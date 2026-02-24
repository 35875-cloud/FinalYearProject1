import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
  user:     process.env.DB_USER     || 'postgres',
  host:     process.env.DB_HOST     || 'localhost',
  database: process.env.DB_NAME     || 'landdb',
  password: process.env.DB_PASSWORD || 'postgres',
  port:     process.env.DB_PORT     || 5432,
});

let io = null;

const activeConnections = new Map(); // userId -> socket.id
const userSockets       = new Map(); // socket.id -> userId

// ─────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────
function initializeSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      credentials: true
    },
    pingTimeout:  60000,
    pingInterval: 25000
  });

  io.use(authenticateSocket);
  io.on('connection', handleConnection);

  console.log('✅ Socket.IO server initialized');
  return io;
}

// ─────────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────────
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.userId   = decoded.userId;
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    console.error('Socket auth failed:', err.message);
    next(new Error('Invalid authentication token'));
  }
}

// ─────────────────────────────────────────────────────────────────
// CONNECTION HANDLER — ALL socket.on() calls are inside this function
// ─────────────────────────────────────────────────────────────────
function handleConnection(socket) {
  const userId = socket.userId;
  console.log(`✅ User connected: ${userId} (${socket.id})`);

  activeConnections.set(userId, socket.id);
  userSockets.set(socket.id, userId);

  // ── JOIN CHANNEL ──────────────────────────────────────────────
  socket.on('join_channel', async (data) => {
    try {
      const { channelId } = data;

      const client = await pool.connect();
      const participant = await client.query(
        'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );

      if (participant.rows.length === 0) {
        client.release();
        socket.emit('error', { message: 'Unauthorized: Not a participant' });
        return;
      }

      const role = participant.rows[0].role;

      await client.query(
        'UPDATE channel_participants SET is_online = true, last_seen = NOW() WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      client.release();

      socket.join(channelId);
      socket.to(channelId).emit('user_joined', { userId, role, timestamp: new Date() });

      console.log(`User ${userId} joined channel ${channelId} as ${role}`);

    } catch (err) {
      console.error('Error joining channel:', err);
      socket.emit('error', { message: 'Failed to join channel' });
    }
  });

  // ── SEND MESSAGE ──────────────────────────────────────────────
  socket.on('send_message', async (data) => {
    try {
      const { channelId, message, messageType = 'TEXT' } = data;

      console.log(`📨 send_message from ${userId} channel=${channelId} msg="${message}"`);

      if (!channelId || !message || !String(message).trim()) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      const client = await pool.connect();

      // 1. Verify participant + get role
      const participant = await client.query(
        'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );

      if (participant.rows.length === 0) {
        client.release();
        socket.emit('error', { message: 'Unauthorized: Not a participant' });
        return;
      }

      const senderRole = participant.rows[0].role;

      // 2. Get transfer_id for this channel
      const transferRow = await client.query(
        'SELECT transfer_id FROM transfer_requests WHERE channel_id = $1',
        [channelId]
      );
      const transferId = transferRow.rows[0]?.transfer_id || null;

      // 3. Insert message — with auto-fallback if transfer_id column missing
      let result;
      try {
        result = await client.query(`
          INSERT INTO channel_messages
            (channel_id, transfer_id, sender_id, sender_role, message_type, message_content)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [channelId, transferId, userId, senderRole, messageType, String(message).trim()]);
      } catch (insertErr) {
        if (insertErr.code === '42703') {
          // transfer_id column doesn't exist — insert without it
          console.warn('⚠️ transfer_id column missing in channel_messages, inserting without it');
          result = await client.query(`
            INSERT INTO channel_messages
              (channel_id, sender_id, sender_role, message_type, message_content)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
          `, [channelId, userId, senderRole, messageType, String(message).trim()]);
        } else {
          throw insertErr;
        }
      }

      client.release();

      const saved = result.rows[0];
      console.log(`✅ Message saved id=${saved.message_id}`);

      // 4. Broadcast to entire channel room (including sender)
      io.to(channelId).emit('new_message', {
        messageId:       saved.message_id,
        senderId:        userId,
        senderRole:      senderRole,
        messageType:     messageType,
        messageContent:  String(message).trim(),
        timestamp:       saved.timestamp || saved.created_at || new Date(),
        isSystemMessage: false
      });

    } catch (err) {
      console.error('Error sending message:', err);
      socket.emit('error', { message: 'Failed to send message: ' + err.message });
    }
  });

  // ── SEND PRICE OFFER ──────────────────────────────────────────
  socket.on('send_price_offer', async (data) => {
    try {
      const { channelId, offeredPrice } = data;

      const client = await pool.connect();

      const participant = await client.query(
        'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );

      if (participant.rows.length === 0) {
        client.release();
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      const senderRole = participant.rows[0].role;

      const transferRow = await client.query(
        'SELECT transfer_id FROM transfer_requests WHERE channel_id = $1',
        [channelId]
      );
      const transferId = transferRow.rows[0]?.transfer_id || null;

      let result;
      try {
        result = await client.query(`
          INSERT INTO channel_messages
            (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, price_offer)
          VALUES ($1, $2, $3, $4, 'PRICE_OFFER', $5, $6)
          RETURNING *
        `, [channelId, transferId, userId, senderRole,
            `Offered price: PKR ${Number(offeredPrice).toLocaleString()}`, offeredPrice]);
      } catch (insertErr) {
        if (insertErr.code === '42703') {
          result = await client.query(`
            INSERT INTO channel_messages
              (channel_id, sender_id, sender_role, message_type, message_content, price_offer)
            VALUES ($1, $2, $3, 'PRICE_OFFER', $4, $5)
            RETURNING *
          `, [channelId, userId, senderRole,
              `Offered price: PKR ${Number(offeredPrice).toLocaleString()}`, offeredPrice]);
        } else {
          throw insertErr;
        }
      }

      client.release();

      const saved = result.rows[0];

      io.to(channelId).emit('new_message', {
        messageId:       saved.message_id,
        senderId:        userId,
        senderRole:      senderRole,
        messageType:     'PRICE_OFFER',
        messageContent:  saved.message_content,
        priceOffer:      offeredPrice,
        timestamp:       saved.timestamp || saved.created_at || new Date(),
        isSystemMessage: false
      });

      console.log(`Price offer ${offeredPrice} sent in channel ${channelId}`);

    } catch (err) {
      console.error('Error sending price offer:', err);
      socket.emit('error', { message: 'Failed to send price offer' });
    }
  });

  // ── AGREE TO DEAL ─────────────────────────────────────────────
  socket.on('agree_to_deal', async (data) => {
    try {
      const { channelId, agreedTerms } = data;

      const client = await pool.connect();
      await client.query('BEGIN');

      const participant = await client.query(
        'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );

      if (participant.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      const role            = participant.rows[0].role;
      const columnName      = role === 'SELLER' ? 'seller_agreed'    : 'buyer_agreed';
      const timestampColumn = role === 'SELLER' ? 'seller_agreed_at' : 'buyer_agreed_at';

      await client.query(`
        UPDATE transfer_requests
        SET ${columnName} = true,
            ${timestampColumn} = NOW(),
            agreement_text = COALESCE(agreement_text, $2)
        WHERE channel_id = $1
      `, [channelId, agreedTerms]);

      const status = await client.query(
        'SELECT seller_agreed, buyer_agreed FROM transfer_requests WHERE channel_id = $1',
        [channelId]
      );

      const bothAgreed = status.rows[0]?.seller_agreed && status.rows[0]?.buyer_agreed;

      if (bothAgreed) {
        await client.query(
          "UPDATE transfer_requests SET channel_status = 'AGREED', agreement_timestamp = NOW() WHERE channel_id = $1",
          [channelId]
        );
      }

      await client.query('COMMIT');
      client.release();

      io.to(channelId).emit('agreement_updated', { role, agreed: true, bothAgreed, timestamp: new Date() });

      if (bothAgreed) {
        io.to(channelId).emit('both_agreed', {
          message: 'Both parties agreed! Please upload a screenshot for LRO verification.',
          timestamp: new Date()
        });
      }

      console.log(`${role} agreed in channel ${channelId}. Both: ${bothAgreed}`);

    } catch (err) {
      console.error('Error recording agreement:', err);
      socket.emit('error', { message: 'Failed to record agreement' });
    }
  });

  // ── TYPING ────────────────────────────────────────────────────
  socket.on('typing', (data) => {
    const { channelId } = data;
    socket.to(channelId).emit('typing', { userId, timestamp: new Date() });
  });

  // ── LEAVE CHANNEL ─────────────────────────────────────────────
  socket.on('leave_channel', async (data) => {
    try {
      const { channelId } = data;
      socket.leave(channelId);

      const client = await pool.connect();
      await client.query(
        'UPDATE channel_participants SET is_online = false, last_seen = NOW() WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      client.release();

      socket.to(channelId).emit('user_left', { userId, timestamp: new Date() });
      console.log(`User ${userId} left channel ${channelId}`);

    } catch (err) {
      console.error('Error leaving channel:', err);
    }
  });

  // ── DISCONNECT ────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    try {
      console.log(`❌ User disconnected: ${userId} (${socket.id})`);
      activeConnections.delete(userId);
      userSockets.delete(socket.id);

      const client = await pool.connect();
      await client.query(
        'UPDATE channel_participants SET is_online = false, last_seen = NOW() WHERE user_id = $1',
        [userId]
      );
      client.release();

    } catch (err) {
      console.error('Error handling disconnect:', err);
    }
  });

} // ← end of handleConnection

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function emitToChannel(channelId, eventName, data) {
  if (io) io.to(channelId).emit(eventName, data);
}

function emitToUser(uid, eventName, data) {
  const socketId = activeConnections.get(uid);
  if (io && socketId) io.to(socketId).emit(eventName, data);
}

async function getOnlineUsers(channelId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT user_id, role FROM channel_participants WHERE channel_id = $1 AND is_online = true',
      [channelId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

function isUserOnline(uid) {
  return activeConnections.has(uid);
}

export default { initializeSocketIO, emitToChannel, emitToUser, getOnlineUsers, isUserOnline };