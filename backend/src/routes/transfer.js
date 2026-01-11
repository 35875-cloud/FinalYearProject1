// =====================================================
// ENHANCED TRANSFER ROUTES - With Buyer Validation
// Location: backend/src/routes/transfer.js
// FIXED: Uses property_transactions table instead of blockchain_ledger
// =====================================================

import express from "express";
const router = express.Router();
import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// =====================================================
// MIDDLEWARE - JWT Authentication
// =====================================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-jwt-secret");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: "Invalid token" });
  }
}

// =====================================================
// 🆕 VERIFY BUYER - Check if buyer exists and validate info
// =====================================================
router.post("/verify-buyer", authenticateToken, async (req, res) => {
  try {
    const { buyerCnic } = req.body;

    if (!buyerCnic) {
      return res.status(400).json({
        success: false,
        message: "Buyer CNIC is required"
      });
    }

    // Clean CNIC
    const cleanedCnic = buyerCnic.replace(/\D/g, "");

    if (cleanedCnic.length !== 13) {
      return res.status(400).json({
        success: false,
        message: "Invalid CNIC format. Must be 13 digits."
      });
    }

    console.log("\n========================================");
    console.log("🔍 VERIFYING BUYER");
    console.log("CNIC:", cleanedCnic);

    // Check if buyer exists in the system
    const buyerResult = await pool.query(
      `SELECT user_id, name, cnic, father_name, email, mobile, role 
       FROM users 
       WHERE cnic = $1 AND role = 'CITIZEN' AND is_active = TRUE`,
      [cleanedCnic]
    );

    if (buyerResult.rows.length === 0) {
      console.log("❌ Buyer not found in system");
      console.log("========================================\n");
      
      return res.json({
        success: false,
        exists: false,
        message: "Buyer with this CNIC is not registered in the system. Please ask the buyer to register first."
      });
    }

    const buyer = buyerResult.rows[0];
    
    console.log("✅ Buyer found:");
    console.log("   User ID:", buyer.user_id);
    console.log("   Name:", buyer.name);
    console.log("   Father Name:", buyer.father_name);
    console.log("========================================\n");

    return res.json({
      success: true,
      exists: true,
      buyer: {
        userId: buyer.user_id,
        name: buyer.name,
        cnic: buyer.cnic,
        fatherName: buyer.father_name,
        email: buyer.email,
        mobile: buyer.mobile
      },
      message: "Buyer verified successfully"
    });

  } catch (err) {
    console.error("❌ Verify buyer error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// 1️⃣ GET SELLER'S PROPERTIES (for dropdown)
// =====================================================
router.get("/seller-properties", authenticateToken, async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("📋 FETCHING SELLER'S PROPERTIES");
    console.log("User ID:", req.user.userId);

    const result = await pool.query(
      `SELECT property_id, fard_no, khasra_no, khatooni_no, 
              district, tehsil, area_marla, property_type, status
       FROM properties 
       WHERE owner_id = $1 
       AND status = 'APPROVED'
       AND property_id NOT IN (
         SELECT property_id FROM transfer_requests 
         WHERE status IN ('PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED')
       )
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    console.log("✅ Found", result.rows.length, "available properties");
    console.log("========================================\n");

    return res.json({
      success: true,
      properties: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching properties:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// 2️⃣ INITIATE TRANSFER - WITH BUYER VALIDATION
// =====================================================
router.post("/initiate", authenticateToken, async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("📄 INITIATE TRANSFER REQUEST");
    console.log("========================================");

    const {
      propertyId,
      buyerCnic,
      buyerName,
      transferAmount,
      durationDays
    } = req.body;

    // Validation
    if (!propertyId || !buyerCnic || !buyerName || !transferAmount || !durationDays) {
      return res.status(400).json({
        success: false,
        message: "All fields required: propertyId, buyerCnic, buyerName, transferAmount, durationDays"
      });
    }

    // Clean CNIC
    const cleanedCnic = buyerCnic.replace(/\D/g, "");

    // ✅ CRITICAL VALIDATION: Check if buyer exists and info matches
    const buyerCheck = await pool.query(
      `SELECT user_id, name, father_name, cnic 
       FROM users 
       WHERE cnic = $1 AND role = 'CITIZEN' AND is_active = TRUE`,
      [cleanedCnic]
    );

    if (buyerCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "❌ Buyer with CNIC " + formatCNIC(cleanedCnic) + " is not registered as a citizen. Please ask the buyer to register first."
      });
    }

    const registeredBuyer = buyerCheck.rows[0];

    // ✅ VALIDATE NAME MATCH (case-insensitive)
    const normalizedInputName = buyerName.trim().toLowerCase();
    const normalizedRegisteredName = registeredBuyer.name.trim().toLowerCase();

    if (normalizedInputName !== normalizedRegisteredName) {
      return res.status(400).json({
        success: false,
        message: `❌ Name mismatch! The name you entered "${buyerName}" does not match the registered name "${registeredBuyer.name}" for CNIC ${formatCNIC(cleanedCnic)}. Please verify the buyer's information.`
      });
    }

    console.log("✅ Buyer validated:");
    console.log("   User ID:", registeredBuyer.user_id);
    console.log("   Name:", registeredBuyer.name);
    console.log("   Father Name:", registeredBuyer.father_name);
    console.log("   CNIC:", cleanedCnic);

    // Verify seller owns the property
    const propertyCheck = await pool.query(
      `SELECT * FROM properties 
       WHERE property_id = $1 AND owner_id = $2`,
      [propertyId, req.user.userId]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Property not found or you don't own it"
      });
    }

    const property = propertyCheck.rows[0];

    // Check property status
    if (property.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: "Only approved properties can be transferred"
      });
    }

    // Check if property already has pending transfer
    const existingTransfer = await pool.query(
      `SELECT * FROM transfer_requests 
       WHERE property_id = $1 
       AND status IN ('PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED')`,
      [propertyId]
    );

    if (existingTransfer.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "This property already has a pending transfer request"
      });
    }

    // Calculate taxes (2% of transfer amount)
    const propertyTaxBuyer = parseFloat((transferAmount * 0.02).toFixed(2));
    const propertyTaxSeller = parseFloat((transferAmount * 0.02).toFixed(2));
    const totalAmount = parseFloat((parseFloat(transferAmount) + propertyTaxBuyer + propertyTaxSeller).toFixed(2));

    // Set expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

    // Generate transfer ID
    const transferId = `TRF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Insert transfer request
    await pool.query(
      `INSERT INTO transfer_requests 
       (transfer_id, property_id, seller_id, buyer_id, buyer_name, buyer_cnic, buyer_father_name,
        transfer_amount, property_tax_buyer, property_tax_seller, total_amount, 
        status, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PAYMENT_PENDING', $12, NOW(), NOW())`,
      [
        transferId,
        propertyId,
        req.user.userId,
        registeredBuyer.user_id, // ✅ Store buyer's user_id
        registeredBuyer.name,
        cleanedCnic,
        registeredBuyer.father_name || '',
        transferAmount,
        propertyTaxBuyer,
        propertyTaxSeller,
        totalAmount,
        expiresAt
      ]
    );

    console.log("✅ Transfer request created:", transferId);
    console.log("   Buyer User ID:", registeredBuyer.user_id);
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Transfer request created successfully",
      transferId,
      expiresAt,
      totalAmount,
      propertyTaxBuyer,
      propertyTaxSeller,
      buyerUserId: registeredBuyer.user_id
    });

  } catch (err) {
    console.error("❌ Initiate transfer error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// 3️⃣ GET SELLER'S PENDING TRANSFERS
// =====================================================
router.get("/seller-pending", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        tr.*,
        p.fard_no,
        p.khasra_no,
        p.khatooni_no,
        p.district,
        p.tehsil,
        p.area_marla,
        p.property_type
       FROM transfer_requests tr
       LEFT JOIN properties p ON tr.property_id = p.property_id
       WHERE tr.seller_id = $1
       ORDER BY tr.created_at DESC`,
      [req.user.userId]
    );

    return res.json({
      success: true,
      transfers: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching seller transfers:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// 4️⃣ GET BUYER'S PENDING TRANSFERS
// =====================================================
router.get("/buyer-pending", authenticateToken, async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("🔍 FETCHING BUYER'S PENDING TRANSFERS");
    console.log("User ID:", req.user.userId);

    const result = await pool.query(
      `SELECT 
        tr.*,
        p.fard_no,
        p.khasra_no,
        p.khatooni_no,
        p.district,
        p.tehsil,
        p.area_marla,
        p.property_type,
        seller.name as seller_name,
        seller.cnic as seller_cnic,
        seller.mobile as seller_mobile
       FROM transfer_requests tr
       LEFT JOIN properties p ON tr.property_id = p.property_id
       LEFT JOIN users seller ON tr.seller_id = seller.user_id
       WHERE tr.buyer_id = $1 
       AND tr.status IN ('PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED')
       ORDER BY tr.created_at DESC`,
      [req.user.userId]
    );

    console.log("✅ Found", result.rows.length, "pending transfer(s)");
    console.log("========================================\n");

    return res.json({
      success: true,
      transfers: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching buyer transfers:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// 5️⃣ BUYER ENTERS PAYMENT (Simplified - No Upload)
// =====================================================
router.post("/enter-payment", authenticateToken, async (req, res) => {
  try {
    const { transferId, paidAmount } = req.body;

    if (!transferId || !paidAmount) {
      return res.status(400).json({
        success: false,
        message: "Transfer ID and paid amount required"
      });
    }

    console.log("\n========================================");
    console.log("💰 BUYER ENTERING PAYMENT");
    console.log("Transfer ID:", transferId);
    console.log("Paid Amount:", paidAmount);
    console.log("User ID:", req.user.userId);

    // Verify transfer exists and belongs to this buyer
    const transferCheck = await pool.query(
      `SELECT * FROM transfer_requests WHERE transfer_id = $1 AND buyer_id = $2`,
      [transferId, req.user.userId]
    );

    if (transferCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transfer not found or you're not the buyer"
      });
    }

    const transfer = transferCheck.rows[0];

    // Check if payment matches total amount
    if (parseFloat(paidAmount) !== parseFloat(transfer.total_amount)) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (${paidAmount}) must match total amount (${transfer.total_amount})`
      });
    }

    // Update transfer status
    await pool.query(
      `UPDATE transfer_requests 
       SET status = 'PAYMENT_VERIFIED',
           paid_amount = $1,
           payment_uploaded_at = NOW(),
           payment_verified_at = NOW(),
           updated_at = NOW()
       WHERE transfer_id = $2`,
      [paidAmount, transferId]
    );

    console.log("✅ Payment recorded successfully");
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Payment recorded. Waiting for officer approval."
    });

  } catch (err) {
    console.error("❌ Enter payment error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// 6️⃣ GET OFFICER'S PENDING TRANSFERS
// =====================================================
router.get("/officer-pending", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();

    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Officer access required."
      });
    }

    console.log("\n========================================");
    console.log("🏛️ FETCHING OFFICER'S PENDING TRANSFERS");
    console.log("Officer:", req.user.userId, "(", userRole, ")");

    const result = await pool.query(
      `SELECT 
        tr.*,
        p.fard_no,
        p.khasra_no,
        p.khatooni_no,
        p.district,
        p.tehsil,
        p.area_marla,
        p.property_type,
        p.owner_id as current_owner_id,
        p.owner_name as current_owner_name,
        seller.name as seller_name,
        seller.cnic as seller_cnic
       FROM transfer_requests tr
       LEFT JOIN properties p ON tr.property_id = p.property_id
       LEFT JOIN users seller ON tr.seller_id = seller.user_id
       WHERE tr.status IN ('PAYMENT_UPLOADED', 'PAYMENT_VERIFIED')
       ORDER BY tr.created_at DESC`
    );

    console.log("✅ Found", result.rows.length, "pending transfer(s)");
    console.log("========================================\n");

    return res.json({
      success: true,
      transfers: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching officer transfers:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// 7️⃣ APPROVE TRANSFER - FIXED TO USE property_transactions
// =====================================================
router.post("/approve", authenticateToken, async (req, res) => {
  try {
    const { transferId } = req.body;
    const userRole = req.user.role.toUpperCase();

    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only officers can approve transfers."
      });
    }

    console.log("\n========================================");
    console.log("✅ APPROVING TRANSFER:", transferId, "by", req.user.userId);

    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: "Transfer ID is required"
      });
    }

    // Get transfer details with full info
    const transferResult = await pool.query(
      `SELECT 
        tr.*,
        p.owner_id as current_owner_id,
        p.owner_name as current_owner_name,
        p.owner_cnic as current_owner_cnic
       FROM transfer_requests tr
       LEFT JOIN properties p ON tr.property_id = p.property_id
       WHERE tr.transfer_id = $1`,
      [transferId]
    );

    if (transferResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transfer not found"
      });
    }

    const transfer = transferResult.rows[0];

    // Verify status
    if (transfer.status !== 'PAYMENT_VERIFIED' && transfer.status !== 'PAYMENT_UPLOADED') {
      return res.status(400).json({
        success: false,
        message: `Transfer cannot be approved. Current status: ${transfer.status}`
      });
    }

    // ✅ CRITICAL: Verify buyer_id exists in transfer (should always exist now)
    if (!transfer.buyer_id) {
      return res.status(400).json({
        success: false,
        message: "Invalid transfer: Buyer information is incomplete"
      });
    }

    // ✅ DOUBLE CHECK: Verify buyer still exists and info matches
    const buyerVerification = await pool.query(
      `SELECT user_id, name, cnic, father_name 
       FROM users 
       WHERE user_id = $1 AND cnic = $2 AND is_active = TRUE`,
      [transfer.buyer_id, transfer.buyer_cnic]
    );

    if (buyerVerification.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "❌ Buyer account validation failed. The buyer may have been deactivated or deleted."
      });
    }

    const verifiedBuyer = buyerVerification.rows[0];

    // ✅ VALIDATE NAME MATCH AGAIN
    if (verifiedBuyer.name.trim().toLowerCase() !== transfer.buyer_name.trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: `❌ Critical validation error: Buyer name in transfer "${transfer.buyer_name}" does not match registered name "${verifiedBuyer.name}"`
      });
    }

    console.log("✅ Buyer validated:");
    console.log("   User ID:", verifiedBuyer.user_id);
    console.log("   Name:", verifiedBuyer.name);
    console.log("   Father Name:", verifiedBuyer.father_name);
    console.log("   CNIC:", verifiedBuyer.cnic);

    // Start transaction
    await pool.query('BEGIN');

    try {
      // STEP 1: Record ownership history
      console.log("📝 Recording ownership history...");
      console.log("   Previous Owner:", transfer.current_owner_name, "(", transfer.current_owner_id, ")");
      console.log("   New Owner:", verifiedBuyer.name, "(", verifiedBuyer.user_id, ")");

      await pool.query(
        `INSERT INTO ownership_history 
         (id, property_id, previous_owner_id, new_owner_id, transfer_type, 
          transfer_amount, transfer_date, transfer_id)
         VALUES ($1, $2, $3, $4, 'SALE', $5, NOW(), $6)`,
        [
          crypto.randomUUID(),
          transfer.property_id,
          transfer.current_owner_id,
          verifiedBuyer.user_id,
          transfer.transfer_amount,
          transferId
        ]
      );

      console.log("✅ Ownership history recorded");

      // STEP 2: Transfer property ownership
      await pool.query(
        `UPDATE properties 
         SET owner_id = $1, 
             owner_name = $2, 
             owner_cnic = $3, 
             father_name = $4, 
             updated_at = NOW()
         WHERE property_id = $5`,
        [
          verifiedBuyer.user_id, 
          verifiedBuyer.name, 
          verifiedBuyer.cnic, 
          verifiedBuyer.father_name || '', 
          transfer.property_id
        ]
      );

      console.log("✅ Property ownership transferred");

      // STEP 3: Complete transfer request
      await pool.query(
        `UPDATE transfer_requests 
         SET status = 'COMPLETED', 
             completed_at = NOW(), 
             updated_at = NOW() 
         WHERE transfer_id = $1`,
        [transferId]
      );

      // STEP 4: Create property transaction record (NEW - FIXED)
      console.log("📝 Creating property transaction record...");
      
      const transactionData = {
        transferId,
        previousOwner: {
          userId: transfer.current_owner_id,
          name: transfer.current_owner_name,
          cnic: transfer.current_owner_cnic
        },
        newOwner: {
          userId: verifiedBuyer.user_id,
          name: verifiedBuyer.name,
          cnic: verifiedBuyer.cnic,
          fatherName: verifiedBuyer.father_name
        },
        transferAmount: transfer.transfer_amount,
        propertyTaxBuyer: transfer.property_tax_buyer,
        propertyTaxSeller: transfer.property_tax_seller,
        totalAmount: transfer.total_amount,
        approvedBy: req.user.userId,
        approvedAt: new Date().toISOString()
      };

      const transactionHash = crypto.createHash('sha256')
        .update(JSON.stringify(transactionData))
        .digest('hex');

      const previousTransactionHash = await getLatestTransactionHash(transfer.property_id);

      await pool.query(
        `INSERT INTO property_transactions 
         (id, property_id, transaction_type, transaction_data, transaction_hash, 
          previous_transaction_hash, creator_user_id, verified) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          crypto.randomUUID(),
          transfer.property_id,
          'TRANSFER',
          JSON.stringify(transactionData),
          transactionHash,
          previousTransactionHash,
          req.user.userId,
          true
        ]
      );

      console.log("✅ Property transaction record created");
      console.log("   Transaction Hash:", transactionHash);

      // STEP 5: Create audit log
      await pool.query(
        `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
         VALUES ($1, 'TRANSFER_APPROVED', $2, $3, $4)`,
        [
          req.user.userId,
          transferId,
          JSON.stringify({ 
            transferId, 
            propertyId: transfer.property_id, 
            previousOwner: transfer.current_owner_id,
            newOwner: verifiedBuyer.user_id,
            newOwnerName: verifiedBuyer.name,
            transactionHash
          }),
          req.ip || 'unknown'
        ]
      );

      // Commit transaction
      await pool.query('COMMIT');

      console.log("✅ TRANSFER COMPLETED - Property", transfer.property_id, "now owned by", verifiedBuyer.user_id);
      console.log("========================================\n");

      return res.json({ 
        success: true, 
        message: "Transfer approved and ownership changed successfully", 
        newOwnerId: verifiedBuyer.user_id,
        newOwnerName: verifiedBuyer.name,
        newOwnerCnic: verifiedBuyer.cnic,
        previousOwnerId: transfer.current_owner_id,
        transactionHash
      });

    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (err) {
    console.error("❌ Approve transfer error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// =====================================================
// 8️⃣ REJECT TRANSFER
// =====================================================
router.post("/reject", authenticateToken, async (req, res) => {
  try {
    const { transferId, reason } = req.body;
    const userRole = req.user.role.toUpperCase();

    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    if (!transferId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Transfer ID and rejection reason required"
      });
    }

    await pool.query(
      `UPDATE transfer_requests 
       SET status = 'REJECTED',
           rejection_reason = $1,
           rejected_by = $2,
           rejected_at = NOW()
       WHERE transfer_id = $3`,
      [reason, req.user.userId, transferId]
    );

    return res.json({
      success: true,
      message: "Transfer rejected successfully"
    });

  } catch (err) {
    console.error("❌ Reject transfer error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Helper function to get latest transaction hash for a property
async function getLatestTransactionHash(propertyId) {
  try {
    const result = await pool.query(
      `SELECT transaction_hash 
       FROM property_transactions 
       WHERE property_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [propertyId]
    );
    return result.rows.length > 0 ? result.rows[0].transaction_hash : null;
  } catch (err) {
    console.error("Error getting latest transaction hash:", err);
    return null;
  }
}

// Helper function to format CNIC
function formatCNIC(cnic) {
  if (!cnic || cnic.length !== 13) return cnic;
  return `${cnic.slice(0,5)}-${cnic.slice(5,12)}-${cnic.slice(12)}`;
}

// =====================================================
// 🆕 GET BUYER'S PENDING TRANSFERS BY CNIC
// Add this route to your transfer.js file
// =====================================================
router.get("/pending/:cnic", authenticateToken, async (req, res) => {
  try {
    const { cnic } = req.params;
    
    console.log("\n========================================");
    console.log("🔍 FETCHING BUYER'S PENDING TRANSFERS BY CNIC");
    console.log("CNIC:", cnic);

    // Clean CNIC
    const cleanedCnic = cnic.replace(/\D/g, "");

    if (cleanedCnic.length !== 13) {
      return res.status(400).json({
        success: false,
        message: "Invalid CNIC format. Must be 13 digits."
      });
    }

    // First, find the buyer's user_id from the CNIC
    const buyerCheck = await pool.query(
      `SELECT user_id FROM users WHERE cnic = $1 AND is_active = TRUE`,
      [cleanedCnic]
    );

    if (buyerCheck.rows.length === 0) {
      console.log("❌ No user found with CNIC:", cleanedCnic);
      return res.json({
        success: true,
        transfers: [],
        total: 0,
        message: "No transfers found for this CNIC"
      });
    }

    const buyerId = buyerCheck.rows[0].user_id;
    console.log("✅ Found buyer user_id:", buyerId);

    // Get all transfers for this buyer
    const result = await pool.query(
      `SELECT 
        tr.transfer_id,
        tr.property_id,
        tr.buyer_name,
        tr.buyer_cnic,
        tr.buyer_father_name,
        tr.transfer_amount,
        tr.property_tax_buyer,
        tr.property_tax_seller,
        tr.total_amount,
        tr.status,
        tr.expires_at,
        tr.created_at,
        tr.paid_amount,
        
        p.fard_no,
        p.khasra_no,
        p.khatooni_no,
        p.district,
        p.tehsil,
        p.area_marla,
        p.property_type,
        
        seller.name as seller_name,
        seller.cnic as seller_cnic,
        seller.mobile as seller_mobile
        
       FROM transfer_requests tr
       LEFT JOIN properties p ON tr.property_id = p.property_id
       LEFT JOIN users seller ON tr.seller_id = seller.user_id
       WHERE tr.buyer_id = $1 
       AND tr.status IN ('PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED')
       AND tr.expires_at > NOW()
       ORDER BY tr.created_at DESC`,
      [buyerId]
    );

    console.log("✅ Found", result.rows.length, "pending transfer(s)");
    console.log("========================================\n");

    return res.json({
      success: true,
      transfers: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching buyer transfers by CNIC:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});


// 🆕 GET OFFICER'S REJECTED TRANSFERS
// =====================================================
router.get("/officer-rejected", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();

    // Check if user has officer privileges
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only officers can view rejected transfers." 
      });
    }

    console.log("\n========================================");
    console.log("📋 FETCHING REJECTED TRANSFERS FOR OFFICER");
    console.log("User ID:", req.user.userId);
    console.log("User Role:", userRole);

    // Get all rejected transfers with property and user details
    const result = await pool.query(
      `SELECT 
        tr.transfer_id,
        tr.property_id,
        tr.buyer_name,
        tr.buyer_cnic,
        tr.buyer_father_name,
        tr.transfer_amount,
        tr.property_tax_buyer,
        tr.property_tax_seller,
        tr.total_amount,
        tr.status,
        tr.rejection_reason,
        tr.rejected_at,
        tr.created_at,
        tr.paid_amount,
        
        p.fard_no,
        p.khasra_no,
        p.khatooni_no,
        p.district,
        p.tehsil,
        p.area_marla,
        p.property_type,
        
        seller.name as seller_name,
        seller.cnic as seller_cnic,
        seller.mobile as seller_mobile,
        
        rejected_by_user.name as rejected_by_name
        
       FROM transfer_requests tr
       LEFT JOIN properties p ON tr.property_id = p.property_id
       LEFT JOIN users seller ON tr.seller_id = seller.user_id
       LEFT JOIN users rejected_by_user ON tr.rejected_by = rejected_by_user.user_id
       WHERE tr.status = 'REJECTED'
       ORDER BY tr.rejected_at DESC`,
      []
    );

    console.log("✅ Found", result.rows.length, "rejected transfer(s)");
    console.log("========================================\n");

    return res.json({
      success: true,
      transfers: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error("❌ Error fetching rejected transfers:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// 🆕 RECONSIDER REJECTED TRANSFER
// =====================================================
router.post("/reconsider", authenticateToken, async (req, res) => {
  try {
    const { transferId, notes } = req.body;
    const userRole = req.user.role.toUpperCase();

    // Check if user has officer privileges
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    if (!transferId || !notes) {
      return res.status(400).json({
        success: false,
        message: "Transfer ID and reconsideration notes required"
      });
    }

    console.log("\n========================================");
    console.log("🔄 RECONSIDERING REJECTED TRANSFER");
    console.log("Transfer ID:", transferId);
    console.log("Officer:", req.user.userId);
    console.log("Notes:", notes);

    // Check if transfer exists and is rejected
    const transferCheck = await pool.query(
      `SELECT * FROM transfer_requests WHERE transfer_id = $1 AND status = 'REJECTED'`,
      [transferId]
    );

    if (transferCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Rejected transfer not found"
      });
    }

    // Move back to PAYMENT_PENDING status
    await pool.query(
      `UPDATE transfer_requests 
       SET status = 'PAYMENT_PENDING',
           rejection_reason = NULL,
           rejected_by = NULL,
           rejected_at = NULL,
           updated_at = NOW()
       WHERE transfer_id = $1`,
      [transferId]
    );

    // Create audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'TRANSFER_RECONSIDERED', $2, $3, $4)`,
      [
        req.user.userId,
        transferId,
        JSON.stringify({ 
          transferId, 
          notes,
          reconsideredBy: req.user.userId
        }),
        req.ip || 'unknown'
      ]
    );

    console.log("✅ Transfer moved back to PAYMENT_PENDING");
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Transfer moved back to pending for re-review"
    });

  } catch (err) {
    console.error("❌ Reconsider transfer error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

export default router;