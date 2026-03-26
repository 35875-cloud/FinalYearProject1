// ═══════════════════════════════════════════════════════════════
//  fabric.service.mock.js
//  FILE LOCATION:  backend/src/services/fabric.service.mock.js
//
//  PURPOSE: Simulates Hyperledger Fabric using PostgreSQL.
//           Zero Docker, zero Fabric install required.
//           Identical function signatures to real fabric.service.js.
//           Switch to real by changing ONE import in blockchain.routes.js.
//
//  CREATES:  mock_blockchain table in your PostgreSQL automatically.
// ═══════════════════════════════════════════════════════════════

import pg from 'pg';

const pool = new pg.Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'landdb',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '6700',
});

// ── Auto-create mock_blockchain table on startup ──────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS mock_blockchain (
    id          SERIAL PRIMARY KEY,
    channel_id  VARCHAR(255) NOT NULL,
    action      VARCHAR(100) NOT NULL,
    actor       VARCHAR(100),
    data        JSONB        DEFAULT '{}',
    tx_id       VARCHAR(100),
    created_at  TIMESTAMPTZ  DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_mock_bc_channel
    ON mock_blockchain(channel_id);
`)
  .then(() => console.log('✅ Mock blockchain ready (PostgreSQL mode)'))
  .catch(e  => console.error('❌ Mock blockchain init error:', e.message));

// ── Helpers ───────────────────────────────────────────────────
const fakeTxId = () =>
  'mock_' + Date.now().toString(16) + Math.random().toString(16).slice(2, 10);

async function addBlock(channelId, action, actor, data = {}) {
  const txId = fakeTxId();
  await pool.query(
    `INSERT INTO mock_blockchain (channel_id, action, actor, data, tx_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [channelId, action, actor, JSON.stringify(data), txId]
  );
  console.log(`🧱 BLOCK [${action}]  channel=${channelId}  by=${actor}  tx=${txId}`);
  return txId;
}

async function getBlocks(channelId) {
  const r = await pool.query(
    `SELECT * FROM mock_blockchain WHERE channel_id = $1 ORDER BY created_at ASC`,
    [channelId]
  );
  return r.rows;
}

// ═══════════════════════════════════════════════════════════════
//  1. recordAgreementOnChain
//     Called automatically by websocket.service.js when both
//     parties click Agree. Writes BLOCK 1.
// ═══════════════════════════════════════════════════════════════
async function recordAgreementOnChain({
  channelId, sellerId, buyerId, propertyId,
  agreementHash, agreedPrice, timestamp,
  transferId
}) {
  try {
    const txId = await addBlock(channelId, 'RECORD_AGREEMENT', 'SYSTEM', {
      agreementHash, agreedPrice, sellerId, buyerId,
      propertyId, transferId, timestamp,
      status: 'AGREED',
    });
    return {
      success: true,
      txId,
      agreementHash,
      message: 'Agreement anchored on mock blockchain',
    };
  } catch (e) {
    console.error('recordAgreementOnChain error:', e.message);
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  2. submitForLROVerification
//     LRO officer clicks "Submit for PoA Voting".
//     Changes status to LRO_PENDING. Writes BLOCK 2.
// ═══════════════════════════════════════════════════════════════
async function submitForLROVerification(channelId, lroOfficerId) {
  try {
    const blocks = await getBlocks(channelId);

    if (!blocks.find(b => b.action === 'RECORD_AGREEMENT')) {
      // Auto-anchor if missing (Fabric may have been down)
      console.log(`⚠  No agreement block for ${channelId} — auto-anchoring...`);
      const row = await pool.query(
        `SELECT tr.channel_id, tr.transfer_id, tr.property_id,
                tr.seller_id, tr.buyer_id, tr.agreed_price,
                tr.agreement_hash, tr.agreement_timestamp
         FROM transfer_requests tr WHERE tr.channel_id = $1`,
        [channelId]
      );
      if (row.rows[0]?.agreement_hash) {
        const r = row.rows[0];
        await addBlock(channelId, 'RECORD_AGREEMENT', 'SYSTEM_RETROACTIVE', {
          agreementHash: r.agreement_hash,
          agreedPrice:   r.agreed_price,
          sellerId:      String(r.seller_id),
          buyerId:       String(r.buyer_id),
          propertyId:    String(r.property_id),
          timestamp:     r.agreement_timestamp,
          status:        'AGREED',
        });
      } else {
        return { success: false, error: 'No agreement hash in database — agreement not completed' };
      }
    }

    // Check not already submitted
    if (blocks.find(b => b.action === 'SUBMIT_FOR_LRO')) {
      return { success: false, error: 'Already submitted for PoA voting' };
    }

    const txId = await addBlock(channelId, 'SUBMIT_FOR_LRO', lroOfficerId, {
      submittedBy: lroOfficerId,
      status:      'LRO_PENDING',
    });

    return { success: true, txId, status: 'LRO_PENDING' };
  } catch (e) {
    console.error('submitForLROVerification error:', e.message);
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  3. castPoAVote
//     Each of 5 LRO nodes votes APPROVE or REJECT.
//     Smart contract logic: 3+ APPROVE → auto LRO_APPROVED
//                           2+ REJECT  → auto LRO_REJECTED
// ═══════════════════════════════════════════════════════════════
async function castPoAVote(channelId, nodeId, vote, reason = '') {
  try {
    const blocks = await getBlocks(channelId);

    // Must be submitted first
    if (!blocks.find(b => b.action === 'SUBMIT_FOR_LRO')) {
      return { success: false, error: 'Case not submitted for PoA yet. Submit first.' };
    }

    // Duplicate vote check — each node can only vote once
    const alreadyVoted = blocks.find(
      b => b.action === 'POA_VOTE' && b.data?.nodeId === nodeId
    );
    if (alreadyVoted) {
      return { success: false, error: `${nodeId} has already voted on this case` };
    }

    // Case must have been submitted
    if (!blocks.find(b => b.action === 'SUBMIT_FOR_LRO')) {
      return { success: false, error: 'Case not submitted for PoA yet. Submit first.' };
    }

    // Write vote block FIRST
    await addBlock(channelId, 'POA_VOTE', nodeId, { nodeId, vote, reason });

    // Count votes fresh from DB (not the stale `blocks` array fetched before this vote)
    const freshBlocks = await getBlocks(channelId);
    const allVoteBlocks = freshBlocks.filter(b => b.action === 'POA_VOTE');
    const approvals  = allVoteBlocks.filter(b => b.data.vote === 'APPROVE').length;
    const rejections = allVoteBlocks.filter(b => b.data.vote === 'REJECT').length;
    const totalVotes = allVoteBlocks.length;

    // Smart contract auto-decision (only fire once — check for existing decision block)
    const alreadyDecided = freshBlocks.find(
      b => b.action === 'AUTO_APPROVED' || b.action === 'AUTO_REJECTED'
    );
    let newStatus = 'LRO_PENDING';

    if (!alreadyDecided) {
      if (approvals >= 3) {
        newStatus = 'LRO_APPROVED';
        await addBlock(channelId, 'AUTO_APPROVED', 'SMART_CONTRACT', {
          approvals, totalVotes, status: 'LRO_APPROVED',
          message: `${approvals}/5 nodes approved — majority reached`,
        });
        console.log(`🎉 SMART CONTRACT: ${channelId} → LRO_APPROVED (${approvals} approvals)`);
      } else if (rejections >= 3) {
        newStatus = 'LRO_REJECTED';
        await addBlock(channelId, 'AUTO_REJECTED', 'SMART_CONTRACT', {
          rejections, totalVotes, status: 'LRO_REJECTED',
          message: `${rejections}/5 nodes rejected`,
        });
        console.log(`❌ SMART CONTRACT: ${channelId} → LRO_REJECTED (${rejections} rejections)`);
      }
    } else {
      // Already decided — keep existing status, just record the additional vote
      newStatus = alreadyDecided.action === 'AUTO_APPROVED' ? 'LRO_APPROVED' : 'LRO_REJECTED';
    }

    return {
      success:    true,
      status:     newStatus,
      approvals,
      rejections,
      totalVotes,
      nodeId,
      vote,
    };
  } catch (e) {
    console.error('castPoAVote error:', e.message);
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  4. executeTransfer
//     DC executes final ownership transfer after LRO_APPROVED.
//     Looks up property/buyer from DB automatically.
//     Writes final BLOCK.
// ═══════════════════════════════════════════════════════════════
async function executeTransfer(channelId, executedBy) {
  try {
    const blocks = await getBlocks(channelId);

    // Must be approved first
    if (!blocks.find(b => b.action === 'AUTO_APPROVED')) {
      return {
        success: false,
        error:   'Transfer blocked — need 3/5 LRO APPROVE votes first (LRO_APPROVED status required)',
      };
    }

    // Check not already transferred
    if (blocks.find(b => b.action === 'OWNERSHIP_TRANSFER')) {
      return { success: false, error: 'Already transferred' };
    }

    // Get property and buyer info from DB
    const row = await pool.query(
      `SELECT tr.property_id, tr.buyer_id, u.name AS buyer_name
       FROM transfer_requests tr
       LEFT JOIN users u ON u.user_id = tr.buyer_id
       WHERE tr.channel_id = $1`,
      [channelId]
    );

    if (!row.rows[0]) {
      return { success: false, error: 'Channel not found in database' };
    }

    const { property_id, buyer_id, buyer_name } = row.rows[0];

    const txId = await addBlock(channelId, 'OWNERSHIP_TRANSFER', executedBy, {
      propertyId:  String(property_id),
      newOwnerId:  String(buyer_id),
      newOwner:    buyer_name,
      executedBy,
      status:      'TRANSFERRED',
      ownership:   `OWN:${property_id}:${buyer_id}`,
    });

    console.log(`✅ TRANSFER COMPLETE: property=${property_id} → owner=${buyer_id}`);

    return {
      success:    true,
      txId,
      propertyId: String(property_id),
      newOwner:   buyer_name || String(buyer_id),
      status:     'TRANSFERRED',
    };
  } catch (e) {
    console.error('executeTransfer error:', e.message);
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  5. verifyAgreementHash
//     Compare DB hash vs blockchain hash → tamper detection.
//     Returns: { verified: bool, dbHash, chainHash }
// ═══════════════════════════════════════════════════════════════
async function verifyAgreementHash(channelId, dbHash) {
  try {
    const blocks   = await getBlocks(channelId);
    const agBlock  = blocks.find(b => b.action === 'RECORD_AGREEMENT');

    if (!agBlock) {
      return { verified: false, integrity: 'NOT_ON_CHAIN', onChain: false };
    }

    const chainHash = agBlock.data?.agreementHash;
    const verified  = chainHash === dbHash;

    return {
      verified,
      onChain:   true,
      integrity: verified ? 'CLEAN' : 'TAMPERED',
      dbHash,
      chainHash,
    };
  } catch (e) {
    console.error('verifyAgreementHash error:', e.message);
    return { verified: false, integrity: 'ERROR', error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  6. getAgreementFromChain
//     Full on-chain record for a channel.
//     Returns: { found: bool, agreement: { ... } }
// ═══════════════════════════════════════════════════════════════
async function getAgreementFromChain(channelId) {
  try {
    const blocks = await getBlocks(channelId);

    if (!blocks.length) {
      return { found: false, agreement: null };
    }

    const agBlock    = blocks.find(b => b.action === 'RECORD_AGREEMENT');
    const poaVotes   = blocks
      .filter(b => b.action === 'POA_VOTE')
      .map(b => ({
        nodeId:    b.data.nodeId,
        vote:      b.data.vote,
        reason:    b.data.reason,
        timestamp: b.created_at,
        txId:      b.tx_id,
      }));
    const transferred = blocks.find(b => b.action === 'OWNERSHIP_TRANSFER');
    const approved    = blocks.find(b => b.action === 'AUTO_APPROVED');
    const rejected    = blocks.find(b => b.action === 'AUTO_REJECTED');

    let status = 'AGREED';
    if (blocks.find(b => b.action === 'SUBMIT_FOR_LRO')) status = 'LRO_PENDING';
    if (approved)                                          status = 'LRO_APPROVED';
    if (rejected)                                          status = 'LRO_REJECTED';
    if (transferred)                                       status = 'TRANSFERRED';

    const approvals  = poaVotes.filter(v => v.vote === 'APPROVE').length;
    const rejections = poaVotes.filter(v => v.vote === 'REJECT').length;

    // ── ENRICH: fetch full buyer/seller/property names from DB ──────
    // The blockchain stores IDs. We join the DB to get human-readable
    // details so the LRO can verify who they are voting on.
    let sellerName = null, sellerCnic = null, sellerFather = null;
    let buyerName  = null, buyerCnic  = null, buyerFather  = null;
    let propertyName = null, district = null, tehsil = null;
    let transferId   = null;

    const sellerId   = agBlock?.data?.sellerId;
    const buyerId    = agBlock?.data?.buyerId;
    const propertyId = agBlock?.data?.propertyId;

    try {
      if (sellerId) {
        const sr = await pool.query(
          `SELECT name, cnic, father_name FROM users WHERE user_id = $1 LIMIT 1`,
          [String(sellerId)]
        );
        if (sr.rows[0]) {
          sellerName   = sr.rows[0].name;
          sellerCnic   = sr.rows[0].cnic;
          sellerFather = sr.rows[0].father_name;
        }
      }
      if (buyerId) {
        const br = await pool.query(
          `SELECT name, cnic, father_name FROM users WHERE user_id = $1 LIMIT 1`,
          [String(buyerId)]
        );
        if (br.rows[0]) {
          buyerName   = br.rows[0].name;
          buyerCnic   = br.rows[0].cnic;
          buyerFather = br.rows[0].father_name;
        }
      }
      if (propertyId) {
        const pr = await pool.query(
          `SELECT fard_no, district, tehsil, mauza, khasra_no, area_marla
           FROM properties WHERE property_id = $1 LIMIT 1`,
          [String(propertyId)]
        );
        if (pr.rows[0]) {
          propertyName = pr.rows[0].fard_no;
          district     = pr.rows[0].district;
          tehsil       = pr.rows[0].tehsil;
        }
      }
      // get transferId too
      const tr = await pool.query(
        `SELECT transfer_id FROM transfer_requests WHERE channel_id = $1 LIMIT 1`,
        [channelId]
      );
      transferId = tr.rows[0]?.transfer_id;
    } catch (enrichErr) {
      console.warn('⚠  getAgreementFromChain enrich warning:', enrichErr.message);
    }

    return {
      found: true,
      agreement: {
        channelId,
        transferId,
        // ── Hash & price (from blockchain, immutable) ──
        agreementHash:  agBlock?.data?.agreementHash,
        agreedPrice:    agBlock?.data?.agreedPrice,
        // ── IDs (from blockchain) ──
        sellerId,
        buyerId,
        propertyId,
        // ── Human-readable names (from DB join, for display) ──
        sellerName,   sellerCnic,   sellerFather,
        buyerName,    buyerCnic,    buyerFather,
        propertyName, district,     tehsil,
        // ── Chain state ──
        status,
        blockchainTxId: agBlock?.tx_id,
        poaVotes,
        approvals,
        rejections,
        ownershipRecord: transferred
          ? `OWN:${transferred.data.propertyId}:${transferred.data.newOwnerId}`
          : null,
        // ── Full immutable ledger trail ──
        history: blocks.map(b => ({
          action:    b.action,
          actor:     b.actor,
          txId:      b.tx_id,
          timestamp: b.created_at,
          data:      b.data,
        })),
      },
    };
  } catch (e) {
    console.error('getAgreementFromChain error:', e.message);
    return { found: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  7. getAgreementHistory
//     Full audit trail of every block for a channel.
// ═══════════════════════════════════════════════════════════════
async function getAgreementHistory(channelId) {
  try {
    const blocks = await getBlocks(channelId);
    return {
      channelId,
      totalBlocks: blocks.length,
      history: blocks.map(b => ({
        blockNumber: b.id,
        action:      b.action,
        actor:       b.actor,
        txId:        b.tx_id,
        timestamp:   b.created_at,
        data:        b.data,
      })),
    };
  } catch (e) {
    console.error('getAgreementHistory error:', e.message);
    return { channelId, totalBlocks: 0, history: [], error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  8. batchTamperScan
//     Scan multiple DB records against blockchain in one call.
// ═══════════════════════════════════════════════════════════════
async function batchTamperScan(rows) {
  const results   = [];
  let clean       = 0;
  let tampered    = 0;
  let notOnChain  = 0;

  for (const row of rows) {
    const check = await verifyAgreementHash(row.channel_id, row.agreement_hash);
    const entry = {
      channelId:  row.channel_id,
      status:     row.channel_status,
      integrity:  check.integrity,
      verified:   check.verified,
      dbHash:     row.agreement_hash?.slice(0, 16) + '...',
      chainHash:  check.chainHash?.slice(0, 16) + '...',
    };
    results.push(entry);

    if (!check.onChain)           notOnChain++;
    else if (check.verified)      clean++;
    else                          tampered++;
  }

  console.log(`🔍 Tamper scan: ${clean} clean, ${tampered} tampered, ${notOnChain} not-on-chain`);

  return {
    scanned:    rows.length,
    clean,
    tampered,
    notOnChain,
    results,
    summary: tampered > 0
      ? `⚠️  ${tampered} record(s) TAMPERED — investigate immediately`
      : `✅ All ${clean} records verified clean`,
  };
}

// ── Default export (matches real fabric.service.js interface) ─
export default {
  recordAgreementOnChain,
  submitForLROVerification,
  castPoAVote,
  executeTransfer,
  verifyAgreementHash,
  getAgreementFromChain,
  getAgreementHistory,
  batchTamperScan,
};