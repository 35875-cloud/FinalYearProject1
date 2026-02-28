/**
 * P2P CHANNEL DATABASE MIGRATION
 * Run this: node src/migrations/run_p2p_migration.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'land_registry',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('\n🚀 Starting P2P Channel Migration...\n');
    
    await client.query('BEGIN');
    
    // STEP 1: Add columns to transfer_requests
    console.log('📝 Step 1: Adding columns to transfer_requests...');
    
    // Add columns one by one to avoid issues
    const columns = [
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS channel_id VARCHAR(100)',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS channel_status VARCHAR(20) DEFAULT \'INACTIVE\'',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS channel_created_at TIMESTAMP',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS channel_activated_at TIMESTAMP',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS agreement_screenshot_url TEXT',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS agreement_text TEXT',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS screenshot_uploaded_at TIMESTAMP',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS agreed_price DECIMAL(15,2)',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS negotiated_terms TEXT',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS seller_agreed BOOLEAN DEFAULT FALSE',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS buyer_agreed BOOLEAN DEFAULT FALSE',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS seller_agreed_at TIMESTAMP',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS buyer_agreed_at TIMESTAMP',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS both_agreed_at TIMESTAMP',
      'ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS channel_closed_at TIMESTAMP'
    ];
    
    for (const query of columns) {
      try {
        await client.query(query);
      } catch (err) {
        if (err.code !== '42701') { // Ignore "column already exists" errors
          throw err;
        }
      }
    }
    
    console.log('✅ transfer_requests updated\n');
    
    // STEP 2: Create channel_messages table
    console.log('📝 Step 2: Creating channel_messages table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_messages (
        message_id SERIAL PRIMARY KEY,
        channel_id VARCHAR(100) NOT NULL,
        sender_id VARCHAR(50),
        sender_role VARCHAR(20),
        message_type VARCHAR(20) DEFAULT 'TEXT',
        message_content TEXT,
        price_offer DECIMAL(15,2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_by_other BOOLEAN DEFAULT FALSE,
        is_system_message BOOLEAN DEFAULT FALSE
      )
    `);
    
    console.log('✅ channel_messages created\n');
    
    // STEP 3: Create channel_participants table
    console.log('📝 Step 3: Creating channel_participants table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_participants (
        participant_id SERIAL PRIMARY KEY,
        channel_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL,
        is_online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ channel_participants created\n');
    
    // STEP 4: Create indexes
    console.log('📝 Step 4: Creating indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_id)',
      'CREATE INDEX IF NOT EXISTS idx_channel_messages_timestamp ON channel_messages(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_channel_participants_channel ON channel_participants(channel_id)',
      'CREATE INDEX IF NOT EXISTS idx_channel_participants_user ON channel_participants(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_transfer_requests_channel ON transfer_requests(channel_id)',
      'CREATE INDEX IF NOT EXISTS idx_transfer_requests_channel_status ON transfer_requests(channel_status)'
    ];
    
    for (const query of indexes) {
      try {
        await client.query(query);
      } catch (err) {
        // Ignore if index already exists
      }
    }
    
    console.log('✅ Indexes created\n');
    
    // STEP 5: Verify
    console.log('📝 Step 5: Verifying migration...');
    
    const verify = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transfer_requests' 
      AND column_name LIKE '%channel%'
    `);
    
    console.log('✅ Verification complete');
    console.log(`   Found ${verify.rows.length} channel-related columns\n`);
    
    await client.query('COMMIT');
    
    console.log('========================================');
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('========================================');
    console.log('Tables modified:');
    console.log('  - transfer_requests (added 15 columns)');
    console.log('Tables created:');
    console.log('  - channel_messages');
    console.log('  - channel_participants');
    console.log('Indexes created: 6');
    console.log('\n✅ Database is ready for P2P channels!\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });