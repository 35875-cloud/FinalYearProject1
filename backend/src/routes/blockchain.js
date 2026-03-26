// =====================================================
// BLOCKCHAIN ROUTES - Complete Implementation
// Location: backend/src/routes/blockchain.js
// =====================================================

import express from 'express';
import blockchainService from '../services/blockchain.service.js';
import tamperingService from '../services/blockchainTampering.service.js';
import jwt from 'jsonwebtoken';
import pkg from 'pg';
import fabricService from '../services/fabric.service.mock.js';
import wsService from '../services/websocket.service.js';

const { Pool } = pkg;
const pool2 = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'landdb',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '6700',
});

const router = express.Router();

// =====================================================
// MIDDLEWARE - JWT Authentication
// =====================================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-jwt-secret");
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: "Invalid token" });
    }
}

// Admin-only middleware
function requireAdmin(req, res, next) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'LRO') {
        return res.status(403).json({ success: false, message: "Admin access required" });
    }
    next();
}

// Optional authentication middleware (allows anonymous access)
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-jwt-secret");
            req.user = decoded;
        } catch (err) {
            // Invalid token, but continue without user
            req.user = null;
        }
    } else {
        req.user = null;
    }
    next();
}

// =====================================================
// 1️⃣ MINE NEW BLOCK (Add Property to Blockchain)
// =====================================================
router.post('/mine', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { propertyId } = req.body;
        const adminId = req.user.userId;

        console.log("\n⛏️ ========================================");
        console.log("⛏️  MINING NEW BLOCK");
        console.log("⛏️ ========================================");
        console.log("Property ID:", propertyId);
        console.log("Admin ID:", adminId);

        if (!propertyId) {
            return res.status(400).json({ 
                success: false, 
                message: "Property ID is required" 
            });
        }

        // Get property details from database
        const propertyData = await blockchainService.getPropertyData(propertyId);
        
        if (!propertyData) {
            return res.status(404).json({ 
                success: false, 
                message: "Property not found" 
            });
        }

        // Mine the block (Proof of Work)
        const startTime = Date.now();
        const newBlock = await blockchainService.mineBlock(propertyData, adminId);
        const miningTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log("✅ Block mined successfully!");
        console.log("Block Index:", newBlock.block_index);
        console.log("Block Hash:", newBlock.blockchain_hash);
        console.log("Mining Time:", miningTime, "seconds");
        console.log("Nonce:", newBlock.nonce);
        console.log("⛏️ ========================================\n");

        res.json({
            success: true,
            message: "Property successfully added to blockchain",
            block: {
                block_index: newBlock.block_index,
                property_id: newBlock.property_id,
                blockchain_hash: newBlock.blockchain_hash,
                previous_hash: newBlock.previous_hash,
                nonce: newBlock.nonce,
                mined_by: newBlock.mined_by,
                mined_at: newBlock.mined_at,
                transaction_data: newBlock.transaction_data,
                mining_time: miningTime + " seconds"
            }
        });

    } catch (err) {
        console.error("❌ Mining Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Mining failed: " + err.message 
        });
    }
});

// =====================================================
// 2️⃣ GET FULL BLOCKCHAIN (Blockchain Explorer)
// =====================================================
router.get("/explorer", optionalAuth, async (req, res) => {
    try {
        console.log("\n🔍 ========================================");
        console.log("🔍 BLOCKCHAIN EXPLORER - LOADING FULL CHAIN");
        console.log("🔍 ========================================");

        const chain = await blockchainService.getFullChain();
        
        console.log("✅ Blockchain loaded successfully");
        console.log("Total Blocks:", chain.length);
        console.log("🔍 ========================================\n");

        // Verify blockchain integrity
        const isValid = await blockchainService.verifyChain();

        res.json({
            success: true,
            total_blocks: chain.length,
            blockchain_valid: isValid,
            chain: chain.map(block => ({
                block_index: block.block_index,
                property_id: block.property_id,
                blockchain_hash: block.blockchain_hash,
                previous_hash: block.previous_hash,
                nonce: block.nonce,
                mined_by: block.mined_by,
                mined_at: block.mined_at,
                transaction_data: block.transaction_data
            }))
        });

    } catch (err) {
        console.error("❌ Explorer Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Failed to load blockchain: " + err.message 
        });
    }
});

// =====================================================
// 3️⃣ TRACE PROPERTY HISTORY (Property-specific blocks)
// =====================================================
router.get("/trace/:propertyId", optionalAuth, async (req, res) => {
    try {
        const { propertyId } = req.params;

        console.log("\n🔎 ========================================");
        console.log("🔎 TRACING PROPERTY HISTORY");
        console.log("🔎 ========================================");
        console.log("Property ID:", propertyId);

        const history = await blockchainService.getPropertyHistory(propertyId);

        console.log("✅ Found", history.length, "block(s) for this property");
        console.log("🔎 ========================================\n");

        if (history.length === 0) {
            return res.json({
                success: true,
                message: "No blockchain records found for this property",
                property_id: propertyId,
                blocks: []
            });
        }

        res.json({ 
            success: true,
            property_id: propertyId,
            total_blocks: history.length,
            blocks: history.map(block => ({
                block_index: block.block_index,
                blockchain_hash: block.blockchain_hash,
                previous_hash: block.previous_hash,
                nonce: block.nonce,
                mined_by: block.mined_by,
                mined_at: block.mined_at,
                transaction_data: block.transaction_data
            }))
        });

    } catch (err) {
        console.error("❌ Trace Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Failed to trace property: " + err.message 
        });
    }
});

// =====================================================
// 4️⃣ GET BLOCKCHAIN STATISTICS
// =====================================================
router.get("/stats", optionalAuth, async (req, res) => {
    try {
        const stats = await blockchainService.getBlockchainStats();
        
        res.json({
            success: true,
            statistics: stats
        });

    } catch (err) {
        console.error("❌ Stats Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Failed to load statistics: " + err.message 
        });
    }
});

// =====================================================
// 5️⃣ VERIFY BLOCKCHAIN INTEGRITY
// =====================================================
router.get('/verify', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log("\n🔒 ========================================");
        console.log("🔒 VERIFYING BLOCKCHAIN INTEGRITY");
        console.log("🔒 ========================================");

        const verification = await blockchainService.verifyChainDetailed();

        console.log("Blockchain Valid:", verification.isValid);
        console.log("Total Blocks Verified:", verification.totalBlocks);
        
        if (!verification.isValid) {
            console.log("❌ Invalid Blocks:", verification.invalidBlocks.length);
        }
        
        console.log("🔒 ========================================\n");

        res.json({
            success: true,
            verification
        });

    } catch (err) {
        console.error("❌ Verification Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Verification failed: " + err.message 
        });
    }
});

// =====================================================
// 6️⃣ GET SINGLE BLOCK BY INDEX
// =====================================================
router.get("/block/:blockIndex", optionalAuth, async (req, res) => {
    try {
        const { blockIndex } = req.params;
        const block = await blockchainService.getBlockByIndex(parseInt(blockIndex));

        if (!block) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }

        res.json({
            success: true,
            block: {
                block_index: block.block_index,
                property_id: block.property_id,
                blockchain_hash: block.blockchain_hash,
                previous_hash: block.previous_hash,
                nonce: block.nonce,
                mined_by: block.mined_by,
                mined_at: block.mined_at,
                transaction_data: block.transaction_data
            }
        });

    } catch (err) {
        console.error("❌ Block Fetch Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Failed to fetch block: " + err.message 
        });
    }
});

// =====================================================
// 🔐 TAMPERING DETECTION & TESTING ROUTES
// =====================================================

// 1️⃣ Detect Tampering
router.get('/tampering/detect', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await tamperingService.detectTampering();
        res.json({ success: true, ...result });
    } catch (err) {
        console.error("❌ Detection Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2️⃣ Simulate Tampering
router.post('/tampering/simulate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { blockIndex, tamperingType } = req.body;

        if (!blockIndex && blockIndex !== 0) {
            return res.status(400).json({ success: false, message: "Block index required" });
        }

        const validTypes = ['MODIFY_DATA', 'CHANGE_HASH', 'BREAK_CHAIN', 'MODIFY_NONCE'];
        const type = tamperingType || 'MODIFY_DATA';

        if (!validTypes.includes(type)) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid type. Use: ${validTypes.join(', ')}` 
            });
        }

        const result = await tamperingService.simulateTampering(blockIndex, type);
        res.json({ success: true, message: `Block ${blockIndex} tampered (${type})`, ...result });

    } catch (err) {
        console.error("❌ Tampering Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3️⃣ Restore Block
router.post('/tampering/restore/:blockIndex', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const blockIndex = parseInt(req.params.blockIndex);

        if (isNaN(blockIndex)) {
            return res.status(400).json({ success: false, message: "Invalid block index" });
        }

        const result = await tamperingService.restoreBlock(blockIndex);
        res.json({ success: true, message: `Block ${blockIndex} restored`, ...result });

    } catch (err) {
        console.error("❌ Restoration Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4️⃣ Compare Hashes
router.get('/tampering/compare/:blockIndex', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const blockIndex = parseInt(req.params.blockIndex);

        if (isNaN(blockIndex)) {
            return res.status(400).json({ success: false, message: "Invalid block index" });
        }

        const result = await tamperingService.compareHashes(blockIndex);
        res.json({ success: true, ...result });

    } catch (err) {
        console.error("❌ Comparison Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5️⃣ Tampering Info
router.get('/tampering/info', authenticateToken, requireAdmin, async (req, res) => {
    res.json({
        success: true,
        message: "Blockchain Tampering Test Tool",
        endpoints: {
            detect: "GET /api/blockchain/tampering/detect",
            simulate: "POST /api/blockchain/tampering/simulate",
            restore: "POST /api/blockchain/tampering/restore/:blockIndex",
            compare: "GET /api/blockchain/tampering/compare/:blockIndex"
        },
        tamperingTypes: [
            "MODIFY_DATA - Change transaction data",
            "CHANGE_HASH - Modify blockchain hash",
            "BREAK_CHAIN - Break chain linkage",
            "MODIFY_NONCE - Change nonce value"
        ],
        example: {
            simulate: {
                url: "POST /api/blockchain/tampering/simulate",
                body: { blockIndex: 1, tamperingType: "MODIFY_DATA" }
            }
        }
    });
});


// ═══════════════════════════════════════════════════════════════
//  PoA VOTING ROUTES  (called by LROVotingPanel.jsx)
// ═══════════════════════════════════════════════════════════════

function requireLROorDC(req, res, next) {
  const role = (req.user?.role || '').toUpperCase();
  if (!['LRO','DC','ADMIN','LAND RECORD OFFICER','DEPUTY COMMISSIONER'].includes(role)) {
    return res.status(403).json({ success: false, error: 'LRO or DC role required' });
  }
  next();
}

// GET /api/blockchain/lro/cases  - all AGREED+ cases for LROVotingPanel
router.get('/lro/cases', authenticateToken, requireLROorDC, async (req, res) => {
  try {
    const result = await pool2.query(`
      SELECT
        tr.channel_id, tr.transfer_id, tr.property_id,
        tr.seller_id,  tr.buyer_id,    tr.agreed_price,
        tr.agreement_hash, tr.agreement_timestamp,
        tr.channel_status, tr.seller_agreed, tr.buyer_agreed,
        seller.name  AS seller_name, seller.cnic AS seller_cnic,
        buyer.name   AS buyer_name,  buyer.cnic  AS buyer_cnic,
        p.district, p.mauza, p.khasra_no, p.fard_no, p.area_marla
      FROM transfer_requests tr
      LEFT JOIN users      seller ON seller.user_id   = tr.seller_id
      LEFT JOIN users      buyer  ON buyer.user_id    = tr.buyer_id
      LEFT JOIN properties p      ON p.property_id   = tr.property_id
      WHERE tr.agreement_hash IS NOT NULL
        AND tr.channel_status IN ('AGREED','LRO_PENDING','LRO_APPROVED','LRO_REJECTED','TRANSFERRED')
      ORDER BY tr.agreement_timestamp DESC
      LIMIT 100
    `);
    res.json({ success: true, cases: result.rows });
  } catch (err) {
    console.error('GET /lro/cases error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/blockchain/agreement/:channelId
// Returns full case details including buyer/seller names for LRO voting panel
router.get('/agreement/:channelId', authenticateToken, requireLROorDC, async (req, res) => {
  try {
    const { channelId } = req.params;

    // ── Fetch DB record with full buyer/seller/property info ──
    const dbRow = await pool2.query(
      `SELECT
         tr.channel_id, tr.transfer_id, tr.property_id,
         tr.seller_id,  tr.buyer_id,    tr.agreed_price,
         tr.agreement_hash, tr.agreement_timestamp,
         tr.channel_status, tr.seller_agreed, tr.buyer_agreed,
         seller.name        AS seller_name,
         seller.cnic        AS seller_cnic,
         seller.father_name AS seller_father,
         buyer.name         AS buyer_name,
         buyer.cnic         AS buyer_cnic,
         buyer.father_name  AS buyer_father,
         p.fard_no,
         p.district,
         p.tehsil,
         p.mauza,
         p.khasra_no,
         p.area_marla
       FROM transfer_requests tr
       LEFT JOIN users      seller ON seller.user_id   = tr.seller_id
       LEFT JOIN users      buyer  ON buyer.user_id    = tr.buyer_id
       LEFT JOIN properties p      ON p.property_id   = tr.property_id
       WHERE tr.channel_id = $1`,
      [channelId]
    );
    const db = dbRow.rows[0] || null;

    // ── Fetch blockchain record (now includes enriched names) ──
    const chainRecord = await fabricService.getAgreementFromChain(channelId);

    // ── Tamper check: compare DB hash vs chain hash ──
    let tamperCheck = null;
    if (db?.agreement_hash) {
      tamperCheck = await fabricService.verifyAgreementHash(channelId, db.agreement_hash);
    }

    const integrity = tamperCheck
      ? (tamperCheck.verified ? 'CLEAN' : 'TAMPERED')
      : (chainRecord.found    ? 'NOT_VERIFIED' : 'NOT_ON_CHAIN');

    // If tampered - log alert
    if (integrity === 'TAMPERED') {
      console.error(`⚠️  TAMPER ALERT: channel=\${channelId}  DB_hash=\${db.agreement_hash?.slice(0,16)}  chain_hash=\${tamperCheck?.chainHash?.slice(0,16)}`);
    }

    res.json({
      success:    true,
      channelId,
      database:   db,
      blockchain: chainRecord.agreement || null,
      onChain:    chainRecord.found,
      tamperCheck,
      integrity,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/blockchain/history/:channelId
router.get('/history/:channelId', authenticateToken, requireLROorDC, async (req, res) => {
  try {
    const result = await fabricService.getAgreementHistory(req.params.channelId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/blockchain/verify/:channelId
router.get('/verify/:channelId', authenticateToken, requireLROorDC, async (req, res) => {
  try {
    const { channelId } = req.params;
    const dbRow = await pool2.query(
      'SELECT agreement_hash FROM transfer_requests WHERE channel_id = $1', [channelId]
    );
    if (!dbRow.rows[0]?.agreement_hash) {
      return res.json({ success: false, onChain: false, integrity: 'NO_HASH',
        error: 'No agreement hash - both parties must agree first' });
    }
    const result = await fabricService.verifyAgreementHash(channelId, dbRow.rows[0].agreement_hash);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/blockchain/retry-anchor/:channelId
router.post('/retry-anchor/:channelId', authenticateToken, requireLROorDC, async (req, res) => {
  try {
    const { channelId } = req.params;
    const dbRow = await pool2.query(
      `SELECT tr.channel_id, tr.transfer_id, tr.property_id,
              tr.seller_id, tr.buyer_id, tr.agreed_price,
              tr.agreement_hash, tr.agreement_timestamp
       FROM transfer_requests tr WHERE tr.channel_id = $1`, [channelId]
    );
    const row = dbRow.rows[0];
    if (!row) return res.status(404).json({ success: false, error: 'Channel not found' });
    if (!row.agreement_hash) return res.status(400).json({ success: false, error: 'No hash yet - both parties must agree first' });
    const existing = await fabricService.getAgreementFromChain(channelId);
    if (existing.found) return res.json({ success: true, message: 'Already on chain', txId: existing.agreement?.blockchainTxId });
    const result = await fabricService.recordAgreementOnChain({
      channelId, transferId: row.transfer_id, propertyId: String(row.property_id),
      sellerId: String(row.seller_id), buyerId: String(row.buyer_id),
      agreedPrice: row.agreed_price, agreementHash: row.agreement_hash,
      timestamp: row.agreement_timestamp?.toISOString() || new Date().toISOString(),
    });
    res.json({ success: result.success, txId: result.txId, agreementHash: result.agreementHash, error: result.error });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/blockchain/lro/submit/:channelId
router.post('/lro/submit/:channelId', authenticateToken, requireLROorDC, async (req, res) => {
  try {
    const { channelId } = req.params;
    const check = await pool2.query(
      'SELECT channel_status, agreement_hash FROM transfer_requests WHERE channel_id = $1', [channelId]
    );
    if (!check.rows[0]) return res.status(404).json({ success: false, error: 'Channel not found' });
    if (check.rows[0].channel_status !== 'AGREED')
      return res.status(400).json({ success: false, error: `Status is ${check.rows[0].channel_status} - can only submit AGREED cases` });
    const result = await fabricService.submitForLROVerification(channelId, String(req.user.userId));
    if (result.success) {
      await pool2.query("UPDATE transfer_requests SET channel_status = 'LRO_PENDING' WHERE channel_id = $1", [channelId]);
    }
    res.json({ success: result.success, txId: result.txId, status: result.status, error: result.error });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/blockchain/lro/vote/:channelId
router.post('/lro/vote/:channelId', authenticateToken, requireLROorDC, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { vote, reason, nodeId: bodyNodeId } = req.body;
    const nodeId = req.user.lroNodeId || bodyNodeId;
    if (!nodeId) return res.status(400).json({ success: false, error: 'No LRO node ID. Your account must have lro_node_id set in the database.' });
    if (!vote || !['APPROVE','REJECT'].includes(vote.toUpperCase()))
      return res.status(400).json({ success: false, error: 'vote must be APPROVE or REJECT' });
    const check = await pool2.query('SELECT channel_status FROM transfer_requests WHERE channel_id = $1', [channelId]);
    if (check.rows[0]?.channel_status !== 'LRO_PENDING')
      return res.status(400).json({ success: false, error: `Cannot vote - status is ${check.rows[0]?.channel_status}. Case must be LRO_PENDING.` });
    const result = await fabricService.castPoAVote(channelId, nodeId, vote.toUpperCase(), reason || '');
    if (result.success && result.status) {
      await pool2.query('UPDATE transfer_requests SET channel_status = $2 WHERE channel_id = $1', [channelId, result.status]);
      try {
        const eventName = result.status === 'LRO_APPROVED' ? 'poa_approved' :
                          result.status === 'LRO_REJECTED' ? 'poa_rejected' : 'poa_vote_cast';
        if (wsService?.emitToChannel) wsService.emitToChannel(channelId, eventName, {
          channelId, nodeId, vote: vote.toUpperCase(),
          approvals: result.approvals, rejections: result.rejections,
          status: result.status, timestamp: new Date(),
        });
      } catch(wsErr) { /* non-fatal */ }
    }
    res.json({ success: result.success, txId: result.txId, nodeId, vote: vote.toUpperCase(),
      approvals: result.approvals, rejections: result.rejections, status: result.status, error: result.error });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/blockchain/lro/transfer/:channelId
router.post('/lro/transfer/:channelId', authenticateToken, requireLROorDC, async (req, res) => {
  try {
    const { channelId } = req.params;
    const check = await pool2.query('SELECT channel_status FROM transfer_requests WHERE channel_id = $1', [channelId]);
    if (check.rows[0]?.channel_status !== 'LRO_APPROVED')
      return res.status(400).json({ success: false, error: `Cannot transfer - need LRO_APPROVED. Current: ${check.rows[0]?.channel_status}` });
    const result = await fabricService.executeTransfer(channelId, String(req.user.userId));
    if (result.success) {
      await pool2.query("UPDATE transfer_requests SET channel_status = 'TRANSFERRED' WHERE channel_id = $1", [channelId]);
      await pool2.query(
        `UPDATE properties SET owner_id = (SELECT buyer_id FROM transfer_requests WHERE channel_id = $1)
         WHERE property_id = (SELECT property_id FROM transfer_requests WHERE channel_id = $1)`, [channelId]
      );
      try {
        if (wsService?.emitToChannel) wsService.emitToChannel(channelId, 'transfer_executed', {
          channelId, propertyId: result.propertyId, newOwner: result.newOwner,
          txId: result.txId, timestamp: new Date(),
        });
      } catch(wsErr) { /* non-fatal */ }
    }
    res.json({ success: result.success, txId: result.txId, propertyId: result.propertyId,
      newOwner: result.newOwner, status: result.status, error: result.error });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


export default router;