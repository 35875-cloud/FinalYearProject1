// ═══════════════════════════════════════════════════════════════════
//  websocket_service.js
//  Location: backend/src/services/websocket_service.js
//
//  Changes from previous version:
//    REMOVED:  send_message handler (was writing plaintext to DB)
//    REMOVED:  new_message emit for text/image/voice
//    ADDED:    p2p_msg handler — relay encrypted blob or store offline
//    ADDED:    WebRTC signaling: rtc_call_offer, rtc_call_answer,
//              rtc_ice_candidate, rtc_call_reject, rtc_call_end, rtc_call_busy
//    ADDED:    on-connect fetch_pending notification
//    ADDED:    Transfer workflow handlers: join_lro_room, watch_transfer,
//              receipt_timer_tick, agree_ack, proof_uploaded,
//              seller_proof_uploaded, challenge_filed, deadline_ack
//    ADDED:    emitToTransfer, emitToLRO helper functions
//    UNCHANGED: join_channel, send_price_offer, agree_to_deal,
//               leave_channel, typing, disconnect, mark_read helpers
// ═══════════════════════════════════════════════════════════════════

import { Server } from 'socket.io';
import jwt        from 'jsonwebtoken';
import pkg        from 'pg';
import crypto     from 'crypto';
import fabricService from './fabric.service.mock.js';

const { Pool } = pkg;

const pool = new Pool({
  user:     process.env.DB_USER     || 'postgres',
  host:     process.env.DB_HOST     || 'localhost',
  database: process.env.DB_NAME     || 'landdb',
  password: process.env.DB_PASSWORD || 'postgres',
  port:     process.env.DB_PORT     || 5432,
});

let io = null;
const activeConnections = new Map(); // userId  → socket.id
const userSockets       = new Map(); // socket.id → userId

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

  globalThis.__websocketService = { getIO: () => io };
  console.log('✅ Socket.IO server initialized');
  return io;
}

// ─────────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE (unchanged)
// ─────────────────────────────────────────────────────────────────
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    const decoded  = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');
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
    if (oldSocket) { console.log(`⚠️ Disconnecting stale socket for ${userId}`); oldSocket.disconnect(true); }
    userSockets.delete(existingSocketId);
  }
  activeConnections.set(userId, socket.id);
  userSockets.set(socket.id, userId);

  // Auto-join LRO room if the connected user is an officer
  const role = (socket.userRole || '').toUpperCase();
  if (['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'DC', 'AC', 'ADMIN'].includes(role)) {
    socket.join('lro_room');
    console.log(`⚖️  Officer ${userId} (${role}) auto-joined lro_room`);
  }

  // Notify client if they have pending encrypted offline messages to fetch
  (async () => {
    try {
      const pending = await pool.query(
        `SELECT COUNT(*) AS cnt FROM p2p_messages
          WHERE recipient_id = $1 AND delivered = false AND expires_at > NOW()`,
        [userId]
      );
      if (parseInt(pending.rows[0]?.cnt) > 0) {
        socket.emit('fetch_pending');
        console.log(`📬 Notified ${userId} of ${pending.rows[0].cnt} pending encrypted messages`);
      }
    } catch (e) {
      // p2p_messages table might not exist yet (before migration) — silent
    }
  })();

  // ══════════════════════════════════════════════════════════════
  // JOIN CHANNEL  (unchanged)
  // ══════════════════════════════════════════════════════════════
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

      // Notify others I joined (include my userId so they can set recipientId)
      socket.to(channelId).emit('user_joined', { userId, role, timestamp: new Date() });

      // Tell me who is already online — include their userIds so I can set recipientId
      const onlineOthers = onlineRows.rows.map(r => ({ userId: r.user_id, role: r.role }));
      for (const other of onlineOthers) {
        socket.emit('user_joined', { userId: other.userId, role: other.role, timestamp: new Date(), alreadyOnline: true });
      }

      // self_joined now includes all OTHER participants (online + offline) for recipientId resolution
      const allParts = await pool.query(
        'SELECT user_id, role FROM channel_participants WHERE channel_id = $1 AND user_id != $2',
        [channelId, userId]
      );
      socket.emit('self_joined', {
        userId, role, timestamp: new Date(),
        others: allParts.rows.map(r => ({ userId: r.user_id, role: r.role })),
      });

      console.log(`User ${userId} joined channel ${channelId} as ${role}. Online peers: ${onlineRows.rows.length}`);

    } catch (err) {
      console.error('Error joining channel:', err);
      socket.emit('error', { message: 'Failed to join channel' });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // P2P_MSG — Encrypted message relay (REPLACES send_message)
  //
  // Payload: { channelId, recipientId, cipherBlob, iv, ephPub, senderHash, messageType, ts }
  //
  // Server NEVER decrypts — it only routes the opaque blob.
  // If recipient online  → relay directly via socket
  // If recipient offline → save encrypted blob to p2p_messages table
  // ══════════════════════════════════════════════════════════════
  socket.on('p2p_msg', async (data) => {
    try {
      const {
        channelId, recipientId, cipherBlob, iv,
        ephPub,           // OLD format (single-key)
        keyForSender,     // NEW format (double-key)
        keyForRecipient,  // NEW format (double-key)
        senderHash, messageType, ts,
      } = data;

      if (!channelId || !recipientId || !cipherBlob || !iv) {
        socket.emit('error', { message: 'p2p_msg: missing required fields' });
        return;
      }

      // Security: sender must be a participant in this channel
      const partCheck = await pool.query(
        'SELECT 1 FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      if (!partCheck.rows.length) {
        socket.emit('error', { message: 'Unauthorized: Not a channel participant' });
        return;
      }

      // ── ALWAYS save to DB ──────────────────────────────────────
      // Saved whether recipient is online or not.
      // This is what makes history work on refresh for BOTH parties.
      let messageId = null;
      try {
        // Detect packet format — new double-key or old single-key
        const isNewFormat = keyForSender && keyForRecipient;
        const result = await pool.query(
          `INSERT INTO p2p_messages
             (channel_id, sender_id, recipient_id, cipher_blob, iv,
              ephemeral_pub, key_for_sender, key_for_recipient,
              sender_hash, message_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING message_id`,
          [
            channelId,
            userId,           // sender_id — so sender can load own history
            recipientId,
            cipherBlob,
            iv,
            isNewFormat ? null : (ephPub || null),
            isNewFormat ? JSON.stringify(keyForSender)    : null,
            isNewFormat ? JSON.stringify(keyForRecipient) : null,
            senderHash || null,
            messageType || 'TEXT',
          ]
        );
        messageId = result.rows[0].message_id;
      } catch (dbErr) {
        console.warn('p2p_messages insert failed:', dbErr.message);
        // If new columns don't exist yet (migration not run), fall back to old schema
        try {
          const fallback = await pool.query(
            `INSERT INTO p2p_messages
               (channel_id, recipient_id, cipher_blob, iv, ephemeral_pub, sender_hash, message_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             RETURNING message_id`,
            [channelId, recipientId, cipherBlob, iv, ephPub || null, senderHash || null, messageType || 'TEXT']
          );
          messageId = fallback.rows[0].message_id;
        } catch (fallbackErr) {
          console.error('p2p_messages fallback insert also failed:', fallbackErr.message);
        }
      }

      // ── Relay to recipient if online ───────────────────────────
      const recipientSocketId = activeConnections.get(recipientId);
      const recipientSocket   = recipientSocketId && io.sockets.sockets.get(recipientSocketId);

      if (recipientSocket) {
        // Send recipient ONLY their key wrapper — never expose keyForSender to them
        recipientSocket.emit('p2p_msg', {
          channelId, cipherBlob, iv,
          myKey:       keyForRecipient || null,  // new format
          ephPub:      ephPub || null,            // old format fallback
          senderHash, messageType, ts,
        });

        // Mark as delivered immediately since they are online
        if (messageId) {
          pool.query('UPDATE p2p_messages SET delivered = true WHERE message_id = $1', [messageId])
            .catch(e => console.warn('mark delivered error:', e.message));
        }

        socket.emit('p2p_delivered', { ts: ts || Date.now(), recipientId });
        console.log(`🔒 p2p_msg relayed+saved: ${userId}→${recipientId} channel=${channelId}`);
      } else {
        // Recipient offline — message already saved, they will get it via fetch_pending
        socket.emit('p2p_store_in_db', { ts: ts || Date.now(), recipientId, messageId });
        console.log(`💾 p2p_msg stored (offline): ${userId}→${recipientId} channel=${channelId}`);
      }

    } catch (err) {
      console.error('p2p_msg error:', err);
      socket.emit('error', { message: 'Failed to relay message' });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // SEND PRICE OFFER  (unchanged — price offers stay in DB for blockchain)
  // ══════════════════════════════════════════════════════════════
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
        } else { throw insertErr; }
      }
      client.release();

      const saved = result.rows[0];
      socket.to(channelId).emit('new_message', {
        messageId:      saved.message_id,
        senderId:       userId,
        senderRole:     senderRole,
        messageType:    'PRICE_OFFER',
        messageContent: saved.message_content,
        priceOffer:     offeredPrice,
        timestamp:      saved.timestamp || saved.created_at || new Date(),
        isSystemMessage: false,
      });

      console.log(`Price offer ${offeredPrice} sent in channel ${channelId}`);
    } catch (err) {
      console.error('Error sending price offer:', err);
      socket.emit('error', { message: 'Failed to send price offer' });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // AGREE TO DEAL  (unchanged — full blockchain PoA flow intact)
  // ══════════════════════════════════════════════════════════════
  socket.on('agree_to_deal', async (data) => {
    try {
      const { channelId, agreedTerms, agreedPrice } = data;
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

      const role         = participant.rows[0].role;
      const columnName   = role === 'SELLER' ? 'seller_agreed' : 'buyer_agreed';
      const tsColumn     = role === 'SELLER' ? 'seller_agreed_at' : 'buyer_agreed_at';
      const parsedPrice  = agreedPrice ? parseFloat(agreedPrice) : null;

      if (parsedPrice && parsedPrice > 0) {
        await client.query(`
          UPDATE transfer_requests
            SET ${columnName}  = true,
                ${tsColumn}    = NOW(),
                agreed_price   = $3,
                agreement_text = COALESCE(agreement_text, $2)
          WHERE channel_id = $1
        `, [channelId, agreedTerms || 'I agree.', parsedPrice]);
      } else {
        await client.query(`
          UPDATE transfer_requests
            SET ${columnName}  = true,
                ${tsColumn}    = NOW(),
                agreed_price   = COALESCE(agreed_price, transfer_amount),
                agreement_text = COALESCE(agreement_text, $2)
          WHERE channel_id = $1
        `, [channelId, agreedTerms || 'I agree.']);
      }

      const status      = await client.query(
        'SELECT seller_agreed, buyer_agreed, agreed_price, transfer_amount FROM transfer_requests WHERE channel_id = $1',
        [channelId]
      );
      const row         = status.rows[0] || {};
      const bothAgreed  = row.seller_agreed && row.buyer_agreed;
      const finalPrice  = parsedPrice || parseFloat(row.agreed_price || 0) || parseFloat(row.transfer_amount || 0);

      if (bothAgreed) {
        const agreementTs   = new Date().toISOString();
        const hashInput     = `${channelId}:${row.transfer_id || ''}:${finalPrice}:${agreementTs}`;
        const agreementHash = crypto.createHash('sha256').update(hashInput).digest('hex');

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
          SELECT $1::TEXT, transfer_id, $2::TEXT, 'SYSTEM', 'SYSTEM',
            '✅ Both parties agreed. Case sent to LRO for verification.',
            true
          FROM transfer_requests WHERE channel_id = $1::TEXT
        `, [channelId, userId]);

        console.log(`\n✅ BOTH AGREED — channel=${channelId} hash=${agreementHash}`);
      }

      await client.query('COMMIT');
      client.release();

      // Anchor to mock blockchain (non-blocking)
      if (bothAgreed) {
        (async () => {
          try {
            const info = await pool.query(
              'SELECT transfer_id, property_id, seller_id, buyer_id, agreement_hash, agreed_price FROM transfer_requests WHERE channel_id = $1',
              [channelId]
            );
            const r = info.rows[0] || {};
            if (r.agreement_hash) {
              const result = await fabricService.recordAgreementOnChain({
                channelId,
                transferId:    r.transfer_id,
                propertyId:    String(r.property_id || ''),
                sellerId:      String(r.seller_id   || ''),
                buyerId:       String(r.buyer_id    || ''),
                agreedPrice:   parseFloat(r.agreed_price || 0),
                agreementHash: r.agreement_hash,
                timestamp:     new Date().toISOString(),
              });
              if (result.success) console.log('⛓️  Block written txId=' + result.txId);
              else                console.warn('⚠️  Fabric anchor failed:', result.error);
            }
          } catch (anchorErr) {
            console.warn('⚠️  Fabric anchor exception (non-fatal):', anchorErr.message);
          }
        })();
      }

      io.to(channelId).emit('agreement_updated', {
        role, agreed: true, bothAgreed,
        timestamp: new Date(),
      });

      if (bothAgreed) {
        io.to(channelId).emit('both_agreed', {
          message:   'Both parties agreed. Case is now with LRO for verification.',
          timestamp: new Date(),
        });
      }

      console.log(`${role} agreed channel=${channelId} bothAgreed=${bothAgreed}`);
    } catch (err) {
      console.error('Error recording agreement:', err);
      socket.emit('error', { message: 'Failed to record agreement' });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // WEBRTC SIGNALING — server is a dumb relay for all RTC events
  // Media travels direct peer-to-peer (DTLS-SRTP encrypted by spec)
  // ══════════════════════════════════════════════════════════════

  socket.on('rtc_call_offer', (data) => {
    const { targetId, sdp, callType, channelId } = data || {};
    if (!targetId || !sdp) return;
    const targetSid = activeConnections.get(targetId);
    if (!targetSid) {
      socket.emit('rtc_call_busy', { reason: 'User is offline' });
      return;
    }
    const targetSock = io.sockets.sockets.get(targetSid);
    if (targetSock) {
      targetSock.emit('rtc_call_offer', { callerId: userId, sdp, callType: callType || 'audio', channelId });
      console.log(`📞 RTC offer: ${userId}→${targetId} type=${callType}`);
    } else {
      socket.emit('rtc_call_busy', { reason: 'User is unavailable' });
    }
  });

  socket.on('rtc_call_answer', (data) => {
    const { targetId, sdp } = data || {};
    if (!targetId || !sdp) return;
    const targetSid  = activeConnections.get(targetId);
    const targetSock = targetSid && io.sockets.sockets.get(targetSid);
    if (targetSock) {
      targetSock.emit('rtc_call_answer', { calleeId: userId, sdp });
      console.log(`📞 RTC answer: ${userId}→${targetId}`);
    }
  });

  socket.on('rtc_ice_candidate', (data) => {
    const { targetId, candidate } = data || {};
    if (!targetId || !candidate) return;
    const targetSid  = activeConnections.get(targetId);
    const targetSock = targetSid && io.sockets.sockets.get(targetSid);
    if (targetSock) targetSock.emit('rtc_ice_candidate', { fromId: userId, candidate });
  });

  socket.on('rtc_call_reject', (data) => {
    const { targetId } = data || {};
    const targetSid  = activeConnections.get(targetId);
    const targetSock = targetSid && io.sockets.sockets.get(targetSid);
    if (targetSock) {
      targetSock.emit('rtc_call_reject', { fromId: userId });
      console.log(`📵 RTC reject: ${userId}→${targetId}`);
    }
  });

  socket.on('rtc_call_end', (data) => {
    const { targetId, durationSec } = data || {};
    const targetSid  = activeConnections.get(targetId);
    const targetSock = targetSid && io.sockets.sockets.get(targetSid);
    if (targetSock) {
      targetSock.emit('rtc_call_end', { fromId: userId, durationSec });
      console.log(`📵 RTC end: ${userId}↔${targetId} dur=${durationSec}s`);
    }
  });

  socket.on('rtc_call_busy', (data) => {
    const { targetId } = data || {};
    const targetSid  = activeConnections.get(targetId);
    const targetSock = targetSid && io.sockets.sockets.get(targetSid);
    if (targetSock) targetSock.emit('rtc_call_busy', { fromId: userId });
  });

  // ══════════════════════════════════════════════════════════════
  // LEAVE CHANNEL  (unchanged)
  // ══════════════════════════════════════════════════════════════
  socket.on('leave_channel', async (data) => {
    try {
      const { channelId } = data;
      socket.leave(channelId);
      const client = await pool.connect();
      const pRow   = await client.query(
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

  // ══════════════════════════════════════════════════════════════
  // TYPING  (unchanged)
  // ══════════════════════════════════════════════════════════════
  socket.on('typing', (data) => {
    const { channelId } = data || {};
    if (channelId) socket.to(channelId).emit('typing', { userId, timestamp: new Date() });
  });

  // ══════════════════════════════════════════════════════════════
  // ── NEW TRANSFER WORKFLOW HANDLERS ────────────────────────────
  // ══════════════════════════════════════════════════════════════

  // ──────────────────────────────────────────────────────────────
  // JOIN LRO ROOM (manual join — also auto-joined on connect above)
  // LRO users call this to ensure they are in the room.
  // ──────────────────────────────────────────────────────────────
  socket.on('join_lro_room', () => {
    const r = (socket.userRole || '').toUpperCase();
    const allowed = ['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'DC', 'AC', 'ADMIN'];
    if (allowed.includes(r)) {
      socket.join('lro_room');
      socket.emit('lro_room_joined', { timestamp: new Date() });
      console.log(`⚖️  LRO ${userId} joined lro_room`);
    } else {
      socket.emit('error', { message: 'Access denied: LRO role required' });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // WATCH TRANSFER
  // Buyer/seller subscribe to live state updates for one transfer.
  // Joins room transfer:<transferId> after verifying participation.
  // Payload: { transferId }
  // ──────────────────────────────────────────────────────────────
  socket.on('watch_transfer', async (data) => {
    try {
      const { transferId } = data || {};
      if (!transferId) return;
      const check = await pool.query(
        `SELECT 1 FROM transfer_requests
          WHERE transfer_id = $1
            AND (seller_id = $2 OR buyer_id = $2)`,
        [transferId, userId]
      );
      if (!check.rows.length) {
        socket.emit('error', { message: 'Not a transfer participant' });
        return;
      }
      socket.join(`transfer:${transferId}`);
      socket.emit('watching_transfer', { transferId, timestamp: new Date() });
      console.log(`👁  User ${userId} watching transfer:${transferId}`);
    } catch (err) {
      console.error('watch_transfer error:', err);
    }
  });

  socket.on('unwatch_transfer', (data) => {
    const { transferId } = data || {};
    if (transferId) socket.leave(`transfer:${transferId}`);
  });

  // ──────────────────────────────────────────────────────────────
  // RECEIPT TIMER TICK
  // Seller relays countdown ticks to the channel so the buyer
  // sees the live timer without polling the server.
  // Payload: { channelId, transferId, secondsLeft }
  // ──────────────────────────────────────────────────────────────
  socket.on('receipt_timer_tick', (data) => {
    const { channelId, transferId, secondsLeft } = data || {};
    if (!channelId) return;
    socket.to(channelId).emit('receipt_timer_tick', {
      transferId, secondsLeft, timestamp: new Date(),
    });
  });

  // ──────────────────────────────────────────────────────────────
  // AGREE ACK  (optimistic UI — before REST response arrives)
  // Tells the other party "I clicked Agree" immediately.
  // Actual hash is generated by POST /api/transfers/:id/agree
  // Payload: { channelId, transferId, role }
  // ──────────────────────────────────────────────────────────────
  socket.on('agree_ack', (data) => {
    const { channelId, transferId, role } = data || {};
    if (!channelId) return;
    socket.to(channelId).emit('agree_ack', {
      userId, transferId, role, timestamp: new Date(),
    });
    console.log(`🤝 agree_ack from ${userId} channel=${channelId}`);
  });

  // ──────────────────────────────────────────────────────────────
  // PROOF UPLOADED (buyer → seller real-time notify)
  // After buyer calls POST /payment-proof, they emit this so
  // the seller sees the notification without a page refresh.
  // Payload: { channelId, transferId, fileName }
  // ──────────────────────────────────────────────────────────────
  socket.on('proof_uploaded', (data) => {
    const { channelId, transferId, fileName } = data || {};
    if (!channelId) return;
    socket.to(channelId).emit('proof_uploaded', {
      userId, transferId, fileName, timestamp: new Date(),
    });
    console.log(`📎 proof_uploaded notify channel=${channelId}`);
  });

  // ──────────────────────────────────────────────────────────────
  // SELLER PROOF UPLOADED (seller → buyer real-time notify)
  // After seller calls POST /seller-upload they emit this so
  // the buyer sees "Seller confirmed payment".
  // Payload: { channelId, transferId, paymentHash }
  // ──────────────────────────────────────────────────────────────
  socket.on('seller_proof_uploaded', (data) => {
    const { channelId, transferId, paymentHash } = data || {};
    if (!channelId) return;
    socket.to(channelId).emit('seller_proof_uploaded', {
      userId, transferId, paymentHash, timestamp: new Date(),
    });
    console.log(`✅ seller_proof_uploaded notify channel=${channelId}`);
  });

  // ──────────────────────────────────────────────────────────────
  // CHALLENGE FILED (buyer in-chat relay)
  // After buyer calls POST /challenge, they emit this to push
  // an immediate in-chat notice to the seller.
  // LRO broadcast is handled server-side in the REST route.
  // Payload: { channelId, transferId, description }
  // ──────────────────────────────────────────────────────────────
  socket.on('challenge_filed', (data) => {
    const { channelId, transferId, description } = data || {};
    if (!channelId) return;
    socket.to(channelId).emit('challenge_filed', {
      userId, transferId,
      description: (description || '').slice(0, 200),
      timestamp: new Date(),
    });
    console.log(`⚠️  challenge_filed relay channel=${channelId}`);
  });

  // ──────────────────────────────────────────────────────────────
  // DEADLINE ACK (seller acknowledges LRO deadline notice)
  // Logs the acknowledgement to transfer_events and notifies
  // the LRO room so the dashboard can show "Seller viewed".
  // Payload: { transferId }
  // ──────────────────────────────────────────────────────────────
  socket.on('deadline_ack', async (data) => {
    const { transferId } = data || {};
    if (!transferId) return;
    try {
      await pool.query(
        `INSERT INTO transfer_events
           (transfer_id, event_type, actor_id, actor_role)
         VALUES ($1, 'SELLER_DEADLINE_SET', $2, 'SELLER')`,
        [transferId, userId]
      );
      io.to('lro_room').emit('deadline_ack', {
        transferId, sellerId: userId, timestamp: new Date(),
      });
    } catch (err) {
      console.error('deadline_ack error:', err.message);
    }
  });

  // ══════════════════════════════════════════════════════════════
  // MARK READ  (unchanged)
  // ══════════════════════════════════════════════════════════════
  socket.on('mark_read', async (data) => {
    const { channelId } = data || {};
    if (!channelId) return;
    try {
      await pool.query(
        `UPDATE channel_messages SET is_read = true
          WHERE channel_id = $1 AND sender_id != $2 AND (is_read = false OR is_read IS NULL)`,
        [channelId, userId]
      );
    } catch { /* column may not exist — silent */ }
  });

  // ══════════════════════════════════════════════════════════════
  // DISCONNECT  (unchanged)
  // ══════════════════════════════════════════════════════════════
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

/** Emit to everyone watching a specific transfer room */
function emitToTransfer(transferId, eventName, data) {
  if (io) io.to(`transfer:${transferId}`).emit(eventName, data);
}

/** Emit to all connected LRO users */
function emitToLRO(eventName, data) {
  if (io) io.to('lro_room').emit(eventName, data);
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

export default {
  initializeSocketIO,
  emitToChannel,
  emitToUser,
  emitToTransfer,
  emitToLRO,
  getOnlineUsers,
  isUserOnline,
};