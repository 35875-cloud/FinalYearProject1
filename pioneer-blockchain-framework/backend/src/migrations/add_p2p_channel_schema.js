/**
 * PHASE 1: P2P WEBSOCKET CHANNEL - DATABASE MIGRATION
 * 
 * This migration adds support for real-time buyer-seller negotiation channels
 * to the existing land registry blockchain system.
 * 
 * Tables Modified:
 * - transfer_requests: Added channel tracking columns
 * 
 * Tables Created:
 * - channel_messages: Stores all chat messages
 * - channel_participants: Tracks channel members
 */

import pg from 'pg';
import dotenv from 'dotenv';


dotenv.config();

const { Pool } = pg;

// Database connection
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
    console.log('🚀 Starting P2P Channel Schema Migration...\n');
    
    await client.query('BEGIN');
    
    // =====================================================================
    // STEP 1: MODIFY TRANSFER_REQUESTS TABLE
    // =====================================================================
    console.log('📝 Step 1: Adding columns to transfer_requests table...');
    
    await client.query(`
      -- Channel tracking columns
      ALTER TABLE transfer_requests
      ADD COLUMN IF NOT EXISTS channel_id VARCHAR(100) UNIQUE,
      ADD COLUMN IF NOT EXISTS channel_created_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS channel_status VARCHAR(20) DEFAULT 'INACTIVE'
        CHECK (channel_status IN ('INACTIVE', 'ACTIVE', 'NEGOTIATING', 'AGREED', 'CLOSED')),
      
      -- Agreement details
      ADD COLUMN IF NOT EXISTS agreement_screenshot_url TEXT,
      ADD COLUMN IF NOT EXISTS agreement_text TEXT,
      ADD COLUMN IF NOT EXISTS agreement_timestamp TIMESTAMP,
      ADD COLUMN IF NOT EXISTS agreed_price DECIMAL(15,2),
      ADD COLUMN IF NOT EXISTS negotiated_terms JSONB,
      
      -- Participant agreement flags
      ADD COLUMN IF NOT EXISTS seller_agreed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS buyer_agreed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS seller_agreed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS buyer_agreed_at TIMESTAMP;
    `);
    
    console.log('✅ transfer_requests table updated\n');
    
    // =====================================================================
    // STEP 2: CREATE CHANNEL_MESSAGES TABLE
    // =====================================================================
    console.log('📝 Step 2: Creating channel_messages table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_messages (
        message_id SERIAL PRIMARY KEY,
        channel_id VARCHAR(100) NOT NULL,
        transfer_request_id INTEGER,
        sender_id VARCHAR(50) NOT NULL,
        sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('SELLER', 'BUYER')),
        message_type VARCHAR(20) NOT NULL 
          CHECK (message_type IN ('TEXT', 'PRICE_OFFER', 'AGREEMENT', 'SCREENSHOT', 'SYSTEM')),
        message_content TEXT,
        price_offer DECIMAL(15,2),
        timestamp TIMESTAMP DEFAULT NOW(),
        read_by_other BOOLEAN DEFAULT FALSE,
        is_system_message BOOLEAN DEFAULT FALSE,
        
        -- Foreign key constraints
        CONSTRAINT fk_transfer_request 
          FOREIGN KEY (transfer_request_id) 
          REFERENCES transfer_requests(transfer_id) 
          ON DELETE CASCADE,
        
        CONSTRAINT fk_sender 
          FOREIGN KEY (sender_id) 
          REFERENCES users(user_id) 
          ON DELETE CASCADE
      );
    `);
    
    // Add indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_channel_messages_channel 
        ON channel_messages(channel_id);
      
      CREATE INDEX IF NOT EXISTS idx_channel_messages_timestamp 
        ON channel_messages(channel_id, timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_channel_messages_sender 
        ON channel_messages(sender_id);
    `);
    
    console.log('✅ channel_messages table created with indexes\n');
    
    // =====================================================================
    // STEP 3: CREATE CHANNEL_PARTICIPANTS TABLE
    // =====================================================================
    console.log('📝 Step 3: Creating channel_participants table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_participants (
        participant_id SERIAL PRIMARY KEY,
        channel_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('SELLER', 'BUYER')),
        joined_at TIMESTAMP DEFAULT NOW(),
        last_seen TIMESTAMP DEFAULT NOW(),
        is_online BOOLEAN DEFAULT FALSE,
        
        -- Ensure one user can't be in same channel twice
        UNIQUE(channel_id, user_id),
        
        -- Foreign key constraint
        CONSTRAINT fk_participant_user 
          FOREIGN KEY (user_id) 
          REFERENCES users(user_id) 
          ON DELETE CASCADE
      );
    `);
    
    // Add indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_channel_participants_channel 
        ON channel_participants(channel_id);
      
      CREATE INDEX IF NOT EXISTS idx_channel_participants_user 
        ON channel_participants(user_id);
      
      CREATE INDEX IF NOT EXISTS idx_channel_participants_online 
        ON channel_participants(channel_id, is_online);
    `);
    
    console.log('✅ channel_participants table created with indexes\n');
    
    // =====================================================================
    // STEP 4: ADD COMMENTS FOR DOCUMENTATION
    // =====================================================================
    console.log('📝 Step 4: Adding table comments...');
    
    await client.query(`
      COMMENT ON COLUMN transfer_requests.channel_id IS 
        'Unique identifier for P2P negotiation channel';
      
      COMMENT ON COLUMN transfer_requests.channel_status IS 
        'Current state of negotiation: INACTIVE, ACTIVE, NEGOTIATING, AGREED, CLOSED';
      
      COMMENT ON COLUMN transfer_requests.negotiated_terms IS 
        'JSON object storing complete negotiation history';
      
      COMMENT ON TABLE channel_messages IS 
        'Stores all messages exchanged in P2P negotiation channels';
      
      COMMENT ON TABLE channel_participants IS 
        'Tracks participants in each negotiation channel';
    `);
    
    console.log('✅ Documentation comments added\n');
    
    // =====================================================================
    // STEP 5: VERIFY MIGRATION
    // =====================================================================
    console.log('📝 Step 5: Verifying migration...');
    
    const verifyTransferRequests = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transfer_requests' 
        AND column_name LIKE '%channel%' 
        OR column_name LIKE '%agreement%' 
        OR column_name LIKE '%agreed%'
      ORDER BY column_name;
    `);
    
    const verifyMessages = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'channel_messages';
    `);
    
    const verifyParticipants = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'channel_participants';
    `);
    
    console.log('✅ Verification complete');
    console.log(`   - transfer_requests: ${verifyTransferRequests.rows.length} new columns`);
    console.log(`   - channel_messages: ${verifyMessages.rows.length > 0 ? 'Created' : 'Failed'}`);
    console.log(`   - channel_participants: ${verifyParticipants.rows.length > 0 ? 'Created' : 'Failed'}\n`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('🎉 Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Install packages: npm install socket.io multer uuid');
    console.log('2. Create uploads directory: mkdir -p uploads/agreements');
    console.log('3. Start implementing backend services\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    throw error;
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
