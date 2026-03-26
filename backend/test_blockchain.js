// ═══════════════════════════════════════════════════════════════
//  test_blockchain.js
//  PURPOSE: Test the COMPLETE PoA blockchain flow automatically
//
//  HOW TO RUN:
//    1. Make sure your backend server is running (npm start)
//    2. Open terminal → go to backend/ folder
//    3. Run:  node test_blockchain.js
//
//  WHAT IT TESTS:
//    Step 1 → Login as LRO Node 1 (Lahore)
//    Step 2 → Fetch all blockchain cases
//    Step 3 → Check if case is already on chain
//    Step 4 → Submit case for PoA voting (AGREED → LRO_PENDING)
//    Step 5 → 3 nodes each vote APPROVE
//    Step 6 → Verify status auto-changed to LRO_APPROVED
//    Step 7 → Tamper detection check (DB hash vs chain hash)
//
//  BEFORE RUNNING:
//    → You must have completed a negotiation (both parties clicked Agree)
//    → LRO accounts must exist in the database (run lro_node_setup_FIXED.sql first)
// ═══════════════════════════════════════════════════════════════

const BASE_URL = 'http://localhost:5000';   // ← change if your backend runs on different port

// ── CONFIG — update these values ─────────────────────────────
const CONFIG = {
  // Leave as 'AUTO' to automatically pick the first available case
  // OR replace with a specific channel_id from your database:
  //   SELECT channel_id FROM transfer_requests WHERE agreement_hash IS NOT NULL LIMIT 1;
  channelId: 'AUTO',

  // LRO accounts (created by lro_node_setup_FIXED.sql)
  lroAccounts: [
    { email: 'lro.node1@plra.gov.pk', password: 'LRO@node123', city: 'Lahore'     },
    { email: 'lro.node2@plra.gov.pk', password: 'LRO@node123', city: 'Rawalpindi' },
    { email: 'lro.node3@plra.gov.pk', password: 'LRO@node123', city: 'Faisalabad' },
  ],

  dcAccount: { email: 'dc@plra.gov.pk', password: 'DC@admin123' },
};

// ── Helper: HTTP POST ─────────────────────────────────────────
async function post(path, body = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Helper: HTTP GET ──────────────────────────────────────────
async function get(path, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE_URL + path, { headers });
  return res.json();
}

// ── Helper: Login ─────────────────────────────────────────────
async function login(email, password) {
  const data = await post('/api/auth/login', { email, password });
  if (data.success && (data.token || data.accessToken)) {
    return data.token || data.accessToken;
  }
  console.log(`  ❌ Login failed for ${email}:`, data.message || data.error);
  return null;
}

// ── Helper: Print section header ─────────────────────────────
function section(title) {
  console.log('\n' + '─'.repeat(60));
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ═══════════════════════════════════════════════════════════════
//  MAIN TEST
// ═══════════════════════════════════════════════════════════════
async function runTest() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Punjab Land Registry — Blockchain PoA Test');
  console.log('  ' + new Date().toLocaleString());
  console.log('═'.repeat(60));

  let passed = 0;
  let failed = 0;

  // ── STEP 1: Login as LRO Node 1 ────────────────────────────
  section('STEP 1 — Login as LRO Node 1 (Lahore)');
  const lro1Token = await login(CONFIG.lroAccounts[0].email, CONFIG.lroAccounts[0].password);
  if (!lro1Token) {
    console.log('\n  ❌ CANNOT CONTINUE — LRO Node 1 login failed');
    console.log('  Fix: Run lro_node_setup_FIXED.sql then hash_lro_passwords.js');
    return;
  }
  console.log(`  ✅ Logged in as ${CONFIG.lroAccounts[0].email}`);
  passed++;

  // ── STEP 2: Fetch all blockchain cases ─────────────────────
  section('STEP 2 — Fetch all blockchain cases');
  const casesData = await get('/api/blockchain/lro/cases', lro1Token);

  if (!casesData.success) {
    console.log('  ❌ Failed to fetch cases:', casesData.error);
    failed++;
  } else {
    const total = casesData.cases?.length || 0;
    console.log(`  ✅ Found ${total} case(s) with agreement hash`);

    if (total === 0) {
      console.log('\n  ⚠  NO CASES FOUND');
      console.log('  You need to complete a negotiation first:');
      console.log('  → Login as seller → list a property');
      console.log('  → Login as buyer  → express interest');
      console.log('  → Both enter chat  → both click AGREE');
      console.log('  → Then re-run this test\n');
      return;
    }

    casesData.cases.slice(0, 3).forEach((c, i) => {
      console.log(`  Case ${i+1}: ${c.channel_id} | Status: ${c.channel_status} | Hash: ${c.agreement_hash?.slice(0,16)}...`);
    });
    passed++;
  }

  // Pick channel to test
  let channelId = CONFIG.channelId;
  if (channelId === 'AUTO') {
    // Prefer AGREED status (not yet submitted), fallback to any
    const agreed = casesData.cases.find(c => c.channel_status === 'AGREED');
    const any    = casesData.cases[0];
    const chosen = agreed || any;
    channelId = chosen.channel_id;
    console.log(`\n  Using channel: ${channelId} (status: ${chosen.channel_status})`);
  }

  // ── STEP 3: Check on-chain record ──────────────────────────
  section('STEP 3 — Check on-chain record');
  const chainData = await get(`/api/blockchain/agreement/${channelId}`, lro1Token);

  if (chainData.onChain) {
    console.log('  ✅ Agreement IS on the blockchain');
    console.log(`  Integrity: ${chainData.integrity}`);
    if (chainData.blockchain?.blockchainTxId) {
      console.log(`  TxID: ${chainData.blockchain.blockchainTxId}`);
    }
    passed++;
  } else {
    console.log('  ⚠  Agreement NOT on chain yet — attempting retry-anchor...');
    const anchor = await post(`/api/blockchain/retry-anchor/${channelId}`, {}, lro1Token);
    if (anchor.success) {
      console.log(`  ✅ Anchored to blockchain! TxID: ${anchor.txId}`);
      passed++;
    } else {
      console.log(`  ❌ Anchor failed: ${anchor.error}`);
      failed++;
    }
  }

  // ── STEP 4: Submit for PoA (only if AGREED) ────────────────
  section('STEP 4 — Submit for PoA Voting');
  const currentCase = casesData.cases.find(c => c.channel_id === channelId);
  const currentStatus = currentCase?.channel_status;

  if (currentStatus === 'AGREED') {
    const submitData = await post(`/api/blockchain/lro/submit/${channelId}`, {}, lro1Token);
    if (submitData.success) {
      console.log(`  ✅ Submitted! Status changed to: ${submitData.status}`);
      passed++;
    } else {
      console.log(`  ❌ Submit failed: ${submitData.error}`);
      failed++;
    }
  } else {
    console.log(`  ⏭  Skipped (status is already: ${currentStatus})`);
    if (['LRO_PENDING','LRO_APPROVED','TRANSFERRED'].includes(currentStatus)) passed++;
  }

  // ── STEP 5: Three LRO nodes vote APPROVE ───────────────────
  section('STEP 5 — 3 LRO Nodes Vote APPROVE');

  let finalStatus = null;
  for (let i = 0; i < CONFIG.lroAccounts.length; i++) {
    const account = CONFIG.lroAccounts[i];
    const token   = await login(account.email, account.password);
    if (!token) {
      console.log(`  ❌ Login failed for ${account.email}`);
      failed++;
      continue;
    }

    // nodeId comes from JWT now (via lro_node_id in users table)
    // but we can also pass it in body as fallback
    const nodeId = `LRO_NODE_${i + 1}`;
    const voteData = await post(
      `/api/blockchain/lro/vote/${channelId}`,
      { nodeId, vote: 'APPROVE', reason: `Verified by ${account.city} LRO office` },
      token
    );

    if (voteData.success) {
      finalStatus = voteData.status;
      console.log(`  ✅ Node ${i+1} (${account.city}) voted APPROVE`);
      console.log(`     Approvals: ${voteData.approvals}/5 | Status: ${voteData.status}`);
      passed++;

      if (voteData.status === 'LRO_APPROVED') {
        console.log('\n  🎉 MAJORITY REACHED! Smart contract auto-approved!');
        break;
      }
    } else {
      const alreadyVoted = voteData.error?.includes('already voted');
      if (alreadyVoted) {
        console.log(`  ⚠  Node ${i+1} (${account.city}) already voted — skipping`);
      } else {
        console.log(`  ❌ Node ${i+1} vote failed: ${voteData.error}`);
        failed++;
      }
    }
  }

  // ── STEP 6: Check final status ─────────────────────────────
  section('STEP 6 — Verify Final Status');
  const refreshedCases = await get('/api/blockchain/lro/cases', lro1Token);
  const updatedCase = refreshedCases.cases?.find(c => c.channel_id === channelId);
  const updatedStatus = updatedCase?.channel_status;

  console.log(`  Status in database: ${updatedStatus}`);

  if (updatedStatus === 'LRO_APPROVED') {
    console.log('  ✅ LRO_APPROVED — DC can now execute the transfer');
    passed++;
  } else if (updatedStatus === 'LRO_PENDING') {
    console.log('  ⚠  Still LRO_PENDING — need more votes (3 required)');
  } else if (updatedStatus === 'TRANSFERRED') {
    console.log('  ✅ Already TRANSFERRED — full flow complete');
    passed++;
  } else {
    console.log(`  Status: ${updatedStatus}`);
  }

  // ── STEP 7: Tamper detection ────────────────────────────────
  section('STEP 7 — Tamper Detection Test');
  const verifyData = await get(`/api/blockchain/verify/${channelId}`, lro1Token);

  if (verifyData.success !== false) {
    const integrity = verifyData.integrity || (verifyData.verified ? 'CLEAN' : 'TAMPERED');
    if (integrity === 'CLEAN') {
      console.log('  ✅ CLEAN — DB hash matches blockchain hash');
      console.log('     No tampering detected');
      passed++;
    } else if (integrity === 'TAMPERED') {
      console.log('  ❌ TAMPERED — DB hash does NOT match blockchain!');
      console.log('     Someone modified the agreement data in PostgreSQL');
      failed++;
    } else {
      console.log(`  Integrity status: ${integrity}`);
    }
  } else {
    console.log(`  ❌ Verify failed: ${verifyData.error}`);
    failed++;
  }

  // ── SUMMARY ─────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Channel tested: ${channelId}`);

  if (failed === 0) {
    console.log('\n  🎉 ALL TESTS PASSED!');
    console.log('  Your blockchain PoA flow is working correctly.\n');
    if (updatedStatus === 'LRO_APPROVED') {
      console.log('  NEXT STEP: Login as DC (dc@plra.gov.pk) and execute transfer');
      console.log('  → Open browser → /lro/blockchain → select case → click Execute Transfer\n');
    }
  } else {
    console.log('\n  ⚠  Some tests failed. Check the errors above.');
    console.log('  Common fixes:');
    console.log('  → Run lro_node_setup_FIXED.sql if accounts missing');
    console.log('  → Run hash_lro_passwords.js if login fails');
    console.log('  → Check auth.js patch if lroNodeId missing from JWT\n');
  }
}

runTest().catch(err => {
  console.error('\n❌ Test crashed:', err.message);
  console.error('Make sure your backend server is running on', BASE_URL);
});