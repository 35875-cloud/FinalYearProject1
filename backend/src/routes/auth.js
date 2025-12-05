const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

// --------------------------------------------------
// 1️⃣ SEND OTP (User is NOT created yet)
// --------------------------------------------------
router.post("/register-citizen", async (req, res) => {
    try {
        let { name, cnic, email, mobile, password, role } = req.body;

        // Normalize inputs
        name = name.trim();
        email = email.trim().toLowerCase();
        mobile = mobile.trim();
        cnic = cnic.replace(/\D/g, ""); // remove dashes

        // Check existing user
        const existing = await pool.query(
            "SELECT * FROM users WHERE cnic=$1 OR email=$2 OR mobile=$3",
            [cnic, email, mobile]
        );

        if (existing.rows.length > 0) {
            return res.json({
                success: false,
                message: "CNIC, Email or Mobile already registered"
            });
        }

        // Create OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Insert OTP
        await pool.query(
            "INSERT INTO otp_verification (email, otp, expires_at) VALUES ($1,$2,$3)",
            [email, otp, expires]
        );

        // For now print OTP in terminal (add SMTP later)
        console.log("📧 OTP sent to:", email, "OTP:", otp);

        return res.json({
            success: true,
            message: "OTP sent to email"
        });

    } catch (err) {
        console.error("❌ register-citizen error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// --------------------------------------------------
// 2️⃣ VERIFY OTP → CREATE USER → RETURN USER ID
// --------------------------------------------------
router.post("/verify-otp", async (req, res) => {
    try {
        let { name, cnic, email, mobile, password, role, otp } = req.body;

        // Check OTP
        const checkOtp = await pool.query(
            "SELECT * FROM otp_verification WHERE email=$1 AND otp=$2",
            [email, otp]
        );

        if (checkOtp.rows.length === 0) {
            return res.json({ success: false, message: "Invalid OTP" });
        }

        if (new Date(checkOtp.rows[0].expires_at) < new Date()) {
            return res.json({ success: false, message: "OTP expired" });
        }

        // Hash password
        const hash = await bcrypt.hash(password, 10);

        // Create unique user_id
        let userID;
        while (true) {
            userID = "USR" + Math.floor(100000 + Math.random() * 900000);
            const exists = await pool.query("SELECT * FROM users WHERE user_id=$1", [userID]);
            if (exists.rows.length === 0) break;
        }

        // Create UUID
        const id = uuidv4();

        // Insert user
        await pool.query(`
            INSERT INTO users (id, user_id, role, name, cnic, email, mobile, password_hash)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [id, userID, role.toUpperCase(), name, cnic, email, mobile, hash]);

        // Delete OTP after use
        await pool.query("DELETE FROM otp_verification WHERE email=$1", [email]);

        return res.json({
            success: true,
            message: "User registered successfully",
            userID
        });

    } catch (err) {
        console.error("❌ verify-otp error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
const jwt = require('jsonwebtoken'); // if you want tokens

router.post('/login', async (req, res) => {
  try {
    const { userId, password } = req.body;

    const result = await pool.query(
      'SELECT id, user_id, role, password_hash, requires_password_reset FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'Invalid UserID or password' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.json({ success: false, message: 'Invalid UserID or password' });
    }

    return res.json({
      success: true,
      role: user.role,
      requiresPasswordReset: user.requires_password_reset
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


module.exports = router;