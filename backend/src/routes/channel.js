/**
 * CHANNEL ROUTES
 * 
 * REST API endpoints for P2P negotiation channels
 */

import express from 'express';
import channelService from '../services/channel.service.js';
import { uploadScreenshot, handleUploadError, uploadChatMedia } from '../middleware/upload.js';
import path from 'path';
import jwt from 'jsonwebtoken';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// AUTHENTICATION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-jwt-secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
}

/**
 * POST /api/channels/create
 * Create a new channel for a transfer request
 */
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { transferId, sellerId, buyerId } = req.body;
    
    if (!transferId || !sellerId || !buyerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transferId, sellerId, buyerId'
      });
    }
    
    const result = await channelService.createChannel(transferId, sellerId, buyerId);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channels/:channelId/activate
 * Activate a channel (called when seller accepts)
 */
router.post('/:channelId/activate', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    
    const result = await channelService.activateChannel(channelId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error activating channel:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/channels/:channelId/messages
 * Get message history for a channel
 */
router.get('/:channelId/messages', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.userId || req.query.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }
    
    const result = await channelService.getChannelHistory(channelId, userId, limit, offset);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(error.message.includes('Unauthorized') ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channels/:channelId/send
 * Send a message (alternative to WebSocket for clients without WS support)
 */
router.post('/:channelId/send', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { message, messageType = 'TEXT', priceOffer } = req.body;
    const userId = req.user?.userId || req.body.userId;
    
    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, message'
      });
    }
    
    const result = await channelService.sendMessage(
      channelId, 
      userId, 
      messageType, 
      message, 
      priceOffer
    );
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channels/:channelId/agree
 * Record agreement from a participant
 */
router.post('/:channelId/agree', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { agreedTerms } = req.body;
    const userId = req.user?.userId || req.body.userId;
    
    if (!userId || !agreedTerms) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, agreedTerms'
      });
    }
    
    const result = await channelService.recordAgreement(channelId, userId, agreedTerms);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error recording agreement:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channels/:channelId/upload-screenshot
 * Upload agreement screenshot
 */
router.post(
  '/:channelId/upload-screenshot',
  authenticateToken,
  uploadScreenshot,
  handleUploadError,
  async (req, res) => {
    try {
      const { channelId } = req.params;
      const { agreedPrice, agreedTerms } = req.body;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }
      
      if (!agreedPrice) {
        return res.status(400).json({
          success: false,
          error: 'Agreed price is required'
        });
      }
      
      const screenshotUrl = `/uploads/agreements/${req.file.filename}`;
      
      const result = await channelService.uploadScreenshot(
        channelId,
        screenshotUrl,
        parseFloat(agreedPrice),
        agreedTerms
      );
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error uploading screenshot:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/channels/my-channels
 * Get all channels for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.query.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }
    
    const result = await channelService.getUserChannels(userId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching user channels:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/channels/my-channels
 * Get all channels for the authenticated user
 */
router.get('/my-channels', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.query.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }
    
    const result = await channelService.getUserChannels(userId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching user channels:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/channels/:channelId/details
 * Get complete channel details
 */
router.get('/:channelId/details', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.userId || req.query.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }
    
    const result = await channelService.getChannelDetails(channelId, userId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching channel details:', error);
    res.status(error.message.includes('Unauthorized') ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channels/:channelId/close
 * Close a channel (called after LRO approval)
 */
router.post('/:channelId/close', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    
    const result = await channelService.closeChannel(channelId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error closing channel:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/channels/:channelId/validate-access
 * Check if user has access to a channel
 */
router.get('/:channelId/validate-access', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.userId || req.query.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }
    
    const result = await channelService.validateChannelAccess(channelId, userId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error validating access:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channels/:channelId/send-media
 * Upload image or voice message for chat (10MB max)
 */
router.post(
  '/:channelId/send-media',
  authenticateToken,
  uploadChatMedia,
  handleUploadError,
  async (req, res) => {
    try {
      const { channelId } = req.params;
      if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

      const mediaType = req.file.mimetype.startsWith('audio/') ? 'VOICE_MESSAGE' : 'IMAGE_MESSAGE';
      const mediaUrl = `/uploads/chat-media/${req.file.filename}`;

      res.status(200).json({
        success: true,
        mediaUrl,
        mediaType,
        fileName: req.file.originalname,
        fileSize: req.file.size
      });
    } catch (error) {
      console.error('Error uploading chat media:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/channels/:channelId/submit-challan
 * Buyer submits signed challan with account verification
 */
router.post('/:channelId/submit-challan', authenticateToken, async (req, res) => {
  const pool = (await import('../config/db.js')).default;
  const client = await pool.connect();

  try {
    const { channelId, transferId, msgKey, challanData, buyerSignature, verifyAccountNo, verifyPin, buyerBalance } = req.body;
    const buyerId = req.user.userId;

    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║      CHALLAN SUBMISSION REQUEST       ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log('║ Channel ID :', channelId);
    console.log('║ Buyer ID   :', buyerId);
    console.log('║ Account    :', verifyAccountNo);
    console.log('╚═══════════════════════════════════════╝\n');

    if (!channelId || !buyerSignature || !verifyAccountNo || !verifyPin) {
      await client.release();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    await client.query('BEGIN');

    // Get channel & transfer details
    const channelRow = await client.query(`
      SELECT tr.*, u_buyer.name as buyer_name, u_buyer.cnic as buyer_cnic,
             u_seller.name as seller_name, u_seller.cnic as seller_cnic,
             p.property_id, p.area_marla, p.district, p.tehsil, p.mauza,
             p.khasra_no, p.khewat_no
      FROM transfer_requests tr
      JOIN users u_buyer ON tr.buyer_id = u_buyer.user_id
      JOIN users u_seller ON tr.seller_id = u_seller.user_id
      JOIN properties p ON tr.property_id = p.property_id
      WHERE tr.channel_id = $1
    `, [channelId]);

    if (channelRow.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const channelData = channelRow.rows[0];

    // Verify buyer account
    const accountRow = await client.query(`
      SELECT * FROM bank_accounts WHERE account_no = $1 AND user_id = $2 AND is_active = true
    `, [verifyAccountNo, buyerId]);

    if (accountRow.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Account verification failed. Account not found or inactive.'
      });
    }

    const buyerAccount = accountRow.rows[0];

    // Verify PIN
    const crypto = await import('crypto');
    function hashPin(pin) {
      return crypto.default.createHash('sha256').update(String(pin)).digest('hex');
    }

    if (hashPin(verifyPin) !== buyerAccount.pin_hash) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(401).json({
        success: false,
        message: 'Incorrect PIN. Please try again.'
      });
    }

    // Check sufficient balance
    const agreedPrice = parseFloat(channelData.agreed_price || 0);
    if (parseFloat(buyerAccount.balance) < agreedPrice) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Need PKR ${agreedPrice.toLocaleString()}, have PKR ${Number(buyerAccount.balance).toLocaleString()}`
      });
    }

    // Update challan message with buyer signature
    const parsedChallanData = typeof challanData === 'string' ? JSON.parse(challanData) : challanData;
    parsedChallanData.buyerSignature = buyerSignature;
    parsedChallanData.buyerAccountVerified = true;
    parsedChallanData.verifiedAt = new Date().toISOString();
    parsedChallanData.buyerBalanceBefore = parseFloat(buyerAccount.balance);

    await client.query(`
      UPDATE channel_messages
      SET message_content = $1, updated_at = NOW()
      WHERE channel_id = $2 AND message_type = 'CHALLAN'
    `, [JSON.stringify(parsedChallanData), channelId]);

    // Create notification message
    await client.query(`
      INSERT INTO channel_messages
        (channel_id, transfer_id, sender_id, sender_role, message_type, message_content, is_system_message)
      VALUES ($1, $2, $3, 'SYSTEM', 'SYSTEM',
        '📄 Buyer has submitted signed challan with account verification. Ready for payment.',
        true)
    `, [channelId, transferId || null, buyerId]);

    await client.query('COMMIT');
    client.release();

    console.log('✅ CHALLAN SUBMISSION SUCCESS');
    console.log('   Buyer Signature  : Recorded');
    console.log('   Account Verified : ' + verifyAccountNo);
    console.log('   Balance          : PKR ' + Number(buyerAccount.balance).toLocaleString());

    return res.json({
      success: true,
      message: 'Challan submitted successfully with account verification',
      submission: {
        challanId: msgKey,
        buyerSignature: buyerSignature.substring(0, 50) + '...',
        verifiedAccount: verifyAccountNo,
        buyerBalance: parseFloat(buyerAccount.balance),
        agreedPrice: agreedPrice,
        canAfford: parseFloat(buyerAccount.balance) >= agreedPrice,
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('❌ CHALLAN SUBMISSION FAILED:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Submission failed: ' + err.message
    });
  }
});
// =====================================================
// ADD THIS ROUTE to backend/src/routes/channel.js
// POST /api/channels/:channelId/agree
// Call after buyer & seller both confirm the price
// =====================================================

router.post('/:channelId/agree', authenticateToken, async (req, res) => {
  const { channelId } = req.params;
  const { userId, agreedPrice } = req.body;

  if (!userId || !agreedPrice) {
    return res.status(400).json({ success: false, message: 'userId and agreedPrice are required' });
  }

  try {
    // 1. Verify the user is a participant in this channel
    const chResult = await pool.query(
      `SELECT * FROM negotiation_channels
       WHERE channel_id = $1 AND (seller_id = $2 OR buyer_id = $2)`,
      [channelId, userId]
    );

    if (chResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Not a participant' });
    }

    const channel = chResult.rows[0];

    if (channel.status === 'AGREED' || channel.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Agreement already confirmed' });
    }

    // 2. Update channel status → AGREED and set agreed_price
    const updated = await pool.query(
      `UPDATE negotiation_channels
       SET status = 'AGREED', agreed_price = $1, updated_at = NOW()
       WHERE channel_id = $2
       RETURNING *`,
      [agreedPrice, channelId]
    );

    // 3. Insert a system message into the channel
    await pool.query(
      `INSERT INTO channel_messages
         (channel_id, sender_id, content, message_type, created_at)
       VALUES ($1, $2, $3, 'SYSTEM', NOW())`,
      [
        channelId,
        userId,
        `✅ Agreement confirmed at ${new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(agreedPrice)}. Buyer may now proceed to payment.`
      ]
    );

    return res.json({
      success: true,
      message: 'Agreement confirmed',
      channel: updated.rows[0]
    });

  } catch (err) {
    console.error('❌ Agreement error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});
export default router;