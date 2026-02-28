import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";

import pool from "../config/db.js";
import fabricGatewayService from "../services/fabricGateway.service.js";
import fabricPLRAService from "../services/fabricPLRA.service.js";
import { findNodeByUserId, findNodeFromEmail } from "../config/plraNodes.js";

const router = express.Router();

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "default-jwt-secret");
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: "Invalid token" });
  }
}

function requireRole(allowed) {
  return (req, res, next) => {
    const role = String(req.user?.role || "").toUpperCase();
    if (!allowed.includes(role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
  };
}

async function resolveNodeId(userId) {
  const direct = findNodeByUserId(userId);
  if (direct) return direct.nodeId;

  const result = await pool.query(
    "SELECT email FROM users WHERE user_id = $1 LIMIT 1",
    [userId]
  );
  const emailNode = findNodeFromEmail(result.rows[0]?.email);
  return emailNode?.nodeId || null;
}

async function getCaseDetail(successionRequestId) {
  const detail = await fabricPLRAService.getSuccessionCase(successionRequestId);
  if (!detail) return null;

  const approvals = detail.votes.filter((vote) => String(vote.vote).toUpperCase() === "APPROVE").length;
  const rejections = detail.votes.filter((vote) => String(vote.vote).toUpperCase() === "REJECT").length;

  return {
    ...detail,
    approvals,
    rejections,
    thresholdReached: approvals >= 3,
  };
}

router.get("/cases", authenticateToken, requireRole(["ADMIN", "DC", "LRO", "LAND RECORD OFFICER"]), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM succession_requests
       ORDER BY COALESCE(updated_at, created_at, submitted_at) DESC`
    );

    return res.json({
      success: true,
      cases: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/cases/:successionRequestId", authenticateToken, requireRole(["ADMIN", "DC", "LRO", "LAND RECORD OFFICER"]), async (req, res) => {
  try {
    const detail = await getCaseDetail(req.params.successionRequestId);
    if (!detail) {
      return res.status(404).json({ success: false, message: "Succession case not found" });
    }

    return res.json({ success: true, ...detail });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  "/officer/lro/:successionRequestId/submit",
  authenticateToken,
  requireRole(["LRO", "LAND RECORD OFFICER", "ADMIN"]),
  async (req, res) => {
    try {
      const { successionRequestId } = req.params;

      const updated = await pool.query(
        `UPDATE succession_requests
         SET status = COALESCE(status, 'UNDER_REVIEW'),
             blockchain_status = 'SUBMITTED',
             submitted_to_blockchain_at = COALESCE(submitted_to_blockchain_at, NOW()),
             updated_at = NOW()
         WHERE succession_request_id = $1
         RETURNING *`,
        [successionRequestId]
      );

      if (!updated.rows.length) {
        return res.status(404).json({ success: false, message: "Succession case not found" });
      }

      await pool.query(
        `INSERT INTO succession_events
           (event_id, succession_request_id, event_type, actor_id, actor_role, metadata, notes, created_at)
         VALUES
           ($1, $2, 'SUBMITTED_FOR_LRO_VOTING', $3, $4, $5::jsonb, $6, NOW())`,
        [
          crypto.randomUUID(),
          successionRequestId,
          req.user.userId,
          String(req.user.role || "").toUpperCase(),
          JSON.stringify({ submittedBy: req.user.userId }),
          "Succession case submitted for LRO voting",
        ]
      );

      await fabricGatewayService.submitSuccessionCase(
        successionRequestId,
        {
          status: "SUBMITTED",
          propertyId: updated.rows[0].property_id,
          ownerCnic: updated.rows[0].owner_cnic,
          lroStatus: updated.rows[0].lro_status,
        },
        "LRO_NODE_1"
      );

      return res.json({
        success: true,
        message: "Succession case submitted for voting",
        request: updated.rows[0],
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.post(
  "/officer/lro/:successionRequestId/vote",
  authenticateToken,
  requireRole(["LRO", "LAND RECORD OFFICER", "ADMIN"]),
  async (req, res) => {
    try {
      const { successionRequestId } = req.params;
      const vote = String(req.body.vote || "APPROVE").toUpperCase();
      const reason = String(req.body.reason || "");

      if (!["APPROVE", "REJECT"].includes(vote)) {
        return res.status(400).json({ success: false, message: "Vote must be APPROVE or REJECT" });
      }

      const nodeId = await resolveNodeId(req.user.userId);
      if (!nodeId) {
        return res.status(400).json({ success: false, message: "Unable to resolve LRO node for this user" });
      }

      const requestResult = await pool.query(
        "SELECT * FROM succession_requests WHERE succession_request_id = $1 LIMIT 1",
        [successionRequestId]
      );

      if (!requestResult.rows.length) {
        return res.status(404).json({ success: false, message: "Succession case not found" });
      }

      const existingVote = await pool.query(
        `SELECT *
         FROM succession_votes
         WHERE succession_request_id = $1 AND node_id = $2
         LIMIT 1`,
        [successionRequestId, nodeId]
      );

      if (existingVote.rows.length) {
        return res.status(409).json({
          success: false,
          message: `Node ${nodeId} already voted`,
        });
      }

      const chainResult = await fabricGatewayService.castSuccessionVote(
        successionRequestId,
        nodeId,
        vote,
        reason,
        req.user.userId,
        nodeId
      );
      const syntheticTxId =
        chainResult?.txId ||
        fabricPLRAService.createSyntheticTxId(`${successionRequestId}:${nodeId}:${vote}:${Date.now()}`);

      await pool.query(
        `INSERT INTO succession_votes
           (vote_id, succession_request_id, node_id, vote, reason, tx_id, created_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, NOW())`,
        [crypto.randomUUID(), successionRequestId, nodeId, vote, reason, syntheticTxId]
      );

      await pool.query(
        `INSERT INTO succession_events
           (event_id, succession_request_id, event_type, actor_id, actor_role, metadata, notes, created_at)
         VALUES
           ($1, $2, 'LRO_VOTE_CAST', $3, $4, $5::jsonb, $6, NOW())`,
        [
          crypto.randomUUID(),
          successionRequestId,
          req.user.userId,
          String(req.user.role || "").toUpperCase(),
          JSON.stringify({ nodeId, vote, txId: syntheticTxId }),
          reason || `${vote} vote recorded`,
        ]
      );

      const detail = await getCaseDetail(successionRequestId);

      if (detail?.thresholdReached) {
        await pool.query(
          `UPDATE succession_requests
           SET lro_status = 'APPROVED',
               blockchain_status = 'READY_FOR_DC',
               lro_verified_by = COALESCE(lro_verified_by, $2),
               lro_verified_at = COALESCE(lro_verified_at, NOW()),
               updated_at = NOW()
           WHERE succession_request_id = $1`,
          [successionRequestId, req.user.userId]
        );
      }

      return res.json({
        success: true,
        message: "Vote recorded successfully",
        nodeId,
        chainResult,
        approvals: detail?.approvals || 0,
        rejections: detail?.rejections || 0,
        thresholdReached: detail?.thresholdReached || false,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.post(
  "/officer/dc/:successionRequestId/approve",
  authenticateToken,
  requireRole(["DC", "ADMIN"]),
  async (req, res) => {
    try {
      const { successionRequestId } = req.params;
      const detail = await getCaseDetail(successionRequestId);

      if (!detail) {
        return res.status(404).json({ success: false, message: "Succession case not found" });
      }

      if (!detail.thresholdReached && String(detail.request.lro_status || "").toUpperCase() !== "APPROVED") {
        return res.status(409).json({
          success: false,
          message: "Succession case does not yet have enough LRO approvals",
        });
      }

      const updated = await pool.query(
        `UPDATE succession_requests
         SET status = 'COMPLETED',
             blockchain_status = 'COMPLETED',
             dc_status = 'APPROVED',
             dc_approved_by = $2,
             dc_approved_at = NOW(),
             completed_at = NOW(),
             updated_at = NOW()
         WHERE succession_request_id = $1
         RETURNING *`,
        [successionRequestId, req.user.userId]
      );

      await pool.query(
        `INSERT INTO succession_events
           (event_id, succession_request_id, event_type, actor_id, actor_role, metadata, notes, created_at)
         VALUES
           ($1, $2, 'DC_SUCCESSION_EXECUTED', $3, $4, $5::jsonb, $6, NOW())`,
        [
          crypto.randomUUID(),
          successionRequestId,
          req.user.userId,
          String(req.user.role || "").toUpperCase(),
          JSON.stringify({ approvedBy: req.user.userId }),
          "Deputy Commissioner approved the succession case",
        ]
      );

      const chainResult = await fabricGatewayService.finalizeSuccessionCase(
        successionRequestId,
        req.user.userId,
        "LRO_NODE_1"
      );

      return res.json({
        success: true,
        message: "Succession case approved by DC",
        chainResult,
        request: updated.rows[0],
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

export default router;
