// =====================================================
// DATABASE MIGRATION SCRIPT - Add Payment Challan Columns
// Location: backend/src/migrations/add_payment_challan_columns.js
// Usage: node backend/src/migrations/add_payment_challan_columns.js
// =====================================================

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../.env' });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('\n=====================================================');
    console.log('🔧 DATABASE MIGRATION - Adding Payment Challan Columns');
    console.log('=====================================================\n');

    await client.query('BEGIN');

    // 1. Check current table structure
    console.log('📋 Step 1: Checking current table structure...');
    const currentColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'transfer_requests'
      ORDER BY ordinal_position
    `);
    
    console.log('Current columns:', currentColumns.rows.map(r => r.column_name).join(', '));

    // 2. Add missing columns
    console.log('\n📝 Step 2: Adding missing columns...');
    
    const columnsToAdd = [
      { name: 'payment_challan_url', type: 'TEXT', description: 'URL to payment challan document' },
      { name: 'payment_uploaded_at', type: 'TIMESTAMP', description: 'When payment challan was uploaded' },
      { name: 'approved_by', type: 'VARCHAR(50)', description: 'User ID who approved the transfer' },
      { name: 'approved_at', type: 'TIMESTAMP', description: 'When transfer was approved' },
      { name: 'approval_notes', type: 'TEXT', description: 'Notes from approving officer' }
    ];

    for (const col of columnsToAdd) {
      try {
        await client.query(`
          ALTER TABLE transfer_requests 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`   ✅ Added: ${col.name} (${col.type}) - ${col.description}`);
      } catch (err) {
        if (err.code === '42701') {
          console.log(`   ℹ️  Skipped: ${col.name} (already exists)`);
        } else {
          throw err;
        }
      }
    }

    // 3. Add indexes for performance
    console.log('\n🔍 Step 3: Adding indexes...');
    
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_transfer_requests_payment_status 
        ON transfer_requests(status, payment_uploaded_at)
      `);
      console.log('   ✅ Added index: idx_transfer_requests_payment_status');
    } catch (err) {
      console.log('   ℹ️  Index already exists');
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_transfer_requests_expires_at 
        ON transfer_requests(expires_at)
      `);
      console.log('   ✅ Added index: idx_transfer_requests_expires_at');
    } catch (err) {
      console.log('   ℹ️  Index already exists');
    }

    // 4. Verify all columns exist
    console.log('\n✔️  Step 4: Verifying migration...');
    const verifyColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'transfer_requests'
      AND column_name IN (
        'payment_challan_url',
        'payment_uploaded_at',
        'approved_by',
        'approved_at',
        'approval_notes'
      )
    `);

    if (verifyColumns.rows.length === 5) {
      console.log('   ✅ All columns verified successfully!');
      console.log('   Columns added:', verifyColumns.rows.map(r => r.column_name).join(', '));
    } else {
      throw new Error(`Expected 5 columns, found ${verifyColumns.rows.length}`);
    }

    // 5. Display current data status
    console.log('\n📊 Step 5: Current data status...');
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_transfers,
        COUNT(CASE WHEN payment_challan_url IS NOT NULL THEN 1 END) as with_challan,
        COUNT(CASE WHEN approved_at IS NOT NULL THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'PAYMENT_PENDING' THEN 1 END) as pending_payment,
        COUNT(CASE WHEN status = 'PAYMENT_UPLOADED' THEN 1 END) as payment_uploaded
      FROM transfer_requests
    `);

    console.log('   Total transfers:', stats.rows[0].total_transfers);
    console.log('   With challan:', stats.rows[0].with_challan);
    console.log('   Approved:', stats.rows[0].approved_count);
    console.log('   Pending payment:', stats.rows[0].pending_payment);
    console.log('   Payment uploaded:', stats.rows[0].payment_uploaded);

    await client.query('COMMIT');

    console.log('\n=====================================================');
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('=====================================================');
    console.log('Next steps:');
    console.log('1. Restart your backend server');
    console.log('2. Test the buyer page to view pending transfers');
    console.log('3. Test uploading payment challan');
    console.log('4. Test LRO approval workflow');
    console.log('=====================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ MIGRATION FAILED!');
    console.error('Error:', err.message);
    console.error('\nFull error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});