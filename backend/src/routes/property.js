import express from "express";
import pool from "../config/db.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import jwt from "jsonwebtoken";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import blockchainService from "../services/blockchain.service.js";

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================
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
// TEST ROUTE
// =====================================================
router.get("/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "Property routes are working!",
    uploadDir: uploadDir
  });
});

// =====================================================
// ADD PROPERTY - SIMPLE (No Photos Required)
// =====================================================
router.post("/add-property-simple", authenticateToken, async (req, res) => {
  console.log("\n========================================");
  console.log("📝 ADD PROPERTY (PENDING APPROVAL)");
  console.log("========================================");
  
  try {
    const userRole = req.user.role.toUpperCase();
    
    if (!['LRO', 'LAND RECORD OFFICER'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only Land Record Officers can add properties." 
      });
    }

    const {
      ownerName, ownerCnic, fatherName, khewatNo, khatooniNo, khasraNo,
      areaMarla, propertyType, district, tehsil, mauza, address, year
    } = req.body;

    console.log("📋 Form Data:", { ownerName, ownerCnic, fatherName, khewatNo, khatooniNo, khasraNo, areaMarla, district, tehsil, mauza });

    // Validate mandatory fields
    const missingFields = [];
    if (!ownerName?.trim()) missingFields.push('Owner Name');
    if (!ownerCnic?.trim()) missingFields.push('CNIC');
    if (!fatherName?.trim()) missingFields.push('Father Name');
    if (!khewatNo?.trim()) missingFields.push('Khewat No');
    if (!khatooniNo?.trim()) missingFields.push('Khatooni No');
    if (!khasraNo?.trim()) missingFields.push('Khasra No');
    if (!areaMarla) missingFields.push('Area (Marla)');
    if (!district?.trim()) missingFields.push('District');
    if (!tehsil?.trim()) missingFields.push('Tehsil');
    if (!mauza?.trim()) missingFields.push('Mauza');
    
    if (missingFields.length > 0) {
      console.log("❌ Validation failed - Missing fields:", missingFields.join(', '));
      return res.status(400).json({ 
        success: false, 
        message: `Please provide all mandatory fields. Missing: ${missingFields.join(', ')}` 
      });
    }

    const cleanedCnic = ownerCnic.replace(/\D/g, "");
    const currentYear = year || new Date().getFullYear();

    // Check if property already exists
    const existingProperty = await pool.query(
      "SELECT * FROM properties WHERE khewat_no = $1 AND khasra_no = $2 AND khatooni_no = $3 AND district = $4",
      [khewatNo, khasraNo, khatooniNo, district]
    );

    if (existingProperty.rows.length > 0) {
      return res.json({
        success: false,
        message: "Property with these details already exists"
      });
    }

    // Check if owner exists, if not create owner record
    let ownerResult = await pool.query(
      "SELECT user_id FROM users WHERE cnic = $1",
      [cleanedCnic]
    );

    let ownerId;
    if (ownerResult.rows.length === 0) {
      const userId = "USR" + Math.floor(100000 + Math.random() * 900000);
      const bcrypt = await import('bcrypt');
      const defaultPassword = await bcrypt.hash("default123", 10);
      
      await pool.query(
        `INSERT INTO users (user_id, name, cnic, father_name, email, mobile, password, role, account_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, ownerName, cleanedCnic, fatherName, `${cleanedCnic}@temp.pk`, 
         `03001234567`, defaultPassword, 'CITIZEN', true]
      );
      ownerId = userId;
      console.log("✅ Created new owner:", ownerId);
    } else {
      ownerId = ownerResult.rows[0].user_id;
      console.log("✅ Found existing owner:", ownerId);
    }

    // Generate property ID
    const propertyId = await generatePropertyId();

    // Insert property with ALL required fields
    await pool.query(
      `INSERT INTO properties 
       (property_id, owner_id, owner_name, owner_cnic, father_name, 
        fard_no, khewat_no, khasra_no, khatooni_no, area_marla, 
        property_type, district, tehsil, mauza, address, 
        status, added_by_officer_id, year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        propertyId,
        ownerId,
        ownerName,
        cleanedCnic,
        fatherName,
        khewatNo,
        khewatNo,
        khasraNo,
        khatooniNo,
        areaMarla,
        propertyType || 'residential',
        district,
        tehsil,
        mauza,
        address || null,
        'PENDING',
        req.user.userId,
        currentYear
      ]
    );

    console.log("✅ Property inserted into database with status PENDING");

    // Create blockchain record
    try {
      const blockchainHash = await createBlockchainRecord(
        propertyId,
        'PROPERTY_ADDED',
        { ownerName, district, tehsil },
        req.user.userId
      );
      console.log("✅ Blockchain record created:", blockchainHash);
    } catch (blockchainError) {
      console.error("⚠️ Blockchain error (non-critical):", blockchainError.message);
    }

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.userId,
        'PROPERTY_ADDED',
        propertyId,
        JSON.stringify({ propertyId, ownerName, status: 'PENDING' }),
        req.ip || 'unknown'
      ]
    );

    console.log("✅ Property added successfully:", propertyId);
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Property added successfully. Awaiting approval.",
      propertyId,
      status: 'PENDING'
    });

  } catch (err) {
    console.error("❌ Error adding property:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// GET USER PROPERTIES (Citizen - Only APPROVED)
// =====================================================
router.get("/my-properties", authenticateToken, async (req, res) => {
  try {
    console.log("📋 Fetching properties for user:", req.user.userId);

    const result = await pool.query(
      `SELECT 
        p.property_id, p.owner_name, p.owner_cnic, p.father_name, 
        p.fard_no, p.khewat_no, p.khasra_no, p.khatooni_no, p.area_marla, 
        p.property_type, p.district, p.tehsil, p.mauza, p.address,
        p.status, p.created_at, p.property_photo_path, p.year,
        u.name as added_by_name
      FROM properties p
      LEFT JOIN users u ON p.added_by_officer_id = u.user_id
      WHERE p.owner_id = $1 AND p.status = 'APPROVED'
      ORDER BY p.created_at DESC`,
      [req.user.userId]
    );

    console.log("✅ Found", result.rows.length, "approved properties");

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
// GET PROPERTY DETAILS
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
      LEFT JOIN users officer ON p.added_by_officer_id = officer.user_id
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
// GET OFFICER STATS
// =====================================================
router.get("/officer-stats", authenticateToken, async (req, res) => {
  try {
    console.log("📊 Fetching officer stats");

    const pendingReg = await pool.query(
      "SELECT COUNT(*) FROM properties WHERE status = 'PENDING'"
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
    console.error("❌ Get stats error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// =====================================================
// GET PENDING REGISTRATIONS (LRO)
// =====================================================
router.get("/pending-registrations", authenticateToken, async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("📋 FETCHING PENDING REGISTRATIONS");
    console.log("========================================");
    console.log("User ID:", req.user.userId);
    console.log("User Role:", req.user.role);
    
    const userRole = req.user.role.toUpperCase();
    
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      console.log("❌ Access denied - invalid role");
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only officers can view pending registrations." 
      });
    }

    console.log("✅ Role check passed");

    const result = await pool.query(
      `SELECT 
        p.property_id, 
        p.owner_name, 
        p.owner_cnic, 
        p.father_name, 
        p.fard_no, 
        p.khewat_no, 
        p.khasra_no, 
        p.khatooni_no, 
        p.area_marla, 
        p.property_type, 
        p.district, 
        p.tehsil, 
        p.mauza, 
        p.address,
        p.status, 
        p.created_at, 
        p.year,
        u.name as owner_full_name, 
        u.email as owner_email, 
        u.mobile as owner_mobile,
        officer.name as added_by_officer_name
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.user_id
      LEFT JOIN users officer ON p.added_by_officer_id = officer.user_id
      WHERE p.status = 'PENDING'
      ORDER BY p.created_at DESC`
    );

    console.log("✅ Query executed successfully");
    console.log("Found", result.rows.length, "pending properties");
    
    if (result.rows.length > 0) {
      console.log("First property:", {
        id: result.rows[0].property_id,
        owner: result.rows[0].owner_name,
        status: result.rows[0].status
      });
    }
    
    console.log("========================================\n");

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });
    
  } catch (err) {
    console.error("========================================");
    console.error("❌ GET PENDING REGISTRATIONS ERROR");
    console.error("========================================");
    console.error("Error:", err.message);
    console.error("Error code:", err.code);
    console.error("Position:", err.position);
    console.error("Hint:", err.hint);
    console.error("========================================\n");
    
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// GET ALL TEHSILDARS (for LRO dropdown)
router.get("/get-tehsildars", authenticateToken, async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("📋 FETCHING TEHSILDARS FOR DROPDOWN");
    console.log("========================================");
    
    const userRole = req.user.role.toUpperCase();
    
    if (!['LRO', 'LAND RECORD OFFICER', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    // More flexible query - get APPROVED and ACTIVE Tehsildars
    const result = await pool.query(
      `SELECT user_id, name, email, role, approval_status, is_active
       FROM users 
       WHERE UPPER(role) = 'TEHSILDAR' 
         AND approval_status = 'APPROVED'
         AND is_active = TRUE
       ORDER BY name ASC`
    );

    console.log("✅ Found", result.rows.length, "Tehsildars");
    
    if (result.rows.length > 0) {
      console.log("Available Tehsildars:");
      result.rows.forEach(t => {
        console.log(`  - ${t.name} (${t.user_id}) - ${t.district}/${t.tehsil}`);
      });
    } else {
      console.log("⚠️ No Tehsildars found!");
      console.log("Please ensure:");
      console.log("  1. Tehsildars are registered");
      console.log("  2. Admin has approved them");
      console.log("  3. approval_status = 'APPROVED'");
      console.log("  4. is_active = TRUE");
    }
    
    console.log("========================================\n");

    return res.json({
      success: true,
      tehsildars: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching tehsildars:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});


// =====================================================
// GET ALL ACs (for Tehsildar dropdown)
// GET ALL ACs (for Tehsildar dropdown)
router.get("/get-acs", authenticateToken, async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("📋 FETCHING ACs FOR DROPDOWN");
    console.log("========================================");
    
    const userRole = req.user.role.toUpperCase();
    
    if (!['TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    const result = await pool.query(
      `SELECT user_id, name, email, role, approval_status, is_active
       FROM users 
       WHERE UPPER(role) = 'AC'
         AND approval_status = 'APPROVED'
         AND is_active = TRUE
       ORDER BY name ASC`
    );

    console.log("✅ Found", result.rows.length, "ACs");
    
    if (result.rows.length > 0) {
      console.log("Available ACs:");
      result.rows.forEach(ac => {
        console.log(`  - ${ac.name} (${ac.user_id}) - ${ac.district}`);
      });
    } else {
      console.log("⚠️ No ACs found!");
    }
    
    console.log("========================================\n");

    return res.json({
      success: true,
      acs: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching ACs:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// =====================================================
// GET ALL DCs (for AC dropdown)
// GET ALL DCs (for AC dropdown)
router.get("/get-dcs", authenticateToken, async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("📋 FETCHING DCs FOR DROPDOWN");
    console.log("========================================");
    
    const userRole = req.user.role.toUpperCase();
    
    if (!['AC', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    const result = await pool.query(
      `SELECT user_id, name, email, role, approval_status, is_active
       FROM users 
       WHERE UPPER(role) = 'DC'
         AND approval_status = 'APPROVED'
         AND is_active = TRUE
       ORDER BY name ASC`
    );

    console.log("✅ Found", result.rows.length, "DCs");
    
    if (result.rows.length > 0) {
      console.log("Available DCs:");
      result.rows.forEach(dc => {
        console.log(`  - ${dc.name} (${dc.user_id}) - ${dc.district}`);
      });
    } else {
      console.log("⚠️ No DCs found!");
    }
    
    console.log("========================================\n");

    return res.json({
      success: true,
      dcs: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching DCs:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});
// =====================================================
// GET FATHER NAME BY CNIC (Auto-fill functionality)
// =====================================================
router.get("/get-father-name/:cnic", authenticateToken, async (req, res) => {
  try {
    const cnic = req.params.cnic.replace(/\D/g, '');
    
    if (cnic.length !== 13) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid CNIC format" 
      });
    }

    const result = await pool.query(
      `SELECT father_name, father_cnic FROM users WHERE cnic = $1`,
      [cnic]
    );

    if (result.rows.length > 0 && result.rows[0].father_name) {
      return res.json({
        success: true,
        fatherName: result.rows[0].father_name,
        fatherCnic: result.rows[0].father_cnic
      });
    }

    return res.json({
      success: false,
      message: "No record found for this CNIC"
    });

  } catch (err) {
    console.error("❌ Error fetching father name:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// =====================================================
// LRO APPROVE & FORWARD TO TEHSILDAR
// =====================================================
router.post("/approve-and-forward", authenticateToken, async (req, res) => {
  try {
    const { propertyId, assignedTehsildarId } = req.body;
    const userRole = req.user.role.toUpperCase();
    
    if (!['LRO', 'LAND RECORD OFFICER', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    if (!propertyId || !assignedTehsildarId) {
      return res.status(400).json({
        success: false,
        message: "Property ID and Tehsildar selection required"
      });
    }

    // Verify tehsildar exists
    const tehsildarCheck = await pool.query(
      "SELECT user_id, name FROM users WHERE user_id = $1 AND UPPER(role) = 'TEHSILDAR'",
      [assignedTehsildarId]
    );

    if (tehsildarCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid Tehsildar selected"
      });
    }

    // Check property exists and is pending
    const propertyCheck = await pool.query(
      "SELECT * FROM properties WHERE property_id = $1 AND status IN ('PENDING', 'PENDING_APPROVAL')",
      [propertyId]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Property not found or not in pending status"
      });
    }

    // Update property status
    await pool.query(
      `UPDATE properties 
       SET status = 'PENDING_TEHSILDAR',
           assigned_tehsildar_id = $1,
           current_approver_role = 'TEHSILDAR',
           updated_at = NOW()
       WHERE property_id = $2`,
      [assignedTehsildarId, propertyId]
    );

    // Create approval chain record
    try {
      await pool.query(
        `INSERT INTO approval_chain 
         (property_id, approver_user_id, approver_role, action, assigned_to_user_id, assigned_to_role)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [propertyId, req.user.userId, 'LRO', 'APPROVED_AND_FORWARDED', assignedTehsildarId, 'TEHSILDAR']
      );
    } catch (e) {
      console.log("⚠️ approval_chain table may not exist yet");
    }

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.userId,
        'PROPERTY_APPROVED_AND_FORWARDED',
        propertyId,
        JSON.stringify({ propertyId, assignedTehsildar: tehsildarCheck.rows[0].name }),
        req.ip || 'unknown'
      ]
    );

    console.log("✅ Property approved and forwarded to Tehsildar");

    return res.json({
      success: true,
      message: "Property approved and forwarded to Tehsildar",
      propertyId,
      assignedTo: tehsildarCheck.rows[0].name,
      status: 'PENDING_TEHSILDAR'
    });

  } catch (err) {
    console.error("❌ Error approving property:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// GET PROPERTIES PENDING FOR TEHSILDAR
// =====================================================
router.get("/tehsildar-pending", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'TEHSILDAR') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Tehsildar only." 
      });
    }

    const result = await pool.query(
      `SELECT p.*, u.name as owner_name, u.cnic as owner_cnic, u.father_name,
              lro.name as added_by_officer_name
       FROM properties p
       LEFT JOIN users u ON p.owner_id = u.user_id
       LEFT JOIN users lro ON p.added_by_officer_id = lro.user_id
       WHERE p.assigned_tehsildar_id = $1 AND p.status = 'PENDING_TEHSILDAR'
       ORDER BY p.created_at DESC`,
      [req.user.userId]
    );

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching Tehsildar pending:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// TEHSILDAR FORWARD TO AC
// =====================================================
router.post("/tehsildar-forward-to-ac", authenticateToken, async (req, res) => {
  try {
    const { propertyId, assignedAcId, comments } = req.body;
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'TEHSILDAR') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    if (!propertyId || !assignedAcId) {
      return res.status(400).json({
        success: false,
        message: "Property ID and AC selection required"
      });
    }

    // Verify AC exists
    const acCheck = await pool.query(
      "SELECT user_id, name FROM users WHERE user_id = $1 AND UPPER(role) = 'AC'",
      [assignedAcId]
    );

    if (acCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid AC selected"
      });
    }

    // Check property is assigned to this Tehsildar
    const propertyCheck = await pool.query(
      "SELECT * FROM properties WHERE property_id = $1 AND assigned_tehsildar_id = $2 AND status = 'PENDING_TEHSILDAR'",
      [propertyId, req.user.userId]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Property not found or not assigned to you"
      });
    }

    // Update property
    await pool.query(
      `UPDATE properties 
       SET status = 'PENDING_AC', 
           assigned_ac_id = $1,
           current_approver_role = 'AC',
           updated_at = NOW()
       WHERE property_id = $2`,
      [assignedAcId, propertyId]
    );

    // Create approval chain record
    await pool.query(
      `INSERT INTO approval_chain 
       (property_id, approver_user_id, approver_role, action, comments, assigned_to_user_id, assigned_to_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [propertyId, req.user.userId, 'TEHSILDAR', 'FORWARDED', comments, assignedAcId, 'AC']
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.userId,
        'PROPERTY_FORWARDED_TO_AC',
        propertyId,
        JSON.stringify({ propertyId, assignedAc: acCheck.rows[0].name, comments }),
        req.ip || 'unknown'
      ]
    );

    console.log("✅ Tehsildar forwarded property to AC");

    return res.json({
      success: true,
      message: "Property forwarded to AC for approval",
      assignedTo: acCheck.rows[0].name
    });

  } catch (err) {
    console.error("❌ Error forwarding to AC:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// GET PROPERTIES PENDING FOR AC
// =====================================================
router.get("/ac-pending", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'AC') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. AC only." 
      });
    }

    const result = await pool.query(
      `SELECT 
        p.*,
        u.name as owner_name, 
        u.cnic as owner_cnic, 
        u.father_name,
        tehsildar.name as tehsildar_name,
        lro.name as added_by_officer_name
       FROM properties p
       LEFT JOIN users u ON p.owner_id = u.user_id
       LEFT JOIN users tehsildar ON p.assigned_tehsildar_id = tehsildar.user_id
       LEFT JOIN users lro ON p.added_by_officer_id = lro.user_id
       WHERE p.assigned_ac_id = $1 AND p.status = 'PENDING_AC'
       ORDER BY p.created_at DESC`,
      [req.user.userId]
    );

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching AC pending:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// AC FORWARD TO DC
// =====================================================
router.post("/ac-forward-to-dc", authenticateToken, async (req, res) => {
  try {
    const { propertyId, assignedDcId, comments } = req.body;
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'AC') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    if (!propertyId || !assignedDcId) {
      return res.status(400).json({
        success: false,
        message: "Property ID and DC selection required"
      });
    }

    // Verify DC exists
    const dcCheck = await pool.query(
      "SELECT user_id, name FROM users WHERE user_id = $1 AND UPPER(role) = 'DC'",
      [assignedDcId]
    );

    if (dcCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid DC selected"
      });
    }

    // Update property
    await pool.query(
      `UPDATE properties 
       SET status = 'PENDING_DC', 
           assigned_dc_id = $1,
           current_approver_role = 'DC',
           updated_at = NOW()
       WHERE property_id = $2 AND assigned_ac_id = $3`,
      [assignedDcId, propertyId, req.user.userId]
    );

    // Create approval chain record
    await pool.query(
      `INSERT INTO approval_chain 
       (property_id, approver_user_id, approver_role, action, comments, assigned_to_user_id, assigned_to_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [propertyId, req.user.userId, 'AC', 'FORWARDED', comments, assignedDcId, 'DC']
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.userId,
        'PROPERTY_FORWARDED_TO_DC',
        propertyId,
        JSON.stringify({ propertyId, assignedDc: dcCheck.rows[0].name, comments }),
        req.ip || 'unknown'
      ]
    );

    return res.json({
      success: true,
      message: "Property forwarded to DC for final approval",
      assignedTo: dcCheck.rows[0].name
    });

  } catch (err) {
    console.error("❌ Error forwarding to DC:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// GET PROPERTIES PENDING FOR DC
// =====================================================
router.get("/dc-pending", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'DC') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. DC only." 
      });
    }

    const result = await pool.query(
      `SELECT 
        p.*,
        u.name as owner_name, 
        u.cnic as owner_cnic, 
        u.father_name,
        ac.name as ac_name, 
        tehsildar.name as tehsildar_name,
        lro.name as added_by_officer_name
       FROM properties p
       LEFT JOIN users u ON p.owner_id = u.user_id
       LEFT JOIN users ac ON p.assigned_ac_id = ac.user_id
       LEFT JOIN users tehsildar ON p.assigned_tehsildar_id = tehsildar.user_id
       LEFT JOIN users lro ON p.added_by_officer_id = lro.user_id
       WHERE p.assigned_dc_id = $1 AND p.status = 'PENDING_DC'
       ORDER BY p.created_at DESC`,
      [req.user.userId]
    );

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching DC pending:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// DC FINAL APPROVAL
// =====================================================
router.post("/dc-approve", authenticateToken, async (req, res) => {
  try {
    const { propertyId, comments } = req.body;
    const userRole = req.user.role.toUpperCase();
    
    if (userRole !== 'DC') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID required"
      });
    }

    // Update property to APPROVED
    await pool.query(
      `UPDATE properties 
       SET status = 'APPROVED', 
           current_approver_role = NULL,
           updated_at = NOW()
       WHERE property_id = $1 AND assigned_dc_id = $2`,
      [propertyId, req.user.userId]
    );

    // Create approval chain record
    await pool.query(
      `INSERT INTO approval_chain 
       (property_id, approver_user_id, approver_role, action, comments)
       VALUES ($1, $2, $3, $4, $5)`,
      [propertyId, req.user.userId, 'DC', 'APPROVED', comments]
    );

    // Create blockchain record
    try {
      await createBlockchainRecord(
        propertyId,
        'PROPERTY_APPROVED_BY_DC',
        { propertyId, comments },
        req.user.userId
      );
    } catch (blockchainError) {
      console.error("⚠️ Blockchain error (non-critical):", blockchainError.message);
    }

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.userId,
        'PROPERTY_APPROVED_BY_DC',
        propertyId,
        JSON.stringify({ propertyId, comments }),
        req.ip || 'unknown'
      ]
    );

    return res.json({
      success: true,
      message: "Property approved successfully. Now visible to citizen.",
      propertyId,
      status: 'APPROVED'
    });

  } catch (err) {
    console.error("❌ Error approving property:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// REJECT PROPERTY (Any approver in chain)
// =====================================================
router.post("/reject-property", authenticateToken, async (req, res) => {
  try {
    const { propertyId, reason } = req.body;
    const userRole = req.user.role.toUpperCase();
    
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'AC', 'DC', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    if (!propertyId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Property ID and rejection reason required"
      });
    }

    // Update property to REJECTED
    await pool.query(
      `UPDATE properties 
       SET status = 'REJECTED', 
           rejection_reason = $1,
           current_approver_role = NULL,
           updated_at = NOW()
       WHERE property_id = $2`,
      [reason, propertyId]
    );

    // Create approval chain record
    await pool.query(
      `INSERT INTO approval_chain 
       (property_id, approver_user_id, approver_role, action, comments)
       VALUES ($1, $2, $3, $4, $5)`,
      [propertyId, req.user.userId, userRole, 'REJECTED', reason]
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.userId,
        'PROPERTY_REJECTED',
        propertyId,
        JSON.stringify({ propertyId, reason, rejectedBy: userRole }),
        req.ip || 'unknown'
      ]
    );

    return res.json({
      success: true,
      message: "Property rejected successfully",
      propertyId,
      status: 'REJECTED'
    });

  } catch (err) {
    console.error("❌ Error rejecting property:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

router.post("/reject-in-chain", authenticateToken, async (req, res) => {
  try {
    const { propertyId, reason } = req.body;
    const userRole = req.user.role.toUpperCase();
    
    if (!['TEHSILDAR', 'AC', 'DC'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    if (!propertyId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Property ID and rejection reason required"
      });
    }

    await pool.query(
      `UPDATE properties 
       SET status = 'REJECTED', 
           rejection_reason = $1,
           current_approver_role = NULL,
           updated_at = NOW()
       WHERE property_id = $2`,
      [reason, propertyId]
    );

    await pool.query(
      `INSERT INTO approval_chain 
       (property_id, approver_user_id, approver_role, action, comments)
       VALUES ($1, $2, $3, $4, $5)`,
      [propertyId, req.user.userId, userRole, 'REJECTED', reason]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.userId,
        'PROPERTY_REJECTED',
        propertyId,
        JSON.stringify({ propertyId, reason, rejectedBy: userRole }),
        req.ip || 'unknown'
      ]
    );

    return res.json({
      success: true,
      message: "Property rejected successfully",
      propertyId,
      status: 'REJECTED'
    });

  } catch (err) {
    console.error("❌ Error rejecting property:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// GET PROPERTY HISTORY
// =====================================================
router.get("/history/:propertyId", authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    console.log("📜 Fetching ownership history for:", propertyId);

    let history = [];
    
    try {
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
      console.log("✅ Found", history.length, "history records");

    } catch (tableErr) {
      console.log("⚠️ ownership_history table might not exist, trying transfer_requests...");
      
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
      console.log("✅ Found", history.length, "transfer records");
    }

    return res.json({
      success: true,
      history: history,
      total: history.length
    });

  } catch (err) {
    console.error("❌ Get property history error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

export default router;