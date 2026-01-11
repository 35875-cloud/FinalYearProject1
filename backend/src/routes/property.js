import express from "express";
import pool from "../config/db.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import jwt from "jsonwebtoken";

const router = express.Router(); // âœ… REQUIRED

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import blockchainService from "../services/blockchain.service.js";



function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log("âŒ No token provided");
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-jwt-secret");
    req.user = decoded;
    console.log("âœ… Token verified for user:", decoded.userId, "Role:", decoded.role);
    next();
  } catch (err) {
    console.log("âŒ Token verification failed:", err.message);
    return res.status(403).json({ success: false, message: "Invalid or expired token" });
  }
}

// =====================================================
// CREATE UPLOAD DIRECTORY IF NOT EXISTS
// =====================================================
const uploadDir = path.join(__dirname, '../../uploads/properties');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("âœ… Created upload directory:", uploadDir);
}

// =====================================================
// MULTER CONFIGURATION - File Upload
// =====================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG) and PDFs are allowed'));
    }
  }
});

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

// Generate SHA-256 hash for files
function generateFileHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  } catch (err) {
    console.error("Error generating file hash:", err);
    return null;
  }
}

// Generate unique Property ID
async function generatePropertyId() {
  let propertyId;
  let attempts = 0;
  
  while (attempts < 10) {
    propertyId = "PROP-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
    const exists = await pool.query("SELECT property_id FROM properties WHERE property_id = $1", [propertyId]);
    if (exists.rows.length === 0) break;
    attempts++;
  }
  
  return propertyId;
}

// Generate blockchain hash for property
function generateBlockchainHash(propertyData) {
  const dataString = JSON.stringify(propertyData);
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

// Get latest block hash
async function getLatestBlockHash() {
  try {
    const result = await pool.query(
      "SELECT blockchain_hash FROM blockchain_ledger ORDER BY created_at DESC LIMIT 1"
    );
    return result.rows.length > 0 ? result.rows[0].blockchain_hash : "GENESIS_BLOCK";
  } catch (err) {
    console.error("Error getting latest block hash:", err);
    return "GENESIS_BLOCK";
  }
}

// Create blockchain record
async function createBlockchainRecord(propertyId, transactionType, data, userId) {
  try {
    const blockchainHash = generateBlockchainHash({ propertyId, transactionType, data, timestamp: new Date() });
    const previousHash = await getLatestBlockHash();
    
    await pool.query(
      `INSERT INTO blockchain_ledger 
      (property_id, transaction_type, transaction_data, blockchain_hash, previous_hash, creator_user_id) 
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [propertyId, transactionType, JSON.stringify(data), blockchainHash, previousHash, userId]
    );
    
    console.log("âœ… Blockchain record created:", blockchainHash);
    return blockchainHash;
  } catch (err) {
    console.error("âŒ Error creating blockchain record:", err);
    throw err;
  }
}

// =====================================================
// TEST ROUTE - Check if routes are loaded
// =====================================================
router.get("/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "Property routes are working!",
    uploadDir: uploadDir
  });
});

// =====================================================
// 1ï¸âƒ£ ADD NEW PROPERTY (Land Record Officer)
// =====================================================
router.post("/add-property", authenticateToken, upload.fields([
  { name: 'ownerPhoto', maxCount: 1 },
  { name: 'propertyPhoto', maxCount: 1 }
]), async (req, res) => {
  console.log("\n========================================");
  console.log("ðŸ“ ADD PROPERTY REQUEST RECEIVED");
  console.log("========================================");
  
  try {
    console.log("User ID:", req.user.userId);
    console.log("User Role:", req.user.role);
    console.log("Request Body:", req.body);
    console.log("Uploaded Files:", req.files);

    // Check if user is Land Record Officer
    if (req.user.role !== 'LRO' && req.user.role !== 'LAND RECORD OFFICER') {
      console.log("âŒ Access denied - not an LRO");
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only Land Record Officers can add properties." 
      });
    }

    const {
      ownerName, ownerCnic, fatherName, fardNo, khasraNo, khatooniNo,
      areaMarla, propertyType, district, tehsil, mauza, address
    } = req.body;

    console.log("Form Data:");
    console.log("- Owner Name:", ownerName);
    console.log("- Owner CNIC:", ownerCnic);
    console.log("- Fard No:", fardNo);

    // Validate required fields
    if (!ownerName || !ownerCnic || !fatherName || !fardNo || !khasraNo || 
        !khatooniNo || !areaMarla || !propertyType || !district || !tehsil) {
      console.log("âŒ Missing required fields");
      return res.status(400).json({ 
        success: false, 
        message: "All required fields must be provided" 
      });
    }

    // Check if files are uploaded
    if (!req.files || !req.files.ownerPhoto || !req.files.propertyPhoto) {
      console.log("âŒ Missing files");
      return res.status(400).json({ 
        success: false, 
        message: "Owner photo and property photo are required" 
      });
    }

    console.log("âœ… All validations passed");

    // Clean CNIC
    const cleanedCnic = ownerCnic.replace(/\D/g, "");
    console.log("Cleaned CNIC:", cleanedCnic);

    // Check if property already exists
    const existingProperty = await pool.query(
      "SELECT * FROM properties WHERE fard_no = $1 AND khasra_no = $2 AND khatooni_no = $3",
      [fardNo, khasraNo, khatooniNo]
    );

    if (existingProperty.rows.length > 0) {
      console.log("âŒ Property already exists");
      return res.json({
        success: false,
        message: "Property with these details already exists"
      });
    }

    console.log("âœ… Property is unique");

    // Check if owner exists, if not create owner record
    let ownerResult = await pool.query(
      "SELECT user_id FROM users WHERE cnic = $1",
      [cleanedCnic]
    );

    let ownerId;
    if (ownerResult.rows.length === 0) {
      console.log("Creating new owner record...");
      // Owner doesn't exist, create a basic record
      const userId = "USR" + Math.floor(100000 + Math.random() * 900000);
      
      await pool.query(
        `INSERT INTO users (id, user_id, role, name, cnic, father_name, is_active) 
         VALUES ($1, $2, 'CITIZEN', $3, $4, $5, TRUE)`,
        [uuidv4(), userId, ownerName, cleanedCnic, fatherName]
      );
      
      ownerId = userId;
      console.log("âœ… Created new owner:", ownerId);
    } else {
      ownerId = ownerResult.rows[0].user_id;
      console.log("âœ… Found existing owner:", ownerId);
    }

    // Generate Property ID
    const propertyId = await generatePropertyId();
    console.log("âœ… Generated Property ID:", propertyId);

    // Generate file hashes
    const ownerPhotoPath = req.files.ownerPhoto[0].path;
    const propertyPhotoPath = req.files.propertyPhoto[0].path;
    
    console.log("Owner Photo Path:", ownerPhotoPath);
    console.log("Property Photo Path:", propertyPhotoPath);

    const ownerPhotoHash = generateFileHash(ownerPhotoPath);
    const propertyPhotoHash = generateFileHash(propertyPhotoPath);
    
    console.log("âœ… Generated file hashes");

    // Insert property record
    console.log("Inserting property into database...");
    
    await pool.query(
      `INSERT INTO properties 
      (property_id, owner_id, owner_name, owner_cnic, father_name, fard_no, khasra_no, 
       khatooni_no, area_marla, property_type, district, tehsil, mauza, address, 
       owner_photo_path, owner_photo_hash, property_photo_path, property_photo_hash, 
       added_by_officer, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        propertyId, ownerId, ownerName, cleanedCnic, fatherName, fardNo, 
        khasraNo, khatooniNo, parseFloat(areaMarla), propertyType, district, 
        tehsil, mauza || null, address || null, ownerPhotoPath, ownerPhotoHash, 
        propertyPhotoPath, propertyPhotoHash, req.user.userId, 'PENDING_APPROVAL'
      ]
    );

    console.log("âœ… Property inserted into database");

    // Create blockchain record
    const propertyData = {
      property_id: propertyId,
      owner_id: ownerId,
      owner_name: ownerName,
      fard_no: fardNo,
      khasra_no: khasraNo,
      area_marla: areaMarla,
      district,
      tehsil
    };

    const blockchainHash = await createBlockchainRecord(
      propertyId,
      'PROPERTY_REGISTRATION',
      propertyData,
      req.user.userId
    );

    console.log("âœ… Blockchain record created");

    // Log audit trail
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'PROPERTY_ADDED', $2, $3, $4)`,
      [
        req.user.userId,
        propertyId,
        JSON.stringify({ propertyId, ownerName, fardNo }),
        req.ip || 'unknown'
      ]
    );

    console.log("âœ… Audit log created");
    console.log("========================================");
    console.log("âœ… PROPERTY ADDED SUCCESSFULLY");
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Property record added successfully and pending approval",
      propertyId,
      blockchainHash,
      status: 'PENDING_APPROVAL'
    });

  } catch (err) {
    console.error("========================================");
    console.error("âŒ ADD PROPERTY ERROR");
    console.error("========================================");
    console.error("Error:", err);
    console.error("Stack:", err.stack);
    console.error("========================================\n");
    
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// =====================================================
// 2ï¸âƒ£ GET USER PROPERTIES (Citizen)
// =====================================================
router.get("/my-properties", authenticateToken, async (req, res) => {
  try {
    console.log("ðŸ“‹ Fetching properties for user:", req.user.userId);

    const result = await pool.query(
      `SELECT 
        p.property_id, p.owner_name, p.owner_cnic, p.father_name, 
        p.fard_no, p.khasra_no, p.khatooni_no, p.area_marla, 
        p.property_type, p.district, p.tehsil, p.mauza, p.address,
        p.status, p.created_at, p.property_photo_path,
        u.name as added_by_name
      FROM properties p
      LEFT JOIN users u ON p.added_by_officer = u.user_id
      WHERE p.owner_id = $1
      ORDER BY p.created_at DESC`,
      [req.user.userId]
    );

    console.log("âœ… Found", result.rows.length, "properties");

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("âŒ Get properties error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// =====================================================
// 3ï¸âƒ£ GET PROPERTY DETAILS
// =====================================================
router.get("/property/:propertyId", authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.params;
    console.log("ðŸ“„ Fetching property details for:", propertyId);

    const result = await pool.query(
      `SELECT 
        p.*, 
        u.name as owner_full_name,
        u.email as owner_email,
        u.mobile as owner_mobile,
        officer.name as officer_name,
        officer.user_id as officer_id
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.user_id
      LEFT JOIN users officer ON p.added_by_officer = officer.user_id
      WHERE p.property_id = $1`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      console.log("âŒ Property not found");
      return res.status(404).json({ 
        success: false, 
        message: "Property not found" 
      });
    }

    // Check if user has permission to view this property
    const property = result.rows[0];
    const userRole = req.user.role.toUpperCase();
    
    if (userRole === 'CITIZEN' && property.owner_id !== req.user.userId) {
      console.log("âŒ Access denied");
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. You can only view your own properties." 
      });
    }

    // Get blockchain history
    const blockchainHistory = await pool.query(
      `SELECT transaction_type, blockchain_hash, previous_hash, created_at, creator_user_id
       FROM blockchain_ledger
       WHERE property_id = $1
       ORDER BY created_at DESC`,
      [propertyId]
    );

    console.log("âœ… Property details retrieved");

    return res.json({
      success: true,
      property: result.rows[0],
      blockchainHistory: blockchainHistory.rows
    });

  } catch (err) {
    console.error("âŒ Get property details error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// =====================================================
// 4ï¸âƒ£ GET OFFICER STATS
// =====================================================
router.get("/officer-stats", authenticateToken, async (req, res) => {
  try {
    console.log("ðŸ“Š Fetching officer stats");

    const pendingReg = await pool.query(
      "SELECT COUNT(*) FROM properties WHERE status = 'PENDING_APPROVAL'"
    );

    const pendingTransfer = await pool.query(
      "SELECT COUNT(*) FROM transfer_requests WHERE status = 'PAYMENT_PENDING' OR status = 'PAYMENT_UPLOADED'"
    );

    const frozen = await pool.query(
      "SELECT COUNT(*) FROM properties WHERE status = 'FROZEN'"
    );

    const approvedToday = await pool.query(
      "SELECT COUNT(*) FROM properties WHERE status = 'APPROVED' AND DATE(updated_at) = CURRENT_DATE"
    );

    return res.json({
      success: true,
      pendingRegistrations: parseInt(pendingReg.rows[0].count),
      pendingTransfers: parseInt(pendingTransfer.rows[0].count),
      frozenProperties: parseInt(frozen.rows[0].count),
      approvedToday: parseInt(approvedToday.rows[0].count)
    });

  } catch (err) {
    console.error("âŒ Get stats error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});
//


// In your add-property route, after database insertion:

// Create blockchain record
// const blockchainData = {
//   propertyId,
//   ownerId,
//   ownerName,
//   ownerCnic: cleanedCnic,
//   fatherName,
//   fardNo,
//   khasraNo,
//   khatooniNo,
//   areaMarla: parseInt(areaMarla),
//   propertyType,
//   district,
//   tehsil,
//   documentHash: propertyPhotoHash // Use the document hash
// };

// try {
//   const blockchainResult = await blockchainService.registerProperty(blockchainData);
  
//   // Update database with blockchain transaction info
//   await pool.query(
//     `UPDATE blockchain_ledger 
//      SET blockchain_hash = $1, verified = true 
//      WHERE property_id = $2`,
//     [blockchainResult.transactionHash, propertyId]
//   );
  
//   console.log("âœ… Property registered on blockchain:", blockchainResult.transactionHash);
// } catch (blockchainError) {
//   console.error("âŒ Blockchain registration failed:", blockchainError);
//   // Property is in database but not on blockchain - handle this case
// }
// =====================================================
// PENDING REGISTRATIONS & APPROVAL ENDPOINTS
// Add these to property.js before "export default router;"
// =====================================================

// GET PENDING REGISTRATIONS (Officer)
router.get("/pending-registrations", authenticateToken, async (req, res) => {
  try {
    console.log("ðŸ“‹ Fetching pending registrations");
    const userRole = req.user.role.toUpperCase();
    
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only officers can view pending registrations." 
      });
    }

    const result = await pool.query(
      `SELECT 
        p.property_id, p.owner_name, p.owner_cnic, p.father_name, 
        p.fard_no, p.khasra_no, p.khatooni_no, p.area_marla, 
        p.property_type, p.district, p.tehsil, p.mauza, p.address,
        p.status, p.created_at,
        u.name as owner_full_name, u.email as owner_email, u.mobile as owner_mobile,
        officer.name as added_by_officer_name
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.user_id
      LEFT JOIN users officer ON p.added_by_officer = officer.user_id
      WHERE p.status = 'PENDING_APPROVAL'
      ORDER BY p.created_at DESC`
    );

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });
  } catch (err) {
    console.error("âŒ Get pending registrations error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// SEARCH PROPERTIES BY CNIC (Officer)
router.get("/search-by-cnic/:cnic", authenticateToken, async (req, res) => {
  try {
    const { cnic } = req.params;
    const userRole = req.user.role.toUpperCase();
    
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const cleanedCnic = cnic.replace(/\D/g, "");

    const result = await pool.query(
      `SELECT 
        p.property_id, p.owner_name, p.owner_cnic, p.father_name, 
        p.fard_no, p.khasra_no, p.khatooni_no, p.area_marla, 
        p.property_type, p.district, p.tehsil, p.mauza, p.address,
        p.status, p.created_at,
        u.name as owner_full_name, u.email as owner_email, u.mobile as owner_mobile,
        officer.name as added_by_officer_name
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.user_id
      LEFT JOIN users officer ON p.added_by_officer = officer.user_id
      WHERE p.owner_cnic = $1 AND p.status = 'PENDING_APPROVAL'
      ORDER BY p.created_at DESC`,
      [cleanedCnic]
    );

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length,
      cnic: cleanedCnic
    });
  } catch (err) {
    console.error("âŒ Search by CNIC error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// APPROVE PROPERTY (Officer)
router.post("/approve-property", authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.body;
    const userRole = req.user.role.toUpperCase();
    
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ success: false, message: "Only Land Record Officers, Tehsildar, or Admin can approve properties." });
    }

    if (!propertyId) {
      return res.status(400).json({ success: false, message: "Property ID is required" });
    }

    const propertyCheck = await pool.query("SELECT * FROM properties WHERE property_id = $1", [propertyId]);

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const property = propertyCheck.rows[0];

    if (property.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ success: false, message: `Property is already ${property.status}` });
    }

    await pool.query(
      `UPDATE properties 
       SET status = 'APPROVED', updated_at = NOW()
       WHERE property_id = $1`,
      [propertyId]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'PROPERTY_APPROVED', $2, $3, $4)`,
      [req.user.userId, propertyId, JSON.stringify({ propertyId, approvedBy: req.user.userId }), req.ip || 'unknown']
    );

    console.log("âœ… Property approved:", propertyId, "by", req.user.userId, "(" + req.user.role + ")");
    return res.json({ success: true, message: "Property approved successfully", propertyId, status: 'APPROVED' });
  } catch (err) {
    console.error("âŒ Approve property error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// REJECT PROPERTY (Officer)
router.post("/reject-property", authenticateToken, async (req, res) => {
  try {
    const { propertyId, reason } = req.body;
    const userRole = req.user.role.toUpperCase();
    
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ success: false, message: "Only Land Record Officers, Tehsildar, or Admin can reject properties." });
    }

    if (!propertyId || !reason) {
      return res.status(400).json({ success: false, message: "Property ID and rejection reason are required" });
    }

    const propertyCheck = await pool.query("SELECT * FROM properties WHERE property_id = $1", [propertyId]);

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const property = propertyCheck.rows[0];

    if (property.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ success: false, message: `Property is already ${property.status}` });
    }

    await pool.query(`UPDATE properties SET status = 'REJECTED', updated_at = NOW() WHERE property_id = $1`, [propertyId]);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'PROPERTY_REJECTED', $2, $3, $4)`,
      [req.user.userId, propertyId, JSON.stringify({ propertyId, rejectedBy: req.user.userId, reason }), req.ip || 'unknown']
    );

    return res.json({ success: true, message: "Property rejected successfully", propertyId, status: 'REJECTED' });
  } catch (err) {
    console.error("âŒ Reject property error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// =====================================================
// GET PROPERTY DETAILS BY ID
// =====================================================
router.get("/details/:propertyId", authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    console.log("ðŸ“‹ Fetching property details:", propertyId);

    const result = await pool.query(
      `SELECT * FROM properties WHERE property_id = $1`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    return res.json({
      success: true,
      property: result.rows[0]
    });

  } catch (err) {
    console.error("âŒ Get property details error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// GET PROPERTY OWNERSHIP HISTORY
// =====================================================
router.get("/history/:propertyId", authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    console.log("ðŸ“œ Fetching ownership history for:", propertyId);

    // Check if ownership_history table exists and has data
    let history = [];
    
    try {
      // Try to fetch from ownership_history table
      const historyResult = await pool.query(
        `SELECT 
          oh.*,
          prev.name as previous_owner_name,
          prev.cnic as previous_owner_cnic,
          new_user.name as new_owner_name,
          new_user.cnic as new_owner_cnic
         FROM ownership_history oh
         LEFT JOIN users prev ON oh.previous_owner_id = prev.user_id
         LEFT JOIN users new_user ON oh.new_owner_id = new_user.user_id
         WHERE oh.property_id = $1
         ORDER BY oh.transfer_date DESC`,
        [propertyId]
      );

      history = historyResult.rows;
      console.log("âœ… Found", history.length, "history records");

    } catch (tableErr) {
      console.log("âš ï¸ ownership_history table might not exist, trying transfer_requests...");
      
      // Fallback: Get history from completed transfers
      const transferResult = await pool.query(
        `SELECT 
          t.transfer_id,
          t.property_id,
          t.seller_id as previous_owner_id,
          t.buyer_cnic as new_owner_cnic,
          seller.name as previous_owner_name,
          seller.cnic as previous_owner_cnic,
          t.buyer_name as new_owner_name,
          t.transfer_amount,
          t.completed_at as transfer_date,
          'SALE' as transfer_type
         FROM transfer_requests t
         LEFT JOIN users seller ON t.seller_id = seller.user_id
         WHERE t.property_id = $1 
         AND t.status = 'COMPLETED'
         ORDER BY t.completed_at DESC`,
        [propertyId]
      );

      history = transferResult.rows;
      console.log("âœ… Found", history.length, "transfer records");
    }

    return res.json({
      success: true,
      history: history,
      total: history.length
    });

  } catch (err) {
    console.error("âŒ Get property history error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// ADMIN-SPECIFIC PROPERTY ROUTES
// Add these routes to your property.js file
// =====================================================

// GET ALL PROPERTIES (Admin only)
router.get("/admin/all-properties", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }

    const result = await pool.query(
      `SELECT 
        p.property_id, p.owner_name, p.owner_cnic, p.father_name, 
        p.fard_no, p.khasra_no, p.khatooni_no, p.area_marla, 
        p.property_type, p.district, p.tehsil, p.mauza, p.address,
        p.status, p.created_at, p.updated_at,
        u.name as owner_full_name, u.email as owner_email, u.mobile as owner_mobile,
        officer.name as added_by_officer_name
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.user_id
      LEFT JOIN users officer ON p.added_by_officer = officer.user_id
      ORDER BY p.created_at DESC`
    );

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching all properties:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// GET PENDING PROPERTY REGISTRATIONS (Admin)
router.get("/admin/pending-properties", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }

    console.log("📋 Admin fetching pending property registrations");

    const result = await pool.query(
      `SELECT 
        p.property_id, p.owner_name, p.owner_cnic, p.father_name, 
        p.fard_no, p.khasra_no, p.khatooni_no, p.area_marla, 
        p.property_type, p.district, p.tehsil, p.mauza, p.address,
        p.status, p.created_at,
        u.name as owner_full_name, u.email as owner_email, u.mobile as owner_mobile,
        officer.name as added_by_officer_name, officer.user_id as officer_id
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.user_id
      LEFT JOIN users officer ON p.added_by_officer = officer.user_id
      WHERE p.status = 'PENDING_APPROVAL'
      ORDER BY p.created_at DESC`
    );

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching pending properties:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// ADMIN APPROVE PROPERTY
router.post("/admin/approve-property", authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.body;
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }

    if (!propertyId) {
      return res.status(400).json({ 
        success: false, 
        message: "Property ID is required" 
      });
    }

    const propertyCheck = await pool.query(
      "SELECT * FROM properties WHERE property_id = $1", 
      [propertyId]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Property not found" 
      });
    }

    const property = propertyCheck.rows[0];

    if (property.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ 
        success: false, 
        message: `Property is already ${property.status}` 
      });
    }

    await pool.query(
      `UPDATE properties 
       SET status = 'APPROVED', updated_at = NOW()
       WHERE property_id = $1`,
      [propertyId]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'ADMIN_PROPERTY_APPROVED', $2, $3, $4)`,
      [
        req.user.userId, 
        propertyId, 
        JSON.stringify({ 
          propertyId, 
          approvedBy: req.user.userId,
          role: 'ADMIN' 
        }), 
        req.ip || 'unknown'
      ]
    );

    console.log("✅ Admin approved property:", propertyId);

    return res.json({ 
      success: true, 
      message: "Property approved successfully by Admin", 
      propertyId, 
      status: 'APPROVED' 
    });

  } catch (err) {
    console.error("❌ Admin approve property error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// ADMIN REJECT PROPERTY
router.post("/admin/reject-property", authenticateToken, async (req, res) => {
  try {
    const { propertyId, reason } = req.body;
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }

    if (!propertyId || !reason) {
      return res.status(400).json({ 
        success: false, 
        message: "Property ID and rejection reason are required" 
      });
    }

    const propertyCheck = await pool.query(
      "SELECT * FROM properties WHERE property_id = $1", 
      [propertyId]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Property not found" 
      });
    }

    const property = propertyCheck.rows[0];

    if (property.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ 
        success: false, 
        message: `Property is already ${property.status}` 
      });
    }

    await pool.query(
      `UPDATE properties 
       SET status = 'REJECTED', updated_at = NOW() 
       WHERE property_id = $1`, 
      [propertyId]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'ADMIN_PROPERTY_REJECTED', $2, $3, $4)`,
      [
        req.user.userId, 
        propertyId, 
        JSON.stringify({ 
          propertyId, 
          rejectedBy: req.user.userId, 
          reason,
          role: 'ADMIN' 
        }), 
        req.ip || 'unknown'
      ]
    );

    console.log("❌ Admin rejected property:", propertyId);

    return res.json({ 
      success: true, 
      message: "Property rejected successfully by Admin", 
      propertyId, 
      status: 'REJECTED' 
    });

  } catch (err) {
    console.error("❌ Admin reject property error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// GET PROPERTY STATISTICS (Admin Dashboard)
router.get("/admin/property-stats", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }

    const totalProps = await pool.query("SELECT COUNT(*) FROM properties");
    const pendingProps = await pool.query("SELECT COUNT(*) FROM properties WHERE status = 'PENDING_APPROVAL'");
    const approvedProps = await pool.query("SELECT COUNT(*) FROM properties WHERE status = 'APPROVED'");
    const rejectedProps = await pool.query("SELECT COUNT(*) FROM properties WHERE status = 'REJECTED'");
    const frozenProps = await pool.query("SELECT COUNT(*) FROM properties WHERE status = 'FROZEN'");

    return res.json({
      success: true,
      stats: {
        total: parseInt(totalProps.rows[0].count),
        pending: parseInt(pendingProps.rows[0].count),
        approved: parseInt(approvedProps.rows[0].count),
        rejected: parseInt(rejectedProps.rows[0].count),
        frozen: parseInt(frozenProps.rows[0].count)
      }
    });

  } catch (err) {
    console.error("❌ Error fetching property stats:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// 🆕 GET OFFICER'S REJECTED PROPERTIES/REGISTRATIONS
// =====================================================
router.get("/officer-rejected", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();

    // Check if user has officer privileges
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only officers can view rejected registrations." 
      });
    }

    console.log("\n========================================");
    console.log("📋 FETCHING REJECTED REGISTRATIONS FOR OFFICER");
    console.log("User ID:", req.user.userId);
    console.log("User Role:", userRole);

    // Get all rejected properties with owner and rejector details
    const result = await pool.query(
      `SELECT 
        p.property_id,
        p.owner_id,
        p.fard_no,
        p.khasra_no,
        p.khatooni_no,
        p.area_marla,
        p.property_type,
        p.district,
        p.tehsil,
        p.mauza,
        p.address,
        p.status,
        p.rejection_reason,
        p.created_at,
        p.updated_at,
        
        owner.name as owner_name,
        owner.cnic as owner_cnic,
        owner.father_name,
        owner.mobile as owner_mobile,
        owner.email as owner_email
        
       FROM properties p
       LEFT JOIN users owner ON p.owner_id = owner.user_id
       WHERE p.status = 'REJECTED'
       ORDER BY p.updated_at DESC`,
      []
    );

    // Get rejector info for each property from audit logs
    for (let prop of result.rows) {
      const auditLog = await pool.query(
        `SELECT u.name as rejected_by_name 
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.user_id
         WHERE al.action_type = 'PROPERTY_REJECTED' 
         AND al.target_id = $1
         ORDER BY al.created_at DESC
         LIMIT 1`,
        [prop.property_id]
      );
      
      if (auditLog.rows.length > 0) {
        prop.rejected_by_name = auditLog.rows[0].rejected_by_name;
      }
    }

    console.log("✅ Found", result.rows.length, "rejected registration(s)");
    console.log("========================================\n");

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching rejected registrations:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// 🆕 RECONSIDER REJECTED REGISTRATION
// =====================================================
router.post("/reconsider", authenticateToken, async (req, res) => {
  try {
    const { propertyId, notes } = req.body;
    const userRole = req.user.role.toUpperCase();

    // Check if user has officer privileges
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    if (!propertyId || !notes) {
      return res.status(400).json({
        success: false,
        message: "Property ID and reconsideration notes required"
      });
    }

    console.log("\n========================================");
    console.log("🔄 RECONSIDERING REJECTED REGISTRATION");
    console.log("Property ID:", propertyId);
    console.log("Officer:", req.user.userId);
    console.log("Notes:", notes);

    // Check if property exists and is rejected
    const propertyCheck = await pool.query(
      `SELECT * FROM properties WHERE property_id = $1 AND status = 'REJECTED'`,
      [propertyId]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Rejected property not found"
      });
    }

    // Move back to PENDING status
    await pool.query(
      `UPDATE properties 
       SET status = 'PENDING',
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE property_id = $1`,
      [propertyId]
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'PROPERTY_RECONSIDERED', $2, $3, $4)`,
      [
        req.user.userId,
        propertyId,
        JSON.stringify({ 
          propertyId, 
          notes,
          reconsideredBy: req.user.userId
        }),
        req.ip || 'unknown'
      ]
    );

    console.log("✅ Property moved back to PENDING");
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Property registration moved back to pending for re-review"
    });

  } catch (err) {
    console.error("❌ Reconsider property error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// Export the router (add at the end of property.js if not already there)
// export default router;

export default router;