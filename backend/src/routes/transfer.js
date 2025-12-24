// =====================================================
// TRANSFER ROUTES - Property Transfer Management
// Location: backend/src/routes/transfer.js
// =====================================================

import express from "express";
const router = express.Router();
import pool from "../config/db.js";
import jwt from "jsonwebtoken";

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
// 1️⃣ INITIATE TRANSFER (Seller/Citizen)
// =====================================================
router.post("/initiate", authenticateToken, async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("🔄 INITIATE TRANSFER REQUEST");
    console.log("========================================");

    const {
      propertyId,
      buyerCnic,
      buyerName,
      buyerFatherName,
      transferAmount,
      durationDays,
      password
    } = req.body;

    // Validation
    if (!propertyId || !buyerCnic || !buyerName || !transferAmount || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields required: propertyId, buyerCnic, buyerName, transferAmount, password"
      });
    }

    // Check if seller owns the property
    const propertyCheck = await pool.query(
      "SELECT * FROM properties WHERE property_id = $1 AND owner_id = $2",
      [propertyId, req.user.userId]
    );

    if (propertyCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Property not found or you don't own it"
      });
    }

    const property = propertyCheck.rows[0];

    if (property.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: "Property must be approved before transfer"
      });
    }

    if (property.is_frozen) {
      return res.status(400).json({
        success: false,
        message: "Property is frozen and cannot be transferred"
      });
    }

    // Get seller details
    const sellerDetails = await pool.query(
      "SELECT name, cnic FROM users WHERE user_id = $1",
      [req.user.userId]
    );

    // Check if buyer exists
    const buyerCheck = await pool.query(
      "SELECT user_id, cnic FROM users WHERE cnic = $1",
      [buyerCnic.replace(/\D/g, "")]
    );

    const buyerId = buyerCheck.rows.length > 0 ? buyerCheck.rows[0].user_id : null;

    // Generate transfer ID
    const transferId = "TRF-" + Date.now() + "-" + Math.floor(Math.random() * 10000);

    // Calculate taxes (5% each)
    const amount = parseFloat(transferAmount);
    const buyerTax = amount * 0.05;
    const sellerTax = amount * 0.05;
    const totalAmount = amount + buyerTax + sellerTax;

    // Calculate expiry date
    const days = parseInt(durationDays) || 30;
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    console.log("Transfer Details:");
    console.log("- Transfer ID:", transferId);
    console.log("- Amount:", amount);
    console.log("- Buyer Tax:", buyerTax);
    console.log("- Seller Tax:", sellerTax);
    console.log("- Total:", totalAmount);

    // Save to database
    await pool.query(
      `INSERT INTO transfer_requests 
       (transfer_id, property_id, seller_id, buyer_id, buyer_name, buyer_cnic, 
        buyer_father_name, transfer_amount, property_tax_buyer, property_tax_seller, 
        total_amount, duration_days, expires_at, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PAYMENT_PENDING')`,
      [
        transferId, propertyId, req.user.userId, buyerId, buyerName, 
        buyerCnic.replace(/\D/g, ""), buyerFatherName || "", amount, 
        buyerTax, sellerTax, totalAmount, days, expiryDate
      ]
    );

    // Call blockchain service
    try {
      const blockchainService = (await import("../services/blockchain.service.js")).default;

      const blockchainData = {
        transferId,
        propertyId,
        sellerId: req.user.userId,
        sellerCnic: sellerDetails.rows[0].cnic,
        buyerId: buyerId || "PENDING",
        buyerCnic: buyerCnic.replace(/\D/g, ""),
        buyerName,
        buyerFatherName: buyerFatherName || "",
        transferAmount: Math.floor(amount),
        durationDays: days
      };

      const blockchainResult = await blockchainService.initiateTransfer(
        blockchainData,
        req.user.userId,
        password
      );

      console.log("✅ Transfer initiated on blockchain!");
      console.log("   Transaction:", blockchainResult.transactionHash);

      // Update database with transaction hash
      await pool.query(
        `UPDATE transfer_requests 
         SET blockchain_transaction_id = (
           SELECT id FROM blockchain_ledger 
           WHERE blockchain_hash = $1 LIMIT 1
         )
         WHERE transfer_id = $2`,
        [blockchainResult.transactionHash, transferId]
      );

    } catch (blockchainError) {
      console.error("❌ Blockchain error:", blockchainError.message);
      console.warn("⚠️  Transfer saved to database only");
    }

    console.log("========================================");
    console.log("✅ TRANSFER INITIATED SUCCESSFULLY");
    console.log("========================================\n");

    return res.json({
      success: true,
      message: "Transfer initiated successfully",
      transferId,
      amount,
      buyerTax,
      sellerTax,
      totalAmount,
      expiresAt: expiryDate,
      status: 'PAYMENT_PENDING'
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
// 2️⃣ GET PENDING TRANSFERS (for buyer)
// =====================================================
router.get("/pending", authenticateToken, async (req, res) => {
  try {
    // Get user's CNIC
    const userResult = await pool.query(
      "SELECT cnic FROM users WHERE user_id = $1",
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userCnic = userResult.rows[0].cnic;

    // Get pending transfers for this buyer
    const transfers = await pool.query(
      `SELECT t.*, p.fard_no, p.khasra_no, p.district, p.tehsil,
              u.name as seller_name
       FROM transfer_requests t
       JOIN properties p ON t.property_id = p.property_id
       JOIN users u ON t.seller_id = u.user_id
       WHERE t.buyer_cnic = $1 
       AND t.status IN ('PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED')
       ORDER BY t.created_at DESC`,
      [userCnic]
    );

    return res.json({
      success: true,
      transfers: transfers.rows,
      total: transfers.rows.length
    });

  } catch (err) {
    console.error("❌ Get pending transfers error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

// =====================================================
// 3️⃣ GET MY TRANSFERS (seller view)
// =====================================================
router.get("/my-transfers", authenticateToken, async (req, res) => {
  try {
    const transfers = await pool.query(
      `SELECT t.*, p.fard_no, p.khasra_no, p.district, p.tehsil
       FROM transfer_requests t
       JOIN properties p ON t.property_id = p.property_id
       WHERE t.seller_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.userId]
    );

    return res.json({
      success: true,
      transfers: transfers.rows,
      total: transfers.rows.length
    });

  } catch (err) {
    console.error("❌ Get my transfers error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message
    });
  }
});

export default router;