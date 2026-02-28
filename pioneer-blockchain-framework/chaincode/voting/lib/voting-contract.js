"use strict";

const { Contract } = require("fabric-contract-api");

const APPROVAL_THRESHOLD = 3;

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value.low === "number") return value.low;
  return Number(value || 0);
}

function nowIso(ctx) {
  const timestamp = ctx.stub.getTxTimestamp();
  const seconds = toNumber(timestamp.seconds);
  const nanos = toNumber(timestamp.nanos);
  return new Date((seconds * 1000) + Math.floor(nanos / 1000000)).toISOString();
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function stringify(state) {
  return JSON.stringify(state);
}

class VotingContract extends Contract {
  landKey(ctx, propertyId) {
    return ctx.stub.createCompositeKey("landRecord", [propertyId]);
  }

  async recordExists(ctx, propertyId) {
    const data = await ctx.stub.getState(this.landKey(ctx, propertyId));
    return !!data && data.length > 0;
  }

  async getRecordState(ctx, propertyId) {
    const data = await ctx.stub.getState(this.landKey(ctx, propertyId));
    if (!data || data.length === 0) return null;
    return parseJson(data.toString(), null);
  }

  async putRecordState(ctx, state) {
    await ctx.stub.putState(this.landKey(ctx, state.propertyId), Buffer.from(stringify(state)));
    return state;
  }

  async InitLedger() {
    return stringify({ success: true });
  }

  async submitLandRecord(ctx, propertyId, propertyHash, payloadJson = "{}", submittedByNode = "", submittedByUserId = "") {
    if (!propertyId) {
      throw new Error("propertyId is required");
    }

    const existing = await this.getRecordState(ctx, propertyId);
    const timestamp = nowIso(ctx);
    const createdAt = existing?.createdAt || timestamp;
    const payload = typeof payloadJson === "string" ? parseJson(payloadJson, {}) : (payloadJson || {});

    const state = {
      recordType: "landRecord",
      propertyId,
      propertyHash: String(propertyHash || ""),
      payload,
      submittedByNode,
      submittedByUserId,
      createdAt,
      updatedAt: timestamp,
      approvals: [],
      rejections: [],
      status: "SUBMITTED",
      finalizedBy: null,
      finalizedAt: null,
      finalHash: null
    };

    await this.putRecordState(ctx, state);
    return stringify({ success: true, propertyId, status: state.status });
  }

  async castVote(ctx, propertyId, nodeId, vote, reason = "", voterUserId = "") {
    const normalizedVote = String(vote || "").toUpperCase();

    if (!["APPROVE", "REJECT"].includes(normalizedVote)) {
      throw new Error("vote must be APPROVE or REJECT");
    }

    const state = await this.getRecordState(ctx, propertyId);
    if (!state) {
      throw new Error(`Land record not found: ${propertyId}`);
    }

    const alreadyVoted = [...(state.approvals || []), ...(state.rejections || [])].find(
      (entry) => entry.nodeId === nodeId
    );
    if (alreadyVoted) {
      throw new Error(`Node ${nodeId} already voted`);
    }

    const entry = {
      nodeId,
      vote: normalizedVote,
      reason,
      voterUserId,
      votedAt: nowIso(ctx),
      txId: ctx.stub.getTxID()
    };

    if (normalizedVote === "APPROVE") {
      state.approvals = [...(state.approvals || []), entry];
    } else {
      state.rejections = [...(state.rejections || []), entry];
    }

    if ((state.approvals || []).length >= APPROVAL_THRESHOLD) {
      state.status = "READY_FOR_DC";
    } else if ((state.rejections || []).length >= APPROVAL_THRESHOLD) {
      state.status = "REJECTED";
    } else {
      state.status = "VOTING";
    }

    state.updatedAt = nowIso(ctx);
    await this.putRecordState(ctx, state);

    return stringify({
      success: true,
      propertyId,
      nodeId,
      vote: normalizedVote,
      status: state.status,
      approvals: state.approvals.length,
      rejections: state.rejections.length,
      txId: entry.txId
    });
  }

  async finalizeLandRecord(ctx, propertyId, dcUserId = "", finalHash = "") {
    const state = await this.getRecordState(ctx, propertyId);
    if (!state) {
      throw new Error(`Land record not found: ${propertyId}`);
    }

    state.status = "FINALIZED";
    state.finalizedBy = dcUserId || null;
    state.finalizedAt = nowIso(ctx);
    state.finalHash = String(finalHash || state.propertyHash || "");
    state.updatedAt = state.finalizedAt;

    await this.putRecordState(ctx, state);

    return stringify({
      success: true,
      propertyId,
      status: state.status,
      finalHash: state.finalHash,
      finalizedBy: state.finalizedBy,
      finalizedAt: state.finalizedAt,
      txId: ctx.stub.getTxID()
    });
  }

  async getVotingCase(ctx, propertyId) {
    const state = await this.getRecordState(ctx, propertyId);
    if (!state) {
      return stringify({ found: false, propertyId });
    }

    return stringify({
      found: true,
      ...state,
      approvalsCount: (state.approvals || []).length,
      rejectionsCount: (state.rejections || []).length
    });
  }

  async queryLandRecord(ctx, propertyId) {
    return this.getVotingCase(ctx, propertyId);
  }
}

module.exports = VotingContract;
