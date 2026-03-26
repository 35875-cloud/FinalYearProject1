// ═══════════════════════════════════════════════════════════════
//  blockchain.routes.js
//  FILE LOCATION:  backend/src/routes/blockchain.routes.js
//
//  REGISTER IN server.js:
//    import blockchainRouter from './routes/blockchain.routes.js';
//    app.use('/api/blockchain', blockchainRouter);
//
//  ALL ENDPOINTS:
//    GET  /api/blockchain/lro/cases              → LRO panel case list
//    GET  /api/blockchain/agreement/:channelId   → full on-chain record
//    GET  /api/blockchain/history/:channelId     → audit trail
//    GET  /api/blockchain/verify/:channelId      → quick tamper check
//    POST /api/blockchain/retry-anchor/:channelId → re-anchor if Fabric was down
//    POST /api/blockchain/tamper-scan            → scan all DB hashes vs chain
//    POST /api/blockchain/lro/submit/:channelId  → AGREED → LRO_PENDING
//    POST /api/blockchain/lro/vote/:channelId    → cast PoA vote
//    POST /api/blockchain/lro/transfer/:channelId → DC executes transfer
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import jwt     from 'jsonwebtoken';
import pg      from 'pg';

// ── SWITCH HERE: mock (no Docker) vs real Fabric ──────────────
import fabricService from '../services/fabric.service.mock.js';
// import fabricService from '../services/fabric.service.js';  // ← for production

import wsService from '../services/websocket.service.js';

const router = express.Router();

const pool = new pg.Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'landdb',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '6700',
});

// ── Auth middleware ───────────────────────────────────────────
const auth = (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : header;
    if (!token) return res.status(401).json({ success: false, error: 'No token provided' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'default-jwt-secret');
    next();
  } catch (e) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

// ── Role check ────────────────────────────────────────────────
const requireLRO = (req, res, next) => {
  const role = (req.user?.role || '').toUpperCase();
  if (!['LRO', 'DC', 'ADMIN', 'LAND RECORD OFFICER', 'DEPUTY COMMISSIONER'].includes(role)) {
    return res.status(403).json({ success: false, error: 'LRO or DC role required' });
  }
  next();
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/blockchain/lro/cases
//  Returns all cases with agreement_hash (AGREED and beyond).
//  This feeds OfficerPendingTransfers and LROVotingPanel.
// ═══════════════════════════════════════════════════════════════
router.get('/lro/cases', auth, requireLRO, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        tr.channel_id,
        tr.transfer_id,
        tr.property_id,
        tr.seller_id,
        tr.buyer_id,
        tr.agreed_price,
        tr.agreement_hash,
        tr.agreement_timestamp,
        tr.channel_status,
        tr.seller_agreed,
        tr.buyer_agreed,
        seller.name  AS seller_name,
        seller.cnic  AS seller_cnic,
        buyer.name   AS buyer_name,
        buyer.cnic   AS buyer_cnic,
        p.district,
        p.property_name
      FROM transfer_requests tr
      LEFT JOIN users       seller ON seller.user_id    = tr.seller_id
      LEFT JOIN users       buyer  ON buyer.user_id     = tr.buyer_id
      LEFT JOIN properties  p      ON p.property_id     = tr.property_id
      WHERE tr.agreement_hash IS NOT NULL
        AND tr.channel_status IN (
          'AGREED', 'LRO_PENDING', 'LRO_APPROVED', 'LRO_REJECTED', 'FROZEN', 'TRANSFERRED'
        )
      ORDER BY tr.agreement_timestamp DESC
      LIMIT 100
    `);

    res.json({ success: true, cases: result.rows });
  } catch (err) {
    console.error('GET /lro/cases error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/blockchain/agreement/:channelId
//  Full on-chain record + tamper check.
//  Used by LROVotingPanel to display blockchain details.
// ═══════════════════════════════════════════════════════════════
router.get('/agreement/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const { channelId } = req.params;

    // DB record
    const dbRow = await pool.query(
      `SELECT tr.channel_id, tr.transfer_id, tr.property_id,
              tr.seller_id, tr.buyer_id, tr.agreed_price,
              tr.agreement_hash, tr.agreement_timestamp,
              tr.channel_status, tr.seller_agreed, tr.buyer_agreed
       FROM transfer_requests tr WHERE tr.channel_id = $1`,
      [channelId]
    );
    const db = dbRow.rows[0] || null;

    // Chain record
    const chainRecord = await fabricService.getAgreementFromChain(channelId);

    // Tamper check
    let tamperCheck = null;
    if (db?.agreement_hash) {
      tamperCheck = await fabricService.verifyAgreementHash(channelId, db.agreement_hash);
    }

    // Also fetch votes from persistent poa_votes table
    const dbVotes = await pool.query(
      `SELECT node_id, vote, reason, tx_id, created_at
         FROM poa_votes WHERE channel_id = $1 ORDER BY created_at ASC`,
      [channelId]
    );
    if (chainRecord.found && chainRecord.agreement) {
      chainRecord.agreement.poaVotes   = dbVotes.rows.length ? dbVotes.rows : (chainRecord.agreement.poaVotes || []);
      chainRecord.agreement.approvals  = dbVotes.rows.filter(v => v.vote === 'APPROVE').length;
      chainRecord.agreement.rejections = dbVotes.rows.filter(v => v.vote === 'REJECT').length;
    }

    res.json({
      success:    true,
      channelId,
      database:   db,
      blockchain: chainRecord.agreement || null,
      onChain:    chainRecord.found,
      tamperCheck,
      integrity: tamperCheck
        ? (tamperCheck.verified ? 'CLEAN' : 'TAMPERED')
        : (chainRecord.found    ? 'NOT_VERIFIED' : 'NOT_ON_CHAIN'),
    });
  } catch (err) {
    console.error('GET /agreement error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/blockchain/history/:channelId
//  Full audit trail — every block that touched this agreement.
// ═══════════════════════════════════════════════════════════════
router.get('/history/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const result = await fabricService.getAgreementHistory(req.params.channelId);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('GET /history error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/blockchain/verify/:channelId
//  Quick tamper check only — compare DB hash vs chain hash.
// ═══════════════════════════════════════════════════════════════
router.get('/verify/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const { channelId } = req.params;

    const dbRow = await pool.query(
      'SELECT agreement_hash FROM transfer_requests WHERE channel_id = $1',
      [channelId]
    );

    if (!dbRow.rows[0]?.agreement_hash) {
      return res.json({
        success:   false,
        onChain:   false,
        integrity: 'NO_HASH',
        error:     'No agreement hash in database — agreement not completed yet',
      });
    }

    const result = await fabricService.verifyAgreementHash(channelId, dbRow.rows[0].agreement_hash);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('GET /verify error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/blockchain/retry-anchor/:channelId
//  If Fabric was down when agreement was made, re-anchor now.
// ═══════════════════════════════════════════════════════════════
router.post('/retry-anchor/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const { channelId } = req.params;

    const dbRow = await pool.query(
      `SELECT tr.channel_id, tr.transfer_id, tr.property_id,
              tr.seller_id, tr.buyer_id, tr.agreed_price,
              tr.agreement_hash, tr.agreement_timestamp
       FROM transfer_requests tr WHERE tr.channel_id = $1`,
      [channelId]
    );

    const row = dbRow.rows[0];
    if (!row)              return res.status(404).json({ success: false, error: 'Channel not found' });
    if (!row.agreement_hash)
      return res.status(400).json({ success: false, error: 'No agreement hash — both parties must agree first' });

    // Check if already on chain
    const existing = await fabricService.getAgreementFromChain(channelId);
    if (existing.found) {
      return res.json({
        success: true,
        message: 'Already on chain — no action needed',
        txId:    existing.agreement?.blockchainTxId,
      });
    }

    const result = await fabricService.recordAgreementOnChain({
      channelId,
      transferId:    row.transfer_id,
      propertyId:    String(row.property_id),
      sellerId:      String(row.seller_id),
      buyerId:       String(row.buyer_id),
      agreedPrice:   row.agreed_price,
      agreementHash: row.agreement_hash,
      timestamp:     row.agreement_timestamp?.toISOString() || new Date().toISOString(),
    });

    res.json({
      success:       result.success,
      txId:          result.txId,
      agreementHash: result.agreementHash,
      error:         result.error,
    });
  } catch (err) {
    console.error('POST /retry-anchor error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/blockchain/tamper-scan
//  Scan all DB agreement hashes against blockchain.
//  Body (optional): { limit: 50 }
// ═══════════════════════════════════════════════════════════════
router.post('/tamper-scan', auth, requireLRO, async (req, res) => {
  try {
    const limit = parseInt(req.body?.limit) || 50;

    const dbRows = await pool.query(
      `SELECT channel_id, agreement_hash, channel_status, agreed_price
       FROM transfer_requests
       WHERE agreement_hash IS NOT NULL
       ORDER BY agreement_timestamp DESC
       LIMIT $1`,
      [limit]
    );

    if (dbRows.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No agreements with hashes found',
        scanned: 0,
      });
    }

    const scanResult = await fabricService.batchTamperScan(dbRows.rows);
    res.json({ success: true, ...scanResult });
  } catch (err) {
    console.error('POST /tamper-scan error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/blockchain/lro/submit/:channelId
//  LRO officer submits case for PoA voting.
//  Status: AGREED → LRO_PENDING
// ═══════════════════════════════════════════════════════════════
router.post('/lro/submit/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const { channelId }  = req.params;
    const lroOfficerId   = String(req.user.userId);

    // Check current DB status
    const check = await pool.query(
      'SELECT channel_status, agreement_hash FROM transfer_requests WHERE channel_id = $1',
      [channelId]
    );

    if (!check.rows[0]) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    if (check.rows[0].channel_status !== 'AGREED') {
      return res.status(400).json({
        success: false,
        error:   `Status is ${check.rows[0].channel_status} — can only submit AGREED cases`,
      });
    }
    if (!check.rows[0].agreement_hash) {
      return res.status(400).json({
        success: false,
        error:   'No agreement hash — both parties must agree before submitting',
      });
    }

    const result = await fabricService.submitForLROVerification(channelId, lroOfficerId);

    if (result.success) {
      await pool.query(
        "UPDATE transfer_requests SET channel_status = 'LRO_PENDING' WHERE channel_id = $1",
        [channelId]
      );
    }

    res.json({
      success: result.success,
      txId:    result.txId,
      status:  result.status,
      error:   result.error,
    });
  } catch (err) {
    console.error('POST /lro/submit error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/blockchain/lro/vote/:channelId
//  One of 5 LRO nodes casts PoA vote.
//
//  nodeId is read from JWT automatically (lroNodeId field).
//  Fallback: pass nodeId in request body (for testing).
//
//  Body: { vote: 'APPROVE'|'REJECT', reason: '...' }
//        nodeId is optional in body (used if not in JWT)
// ═══════════════════════════════════════════════════════════════
router.post('/lro/vote/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const { channelId }         = req.params;
    const { vote, reason, nodeId: bodyNodeId } = req.body;

    // nodeId MUST come from JWT — body nodeId is only a fallback for testing
    // If JWT has lroNodeId, ALWAYS use it — reject attempts to override it from body
    const nodeId = req.user.lroNodeId || bodyNodeId;

    if (!nodeId) {
      return res.status(400).json({
        success: false,
        error:   'No LRO node ID found. Your account must have lro_node_id set in the database.',
      });
    }
    if (!vote) {
      return res.status(400).json({ success: false, error: 'vote is required (APPROVE or REJECT)' });
    }
    if (!['APPROVE', 'REJECT'].includes(vote.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'vote must be APPROVE or REJECT' });
    }
    if (vote.toUpperCase() === 'REJECT' && !reason?.trim()) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }

    // Case must have been submitted for PoA (agreement_hash + not AGREED/TRANSFERRED)
    const check = await pool.query(
      'SELECT channel_status, agreement_hash FROM transfer_requests WHERE channel_id = $1',
      [channelId]
    );
    const current = check.rows[0];
    if (!current) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    if (!current.agreement_hash) {
      return res.status(400).json({ success: false, error: 'Both parties must agree before PoA voting can begin' });
    }
    if (current.channel_status === 'AGREED') {
      return res.status(400).json({ success: false, error: 'Case must be submitted for PoA first. Click "Submit for PoA" first.' });
    }
    if (current.channel_status === 'TRANSFERRED') {
      return res.status(400).json({ success: false, error: 'This transfer has already been executed.' });
    }

    // Check duplicate vote in poa_votes table (persistent, independent of blockchain)
    const dupCheck = await pool.query(
      'SELECT vote_id FROM poa_votes WHERE channel_id = $1 AND node_id = $2',
      [channelId, nodeId]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: `${nodeId} has already voted on this case` });
    }

    // Cast the vote on blockchain (mock or real Fabric)
    const result = await fabricService.castPoAVote(
      channelId, nodeId, vote.toUpperCase(), reason || ''
    );

    if (result.success) {
      // ── WRITE TO poa_votes TABLE (persistent, queryable) ──────────
      await pool.query(
        `INSERT INTO poa_votes (channel_id, node_id, vote, reason, tx_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (channel_id, node_id) DO NOTHING`,
        [channelId, nodeId, vote.toUpperCase(), reason || '', result.txId || null]
      );

      // ── Count all votes from poa_votes table ──────────────────────
      const voteCounts = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE vote = 'APPROVE') AS approvals,
           COUNT(*) FILTER (WHERE vote = 'REJECT')  AS rejections,
           COUNT(*) AS total_votes
         FROM poa_votes WHERE channel_id = $1`,
        [channelId]
      );
      const { approvals, rejections, total_votes } = voteCounts.rows[0];

      // ── Determine new status (smart contract logic) ────────────────
      const newStatus = parseInt(approvals) >= 3 ? 'LRO_APPROVED'
                      : parseInt(rejections) >= 3 ? 'LRO_REJECTED'
                      : 'LRO_PENDING';

      // ── Sync status to DB ─────────────────────────────────────────
      if (newStatus !== current.channel_status) {
        await pool.query(
          'UPDATE transfer_requests SET channel_status = $2 WHERE channel_id = $1',
          [channelId, newStatus]
        );
      }

      // ── Emit WebSocket live update ────────────────────────────────
      try {
        const eventName = newStatus === 'LRO_APPROVED' ? 'poa_approved'
                        : newStatus === 'LRO_REJECTED' ? 'poa_rejected'
                        : 'poa_vote_cast';
        wsService.emitToChannel(channelId, eventName, {
          channelId, nodeId, vote: vote.toUpperCase(),
          approvals: parseInt(approvals),
          rejections: parseInt(rejections),
          totalVotes: parseInt(total_votes),
          status: newStatus, timestamp: new Date(),
        });
      } catch (wsErr) {
        console.warn('WebSocket emit failed (non-fatal):', wsErr.message);
      }

      return res.json({
        success:    true,
        txId:       result.txId,
        nodeId,
        vote:       vote.toUpperCase(),
        approvals:  parseInt(approvals),
        rejections: parseInt(rejections),
        totalVotes: parseInt(total_votes),
        status:     newStatus,
      });
    }

    res.json({ success: false, error: result.error });
  } catch (err) {
    console.error('POST /lro/vote error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/blockchain/lro/transfer/:channelId
//  DC executes final ownership transfer after LRO_APPROVED.
//  Updates both blockchain and PostgreSQL.
// ═══════════════════════════════════════════════════════════════
router.post('/lro/transfer/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const { channelId } = req.params;
    const executedBy    = String(req.user.userId);

    // Must be LRO_APPROVED in DB
    const check = await pool.query(
      'SELECT channel_status FROM transfer_requests WHERE channel_id = $1',
      [channelId]
    );
    if (!check.rows[0]) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    if (check.rows[0].channel_status !== 'LRO_APPROVED') {
      return res.status(400).json({
        success: false,
        error:   `Cannot transfer — status is ${check.rows[0].channel_status}. Need LRO_APPROVED (3/5 votes).`,
      });
    }

    const result = await fabricService.executeTransfer(channelId, executedBy);

    if (result.success) {
      // Update transfer_requests status
      await pool.query(
        "UPDATE transfer_requests SET channel_status = 'TRANSFERRED' WHERE channel_id = $1",
        [channelId]
      );

      // Update property ownership — ALL owner fields updated to new buyer
      await pool.query(
        `UPDATE properties
         SET owner_id     = u.user_id,
             owner_name   = u.name,
             owner_cnic   = u.cnic,
             father_name  = u.father_name,
             is_for_sale  = FALSE,
             listed_at    = NULL,
             asking_price = NULL
         FROM (
           SELECT tr.property_id, tr.buyer_id
             FROM transfer_requests tr
            WHERE tr.channel_id = $1
         ) sub
         JOIN users u ON u.user_id = sub.buyer_id
         WHERE properties.property_id = sub.property_id`,
        [channelId]
      );

      // Emit live WebSocket event
      try {
        wsService.emitToChannel(channelId, 'transfer_executed', {
          channelId,
          propertyId: result.propertyId,
          newOwner:   result.newOwner,
          txId:       result.txId,
          timestamp:  new Date(),
        });
      } catch (wsErr) {
        console.warn('WebSocket emit failed (non-fatal):', wsErr.message);
      }
    }

    res.json({
      success:    result.success,
      txId:       result.txId,
      propertyId: result.propertyId,
      newOwner:   result.newOwner,
      status:     result.status,
      error:      result.error,
    });
  } catch (err) {
    console.error('POST /lro/transfer error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/blockchain/lro/freeze/:channelId
//  DC freezes a rejected case for investigation.
//  Writes FROZEN block to ledger, locks property in DB.
// ═══════════════════════════════════════════════════════════════
router.post('/lro/freeze/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const { channelId } = req.params;
    const executedBy    = String(req.user.userId);

    // Only DC can freeze
    const role = (req.user?.role || '').toUpperCase();
    if (!['DC','DEPUTY COMMISSIONER','ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Only the Deputy Commissioner can freeze a case' });
    }

    const check = await pool.query(
      'SELECT channel_status, property_id FROM transfer_requests WHERE channel_id = $1',
      [channelId]
    );
    if (!check.rows[0]) return res.status(404).json({ success: false, error: 'Channel not found' });

    const { channel_status, property_id } = check.rows[0];
    if (!['LRO_REJECTED','LRO_APPROVED'].includes(channel_status)) {
      return res.status(400).json({ success: false, error: `Cannot freeze — status is ${channel_status}` });
    }

    // Write FROZEN block to mock blockchain (immutable record)
    await pool.query(
      `INSERT INTO mock_blockchain (channel_id, action, actor, data)
       VALUES ($1, 'FROZEN', $2, $3)`,
      [channelId, executedBy, JSON.stringify({ status:'FROZEN', reason:'Frozen by DC for investigation', frozenAt:new Date().toISOString() })]
    );

    // Update transfer_requests status
    await pool.query(
      "UPDATE transfer_requests SET channel_status='FROZEN' WHERE channel_id=$1",
      [channelId]
    );

    // Lock the property — mark as frozen/under investigation
    await pool.query(
      "UPDATE properties SET is_frozen=TRUE WHERE property_id=$1",
      [property_id]
    );

    // Emit WebSocket
    try { wsService.emitToChannel(channelId, 'case_frozen', { channelId, frozenBy: executedBy }); } catch(_){}

    res.json({ success: true, message: 'Case frozen — property locked for investigation', channelId });
  } catch (err) {
    console.error('POST /lro/freeze error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


//  Returns all poa_votes for a case from the persistent table.
//  UI uses this to show who voted what (avoids re-reading blockchain).
// ═══════════════════════════════════════════════════════════════
router.get('/lro/votes/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT node_id, vote, reason, tx_id, created_at
         FROM poa_votes
        WHERE channel_id = $1
        ORDER BY created_at ASC`,
      [req.params.channelId]
    );
    const votes      = result.rows;
    const approvals  = votes.filter(v => v.vote === 'APPROVE').length;
    const rejections = votes.filter(v => v.vote === 'REJECT').length;
    const status     = approvals >= 3 ? 'LRO_APPROVED'
                     : rejections >= 3 ? 'LRO_REJECTED'
                     : votes.length > 0 ? 'LRO_PENDING' : 'AGREED';
    res.json({ success: true, votes, approvals, rejections, totalVotes: votes.length, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/blockchain/lro/simulate-votes/:channelId
//  DEV ONLY — auto-APPROVE from all unvoted nodes.
//  Body: { vote: 'APPROVE'|'REJECT' }  default APPROVE
// ═══════════════════════════════════════════════════════════════
router.post('/lro/simulate-votes/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const { channelId } = req.params;
    const voteChoice    = (req.body?.vote || 'APPROVE').toUpperCase();
    const reason        = req.body?.reason || 'Simulated vote (dev mode)';

    const ALL_NODES = ['LRO_NODE_1','LRO_NODE_2','LRO_NODE_3','LRO_NODE_4','LRO_NODE_5'];

    // Find which nodes have already voted
    const existing = await pool.query(
      'SELECT node_id FROM poa_votes WHERE channel_id = $1',
      [channelId]
    );
    const alreadyVoted = new Set(existing.rows.map(r => r.node_id));
    const pending      = ALL_NODES.filter(n => !alreadyVoted.has(n));

    if (pending.length === 0) {
      return res.json({ success: true, message: 'All 5 nodes have already voted', simulated: 0 });
    }

    let simulated = 0;
    for (const nodeId of pending) {
      const result = await fabricService.castPoAVote(channelId, nodeId, voteChoice, reason);
      if (result.success !== false) {
        await pool.query(
          `INSERT INTO poa_votes (channel_id, node_id, vote, reason, tx_id)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (channel_id, node_id) DO NOTHING`,
          [channelId, nodeId, voteChoice, reason, result.txId || null]
        );
        simulated++;
      }
    }

    // Recalculate status from poa_votes
    const counts = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE vote='APPROVE') AS approvals,
              COUNT(*) FILTER (WHERE vote='REJECT')  AS rejections
         FROM poa_votes WHERE channel_id = $1`,
      [channelId]
    );
    const { approvals, rejections } = counts.rows[0];
    const finalStatus = parseInt(approvals) >= 3 ? 'LRO_APPROVED'
                      : parseInt(rejections) >= 3 ? 'LRO_REJECTED'
                      : 'LRO_PENDING';

    await pool.query(
      'UPDATE transfer_requests SET channel_status = $2 WHERE channel_id = $1',
      [channelId, finalStatus]
    );

    try {
      wsService.emitToChannel(channelId,
        finalStatus === 'LRO_APPROVED' ? 'poa_approved' : 'poa_vote_cast',
        { channelId, approvals: parseInt(approvals), rejections: parseInt(rejections), status: finalStatus }
      );
    } catch (_) {}

    res.json({
      success: true,
      simulated,
      message:     `Simulated ${simulated} vote(s). Status: ${finalStatus}`,
      finalStatus,
      approved:    finalStatus === 'LRO_APPROVED',
      approvals:   parseInt(approvals),
      rejections:  parseInt(rejections),
    });
  } catch (err) {
    console.error('POST /simulate-votes error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════
//  POST /api/blockchain/lro/freeze/:channelId
//  DC freezes a rejected case. Writes immutable FREEZE block.
//  Prevents future transfers on this property.
//  Only callable after LRO_REJECTED.
// ═══════════════════════════════════════════════════════════════
router.post('/lro/freeze/:channelId', auth, requireLRO, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { reason }    = req.body;
    const executedBy    = String(req.user.userId);

    // Only DC can freeze
    const role = (req.user?.role || '').toUpperCase();
    if (!['DC','DEPUTY COMMISSIONER','ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Only DC can freeze a case' });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, error: 'Freeze reason is required' });
    }

    const check = await pool.query(
      'SELECT channel_status FROM transfer_requests WHERE channel_id = $1',
      [channelId]
    );
    if (!check.rows[0]) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    if (!['LRO_REJECTED','LRO_APPROVED'].includes(check.rows[0].channel_status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot freeze — status is ${check.rows[0].channel_status}. Only rejected/approved cases can be frozen.`,
      });
    }

    // Write FREEZE block to blockchain
    const freezeResult = await fabricService.recordAgreementOnChain({
      channelId,
      transferId:    'FREEZE',
      propertyId:    '',
      sellerId:      executedBy,
      buyerId:       executedBy,
      agreedPrice:   0,
      agreementHash: 'FREEZE:' + Date.now(),
      timestamp:     new Date().toISOString(),
    }).catch(() => null);

    // Always update DB regardless of chain write
    await pool.query(
      "UPDATE transfer_requests SET channel_status = 'FROZEN' WHERE channel_id = $1",
      [channelId]
    );

    // Log freeze in poa_votes as a special record for audit trail
    await pool.query(
      `INSERT INTO poa_votes (channel_id, node_id, vote, reason, tx_id)
       VALUES ($1, 'DC_FREEZE', 'FREEZE', $2, $3)
       ON CONFLICT (channel_id, node_id) DO UPDATE SET reason = $2`,
      [channelId, reason.trim(), freezeResult?.txId || null]
    );

    try {
      wsService.emitToChannel(channelId, 'case_frozen', {
        channelId, reason: reason.trim(), executedBy, timestamp: new Date()
      });
    } catch(_) {}

    res.json({
      success:   true,
      channelId,
      status:    'FROZEN',
      reason:    reason.trim(),
      executedBy,
      message:   'Case frozen — recorded on blockchain and database',
    });

  } catch (err) {
    console.error('POST /lro/freeze error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;