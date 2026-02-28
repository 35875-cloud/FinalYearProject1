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

function stringify(value) {
  return JSON.stringify(value);
}

class LandAgreementContract extends Contract {
  agreementKey(ctx, channelId) {
    return ctx.stub.createCompositeKey("agreement", [channelId]);
  }

  successionKey(ctx, successionRequestId) {
    return ctx.stub.createCompositeKey("succession", [successionRequestId]);
  }

  async getState(ctx, key) {
    const data = await ctx.stub.getState(key);
    if (!data || data.length === 0) return null;
    return parseJson(data.toString(), null);
  }

  async putState(ctx, key, value) {
    await ctx.stub.putState(key, Buffer.from(stringify(value)));
    return value;
  }

  async InitLedger() {
    return stringify({ success: true });
  }

  async upsertAgreement(ctx, channelId, agreementJson = "{}") {
    if (!channelId) {
      throw new Error("channelId is required");
    }

    const existing = await this.getState(ctx, this.agreementKey(ctx, channelId));
    const timestamp = nowIso(ctx);
    const payload = typeof agreementJson === "string" ? parseJson(agreementJson, {}) : (agreementJson || {});

    const nextState = {
      recordType: "agreement",
      channelId,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      status: payload.status || existing?.status || "ACTIVE",
      payload: {
        ...(existing?.payload || {}),
        ...payload
      },
      approvals: existing?.approvals || [],
      rejections: existing?.rejections || [],
      finalizedBy: existing?.finalizedBy || null,
      finalizedAt: existing?.finalizedAt || null
    };

    await this.putState(ctx, this.agreementKey(ctx, channelId), nextState);
    return stringify({ success: true, channelId, status: nextState.status });
  }

  async castAgreementVote(ctx, channelId, nodeId, vote, reason = "", voterUserId = "") {
    const normalizedVote = String(vote || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(normalizedVote)) {
      throw new Error("vote must be APPROVE or REJECT");
    }

    const state = await this.getState(ctx, this.agreementKey(ctx, channelId));
    if (!state) {
      throw new Error(`Agreement not found: ${channelId}`);
    }

    const duplicate = [...(state.approvals || []), ...(state.rejections || [])].find(
      (entry) => entry.nodeId === nodeId
    );
    if (duplicate) {
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
    await this.putState(ctx, this.agreementKey(ctx, channelId), state);

    return stringify({
      success: true,
      channelId,
      status: state.status,
      approvals: state.approvals.length,
      rejections: state.rejections.length,
      txId: entry.txId
    });
  }

  async finalizeAgreement(ctx, channelId, dcUserId = "") {
    const state = await this.getState(ctx, this.agreementKey(ctx, channelId));
    if (!state) {
      throw new Error(`Agreement not found: ${channelId}`);
    }

    state.status = "FINALIZED";
    state.finalizedBy = dcUserId || null;
    state.finalizedAt = nowIso(ctx);
    state.updatedAt = state.finalizedAt;

    await this.putState(ctx, this.agreementKey(ctx, channelId), state);
    return stringify({ success: true, channelId, status: state.status, txId: ctx.stub.getTxID() });
  }

  async getAgreement(ctx, channelId) {
    const state = await this.getState(ctx, this.agreementKey(ctx, channelId));
    if (!state) {
      return stringify({ found: false, channelId });
    }

    return stringify({
      found: true,
      ...state,
      approvalsCount: (state.approvals || []).length,
      rejectionsCount: (state.rejections || []).length
    });
  }

  async submitSuccessionCase(ctx, successionRequestId, successionJson = "{}") {
    if (!successionRequestId) {
      throw new Error("successionRequestId is required");
    }

    const existing = await this.getState(ctx, this.successionKey(ctx, successionRequestId));
    const timestamp = nowIso(ctx);
    const payload = typeof successionJson === "string" ? parseJson(successionJson, {}) : (successionJson || {});

    const nextState = {
      recordType: "succession",
      successionRequestId,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      status: payload.status || existing?.status || "SUBMITTED",
      payload: {
        ...(existing?.payload || {}),
        ...payload
      },
      approvals: existing?.approvals || [],
      rejections: existing?.rejections || [],
      finalizedBy: existing?.finalizedBy || null,
      finalizedAt: existing?.finalizedAt || null
    };

    await this.putState(ctx, this.successionKey(ctx, successionRequestId), nextState);
    return stringify({ success: true, successionRequestId, status: nextState.status });
  }

  async castSuccessionVote(ctx, successionRequestId, nodeId, vote, reason = "", voterUserId = "") {
    const normalizedVote = String(vote || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(normalizedVote)) {
      throw new Error("vote must be APPROVE or REJECT");
    }

    const state = await this.getState(ctx, this.successionKey(ctx, successionRequestId));
    if (!state) {
      throw new Error(`Succession case not found: ${successionRequestId}`);
    }

    const duplicate = [...(state.approvals || []), ...(state.rejections || [])].find(
      (entry) => entry.nodeId === nodeId
    );
    if (duplicate) {
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
    await this.putState(ctx, this.successionKey(ctx, successionRequestId), state);

    return stringify({
      success: true,
      successionRequestId,
      status: state.status,
      approvals: state.approvals.length,
      rejections: state.rejections.length,
      txId: entry.txId
    });
  }

  async finalizeSuccessionCase(ctx, successionRequestId, dcUserId = "") {
    const state = await this.getState(ctx, this.successionKey(ctx, successionRequestId));
    if (!state) {
      throw new Error(`Succession case not found: ${successionRequestId}`);
    }

    state.status = "FINALIZED";
    state.finalizedBy = dcUserId || null;
    state.finalizedAt = nowIso(ctx);
    state.updatedAt = state.finalizedAt;

    await this.putState(ctx, this.successionKey(ctx, successionRequestId), state);
    return stringify({
      success: true,
      successionRequestId,
      status: state.status,
      txId: ctx.stub.getTxID()
    });
  }

  async getSuccessionCase(ctx, successionRequestId) {
    const state = await this.getState(ctx, this.successionKey(ctx, successionRequestId));
    if (!state) {
      return stringify({ found: false, successionRequestId });
    }

    return stringify({
      found: true,
      ...state,
      approvalsCount: (state.approvals || []).length,
      rejectionsCount: (state.rejections || []).length
    });
  }
}

module.exports = LandAgreementContract;
