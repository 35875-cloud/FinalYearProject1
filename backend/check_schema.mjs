import pool from './src/config/db.js';

const client = await pool.connect();
try {
  // Check lro_status and blockchain_status constraints too
  const r = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'succession_requests'::regclass
      AND contype = 'c'
    ORDER BY conname
  `);
  console.log('All check constraints on succession_requests:');
  r.rows.forEach(row => console.log(`\n[${row.conname}]\n  ${row.definition}`));
} finally {
  client.release();
  process.exit(0);
}
