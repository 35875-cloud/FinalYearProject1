/**
 * WEBSOCKET SERVICE
 * 
 * Manages Socket.IO connections and real-time communication for P2P channels
 * - Socket authentication
 * - Room management
 * - Event broadcasting
 * - Online status tracking
 */


import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pkg from 'pg';


const { Pool } = pkg;

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'land_registry',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

let io = null;

// Store active connections
const activeConnections = new Map(); // userId -> socket.id
const userSockets = new Map(); // socket.id -> userId

/**
 * Initialize Socket.IO server
 */
function initializeSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });
  
  // Authentication middleware
  io.use(authenticateSocket);
  
  // Handle connections
  io.on('connection', handleConnection);
  
  console.log('✅ Socket.IO server initialized');
  
  return io;
}

/**
 * Authenticate socket connection using JWT
 */
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Attach user info to socket
    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    
    next();
  } catch (error) {
    console.error('Socket authentication failed:', error.message);
    next(new Error('Invalid authentication token'));
  }
}

/**
 * Handle new socket connection
 */
function handleConnection(socket) {
  const userId = socket.userId;
  
  console.log(`✅ User connected: ${userId} (${socket.id})`);
  
  // Store connection
  activeConnections.set(userId, socket.id);
  userSockets.set(socket.id, userId);
  
  // ================================================================
  // EVENT: JOIN CHANNEL
  // ================================================================
  socket.on('join_channel', async (data) => {
    try {
      const { channelId } = data;
      
      // Verify user is participant
      const client = await pool.connect();
      const participant = await client.query(
        'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      client.release();
      
      if (participant.rows.length === 0) {
        socket.emit('error', { message: 'Unauthorized: Not a participant' });
        return;
      }
      
      const role = participant.rows[0].role;
      
      // Join the socket room
      socket.join(channelId);
      
      // Update participant status to online
      const updateClient = await pool.connect();
      await updateClient.query(`
        UPDATE channel_participants 
        SET is_online = true, last_seen = NOW()
        WHERE channel_id = $1 AND user_id = $2
      `, [channelId, userId]);
      updateClient.release();
      
      // Notify others in the channel
      socket.to(channelId).emit('user_joined', {
        userId,
        role,
        timestamp: new Date()
      });
      
      console.log(`User ${userId} joined channel ${channelId} as ${role}`);
      
    } catch (error) {
      console.error('Error joining channel:', error);
      socket.emit('error', { message: 'Failed to join channel' });
    }
  });
  
  // ================================================================
  // EVENT: SEND MESSAGE
  // ================================================================
  // In websocket.service.js, modify the send_message handler:

socket.on('send_message', async (data) => {
  try {
    const { channelId, message, messageType = 'TEXT' } = data;
    
    // ... existing code ...
    
    const savedMessage = result.rows[0];
    
    // Broadcast to all in channel (online users get it immediately)
    io.to(channelId).emit('new_message', {
      messageId: savedMessage.message_id,
      senderId: userId,
      senderRole,
      messageType,
      messageContent: message,
      timestamp: savedMessage.timestamp,
      isSystemMessage: false
    });
    
    // If recipient is offline, they'll see it when they connect
    // because transfer_negotiation.html loads all messages on init
    
    console.log(`Message sent in channel ${channelId} by ${userId}`);
    
  } catch (error) {
    console.error('Error sending message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
});
  // ================================================================
  // EVENT: SEND PRICE OFFER
  // ================================================================
  socket.on('send_price_offer', async (data) => {
    try {
      const { channelId, offeredPrice } = data;
      
      const client = await pool.connect();
      
      // Verify participant
      const participant = await client.query(
        'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      
      if (participant.rows.length === 0) {
        socket.emit('error', { message: 'Unauthorized' });
        client.release();
        return;
      }
      
      const senderRole = participant.rows[0].role;
      
      // Get transfer_id
      const transfer = await client.query(
        'SELECT transfer_id FROM transfer_requests WHERE channel_id = $1',
        [channelId]
      );
      const transferId = transfer.rows[0]?.transfer_id;
      
      // Save price offer
      const result = await client.query(`
        INSERT INTO channel_messages 
          (channel_id, transfer_request_id, sender_id, sender_role, message_type, message_content, price_offer)
        VALUES ($1, $2, $3, $4, 'PRICE_OFFER', $5, $6)
        RETURNING *
      `, [
        channelId, 
        transferId, 
        userId, 
        senderRole, 
        `Offered price: PKR ${offeredPrice.toLocaleString()}`, 
        offeredPrice
      ]);
      
      client.release();
      
      const savedOffer = result.rows[0];
      
      // Broadcast to channel
      io.to(channelId).emit('new_message', {
        messageId: savedOffer.message_id,
        senderId: userId,
        senderRole,
        messageType: 'PRICE_OFFER',
        messageContent: savedOffer.message_content,
        priceOffer: offeredPrice,
        timestamp: savedOffer.timestamp,
        isSystemMessage: false
      });
      
      console.log(`Price offer of ${offeredPrice} sent in channel ${channelId}`);
      
    } catch (error) {
      console.error('Error sending price offer:', error);
      socket.emit('error', { message: 'Failed to send price offer' });
    }
  });
  
  // ================================================================
  // EVENT: AGREE TO DEAL
  // ================================================================
  socket.on('agree_to_deal', async (data) => {
    try {
      const { channelId, agreedTerms } = data;
      
      const client = await pool.connect();
      
      await client.query('BEGIN');
      
      // Get participant role
      const participant = await client.query(
        'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      
      if (participant.rows.length === 0) {
        socket.emit('error', { message: 'Unauthorized' });
        await client.query('ROLLBACK');
        client.release();
        return;
      }
      
      const role = participant.rows[0].role;
      
      // Update agreement flag
      const columnName = role === 'SELLER' ? 'seller_agreed' : 'buyer_agreed';
      const timestampColumn = role === 'SELLER' ? 'seller_agreed_at' : 'buyer_agreed_at';
      
      await client.query(`
        UPDATE transfer_requests 
        SET ${columnName} = true, 
            ${timestampColumn} = NOW(),
            agreement_text = COALESCE(agreement_text, $2)
        WHERE channel_id = $1
      `, [channelId, agreedTerms]);
      
      // Check if both agreed
      const agreementStatus = await client.query(`
        SELECT seller_agreed, buyer_agreed 
        FROM transfer_requests 
        WHERE channel_id = $1
      `, [channelId]);
      
      const bothAgreed = agreementStatus.rows[0].seller_agreed && agreementStatus.rows[0].buyer_agreed;
      
      if (bothAgreed) {
        await client.query(`
          UPDATE transfer_requests 
          SET channel_status = 'AGREED', agreement_timestamp = NOW()
          WHERE channel_id = $1
        `, [channelId]);
      }
      
      await client.query('COMMIT');
      client.release();
      
      // Emit agreement update
      io.to(channelId).emit('agreement_updated', {
        role,
        agreed: true,
        bothAgreed,
        timestamp: new Date()
      });
      
      // If both agreed, emit special event
      if (bothAgreed) {
        io.to(channelId).emit('both_agreed', {
          message: 'Both parties have agreed! Please upload a screenshot of the agreement.',
          timestamp: new Date()
        });
      }
      
      console.log(`${role} agreed in channel ${channelId}. Both agreed: ${bothAgreed}`);
      
    } catch (error) {
      console.error('Error recording agreement:', error);
      socket.emit('error', { message: 'Failed to record agreement' });
    }
  });
  
  // ================================================================
  // EVENT: TYPING INDICATOR
  // ================================================================
  socket.on('typing', (data) => {
    const { channelId } = data;
    socket.to(channelId).emit('typing', {
      userId,
      timestamp: new Date()
    });
  });
  
  // ================================================================
  // EVENT: LEAVE CHANNEL
  // ================================================================
  socket.on('leave_channel', async (data) => {
    try {
      const { channelId } = data;
      
      socket.leave(channelId);
      
      // Update participant status
      const client = await pool.connect();
      await client.query(`
        UPDATE channel_participants 
        SET is_online = false, last_seen = NOW()
        WHERE channel_id = $1 AND user_id = $2
      `, [channelId, userId]);
      client.release();
      
      // Notify others
      socket.to(channelId).emit('user_left', {
        userId,
        timestamp: new Date()
      });
      
      console.log(`User ${userId} left channel ${channelId}`);
      
    } catch (error) {
      console.error('Error leaving channel:', error);
    }
  });
  
  // ================================================================
  // EVENT: DISCONNECT
  // ================================================================
  socket.on('disconnect', async () => {
    try {
      console.log(`❌ User disconnected: ${userId} (${socket.id})`);
      
      // Remove from active connections
      activeConnections.delete(userId);
      userSockets.delete(socket.id);
      
      // Update all channels where user is participant
      const client = await pool.connect();
      await client.query(`
        UPDATE channel_participants 
        SET is_online = false, last_seen = NOW()
        WHERE user_id = $1
      `, [userId]);
      client.release();
      
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
}

/**
 * Emit event to specific channel
 */
function emitToChannel(channelId, eventName, data) {
  if (io) {
    io.to(channelId).emit(eventName, data);
  }
}

/**
 * Emit event to specific user
 */
function emitToUser(userId, eventName, data) {
  const socketId = activeConnections.get(userId);
  if (io && socketId) {
    io.to(socketId).emit(eventName, data);
  }
}

/**
 * Get online users in a channel
 */
async function getOnlineUsers(channelId) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT user_id, role 
      FROM channel_participants 
      WHERE channel_id = $1 AND is_online = true
    `, [channelId]);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting online users:', error);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Check if user is online
 */
function isUserOnline(userId) {
  return activeConnections.has(userId);
}

export default {
  initializeSocketIO,
  emitToChannel,
  emitToUser,
  getOnlineUsers,
  isUserOnline
};
