// ═══════════════════════════════════════════════════════════════
//  hash_lro_passwords.js
//  PURPOSE: Generate bcrypt hashes for your 5 LRO + 1 DC accounts
//  
//  HOW TO RUN:
//    1. Open terminal
//    2. Go to your backend/ folder:   cd backend
//    3. Run this file:                node hash_lro_passwords.js
//    4. Copy the SQL output
//    5. Paste it into pgAdmin and run it
// ═══════════════════════════════════════════════════════════════

import bcrypt from 'bcrypt';

// ── CHANGE THESE PASSWORDS if you want different ones ─────────
const LRO_PASSWORD = 'LRO@node123';   // Password for all 5 LRO accounts
const DC_PASSWORD  = 'DC@admin123';   // Password for DC account

// ── These match the accounts in lro_node_setup_FIXED.sql ──────
const accounts = [
  { userId: 'USR900001', nodeId: 'LRO_NODE_1', email: 'lro.node1@plra.gov.pk', password: LRO_PASSWORD, city: 'Lahore'     },
  { userId: 'USR900002', nodeId: 'LRO_NODE_2', email: 'lro.node2@plra.gov.pk', password: LRO_PASSWORD, city: 'Rawalpindi' },
  { userId: 'USR900003', nodeId: 'LRO_NODE_3', email: 'lro.node3@plra.gov.pk', password: LRO_PASSWORD, city: 'Faisalabad' },
  { userId: 'USR900004', nodeId: 'LRO_NODE_4', email: 'lro.node4@plra.gov.pk', password: LRO_PASSWORD, city: 'Multan'     },
  { userId: 'USR900005', nodeId: 'LRO_NODE_5', email: 'lro.node5@plra.gov.pk', password: LRO_PASSWORD, city: 'Gujranwala' },
  { userId: 'USR900006', nodeId: null,          email: 'dc@plra.gov.pk',        password: DC_PASSWORD,  city: 'DC Office'  },
];

// ── Main ──────────────────────────────────────────────────────
console.log('\n' + '='.repeat(65));
console.log('  Punjab Land Registry — LRO Password Hash Generator');
console.log('='.repeat(65));
console.log('\nGenerating bcrypt hashes (this takes a few seconds)...\n');

const sqls = [];

for (const account of accounts) {
  const hash = await bcrypt.hash(account.password, 10);
  sqls.push(`UPDATE users SET password_hash = '${hash}' WHERE email = '${account.email}';`);
  console.log(`✅ Hashed: ${account.email} (${account.city})`);
}

console.log('\n' + '='.repeat(65));
console.log('  COPY THIS SQL AND RUN IT IN PGADMIN:');
console.log('='.repeat(65) + '\n');

sqls.forEach(s => console.log(s));

console.log('\n' + '='.repeat(65));
console.log('  LOGIN CREDENTIALS SUMMARY:');
console.log('='.repeat(65));
accounts.forEach(a => {
  console.log(`  ${a.email.padEnd(32)} Password: ${a.password}  ${a.nodeId ? `[${a.nodeId}]` : '[DC]'}`);
});
console.log('\n  ⚠  These credentials are for DEVELOPMENT only.');
console.log('     Change passwords before going to production!\n');