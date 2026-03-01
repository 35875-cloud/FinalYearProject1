/**
 * CHANNEL SERVICE
 * 
 * Handles all business logic for P2P negotiation channels including:
 * - Channel creation and lifecycle management
 * - Message handling
 * - Agreement recording
 * - Screenshot uploads
 */


import pkg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import websocketService from './websocket.service.js';

const { Pool } = pkg;

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'land_registry',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

/**
 * 1. CREATE CHANNEL
 * Creates a new P2P negotiation channel for a transfer request
 */
async function createChannel(transferId, sellerId, buyerId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Generate unique channel ID
    const channelId = `ch-${uuidv4()}`;
    
    // Check if channel already exists for this transfer
    const existingChannel = await client.query(
      'SELECT channel_id FROM transfer_requests WHERE transfer_id = $1 AND channel_id IS NOT NULL',
      [transferId]
    );
    
    if (existingChannel.rows.length > 0) {
      throw new Error('Channel already exists for this transfer');
    }
    
    // Update transfer_requests with channel info
    await client.query(`
      UPDATE transfer_requests 
      SET channel_id = $1, 
          channel_created_at = NOW(), 
          channel_status = 'INACTIVE'
      WHERE transfer_id = $2
    `, [channelId, transferId]);
    
    // Add participants
    await client.query(`
      INSERT INTO channel_participants (channel_id, user_id, role)
      VALUES 
        ($1, $2, 'SELLER'),
        ($1, $3, 'BUYER')
    `, [channelId, sellerId, buyerId]);
    
    // Create system message
    await client.query(`
      INSERT INTO channel_messages 
        (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, is_system_message)
      VALUES 
        ($1, $2, $3, 'BUYER', 'SYSTEM', 'Channel created. Waiting for seller acceptance.', true)
    `, [channelId, transferId, buyerId]);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      channelId,
      participants: [
        { userId: sellerId, role: 'SELLER' },
        { userId: buyerId, role: 'BUYER' }
      ],
      status: 'INACTIVE',
      createdAt: new Date()
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 2. ACTIVATE CHANNEL
 * Activates channel when seller accepts the transfer request
 */
async function activateChannel(channelId) {
  const client = await pool.connect();
  
  try {
    // Update channel status
    const result = await client.query(`
      UPDATE transfer_requests 
      SET channel_status = 'ACTIVE'
      WHERE channel_id = $1
      RETURNING transfer_id, channel_status
    `, [channelId]);
    
    if (result.rows.length === 0) {
      throw new Error('Channel not found');
    }
    
    // Add system message
    await client.query(`
      INSERT INTO channel_messages 
        (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, is_system_message)
      SELECT $1, transfer_id, buyer_id, 'BUYER', 'SYSTEM', 'Channel activated. Both parties can now negotiate.', true
      FROM transfer_requests
      WHERE channel_id = $1
    `, [channelId]);
    
    return {
      success: true,
      channelId,
      status: 'ACTIVE'
    };
    
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 3. SEND MESSAGE
 * Sends a message in the channel
 */
async function sendMessage(channelId, senderId, messageType, messageContent, priceOffer = null) {
  const client = await pool.connect();
  
  try {
    // Verify sender is a participant
    const participant = await client.query(
      'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
      [channelId, senderId]
    );
    
    if (participant.rows.length === 0) {
      throw new Error('User is not a participant in this channel');
    }
    
    const senderRole = participant.rows[0].role;
    
    // Get transfer_id
    const transfer = await client.query(
      'SELECT transfer_id FROM transfer_requests WHERE channel_id = $1',
      [channelId]
    );
    
    const transferId = transfer.rows[0]?.transfer_id;
    
    // Insert message
    const result = await client.query(`
      INSERT INTO channel_messages 
        (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, price_offer)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [channelId, transferId, senderId, senderRole, messageType, messageContent, priceOffer]);
    
    // Update channel status to NEGOTIATING if it's ACTIVE
    await client.query(`
      UPDATE transfer_requests 
      SET channel_status = 'NEGOTIATING'
      WHERE channel_id = $1 AND channel_status = 'ACTIVE'
    `, [channelId]);
    
    return {
      success: true,
      message: result.rows[0]
    };
    
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 4. RECORD AGREEMENT
 * Records when a participant agrees to the terms
 */
async function recordAgreement(channelId, userId, agreedTerms) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get participant role
    const participant = await client.query(
      'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId]
    );
    
    if (participant.rows.length === 0) {
      throw new Error('User is not a participant in this channel');
    }
    
    const role = participant.rows[0].role;
    
    // Update agreement flag based on role
    const columnName = role === 'SELLER' ? 'seller_agreed' : 'buyer_agreed';
    const timestampColumn = role === 'SELLER' ? 'seller_agreed_at' : 'buyer_agreed_at';
    
    await client.query(`
      UPDATE transfer_requests 
      SET ${columnName} = true, 
          ${timestampColumn} = NOW(),
          agreement_text = COALESCE(agreement_text, $2)
      WHERE channel_id = $1
    `, [channelId, agreedTerms]);
    
    // Check if both parties have agreed
    const agreementStatus = await client.query(`
      SELECT seller_agreed, buyer_agreed 
      FROM transfer_requests 
      WHERE channel_id = $1
    `, [channelId]);
    
    const bothAgreed = agreementStatus.rows[0].seller_agreed && agreementStatus.rows[0].buyer_agreed;
    
    // If both agreed, update channel status
    if (bothAgreed) {
      await client.query(`
        UPDATE transfer_requests 
        SET channel_status = 'AGREED',
            agreement_timestamp = NOW()
        WHERE channel_id = $1
      `, [channelId]);
      
      // Add system message
      await client.query(`
        INSERT INTO channel_messages 
          (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, is_system_message)
        SELECT $1, transfer_id, buyer_id, 'BUYER', 'SYSTEM', 'Both parties have agreed! Please upload a screenshot of the agreement.', true
        FROM transfer_requests
        WHERE channel_id = $1
      `, [channelId]);
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      role,
      agreed: true,
      bothAgreed,
      timestamp: new Date()
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 5. UPLOAD SCREENSHOT
 * Stores screenshot URL and agreed price
 */
async function uploadScreenshot(channelId, screenshotUrl, agreedPrice, agreedTerms) {
  const client = await pool.connect();
  
  try {
    // Verify both parties have agreed
    const agreementCheck = await client.query(`
      SELECT seller_agreed, buyer_agreed 
      FROM transfer_requests 
      WHERE channel_id = $1
    `, [channelId]);
    
    if (agreementCheck.rows.length === 0) {
      throw new Error('Channel not found');
    }
    
    const { seller_agreed, buyer_agreed } = agreementCheck.rows[0];
    
    if (!seller_agreed || !buyer_agreed) {
      throw new Error('Both parties must agree before uploading screenshot');
    }
    
    // Update transfer request with screenshot
    await client.query(`
      UPDATE transfer_requests 
      SET agreement_screenshot_url = $1,
          agreed_price = $2,
          agreement_text = COALESCE(agreement_text, $3),
          channel_status = 'AGREED'
      WHERE channel_id = $4
    `, [screenshotUrl, agreedPrice, agreedTerms, channelId]);
    
    // Add system message
    await client.query(`
      INSERT INTO channel_messages 
        (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, is_system_message)
      SELECT $1, transfer_id, buyer_id, 'BUYER', 'SCREENSHOT', 'Agreement screenshot uploaded. Awaiting LRO approval.', true
      FROM transfer_requests
      WHERE channel_id = $1
    `, [channelId]);
    
    return {
      success: true,
      screenshotUrl,
      agreedPrice,
      status: 'AGREED'
    };
    
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 6. GET CHANNEL HISTORY
 * Retrieves all messages in a channel
 */
async function getChannelHistory(channelId, userId, limit = 50, offset = 0) {
  const client = await pool.connect();
  
  try {
    // Verify user is a participant
    const participant = await client.query(
      'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId]
    );
    
    if (participant.rows.length === 0) {
      throw new Error('Unauthorized: User is not a participant in this channel');
    }
    
    // Get messages
    const messages = await client.query(`
      SELECT 
        m.message_id,
        m.sender_id,
        m.sender_role,
        m.message_type,
        m.message_content,
        m.price_offer,
        m.timestamp,
        m.is_system_message,
        u.name as sender_name
      FROM channel_messages m
      LEFT JOIN users u ON m.sender_id = u.user_id
      WHERE m.channel_id = $1
      ORDER BY m.timestamp ASC
      LIMIT $2 OFFSET $3
    `, [channelId, limit, offset]);
    
    return {
      success: true,
      messages: messages.rows,
      count: messages.rows.length
    };
    
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 7. GET CHANNEL DETAILS
 * Gets complete channel information
 */
async function getChannelDetails(channelId, userId) {
  const client = await pool.connect();
  
  try {
    // Verify user is a participant
    const participant = await client.query(
      'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId]
    );
    
    if (participant.rows.length === 0) {
      throw new Error('Unauthorized: User is not a participant in this channel');
    }
    
    // Get channel details — includes seller & buyer name + CNIC via user JOIN
    const channel = await client.query(`
      SELECT 
        tr.transfer_id,
        tr.channel_id,
        tr.channel_status,
        tr.channel_created_at,
        tr.agreement_screenshot_url,
        tr.agreement_text,
        tr.agreement_timestamp,
        tr.agreed_price,
        tr.seller_agreed,
        tr.buyer_agreed,
        tr.seller_agreed_at,
        tr.buyer_agreed_at,
        tr.property_id,
        tr.seller_id,
        tr.buyer_id,
        seller.name  AS seller_name,
        seller.cnic  AS seller_cnic,
        buyer.name   AS buyer_name,
        buyer.cnic   AS buyer_cnic,
        CONCAT(p.district, ', ', p.tehsil, ', ', p.mauza) AS property_location,
        p.area_marla AS property_size,
        p.district,
        p.tehsil,
        p.mauza
      FROM transfer_requests tr
      JOIN  properties p      ON tr.property_id = p.property_id
      LEFT JOIN users  seller ON tr.seller_id   = seller.user_id
      LEFT JOIN users  buyer  ON tr.buyer_id    = buyer.user_id
      WHERE tr.channel_id = $1
    `, [channelId]);
    
    if (channel.rows.length === 0) {
      throw new Error('Channel not found');
    }
    
    // Get participants
    const participants = await client.query(`
      SELECT 
        cp.user_id,
        cp.role,
        cp.is_online,
        cp.last_seen,
        u.name
      FROM channel_participants cp
      JOIN users u ON cp.user_id = u.user_id
      WHERE cp.channel_id = $1
    `, [channelId]);
    
    return {
      success: true,
      channel: channel.rows[0],
      participants: participants.rows
    };
    
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 8. CLOSE CHANNEL
 * Closes a channel (called after LRO approval)
 */
async function closeChannel(channelId) {
  const client = await pool.connect();
  
  try {
    await client.query(`
      UPDATE transfer_requests 
      SET channel_status = 'CLOSED'
      WHERE channel_id = $1
    `, [channelId]);
    
    // Set all participants offline
    await client.query(`
      UPDATE channel_participants 
      SET is_online = false
      WHERE channel_id = $1
    `, [channelId]);
    
    // Add system message
    await client.query(`
      INSERT INTO channel_messages 
        (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, is_system_message)
      SELECT $1, transfer_id, buyer_id, 'BUYER', 'SYSTEM', 'Channel closed. Transfer has been approved by LRO.', true
      FROM transfer_requests
      WHERE channel_id = $1
    `, [channelId]);
    
    return {
      success: true,
      status: 'CLOSED'
    };
    
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 9. VALIDATE CHANNEL ACCESS
 * Checks if user has access to a channel
 */
async function validateChannelAccess(channelId, userId) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId]
    );
    
    return {
      hasAccess: result.rows.length > 0,
      role: result.rows[0]?.role || null
    };
    
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 10. GET USER CHANNELS
 * Gets all channels for a user
 */
async function getUserChannels(userId) {
  const client = await pool.connect();
  
  try {
    const channels = await client.query(`
      SELECT 
        tr.channel_id,
        tr.channel_status,
        tr.channel_created_at,
        tr.property_id,
        tr.seller_agreed,
        tr.buyer_agreed,
        cp.role as user_role,
        CONCAT(p.district, ', ', p.tehsil, ', ', p.mauza) as property_location,
        COUNT(cm.message_id) as total_messages,
        MAX(cm.timestamp) as last_message_at
      FROM channel_participants cp
      JOIN transfer_requests tr ON cp.channel_id = tr.channel_id
      JOIN properties p ON tr.property_id = p.property_id
      LEFT JOIN channel_messages cm ON cp.channel_id = cm.channel_id
      WHERE cp.user_id = $1
      GROUP BY tr.channel_id, tr.channel_status, tr.channel_created_at, 
               tr.property_id, tr.seller_agreed, tr.buyer_agreed, 
               cp.role, p.district, p.tehsil, p.mauza
      ORDER BY tr.channel_created_at DESC
    `, [userId]);
    
    return {
      success: true,
      channels: channels.rows
    };
    
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

export default {
  createChannel,
  activateChannel,
  sendMessage,
  recordAgreement,
  uploadScreenshot,
  getChannelHistory,
  getChannelDetails,
  closeChannel,
  validateChannelAccess,
  getUserChannels
};