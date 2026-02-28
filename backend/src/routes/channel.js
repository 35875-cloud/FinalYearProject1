/**
 * CHANNEL ROUTES
 * 
 * REST API endpoints for P2P negotiation channels
 */

import express from 'express';
import channelService from '../services/channel.service.js';
import { uploadScreenshot, handleUploadError, uploadChatMedia } from '..//middleware/upload.js';
import path from 'path';

const router = express.Router();


// Middleware to verify JWT (assuming you have this)
// import { verifyToken } from '../middleware/auth.js';
// router.use(verifyToken);

/**
 * POST /api/channels/create
 * Create a new channel for a transfer request
 */
router.post('/create', async (req, res) => {
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
router.post('/:channelId/activate', async (req, res) => {
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
router.get('/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.userId || req.query.userId; // Adjust based on your auth setup
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
router.post('/:channelId/send', async (req, res) => {
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
router.post('/:channelId/agree', async (req, res) => {
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
      
      // Generate file URL (adjust based on your setup)
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
router.get('/my-channels', async (req, res) => {
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
router.get('/:channelId/details', async (req, res) => {
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
router.post('/:channelId/close', async (req, res) => {
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
router.get('/:channelId/validate-access', async (req, res) => {
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
  uploadChatMedia,
  handleUploadError,
  async (req, res) => {
    try {
      const { channelId } = req.params;
      if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

      const mediaType = req.file.mimetype.startsWith('audio/') ? 'VOICE_MESSAGE' : 'IMAGE_MESSAGE';
      const mediaUrl  = `/uploads/chat-media/${req.file.filename}`;

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

export default router;