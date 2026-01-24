// =====================================================
// ENHANCED TRANSFER ROUTES - Complete Property Transfer Workflow
// Location: backend/src/routes/transfer.js
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
// UTILITY FUNCTIONS
// =====================================================
function formatCNIC(cnic) {
  if (!cnic || cnic.length !== 13) return cnic;
  return `${cnic.slice(0, 5)}-${cnic.slice(5, 12)}-${cnic.slice(12)}`;
}

// =====================================================
// 1️⃣ VERIFY BUYER - Check if buyer exists
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
// 2️⃣ GET SELLER'S PROPERTIES (for dropdown)
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
// 3️⃣ INITIATE TRANSFER - Create transfer application
// =====================================================
router.post("/initiate", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

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
      throw new Error("All fields required: propertyId, buyerCnic, buyerName, transferAmount, durationDays");
    }

    const cleanedCnic = buyerCnic.replace(/\D/g, "");

    // Verify buyer exists
    const buyerCheck = await client.query(
      `SELECT user_id, name, father_name, cnic 
       FROM users 
       WHERE cnic = $1 AND role = 'CITIZEN' AND is_active = TRUE`,
      [cleanedCnic]
    );

    if (buyerCheck.rows.length === 0) {
      throw new Error(`Buyer with CNIC ${formatCNIC(cleanedCnic)} is not registered. Please ask the buyer to register first.`);
    }

    const registeredBuyer = buyerCheck.rows[0];

    // Validate name match
    const normalizedInputName = buyerName.trim().toLowerCase();
    const normalizedRegisteredName = registeredBuyer.name.trim().toLowerCase();

    if (normalizedInputName !== normalizedRegisteredName) {
      throw new Error(`Name mismatch! Entered "${buyerName}" does not match registered name "${registeredBuyer.name}"`);
    }

    console.log("✅ Buyer validated:", registeredBuyer.name);

    // Verify seller owns property
    const propertyCheck = await client.query(
      `SELECT * FROM properties 
       WHERE property_id = $1 AND owner_id = $2 AND status = 'APPROVED'`,
      [propertyId, req.user.userId]
    );

    if (propertyCheck.rows.length === 0) {
      throw new Error("Property not found or you don't own it");
    }

    const property = propertyCheck.rows[0];

    // Check for pending transfers
    const existingTransfer = await client.query(
      `SELECT * FROM transfer_requests 
       WHERE property_id = $1 
       AND status IN ('PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED')`,
      [propertyId]
    );

    if (existingTransfer.rows.length > 0) {
      throw new Error("This property already has a pending transfer request");
    }

    // Calculate taxes (2% each)
    const propertyTaxBuyer = parseFloat((transferAmount * 0.02).toFixed(2));
    const propertyTaxSeller = parseFloat((transferAmount * 0.02).toFixed(2));
    const totalAmount = parseFloat(transferAmount) + propertyTaxBuyer;

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

    // Generate transfer ID
    const transferId = `TR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Create transfer request
    const transferResult = await client.query(
      `INSERT INTO transfer_requests (
        transfer_id, property_id, seller_id, buyer_id, buyer_name, buyer_cnic, buyer_father_name,
        transfer_amount, property_tax_buyer, property_tax_seller, total_amount,
        status, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PAYMENT_PENDING', $12, NOW())
      RETURNING *`,
      [
        transferId,
        propertyId,
        req.user.userId,
        registeredBuyer.user_id,
        registeredBuyer.name,
        cleanedCnic,
        registeredBuyer.father_name,
        transferAmount,
        propertyTaxBuyer,
        propertyTaxSeller,
        totalAmount,
        expiresAt
      ]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'TRANSFER_INITIATED', $2, $3, $4)`,
      [
        req.user.userId,
        transferId,
        JSON.stringify({ propertyId, buyerId: registeredBuyer.user_id, amount: transferAmount }),
        req.ip || 'unknown'
      ]
    );

    await client.query('COMMIT');

    console.log("✅ Transfer initiated successfully");
    console.log("Transfer ID:", transferId);
    console.log("Expires at:", expiresAt);
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Transfer request created successfully",
      transfer: transferResult.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Initiate transfer error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    client.release();
  }
});

// =====================================================
// 4️⃣ BUYER: Get Pending Transfer Applications (Limited View)
// =====================================================
router.get("/buyer-pending", authenticateToken, async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("👤 FETCHING BUYER'S PENDING TRANSFERS");
    console.log("Buyer ID:", req.user.userId);

    const result = await pool.query(
      `SELECT 
        tr.transfer_id,
        tr.property_id,
        tr.buyer_name,
        tr.buyer_cnic,
        tr.transfer_amount,
        tr.property_tax_buyer,
        tr.total_amount,
        tr.status,
        tr.expires_at,
        tr.created_at,
        tr.paid_amount,
        tr.payment_challan_url,
        
        -- Limited property info (buyer can see basic details only)
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
      [req.user.userId]
    );

    console.log("✅ Found", result.rows.length, "pending transfer(s)");
    console.log("========================================\n");

    return res.json({
      success: true,
      transfers: result.rows,
      total: result.rows.length,
      message: "Note: You can see limited property details until transfer is approved"
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
// 5️⃣ BUYER: Upload Payment Challan
// =====================================================
router.post("/upload-payment", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log("\n========================================");
    console.log("💳 BUYER UPLOADING PAYMENT CHALLAN");
    console.log("========================================");

    const { transferId, paidAmount, challanUrl } = req.body;

    if (!transferId || !paidAmount || !challanUrl) {
      throw new Error("Transfer ID, paid amount, and challan URL required");
    }

    // Verify transfer belongs to this buyer
    const transferCheck = await client.query(
      `SELECT * FROM transfer_requests 
       WHERE transfer_id = $1 AND buyer_id = $2 AND status = 'PAYMENT_PENDING'`,
      [transferId, req.user.userId]
    );

    if (transferCheck.rows.length === 0) {
      throw new Error("Transfer not found or payment already uploaded");
    }

    const transfer = transferCheck.rows[0];

    // Verify amount matches (with small tolerance for rounding)
    const amountDifference = Math.abs(parseFloat(paidAmount) - parseFloat(transfer.total_amount));
    if (amountDifference > 0.01) {
      throw new Error(`Payment amount mismatch. Expected: ${transfer.total_amount}, Received: ${paidAmount}`);
    }

    // Update transfer with payment details
    await client.query(
      `UPDATE transfer_requests 
       SET status = 'PAYMENT_UPLOADED',
           paid_amount = $1,
           payment_challan_url = $2,
           payment_uploaded_at = NOW(),
           updated_at = NOW()
       WHERE transfer_id = $3`,
      [paidAmount, challanUrl, transferId]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'PAYMENT_UPLOADED', $2, $3, $4)`,
      [
        req.user.userId,
        transferId,
        JSON.stringify({ paidAmount, challanUrl }),
        req.ip || 'unknown'
      ]
    );

    await client.query('COMMIT');

    console.log("✅ Payment challan uploaded successfully");
    console.log("Amount:", paidAmount);
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Payment challan uploaded successfully. Awaiting LRO verification.",
      transferId: transferId
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Upload payment error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    client.release();
  }
});

// =====================================================
// 6️⃣ LRO: Get Pending Transfers for Approval
// =====================================================
router.get("/officer-pending", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();

    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only LRO/Tehsildar/Admin can view pending transfers." 
      });
    }

    console.log("\n========================================");
    console.log("👮 FETCHING PENDING TRANSFERS FOR OFFICER");
    console.log("Officer ID:", req.user.userId);
    console.log("Officer Role:", userRole);

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
        tr.payment_challan_url,
        tr.payment_uploaded_at,
        
        -- Full property details
        p.fard_no,
        p.khewat_no,
        p.khasra_no,
        p.khatooni_no,
        p.district,
        p.tehsil,
        p.mauza,
        p.area_marla,
        p.property_type,
        p.owner_name as current_owner_name,
        p.owner_cnic as current_owner_cnic,
        
        seller.name as seller_name,
        seller.cnic as seller_cnic,
        seller.mobile as seller_mobile,
        seller.father_name as seller_father_name
        
       FROM transfer_requests tr
       LEFT JOIN properties p ON tr.property_id = p.property_id
       LEFT JOIN users seller ON tr.seller_id = seller.user_id
       WHERE tr.status IN ('PAYMENT_UPLOADED', 'PAYMENT_VERIFIED')
       AND tr.expires_at > NOW()
       ORDER BY tr.payment_uploaded_at ASC`,
      []
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
// 7️⃣ LRO: APPROVE TRANSFER - Transfer Property Ownership
// =====================================================
router.post("/approve", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const userRole = req.user.role.toUpperCase();
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      throw new Error("Access denied. Only LRO/Tehsildar/Admin can approve transfers.");
    }

    console.log("\n========================================");
    console.log("✅ APPROVING PROPERTY TRANSFER");
    console.log("========================================");

    const { transferId, approvalNotes } = req.body;

    if (!transferId) {
      throw new Error("Transfer ID required");
    }

    // Get transfer details
    const transferResult = await client.query(
      `SELECT tr.*, p.*, u.name as buyer_full_name, u.father_name as buyer_father_name
       FROM transfer_requests tr
       LEFT JOIN properties p ON tr.property_id = p.property_id
       LEFT JOIN users u ON tr.buyer_id = u.user_id
       WHERE tr.transfer_id = $1 
       AND tr.status IN ('PAYMENT_UPLOADED', 'PAYMENT_VERIFIED')`,
      [transferId]
    );

    if (transferResult.rows.length === 0) {
      throw new Error("Transfer not found or not ready for approval");
    }

    const transfer = transferResult.rows[0];
    const property = transfer;

    console.log("Property ID:", transfer.property_id);
    console.log("Current Owner ID:", transfer.owner_id);
    console.log("New Owner ID:", transfer.buyer_id);
    console.log("Current Owner Name:", transfer.owner_name);
    console.log("New Owner Name:", transfer.buyer_full_name);

    // Update property ownership (keep same property_id but change owner details)
    await client.query(
      `UPDATE properties 
       SET owner_id = $1,
           owner_name = $2,
           owner_cnic = $3,
           father_name = $4,
           updated_at = NOW()
       WHERE property_id = $5`,
      [
        transfer.buyer_id,
        transfer.buyer_full_name,
        transfer.buyer_cnic,
        transfer.buyer_father_name,
        transfer.property_id
      ]
    );

    // Create ownership history record
    await client.query(
      `INSERT INTO property_ownership_history (
        property_id, previous_owner_id, new_owner_id, 
        transfer_type, transfer_amount, transfer_date, 
        remarks, created_at
      ) VALUES ($1, $2, $3, 'SALE', $4, NOW(), $5, NOW())`,
      [
        transfer.property_id,
        transfer.owner_id, // Previous owner (seller)
        transfer.buyer_id,  // New owner (buyer)
        transfer.transfer_amount,
        `Transfer approved by ${req.user.name || 'Officer'}. ${approvalNotes || ''}`
      ]
    );

    // Update transfer status to APPROVED
    await client.query(
      `UPDATE transfer_requests 
       SET status = 'APPROVED',
           approved_by = $1,
           approved_at = NOW(),
           approval_notes = $2,
           updated_at = NOW()
       WHERE transfer_id = $3`,
      [req.user.userId, approvalNotes || 'Transfer approved', transferId]
    );

    // Create transaction record
    await client.query(
      `INSERT INTO property_transactions (
        transaction_id, property_id, transaction_type, 
        from_user_id, to_user_id, amount, status, 
        transaction_date, created_at
      ) VALUES (
        $1, $2, 'TRANSFER', $3, $4, $5, 'COMPLETED', NOW(), NOW()
      )`,
      [
        `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        transfer.property_id,
        transfer.owner_id,
        transfer.buyer_id,
        transfer.transfer_amount
      ]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'TRANSFER_APPROVED', $2, $3, $4)`,
      [
        req.user.userId,
        transferId,
        JSON.stringify({ 
          propertyId: transfer.property_id,
          oldOwnerId: transfer.owner_id,
          newOwnerId: transfer.buyer_id,
          amount: transfer.transfer_amount
        }),
        req.ip || 'unknown'
      ]
    );

    await client.query('COMMIT');

    console.log("✅ Property ownership transferred successfully");
    console.log("Property:", transfer.property_id);
    console.log("From:", transfer.owner_name, "→ To:", transfer.buyer_full_name);
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Transfer approved successfully. Property ownership has been transferred.",
      propertyId: transfer.property_id,
      newOwnerId: transfer.buyer_id,
      newOwnerName: transfer.buyer_full_name
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Approve transfer error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    client.release();
  }
});

// =====================================================
// 8️⃣ LRO: REJECT TRANSFER
// =====================================================
router.post("/reject", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const userRole = req.user.role.toUpperCase();
    if (!['LRO', 'LAND RECORD OFFICER', 'TEHSILDAR', 'ADMIN'].includes(userRole)) {
      throw new Error("Access denied");
    }

    console.log("\n========================================");
    console.log("❌ REJECTING PROPERTY TRANSFER");
    console.log("========================================");

    const { transferId, reason } = req.body;

    if (!transferId || !reason) {
      throw new Error("Transfer ID and rejection reason required");
    }

    // Update transfer status
    await client.query(
      `UPDATE transfer_requests 
       SET status = 'REJECTED',
           rejection_reason = $1,
           rejected_by = $2,
           rejected_at = NOW(),
           updated_at = NOW()
       WHERE transfer_id = $3`,
      [reason, req.user.userId, transferId]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) 
       VALUES ($1, 'TRANSFER_REJECTED', $2, $3, $4)`,
      [
        req.user.userId,
        transferId,
        JSON.stringify({ reason }),
        req.ip || 'unknown'
      ]
    );

    await client.query('COMMIT');

    console.log("✅ Transfer rejected");
    console.log("Reason:", reason);
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Transfer rejected successfully"
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Reject transfer error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    client.release();
  }
});

// =====================================================
// 9️⃣ GET SELLER'S TRANSFERS
// =====================================================
router.get("/seller-transfers", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        tr.*,
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
    console.error("❌ Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// =====================================================
// 🔟 CHECK TRANSFER EXPIRY (Cleanup Job)
// =====================================================
router.post("/cleanup-expired", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role.toUpperCase();
    if (!['ADMIN', 'LRO'].includes(userRole)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const result = await pool.query(
      `UPDATE transfer_requests 
       SET status = 'EXPIRED',
           updated_at = NOW()
       WHERE status IN ('PAYMENT_PENDING', 'PAYMENT_UPLOADED')
       AND expires_at < NOW()
       RETURNING transfer_id`
    );

    return res.json({
      success: true,
      message: `${result.rows.length} expired transfers updated`,
      expiredTransfers: result.rows
    });

  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

export default router;