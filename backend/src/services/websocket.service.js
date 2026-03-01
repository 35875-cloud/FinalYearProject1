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

      // ── Notify others that this user joined ──
      socket.to(channelId).emit('user_joined', { userId, role, timestamp: new Date() });

      // ── Send back presence of users ALREADY online to the new joiner ──
      // This fixes: buyer joins after seller — buyer never saw seller's user_joined event
      const onlineRows = await client.query(
        `SELECT cp.user_id, cp.role FROM channel_participants cp
         WHERE cp.channel_id = $1 AND cp.is_online = true AND cp.user_id != $2`,
        [channelId, userId]
      );
      for (const row of onlineRows.rows) {
        socket.emit('user_joined', { userId: row.user_id, role: row.role, timestamp: new Date(), alreadyOnline: true });
      }

      // ── Also mark self as online in the UI ──
      socket.emit('self_joined', { userId, role, timestamp: new Date() });

      console.log(`User ${userId} joined channel ${channelId} as ${role}. Already online peers: ${onlineRows.rows.length}`);

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

 // =====================================================================
// WEBSOCKET PATCH — REPLACE agree_to_deal handler in websocket.service.js
// FIND:  socket.on('agree_to_deal', async (data) => {  (around line 274)
// REPLACE the entire block until the closing  });  with this:
// =====================================================================

  socket.on('agree_to_deal', async (data) => {
    try {
      const { channelId, agreedTerms, agreedPrice } = data;   // agreedPrice is the KEY new field

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
      const parsedPrice     = agreedPrice ? parseFloat(agreedPrice) : null;

      // Save flag + lock in the agreed price
      if (parsedPrice && parsedPrice > 0) {
        await client.query(`
          UPDATE transfer_requests
          SET ${columnName} = true,
              ${timestampColumn} = NOW(),
              agreed_price = $3,
              agreement_text = COALESCE(agreement_text, $2)
          WHERE channel_id = $1
        `, [channelId, agreedTerms || 'I agree.', parsedPrice]);
      } else {
        await client.query(`
          UPDATE transfer_requests
          SET ${columnName} = true,
              ${timestampColumn} = NOW(),
              agreement_text = COALESCE(agreement_text, $2)
          WHERE channel_id = $1
        `, [channelId, agreedTerms || 'I agree.']);
      }

      // Check if both agreed now
      const status = await client.query(
        'SELECT seller_agreed, buyer_agreed, agreed_price FROM transfer_requests WHERE channel_id = $1',
        [channelId]
      );
      const row        = status.rows[0] || {};
      const bothAgreed = row.seller_agreed && row.buyer_agreed;
      const finalPrice = parsedPrice || parseFloat(row.agreed_price || 0);

      if (bothAgreed) {
        await client.query(`
          UPDATE transfer_requests
          SET channel_status = 'AGREED', agreement_timestamp = NOW()
          WHERE channel_id = $1
        `, [channelId]);

        // System chat message
        await client.query(`
          INSERT INTO channel_messages
            (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, is_system_message)
          SELECT $1, transfer_id, $2, 'SYSTEM', 'SYSTEM',
            'Both parties agreed at PKR ' || COALESCE(agreed_price::TEXT, '?') || '. Generating payment challan...',
            true
          FROM transfer_requests WHERE channel_id = $1
        `, [channelId, userId]);
      }

      await client.query('COMMIT');
      client.release();

      io.to(channelId).emit('agreement_updated', {
        role, agreed: true, bothAgreed,
        agreedPrice: finalPrice || null,
        timestamp: new Date()
      });

      if (bothAgreed) {
        io.to(channelId).emit('both_agreed', {
          message: 'Both parties agreed. Generating challan...',
          agreedPrice: finalPrice || null,
          timestamp: new Date()
        });
      }

      console.log(`${role} agreed in channel ${channelId} @ PKR ${finalPrice}. Both: ${bothAgreed}`);
    } catch (err) {
      console.error('Error recording agreement:', err);
      socket.emit('error', { message: 'Failed to record agreement' });
    }
  });
  // ── PAYMENT FORM SUBMITTED (Buyer → Seller) ──────────────────────
  socket.on('submit_payment_form', (data) => {
    const { channelId } = data;
    if (!channelId) return;
    console.log(`💳 Payment form submitted by ${userId} in channel ${channelId}`);
    // Broadcast to ALL in room (seller sees it, buyer gets echo ignored client-side by role)
    io.to(channelId).emit('payment_form_submitted', { ...data, timestamp: new Date() });
  });

  // ── PAYMENT CONFIRMED (Seller → Buyer) ───────────────────────────
  socket.on('confirm_payment', async (data) => {
    const { channelId, evidenceRef } = data;
    if (!channelId) return;
    console.log(`✅ Payment confirmed by seller ${userId} in channel ${channelId}, ref: ${evidenceRef}`);
    // Update DB status
    try {
      const { Pool } = (await import('pg')).default || require('pg');
      // Simple direct query using pool imported at top of file
      await pool.query(
        `UPDATE transfer_requests SET channel_status='PAYMENT_CONFIRMED', status='PAYMENT_CONFIRMED' WHERE channel_id=$1`,
        [channelId]
      );
    } catch(e) { console.warn('Could not update payment status:', e.message); }
    // Broadcast evidence ready to everyone
    io.to(channelId).emit('payment_confirmed', { ...data, timestamp: new Date() });
  });


  // ── PAYMENT DONE NOTIFICATION ─────────────────────────────
  // Buyer emits this after successful payment API call
  // Server forwards to seller as 'payment_received'
  socket.on('notify_payment_done', async (data) => {
    const { channelId, txnRef, amount, buyerName, sellerBalanceAfter } = data;
    
    // Notify seller
    socket.to(channelId).emit('payment_received', {
      txnRef,
      amount,
      buyerName,
      sellerBalanceAfter,
      timestamp: new Date()
    });
    
    // Confirm back to buyer
    socket.emit('payment_confirmed_to_buyer', { txnRef, timestamp: new Date() });
    
    console.log(`💸 Payment notification broadcast — Channel: ${channelId}, TXN: ${txnRef}, Amount: PKR ${amount}`);
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
      console.log(`User ${userId} left channel ${channelId}`);

    } catch (err) {
      console.error('Error leaving channel:', err);
    }
  });

  // ── PAYMENT SLIP SUBMITTED (buyer → broadcast to all in channel) ──
  socket.on('payment_submitted', async (data) => {
    try {
      const { channelId, slipData } = data;

      // Save PAYMENT_SLIP message to DB so it survives history reload
      const client = await pool.connect();
      const trRow = await client.query(
        'SELECT transfer_id FROM transfer_requests WHERE channel_id = $1',
        [channelId]
      );
      const transferId = trRow.rows[0]?.transfer_id || null;

      // Update transfer status and store slip
      await client.query(`
        UPDATE transfer_requests
        SET payment_slip_data = $1, payment_confirmed = true,
            channel_status = 'PAYMENT_UPLOADED'
        WHERE channel_id = $2
      `, [JSON.stringify(slipData), channelId]);

      // Save as message so history works
      let savedMsg;
      try {
        const res = await client.query(`
          INSERT INTO channel_messages
            (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, is_system_message)
          VALUES ($1, $2, $3, 'BUYER', 'PAYMENT_SLIP', $4, false)
          RETURNING *
        `, [channelId, transferId, userId, JSON.stringify(slipData)]);
        savedMsg = res.rows[0];
      } catch(e) {
        const res = await client.query(`
          INSERT INTO channel_messages
            (channel_id, sender_id, sender_role, message_type, message_content, is_system_message)
          VALUES ($1, $2, 'BUYER', 'PAYMENT_SLIP', $3, false)
          RETURNING *
        `, [channelId, userId, JSON.stringify(slipData)]);
        savedMsg = res.rows[0];
      }
      client.release();

      // Broadcast slip to everyone in the channel
      io.to(channelId).emit('payment_slip_received', {
        messageId:  savedMsg?.message_id,
        slipData,
        senderId:   userId,
        senderRole: 'BUYER',
        messageType:'PAYMENT_SLIP',
        timestamp:  new Date()
      });
      console.log(`💰 Payment slip broadcast in channel ${channelId}`);

    } catch (err) {
      console.error('Error handling payment_submitted:', err);
      socket.emit('error', { message: 'Failed to save payment details' });
    }
  });

  // ── SLIP UPLOADED TO LRO ──────────────────────────────────────
  socket.on('slip_uploaded_lro', async (data) => {
    try {
      const { channelId } = data;
      const client = await pool.connect();
      await client.query(
        "UPDATE transfer_requests SET channel_status='PAYMENT_CONFIRMED', screenshot_uploaded_at=NOW() WHERE channel_id=$1",
        [channelId]
      );
      client.release();

      io.to(channelId).emit('awaiting_lro', { timestamp: new Date() });
      console.log(`📋 Slip uploaded to LRO for channel ${channelId}`);

    } catch (err) {
      console.error('Error slip_uploaded_lro:', err);
    }
  });

  // ── SEND MEDIA (image / voice) ───────────────────────────────
  socket.on('send_media', async (data) => {
    try {
      const { channelId, mediaUrl, mediaType, fileName, durationSec } = data;
      // mediaType: 'IMAGE_MESSAGE' | 'VOICE_MESSAGE'

      const client = await pool.connect();
      const participant = await client.query(
        'SELECT role FROM channel_participants WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      if (participant.rows.length === 0) { client.release(); socket.emit('error', { message: 'Unauthorized' }); return; }
      const senderRole = participant.rows[0].role;

      const transferRow = await client.query(
        'SELECT transfer_id FROM transfer_requests WHERE channel_id = $1', [channelId]
      );
      const transferId = transferRow.rows[0]?.transfer_id || null;

      let result;
      try {
        result = await client.query(`
          INSERT INTO channel_messages (channel_id, transfer_id, sender_id, sender_role, message_type, message_content)
          VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
        `, [channelId, transferId, userId, senderRole, mediaType, mediaUrl]);
      } catch(e) {
        result = await client.query(`
          INSERT INTO channel_messages (channel_id, sender_id, sender_role, message_type, message_content)
          VALUES ($1,$2,$3,$4,$5) RETURNING *
        `, [channelId, userId, senderRole, mediaType, mediaUrl]);
      }
      client.release();

      const saved = result.rows[0];
      io.to(channelId).emit('new_message', {
        messageId: saved.message_id,
        senderId: userId,
        senderRole,
        messageType: mediaType,
        messageContent: mediaUrl,
        fileName: fileName || null,
        durationSec: durationSec || null,
        timestamp: saved.timestamp || new Date(),
        isSystemMessage: false
      });
      console.log(`📎 Media message (${mediaType}) in channel ${channelId}`);
    } catch(err) {
      console.error('Error sending media:', err);
      socket.emit('error', { message: 'Failed to send media' });
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
// =====================================================================
// WEBSOCKET PATCH — ADD THIS BLOCK INSIDE handleConnection()
// in: backend/src/services/websocket.service.js
//
// Paste this code BEFORE the closing  }) at the end of handleConnection
// i.e. just before:    } // ← end of handleConnection
// =====================================================================

  // ── NOTIFY PAYMENT DONE (buyer → server → seller) ───────────────
  //
  // Challan.jsx emits this after a successful POST /api/payments/transfer.
  // The server relays it to everyone else in the channel so the seller
  // sees the "Payment Received!" popup and gets redirected to the
  // challan page showing PAID status.
  //
  socket.on('notify_payment_done', async (data) => {
    try {
      const { channelId, txnRef, amount, buyerName, sellerBalanceAfter } = data;
      if (!channelId) return;

      const client = await pool.connect();

      // Get seller info so we can include their new balance in the notification
      let sellerBalanceFinal = sellerBalanceAfter;
      try {
        const sellerRow = await client.query(`
          SELECT ba.balance, u.name
          FROM transfer_requests tr
          JOIN bank_accounts ba ON ba.user_id = tr.seller_id
          JOIN users u ON u.user_id = tr.seller_id
          WHERE tr.channel_id = $1
          LIMIT 1
        `, [channelId]);
        if (sellerRow.rows.length > 0) {
          sellerBalanceFinal = parseFloat(sellerRow.rows[0].balance);
        }
      } catch (e) { /* non-fatal */ }

      // Mark transfer as PAYMENT_DONE in DB (belt-and-suspenders — payment.js also does this)
      try {
        await client.query(`
          UPDATE transfer_requests
          SET payment_status = 'PAID',
              channel_status = 'PAYMENT_DONE',
              payment_completed_at = COALESCE(payment_completed_at, NOW()),
              challan_txn_id = COALESCE(challan_txn_id, $1)
          WHERE channel_id = $2
        `, [txnRef || null, channelId]);
      } catch (e) { /* non-fatal */ }

      client.release();

      // ── Send to SELLER: "Payment Received!" popup + redirect ─────
      socket.to(channelId).emit('payment_received', {
        txnRef,
        amount,
        buyerName,
        sellerBalanceAfter: sellerBalanceFinal,
        channelId,
        // This flag tells the seller's Challan page to render the PAID receipt
        redirectToChallan: true,
        timestamp: new Date()
      });

      // ── Confirm back to BUYER (optional — Challan.jsx ignores it) ─
      socket.emit('payment_done_ack', {
        txnRef,
        amount,
        status: 'SUCCESS'
      });

      console.log(`💸 Payment done broadcast — channel ${channelId} — TXN ${txnRef}`);

    } catch (err) {
      console.error('Error in notify_payment_done:', err);
      socket.emit('error', { message: 'Payment notification failed on server' });
    }
  });
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