import express from "express";
import pool from "../config/db.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import jwt from "jsonwebtoken";

const router = express.Router(); // ✅ REQUIRED

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import blockchainService from "../services/blockchain.service.js";



function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log("❌ No token provided");
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-jwt-secret");
    req.user = decoded;
    console.log("✅ Token verified for user:", decoded.userId, "Role:", decoded.role);
    next();
  } catch (err) {
    console.log("❌ Token verification failed:", err.message);
    return res.status(403).json({ success: false, message: "Invalid or expired token" });
  }
}

// =====================================================
// CREATE UPLOAD DIRECTORY IF NOT EXISTS
// =====================================================
const uploadDir = path.join(__dirname, '../../uploads/properties');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("✅ Created upload directory:", uploadDir);
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
    
    console.log("✅ Blockchain record created:", blockchainHash);
    return blockchainHash;
  } catch (err) {
    console.error("❌ Error creating blockchain record:", err);
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
// 1️⃣ ADD NEW PROPERTY (Land Record Officer)
// =====================================================
router.post("/add-property", authenticateToken, upload.fields([
  { name: 'ownerPhoto', maxCount: 1 },
  { name: 'propertyPhoto', maxCount: 1 }
]), async (req, res) => {
  console.log("\n========================================");
  console.log("📝 ADD PROPERTY REQUEST RECEIVED");
  console.log("========================================");
  
  try {
    console.log("User ID:", req.user.userId);
    console.log("User Role:", req.user.role);
    console.log("Request Body:", req.body);
    console.log("Uploaded Files:", req.files);

    // Check if user is Land Record Officer
    if (req.user.role !== 'LRO' && req.user.role !== 'LAND RECORD OFFICER') {
      console.log("❌ Access denied - not an LRO");
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
      console.log("❌ Missing required fields");
      return res.status(400).json({ 
        success: false, 
        message: "All required fields must be provided" 
      });
    }

    // Check if files are uploaded
    if (!req.files || !req.files.ownerPhoto || !req.files.propertyPhoto) {
      console.log("❌ Missing files");
      return res.status(400).json({ 
        success: false, 
        message: "Owner photo and property photo are required" 
      });
    }

    console.log("✅ All validations passed");

    // Clean CNIC
    const cleanedCnic = ownerCnic.replace(/\D/g, "");
    console.log("Cleaned CNIC:", cleanedCnic);

    // Check if property already exists
    const existingProperty = await pool.query(
      "SELECT * FROM properties WHERE fard_no = $1 AND khasra_no = $2 AND khatooni_no = $3",
      [fardNo, khasraNo, khatooniNo]
    );

    if (existingProperty.rows.length > 0) {
      console.log("❌ Property already exists");
      return res.json({
        success: false,
        message: "Property with these details already exists"
      });
    }

    console.log("✅ Property is unique");

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
      console.log("✅ Created new owner:", ownerId);
    } else {
      ownerId = ownerResult.rows[0].user_id;
      console.log("✅ Found existing owner:", ownerId);
    }

    // Generate Property ID
    const propertyId = await generatePropertyId();
    console.log("✅ Generated Property ID:", propertyId);

    // Generate file hashes
    const ownerPhotoPath = req.files.ownerPhoto[0].path;
    const propertyPhotoPath = req.files.propertyPhoto[0].path;
    
    console.log("Owner Photo Path:", ownerPhotoPath);
    console.log("Property Photo Path:", propertyPhotoPath);

    const ownerPhotoHash = generateFileHash(ownerPhotoPath);
    const propertyPhotoHash = generateFileHash(propertyPhotoPath);
    
    console.log("✅ Generated file hashes");

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

    console.log("✅ Property inserted into database");

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

    console.log("✅ Blockchain record created");

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

    console.log("✅ Audit log created");
    console.log("========================================");
    console.log("✅ PROPERTY ADDED SUCCESSFULLY");
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
    console.error("❌ ADD PROPERTY ERROR");
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
// 2️⃣ GET USER PROPERTIES (Citizen)
// =====================================================
router.get("/my-properties", authenticateToken, async (req, res) => {
  try {
    console.log("📋 Fetching properties for user:", req.user.userId);

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

    console.log("✅ Found", result.rows.length, "properties");

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Get properties error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// =====================================================
// 3️⃣ GET PROPERTY DETAILS
// =====================================================
router.get("/property/:propertyId", authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.params;
    console.log("📄 Fetching property details for:", propertyId);

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
      console.log("❌ Property not found");
      return res.status(404).json({ 
        success: false, 
        message: "Property not found" 
      });
    }

    // Check if user has permission to view this property
    const property = result.rows[0];
    const userRole = req.user.role.toUpperCase();
    
    if (userRole === 'CITIZEN' && property.owner_id !== req.user.userId) {
      console.log("❌ Access denied");
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

    console.log("✅ Property details retrieved");

    return res.json({
      success: true,
      property: result.rows[0],
      blockchainHistory: blockchainHistory.rows
    });

  } catch (err) {
    console.error("❌ Get property details error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// =====================================================
// 4️⃣ GET OFFICER STATS
// =====================================================
router.get("/officer-stats", authenticateToken, async (req, res) => {
  try {
    console.log("📊 Fetching officer stats");

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
      "SELECT COUNT(*) FROM properties WHERE status = 'APPROVED' AND DATE(approved_at) = CURRENT_DATE"
    );

    return res.json({
      success: true,
      pendingRegistrations: parseInt(pendingReg.rows[0].count),
      pendingTransfers: parseInt(pendingTransfer.rows[0].count),
      frozenProperties: parseInt(frozen.rows[0].count),
      approvedToday: parseInt(approvedToday.rows[0].count)
    });

  } catch (err) {
    console.error("❌ Get stats error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});


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
  
//   console.log("✅ Property registered on blockchain:", blockchainResult.transactionHash);
// } catch (blockchainError) {
//   console.error("❌ Blockchain registration failed:", blockchainError);
//   // Property is in database but not on blockchain - handle this case
// }

export default router;
