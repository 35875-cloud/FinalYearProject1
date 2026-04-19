/**
 * FILE UPLOAD MIDDLEWARE
 * 
 * Configures Multer for handling screenshot uploads
 * - File type validation
 * - Size limits
 * - Storage configuration
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Resolve absolute upload base so it always matches express.static('../uploads')
// upload.js is at backend/src/middleware/upload.js
// so ../../uploads = backend/uploads/
import { fileURLToPath } from 'url';
const __uploadDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__uploadDir, 'agreements');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}


// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const channelId = req.params.channelId || 'unknown';
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `agreement-${channelId}-${timestamp}${extension}`;
    cb(null, filename);
  }
});

// File filter - only allow images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|webp|mp3|mp4|wav|ogg|webm|m4a/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpg, png, gif, webp) and PDFs are allowed'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// Single file upload middleware
export const uploadScreenshot = upload.single('screenshot');

// ── Chat media upload (images + voice, 10MB) ──
const chatMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__uploadDir, 'chat-media');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const channelId = req.params.channelId || 'ch';
    const ext = path.extname(file.originalname);
    cb(null, `media-${channelId}-${Date.now()}${ext}`);
  }
});

const chatMediaFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|mp3|mp4|wav|ogg|webm|m4a/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images and audio files are allowed for chat media'));
  }
};

const chatMedia = multer({
  storage: chatMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: chatMediaFilter
});

export const uploadChatMedia = chatMedia.single('media');

// Error handler for multer errors
export function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 5MB'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next();
}

export default {
  uploadScreenshot,
  handleUploadError
};