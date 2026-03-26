// ═══════════════════════════════════════════════════════════════════════
//  landRegistryChaincode.js
//  FILE LOCATION: chaincode/landRegistry/landRegistryChaincode.js
//
//  Hyperledger Fabric Chaincode — Punjab Land Registry (Property Registration)
//
//  CONSENSUS: Proof of Authority (PoA)
//    • 5 authorised LRO nodes can vote
//    • Minimum 3/5 votes required for LRO approval
//    • DC makes the final on-chain write (immutable block)
//    • Tamper detection: hash of property data stored at vote-open time
//      If anyone modifies the DB row, the hash comparison fails.
//
//  LEDGER STATE KEYS:
//    REG_{propertyId}         → registration voting record
//    LEDGER_{propertyId}      → immutable final block (written by DC)
//    AUDIT_{propertyId}_{ts}  → append-only audit events
//    CONFIG_LRO_NODES         → authorised LRO node list
//
//  DEPLOY (Hyperledger Fabric v2.x):
//    peer lifecycle chaincode package land-registry.tar.gz \
//      --path ./chaincode/landRegistry \
//      --lang node \
//      --label land-registry_1.0
//
//  REQUIRED: npm install fabric-contract-api fabric-shim
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const { Contract } = require('fabric-contract-api');
const crypto       = require('crypto');

// ── Constants ───────────────────────────────────────────────────────────
const REQUIRED_VOTES  = 3;
const TOTAL_NODES     = 5;
const VOTE_WINDOW_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days

const STATUS = {
  VOTING:       'VOTING',
  LRO_APPROVED: 'LRO_APPROVED',
  LRO_REJECTED: 'LRO_REJECTED',
  FINALIZED:    'FINALIZED',
  EXPIRED:      'EXPIRED',
};

// ── Helper: SHA-256 ─────────────────────────────────────────────────────
function sha256(data) {
  return crypto.createHash('sha256').update(
    typeof data === 'string' ? data : JSON.stringify(data)
  ).digest('hex');
}

// ── Helper: deterministic property hash ─────────────────────────────────
function buildPropertyHash(propertyData) {
  // Only hash fields that define the property — not timestamps / status fields
  const canonical = {
    property_id:  propertyData.property_id,
    owner_cnic:   propertyData.owner_cnic,
    father_name:  propertyData.father_name,
    khewat_no:    propertyData.khewat_no  || propertyData.fard_no,
    khasra_no:    propertyData.khasra_no,
    khatooni_no:  propertyData.khatooni_no,
    area_marla:   propertyData.area_marla,
    district:     propertyData.district,
    tehsil:       propertyData.tehsil,
    mauza:        propertyData.mauza,
    property_type: propertyData.property_type,
  };
  return sha256(JSON.stringify(canonical));
}

// ════════════════════════════════════════════════════════════════════════
//  CONTRACT
// ════════════════════════════════════════════════════════════════════════
class LandRegistryContract extends Contract {

  constructor() {
    super('LandRegistryPoA');
  }

  // ── Initialise ledger with authorised LRO node list ──────────────────
  async initLedger(ctx) {
    const defaultNodes = [
      { nodeId: 'LRO_NODE_1', city: 'Lahore',     active: true },
      { nodeId: 'LRO_NODE_2', city: 'Rawalpindi', active: true },
      { nodeId: 'LRO_NODE_3', city: 'Faisalabad', active: true },
      { nodeId: 'LRO_NODE_4', city: 'Multan',     active: true },
      { nodeId: 'LRO_NODE_5', city: 'Gujranwala', active: true },
    ];
    await ctx.stub.putState(
      'CONFIG_LRO_NODES',
      Buffer.from(JSON.stringify(defaultNodes))
    );
    await this._appendAudit(ctx, 'SYSTEM', 'INIT_LEDGER', {
      message: 'Punjab Land Registry PoA Chaincode initialised',
      nodes: defaultNodes.length,
      requiredVotes: REQUIRED_VOTES,
    });
    return { success: true, message: 'Ledger initialised', nodes: defaultNodes };
  }

  // ─────────────────────────────────────────────────────────────────────
  //  1. SUBMIT PROPERTY FOR PoA VOTING
  //     Called by: LRO who submitted the registration
  //     Effect:    Creates voting record on ledger, hashes property data
  // ─────────────────────────────────────────────────────────────────────
  async submitPropertyForVoting(ctx, propertyId, propertyDataJSON, submittingLroNodeId) {
    const key = `REG_${propertyId}`;

    // Prevent duplicate submissions
    const existing = await ctx.stub.getState(key);
    if (existing && existing.length > 0) {
      const rec = JSON.parse(existing.toString());
      if (rec.status !== STATUS.EXPIRED) {
        throw new Error(`Property ${propertyId} already submitted. Status: ${rec.status}`);
      }
    }

    const propertyData = JSON.parse(propertyDataJSON);
    const propertyHash = buildPropertyHash(propertyData);
    const txTimestamp  = ctx.stub.getTxTimestamp();
    const submittedAt  = new Date(txTimestamp.seconds.low * 1000).toISOString();

    const votingRecord = {
      propertyId,
      propertyHash,           // ← tamper-detection anchor
      status:         STATUS.VOTING,
      submittedBy:    submittingLroNodeId,
      submittedAt,
      expiresAt:      new Date(Date.now() + VOTE_WINDOW_MS).toISOString(),
      votes:          {},     // { nodeId: { vote, reason, timestamp, lroName } }
      approvalCount:  0,
      rejectionCount: 0,
      requiredVotes:  REQUIRED_VOTES,
      totalNodes:     TOTAL_NODES,
      txId:           ctx.stub.getTxID(),
      // Snapshot of property for audit trail
      propertySnapshot: {
        owner_name:    propertyData.owner_name,
        owner_cnic:    propertyData.owner_cnic,
        district:      propertyData.district,
        tehsil:        propertyData.tehsil,
        area_marla:    propertyData.area_marla,
        property_type: propertyData.property_type,
      },
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(votingRecord)));

    await this._appendAudit(ctx, submittingLroNodeId, 'SUBMITTED_FOR_VOTING', {
      propertyId,
      propertyHash,
      txId: ctx.stub.getTxID(),
    });

    // Emit event so off-chain listeners can react
    ctx.stub.setEvent('PropertySubmittedForVoting', Buffer.from(JSON.stringify({
      propertyId, propertyHash, submittedBy: submittingLroNodeId, submittedAt,
    })));

    return JSON.stringify({
      success:      true,
      propertyId,
      propertyHash,
      status:       STATUS.VOTING,
      txId:         ctx.stub.getTxID(),
      message:      `Property ${propertyId} submitted for PoA voting (${REQUIRED_VOTES}/${TOTAL_NODES} required)`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  //  2. CAST VOTE
  //     Called by: Any authorised LRO node (but NOT the submitting LRO)
  //     vote:      'APPROVE' | 'REJECT'
  // ─────────────────────────────────────────────────────────────────────
  async castVote(ctx, propertyId, lroNodeId, vote, reason, lroName) {
    const key = `REG_${propertyId}`;
    const raw = await ctx.stub.getState(key);
    if (!raw || raw.length === 0) {
      throw new Error(`Property ${propertyId} not found on ledger. Submit it for voting first.`);
    }

    const rec = JSON.parse(raw.toString());

    // ── Validation ────────────────────────────────────────────────────
    if (rec.status !== STATUS.VOTING) {
      throw new Error(`Voting closed. Current status: ${rec.status}`);
    }
    if (new Date() > new Date(rec.expiresAt)) {
      rec.status = STATUS.EXPIRED;
      await ctx.stub.putState(key, Buffer.from(JSON.stringify(rec)));
      throw new Error(`Voting window expired at ${rec.expiresAt}`);
    }
    if (rec.submittedBy === lroNodeId) {
      throw new Error(`Submitting LRO (${lroNodeId}) cannot vote on their own submission.`);
    }
    if (rec.votes[lroNodeId]) {
      throw new Error(`Node ${lroNodeId} has already voted on property ${propertyId}.`);
    }
    if (!['APPROVE', 'REJECT'].includes(vote.toUpperCase())) {
      throw new Error(`Invalid vote: ${vote}. Must be APPROVE or REJECT.`);
    }

    // ── Record vote ───────────────────────────────────────────────────
    const txTimestamp = ctx.stub.getTxTimestamp();
    const votedAt     = new Date(txTimestamp.seconds.low * 1000).toISOString();

    rec.votes[lroNodeId] = {
      vote:      vote.toUpperCase(),
      reason:    reason || '',
      votedAt,
      lroName:   lroName || lroNodeId,
      txId:      ctx.stub.getTxID(),
    };

    if (vote.toUpperCase() === 'APPROVE') rec.approvalCount++;
    else rec.rejectionCount++;

    // ── Consensus check ───────────────────────────────────────────────
    let consensusReached = false;
    if (rec.approvalCount >= REQUIRED_VOTES) {
      rec.status        = STATUS.LRO_APPROVED;
      rec.approvedAt    = votedAt;
      consensusReached  = true;
      ctx.stub.setEvent('PropertyPoAApproved', Buffer.from(JSON.stringify({
        propertyId,
        approvalCount: rec.approvalCount,
        votedAt,
      })));
    } else if (rec.rejectionCount > (TOTAL_NODES - REQUIRED_VOTES)) {
      // Mathematically impossible to reach 3 approvals now
      rec.status       = STATUS.LRO_REJECTED;
      rec.rejectedAt   = votedAt;
      consensusReached = true;
      ctx.stub.setEvent('PropertyPoARejected', Buffer.from(JSON.stringify({
        propertyId,
        rejectionCount: rec.rejectionCount,
        votedAt,
      })));
    }

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(rec)));

    await this._appendAudit(ctx, lroNodeId, 'VOTE_CAST', {
      propertyId,
      vote: vote.toUpperCase(),
      reason,
      approvalCount:  rec.approvalCount,
      rejectionCount: rec.rejectionCount,
      newStatus:      rec.status,
    });

    return JSON.stringify({
      success:        true,
      propertyId,
      nodeId:         lroNodeId,
      vote:           vote.toUpperCase(),
      approvalCount:  rec.approvalCount,
      rejectionCount: rec.rejectionCount,
      status:         rec.status,
      consensusReached,
      txId:           ctx.stub.getTxID(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  //  3. DC FINAL APPROVAL — WRITES IMMUTABLE BLOCK
  //     Called by: DC (Deputy Commissioner) only
  //     Effect:    Writes permanent FINALIZED block to ledger
  //                Sets DC approval hash (immutable proof)
  // ─────────────────────────────────────────────────────────────────────
  async dcFinalApprove(ctx, propertyId, dcUserId, dcName, currentPropertyDataJSON) {
    const key = `REG_${propertyId}`;
    const raw = await ctx.stub.getState(key);
    if (!raw || raw.length === 0) {
      throw new Error(`Property ${propertyId} not found on ledger.`);
    }

    const rec          = JSON.parse(raw.toString());
    const currentData  = JSON.parse(currentPropertyDataJSON);
    const currentHash  = buildPropertyHash(currentData);

    // ── Must be LRO_APPROVED first ────────────────────────────────────
    if (rec.status !== STATUS.LRO_APPROVED) {
      throw new Error(
        `DC approval requires LRO_APPROVED status. Current: ${rec.status}. ` +
        `Need ${REQUIRED_VOTES} LRO approvals first.`
      );
    }

    // ── TAMPER CHECK — verify property data wasn't changed since voting ─
    if (currentHash !== rec.propertyHash) {
      const tamperReport = {
        propertyId,
        originalHash: rec.propertyHash,
        currentHash,
        tamperedAt:   new Date().toISOString(),
        detectedBy:   dcUserId,
      };
      await this._appendAudit(ctx, dcUserId, 'TAMPER_DETECTED', tamperReport);
      ctx.stub.setEvent('TamperDetected', Buffer.from(JSON.stringify(tamperReport)));
      throw new Error(
        `⚠️  TAMPER DETECTED for Property ${propertyId}! ` +
        `Original hash: ${rec.propertyHash.slice(0, 16)}... ` +
        `Current hash: ${currentHash.slice(0, 16)}... ` +
        `Property data has been modified after blockchain submission. ` +
        `This property is BLOCKED from approval.`
      );
    }

    // ── Build immutable final block ───────────────────────────────────
    const txTimestamp    = ctx.stub.getTxTimestamp();
    const finalizedAt    = new Date(txTimestamp.seconds.low * 1000).toISOString();
    const finalTxId      = ctx.stub.getTxID();

    // Combine all vote data + DC approval into final block hash
    const blockPayload = {
      propertyId,
      propertyHash:  rec.propertyHash,
      votes:         rec.votes,
      approvalCount: rec.approvalCount,
      dcUserId,
      dcName,
      finalizedAt,
      txId:          finalTxId,
    };
    const blockHash = sha256(JSON.stringify(blockPayload));

    // Update voting record to FINALIZED
    rec.status       = STATUS.FINALIZED;
    rec.finalizedAt  = finalizedAt;
    rec.dcApprovedBy = dcUserId;
    rec.dcName       = dcName;
    rec.finalTxId    = finalTxId;
    rec.finalBlockHash = blockHash;
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(rec)));

    // Write IMMUTABLE LEDGER ENTRY (separate key — never overwritten)
    const ledgerKey   = `LEDGER_${propertyId}`;
    const ledgerBlock = {
      blockType:         'PROPERTY_REGISTRATION',
      propertyId,
      propertyHash:      rec.propertyHash,
      finalBlockHash:    blockHash,
      dcApprovedBy:      dcUserId,
      dcName,
      finalizedAt,
      txId:              finalTxId,
      approvalCount:     rec.approvalCount,
      totalNodes:        TOTAL_NODES,
      requiredVotes:     REQUIRED_VOTES,
      votes:             rec.votes,
      submittedBy:       rec.submittedBy,
      submittedAt:       rec.submittedAt,
      propertySnapshot:  rec.propertySnapshot,
      consensusMechanism: 'Proof-of-Authority (PoA)',
      network:           'Punjab Land Registry Authority (PLRA)',
    };

    // putState for ledger key — this creates an immutable Fabric history entry
    await ctx.stub.putState(ledgerKey, Buffer.from(JSON.stringify(ledgerBlock)));

    await this._appendAudit(ctx, dcUserId, 'DC_FINAL_APPROVED', {
      propertyId,
      blockHash,
      txId: finalTxId,
      integrityCheck: 'PASSED',
    });

    ctx.stub.setEvent('PropertyFinalized', Buffer.from(JSON.stringify({
      propertyId,
      blockHash,
      finalizedAt,
      dcApprovedBy: dcUserId,
    })));

    return JSON.stringify({
      success:        true,
      propertyId,
      status:         STATUS.FINALIZED,
      blockHash,
      finalTxId,
      finalizedAt,
      integrityCheck: 'PASSED',
      message:        `Property ${propertyId} permanently registered on blockchain by DC ${dcName}`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  //  4. VERIFY INTEGRITY (callable by anyone)
  //     Compares currentPropertyDataHash with what was anchored at submit
  // ─────────────────────────────────────────────────────────────────────
  async verifyPropertyIntegrity(ctx, propertyId, currentPropertyDataJSON) {
    const key = `REG_${propertyId}`;
    const raw = await ctx.stub.getState(key);
    if (!raw || raw.length === 0) {
      return JSON.stringify({ success: false, error: `Property ${propertyId} not on ledger` });
    }

    const rec         = JSON.parse(raw.toString());
    const currentData = JSON.parse(currentPropertyDataJSON);
    const currentHash = buildPropertyHash(currentData);
    const intact      = currentHash === rec.propertyHash;

    const result = {
      success:       true,
      propertyId,
      intact,
      integrity:     intact ? 'CLEAN' : 'TAMPERED',
      originalHash:  rec.propertyHash,
      currentHash,
      status:        rec.status,
      submittedAt:   rec.submittedAt,
      approvalCount: rec.approvalCount,
    };

    if (!intact) {
      await this._appendAudit(ctx, 'SYSTEM', 'INTEGRITY_FAILURE', {
        propertyId,
        originalHash: rec.propertyHash,
        currentHash,
      });
    }

    return JSON.stringify(result);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  5. GET PROPERTY RECORD (read-only)
  // ─────────────────────────────────────────────────────────────────────
  async getPropertyRecord(ctx, propertyId) {
    const key = `REG_${propertyId}`;
    const raw = await ctx.stub.getState(key);
    if (!raw || raw.length === 0) {
      return JSON.stringify({ found: false, propertyId });
    }
    return raw.toString();
  }

  // ─────────────────────────────────────────────────────────────────────
  //  6. GET FINAL LEDGER BLOCK (immutable, post-DC-approval)
  // ─────────────────────────────────────────────────────────────────────
  async getFinalLedgerBlock(ctx, propertyId) {
    const key = `LEDGER_${propertyId}`;
    const raw = await ctx.stub.getState(key);
    if (!raw || raw.length === 0) {
      return JSON.stringify({
        found:      false,
        propertyId,
        message:    'No final block yet — DC approval pending',
      });
    }
    return raw.toString();
  }

  // ─────────────────────────────────────────────────────────────────────
  //  7. QUERY ALL VOTING RECORDS (for LRO panel)
  //     Returns all REG_* keys with optional status filter
  // ─────────────────────────────────────────────────────────────────────
  async queryVotingRecords(ctx, statusFilter) {
    const iterator = await ctx.stub.getStateByRange('REG_', 'REG_~');
    const results  = [];

    for await (const { key, value } of iterator) {
      if (!key.startsWith('REG_')) continue;
      const rec = JSON.parse(value.toString());
      if (!statusFilter || statusFilter === 'ALL' || rec.status === statusFilter) {
        results.push(rec);
      }
    }

    return JSON.stringify({ success: true, count: results.length, records: results });
  }

  // ─────────────────────────────────────────────────────────────────────
  //  8. GET AUDIT TRAIL FOR A PROPERTY
  // ─────────────────────────────────────────────────────────────────────
  async getAuditTrail(ctx, propertyId) {
    const prefix   = `AUDIT_${propertyId}_`;
    const iterator = await ctx.stub.getStateByRange(prefix, prefix + '\uFFFF');
    const events   = [];

    for await (const { key, value } of iterator) {
      events.push(JSON.parse(value.toString()));
    }

    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return JSON.stringify({ success: true, propertyId, auditTrail: events });
  }

  // ─────────────────────────────────────────────────────────────────────
  //  9. SCAN ALL PROPERTIES FOR TAMPERING (batch integrity check)
  // ─────────────────────────────────────────────────────────────────────
  async batchIntegrityScan(ctx, propertyDataListJSON) {
    const list    = JSON.parse(propertyDataListJSON);
    const results = { clean: [], tampered: [], notOnChain: [] };

    for (const prop of list) {
      const key = `REG_${prop.property_id}`;
      const raw = await ctx.stub.getState(key);
      if (!raw || raw.length === 0) {
        results.notOnChain.push(prop.property_id);
        continue;
      }
      const rec         = JSON.parse(raw.toString());
      const currentHash = buildPropertyHash(prop);
      if (currentHash === rec.propertyHash) {
        results.clean.push(prop.property_id);
      } else {
        results.tampered.push({
          propertyId:    prop.property_id,
          originalHash:  rec.propertyHash,
          currentHash,
          status:        rec.status,
        });
      }
    }

    return JSON.stringify({
      success:    true,
      summary:    {
        clean:      results.clean.length,
        tampered:   results.tampered.length,
        notOnChain: results.notOnChain.length,
      },
      results,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PRIVATE: append immutable audit event
  // ─────────────────────────────────────────────────────────────────────
  async _appendAudit(ctx, actor, eventType, data) {
    const ts       = Date.now();
    const txId     = ctx.stub.getTxID();
    const auditKey = `AUDIT_${data.propertyId || 'SYSTEM'}_${ts}_${txId.slice(0, 8)}`;

    const auditEntry = {
      eventType,
      actor,
      timestamp: new Date(ts).toISOString(),
      txId,
      data,
    };

    await ctx.stub.putState(auditKey, Buffer.from(JSON.stringify(auditEntry)));
  }
}

module.exports = { contracts: [LandRegistryContract] };