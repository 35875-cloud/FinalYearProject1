
import crypto from 'crypto';
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
    cors: { origin: '*', credentials: true },
    pingTimeout:  60000,
    pingInterval: 25000,
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
// CONNECTION HANDLER
// ─────────────────────────────────────────────────────────────────
function handleConnection(socket) {
  const userId = socket.userId;
  console.log(`✅ User connected: ${userId} (${socket.id})`);

  // Disconnect stale socket for this user
  const existingSocketId = activeConnections.get(userId);
  if (existingSocketId && existingSocketId !== socket.id) {
    const oldSocket = io.sockets.sockets.get(existingSocketId);
    if (oldSocket) {
      console.log(`⚠️ Disconnecting stale socket ${existingSocketId} for user ${userId}`);
      oldSocket.disconnect(true);
    }
    userSockets.delete(existingSocketId);
  }
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

      const onlineRows = await client.query(
        `SELECT cp.user_id, cp.role FROM channel_participants cp
         WHERE cp.channel_id = $1 AND cp.is_online = true AND cp.user_id != $2`,
        [channelId, userId]
      );
      client.release();

      socket.leave(channelId);
      socket.join(channelId);

      socket.to(channelId).emit('user_joined', { userId, role, timestamp: new Date() });

      for (const row of onlineRows.rows) {
        socket.emit('user_joined', { userId: row.user_id, role: row.role, timestamp: new Date(), alreadyOnline: true });
      }

      socket.emit('self_joined', {
        userId,
        role,
        timestamp: new Date(),
        peerAlreadyOnline: onlineRows.rows.length > 0,
      });

      console.log(`User ${userId} joined channel ${channelId} as ${role}. Online peers: ${onlineRows.rows.length}`);

    } catch (err) {
      console.error('Error joining channel:', err);
      socket.emit('error', { message: 'Failed to join channel' });
    }
  });

  // ── SEND MESSAGE ──────────────────────────────────────────────
  // TEXT and PRICE_OFFER are P2P-only (WebRTC DataChannel).
  // Only IMAGE_MESSAGE and VOICE_MESSAGE go through server (CDN upload).
  socket.on('send_message', async (data) => {
    try {
      const { channelId, message, messageType = 'TEXT' } = data;
      const P2P_ONLY = ['TEXT', 'PRICE_OFFER'];
      if (P2P_ONLY.includes((messageType || '').toUpperCase())) {
        console.warn(`⛔ Blocked server-routed ${messageType} from ${userId} — must use WebRTC`);
        socket.emit('error', { message: `${messageType} must travel via P2P DataChannel` });
        return;
      }

      if (!channelId || !message || !String(message).trim()) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

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
            (channel_id, transfer_id, sender_id, sender_role, message_type, message_content)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [channelId, transferId, userId, senderRole, messageType, String(message).trim()]);
      } catch (insertErr) {
        if (insertErr.code === '42703') {
          result = await client.query(`
            INSERT INTO channel_messages
              (channel_id, sender_id, sender_role, message_type, message_content)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
          `, [channelId, userId, senderRole, messageType, String(message).trim()]);
        } else { throw insertErr; }
      }
      client.release();

      const saved = result.rows[0];
      socket.to(channelId).emit('new_message', {
        messageId:      saved.message_id,
        senderId:       userId,
        senderRole:     senderRole,
        messageType:    messageType,
        messageContent: String(message).trim(),
        timestamp:      saved.timestamp || saved.created_at || new Date(),
        isSystemMessage: false,
      });
      console.log(`✅ Message saved id=${saved.message_id} type=${messageType}`);

    } catch (err) {
      console.error('Error sending message:', err);
      socket.emit('error', { message: 'Failed to send message: ' + err.message });
    }
  });

  // ── SEND PRICE OFFER (blocked — P2P only) ─────────────────────
  socket.on('send_price_offer', () => {
    console.warn(`⛔ Blocked server-routed price offer from ${userId} — must use WebRTC`);
    socket.emit('error', { message: 'Price offers must travel via P2P DataChannel' });
  });

  // ── AGREE TO DEAL ─────────────────────────────────────────────
  socket.on('agree_to_deal', async (data) => {
    const client = await pool.connect();
    try {
      const { channelId, agreedTerms, agreedPrice } = data;
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

      const role        = participant.rows[0].role;
      const colAgreed   = role === 'SELLER' ? 'seller_agreed'    : 'buyer_agreed';
      const colTs       = role === 'SELLER' ? 'seller_agreed_at' : 'buyer_agreed_at';
      const parsedPrice = agreedPrice ? parseFloat(agreedPrice) : null;

      if (parsedPrice && parsedPrice > 0) {
        await client.query(`
          UPDATE transfer_requests
          SET ${colAgreed} = true, ${colTs} = NOW(),
              agreed_price = $3,
              agreement_text = COALESCE(agreement_text, $2)
          WHERE channel_id = $1
        `, [channelId, agreedTerms || 'I agree.', parsedPrice]);
      } else {
        await client.query(`
          UPDATE transfer_requests
          SET ${colAgreed} = true, ${colTs} = NOW(),
              agreement_text = COALESCE(agreement_text, $2)
          WHERE channel_id = $1
        `, [channelId, agreedTerms || 'I agree.']);
      }

      const status = await client.query(
        'SELECT seller_agreed, buyer_agreed, agreed_price, transfer_id FROM transfer_requests WHERE channel_id = $1',
        [channelId]
      );
      const row        = status.rows[0] || {};
      const bothAgreed = row.seller_agreed && row.buyer_agreed;
      const finalPrice = parsedPrice || parseFloat(row.agreed_price || 0);
      const transferId = row.transfer_id || null;

      let agreementHash = null;

      // ── If both agreed: generate SHA-256 hash, update status, store system msg
      if (bothAgreed) {
        const agreementTimestamp = new Date().toISOString();
        const hashInput  = `${channelId}:${transferId}:${finalPrice}:${agreementTimestamp}`;
        agreementHash    = crypto.createHash('sha256').update(hashInput).digest('hex');

        await client.query(`
          UPDATE transfer_requests
          SET channel_status      = 'AGREED',
              agreement_timestamp = NOW(),
              agreement_hash      = $2
          WHERE channel_id = $1
        `, [channelId, agreementHash]);

        await client.query(`
          INSERT INTO channel_messages
            (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, is_system_message)
          VALUES ($1, $2, $3, 'SYSTEM', 'SYSTEM', $4, true)
        `, [
          channelId, transferId, userId,
          `🤝 Both parties agreed at PKR ${Number(finalPrice||0).toLocaleString('en-PK')}. Agreement Hash: ${agreementHash}`,
        ]);
      }
      // ── FIX: COMMIT and release OUTSIDE the if(bothAgreed) block ──
      await client.query('COMMIT');
      client.release();

      // Notify both peers
      io.to(channelId).emit('agreement_updated', {
        role, agreed: true, bothAgreed,
        agreedPrice: finalPrice || null,
        timestamp: new Date(),
      });

      if (bothAgreed) {
        io.to(channelId).emit('both_agreed', {
          message:       'Both parties agreed. Agreement recorded.',
          agreedPrice:   finalPrice || null,
          agreementHash,           // SHA-256 — blockchain uses this
          timestamp:     new Date(),
        });
      }

      console.log(`${role} agreed in channel ${channelId} @ PKR ${finalPrice}. Both: ${bothAgreed}${agreementHash ? ' Hash: ' + agreementHash.slice(0,16) + '…' : ''}`);

    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      client.release();
      console.error('Error recording agreement:', err);
      socket.emit('error', { message: 'Failed to record agreement' });
    }
  });

  // ── DISAGREE ──────────────────────────────────────────────────
  socket.on('disagreed', async (data) => {
    try {
      const { channelId, reason } = data || {};
      if (!channelId) return;

      const client = await pool.connect();
      const pRow = await client.query(
        'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      const role = pRow.rows[0]?.role;
      if (!role) { client.release(); return; }

      await client.query(`
        UPDATE transfer_requests
        SET seller_agreed = false, buyer_agreed = false,
            channel_status = 'NEGOTIATING',
            agreement_hash = null, agreed_price = null
        WHERE channel_id = $1
      `, [channelId]);

      await client.query(`
        INSERT INTO channel_messages
          (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, is_system_message)
        SELECT $1, transfer_id, $3, 'SYSTEM', 'SYSTEM', $4, true
        FROM transfer_requests WHERE channel_id = $1
      `, [channelId, null, userId, `❌ ${role} disagreed. Negotiation reopened.${reason ? ' Reason: ' + reason : ''}`]);

      client.release();
      socket.to(channelId).emit('disagreed', { role, reason, timestamp: new Date() });

    } catch (err) {
      console.error('Error handling disagreed:', err);
    }
  });

  // ── LEAVE CHANNEL ─────────────────────────────────────────────
  socket.on('leave_channel', async (data) => {
    try {
      const { channelId } = data;
      socket.leave(channelId);
      const client = await pool.connect();
      const pRow = await client.query(
        'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      const role = pRow.rows[0]?.role || 'UNKNOWN';
      await client.query(
        'UPDATE channel_participants SET is_online = false, last_seen = NOW() WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      client.release();
      socket.to(channelId).emit('user_left', { userId, role, timestamp: new Date() });
    } catch (err) { console.error('Error leaving channel:', err); }
  });

  // ── TYPING ────────────────────────────────────────────────────
  socket.on('typing', (data) => {
    const { channelId } = data || {};
    if (channelId) socket.to(channelId).emit('typing', { userId, timestamp: new Date() });
  });

  // ── WebRTC SIGNALING (pure relay — server never reads content) ─
  socket.on('webrtc_offer', (data) => {
    const { channelId, offer } = data || {};
    if (!channelId || !offer) return;
    console.log(`📡 WebRTC offer relayed  [${channelId}] from ${userId}`);
    socket.to(channelId).emit('webrtc_offer', { offer, fromUserId: userId });
  });

  socket.on('webrtc_answer', (data) => {
    const { channelId, answer } = data || {};
    if (!channelId || !answer) return;
    console.log(`📡 WebRTC answer relayed [${channelId}] from ${userId}`);
    socket.to(channelId).emit('webrtc_answer', { answer, fromUserId: userId });
  });

  socket.on('webrtc_ice', (data) => {
    const { channelId, candidate } = data || {};
    if (!channelId || !candidate) return;
    socket.to(channelId).emit('webrtc_ice', { candidate, fromUserId: userId });
  });

  socket.on('webrtc_hangup', (data) => {
    const { channelId } = data || {};
    if (channelId) socket.to(channelId).emit('webrtc_hangup', { fromUserId: userId });
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
    } catch (err) { console.error('Error handling disconnect:', err); }
  });

} // ← end handleConnection

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
  } finally { client.release(); }
}
function isUserOnline(uid) { return activeConnections.has(uid); }

export default { initializeSocketIO, emitToChannel, emitToUser, getOnlineUsers, isUserOnline };