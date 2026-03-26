import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import bcService from '../services/blockchainRegistration.service.js';

const router = express.Router();
const pool = new pg.Pool({ host: process.env.DB_HOST||'localhost', port: parseInt(process.env.DB_PORT||'5432'), database: process.env.DB_NAME||'landdb', user: process.env.DB_USER||'postgres', password: process.env.DB_PASSWORD||'6700' });

const auth = (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : h;
    if (!t) return res.status(401).json({ success: false, error: 'No token' });
    req.user = jwt.verify(t, process.env.JWT_SECRET || 'default-jwt-secret');
    next();
  } catch (e) { res.status(401).json({ success: false, error: 'Invalid token' }); }
};

const requireLRO = (req, res, next) => {
  const role = (req.user?.role || '').toUpperCase().replace(/ /g, '_');
  if (!['LRO','LAND_RECORD_OFFICER','DC','DEPUTY_COMMISSIONER','ADMIN'].includes(role))
    return res.status(403).json({ success: false, error: 'LRO role required' });
  next();
};

const requireDC = (req, res, next) => {
  const role = (req.user?.role || '').toUpperCase().replace(/ /g, '_');
  if (!['DC','DEPUTY_COMMISSIONER','ADMIN'].includes(role))
    return res.status(403).json({ success: false, error: 'DC role required' });
  next();
};

function getLroNodeId(user) {
  if (user.lroNodeId) return user.lroNodeId;
  if (user.lro_node_id) return user.lro_node_id;
  const uid = user.userId || user.user_id || user.id;
  if (uid) return `LRO_NODE_${((parseInt(uid) - 1) % 5) + 1}`;
  return 'LRO_NODE_1';
}

bcService.ensureTables().catch(e => console.error('[BlockchainReg] Table init error:', e.message));

router.get('/cases', auth, requireLRO, async (req, res) => {
  try { res.json(await bcService.getAllCases(req.query.status || 'ALL')); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/stats', auth, requireLRO, async (req, res) => {
  try { res.json(await bcService.getStats()); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/status/:propertyId', auth, requireLRO, async (req, res) => {
  try { res.json(await bcService.getVotingStatus(req.params.propertyId)); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/verify/:propertyId', auth, requireLRO, async (req, res) => {
  try { res.json(await bcService.verifyIntegrity(req.params.propertyId)); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/ledger/:propertyId', auth, requireLRO, async (req, res) => {
  try { const blocks = await bcService.getFullLedger(req.params.propertyId); res.json({ success: true, blocks }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/dc-pending', auth, requireDC, async (req, res) => {
  try {
    const result = await pool.query(`SELECT bc.*, p.owner_name, p.owner_cnic, p.father_name, p.district, p.tehsil, p.area_marla, p.property_type, p.khasra_no FROM reg_blockchain_cases bc LEFT JOIN properties p ON bc.property_id = p.property_id WHERE bc.status = 'LRO_APPROVED' ORDER BY bc.lro_approved_at DESC`);
    const cases = await Promise.all(result.rows.map(async row => {
      const votes = await pool.query('SELECT * FROM reg_blockchain_votes WHERE property_id=$1', [row.property_id]);
      return { ...row, votes: votes.rows };
    }));
    res.json({ success: true, cases });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/submit/:propertyId', auth, requireLRO, async (req, res) => {
  try {
    const propRow = await pool.query('SELECT * FROM properties WHERE property_id=$1', [req.params.propertyId]);
    if (propRow.rows.length === 0) return res.status(404).json({ success: false, error: 'Property not found' });
    const lroNodeId = getLroNodeId(req.user);
    const lroUserId = req.user.userId || req.user.user_id || req.user.id;
    res.json(await bcService.submitForVoting(req.params.propertyId, propRow.rows[0], lroNodeId, lroUserId));
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/vote/:propertyId', auth, requireLRO, async (req, res) => {
  try {
    const { vote, reason } = req.body;
    if (!vote) return res.status(400).json({ success: false, error: 'vote required (APPROVE|REJECT)' });
    const lroNodeId = getLroNodeId(req.user);
    const lroUserId = req.user.userId || req.user.user_id || req.user.id;
    const lroName = req.user.name || req.user.userName || lroNodeId;
    res.json(await bcService.castVote(req.params.propertyId, lroNodeId, lroUserId, lroName, vote, reason));
  } catch (e) { res.status(e.message.includes('TAMPER') ? 403 : 400).json({ success: false, error: e.message }); }
});

router.post('/dc-approve/:propertyId', auth, requireDC, async (req, res) => {
  try {
    const dcUserId = req.user.userId || req.user.user_id || req.user.id;
    const dcName = req.user.name || req.user.userName || 'Deputy Commissioner';
    res.json(await bcService.dcFinalApprove(req.params.propertyId, dcUserId, dcName));
  } catch (e) { res.status(e.message.includes('TAMPER') ? 403 : 400).json({ success: false, error: e.message }); }
});

export default router;
