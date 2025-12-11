// auth.js (Fixed with explicit type casting and table check)

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

        console.log("🔍 Attempting to insert OTP for email:", email);

        // Delete any existing OTP for this email first
        await pool.query("DELETE FROM otp_verification WHERE email=$1", [email]);

        // Insert OTP with explicit type casting
        await pool.query(
            "INSERT INTO otp_verification (email, otp, expires_at) VALUES ($1::text, $2::text, $3::timestamp)",
            [email, otp, expires]
        );

        console.log("✅ OTP inserted successfully");
        console.log("📧 OTP sent to:", email, "OTP:", otp);

        return res.json({
            success: true,
            message: "OTP sent to email"
        });

    } catch (err) {
        console.error("❌ register-citizen error:", err);
        return res.status(500).json({ success: false, message: "Server error: " + err.message });
    }
});

// --------------------------------------------------
// 2️⃣ VERIFY OTP → CREATE USER → RETURN USER ID
// --------------------------------------------------
router.post("/verify-otp", async (req, res) => {
    try {
        let { name, cnic, email, mobile, password, role, otp } = req.body;

        // Normalize inputs
        email = email.trim().toLowerCase();
        otp = otp.trim();

        console.log("🔍 Verifying OTP - Email:", email, "OTP:", otp);

        // Check if table exists and see what's in it
        try {
            const tableCheck = await pool.query(
                "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'otp_verification'"
            );
            console.log("📋 OTP table structure:", tableCheck.rows);
        } catch (e) {
            console.log("⚠️ Could not check table structure:", e.message);
        }

        // Try to get all OTPs for debugging
        try {
            const allOtps = await pool.query("SELECT * FROM otp_verification WHERE email = $1::text", [email]);
            console.log("📋 All OTP records for email:", allOtps.rows);
        } catch (e) {
            console.log("⚠️ Could not fetch OTP records:", e.message);
        }

        // Check OTP with explicit type casting
        const checkOtp = await pool.query(
            "SELECT * FROM otp_verification WHERE email = $1::text AND otp = $2::text",
            [email, otp]
        );

        console.log("✅ Matching OTP found:", checkOtp.rows.length);

        if (checkOtp.rows.length === 0) {
            return res.json({ 
                success: false, 
                message: "Invalid OTP. Please check the code and try again." 
            });
        }

        // Check expiration
        if (new Date(checkOtp.rows[0].expires_at) < new Date()) {
            await pool.query("DELETE FROM otp_verification WHERE email=$1", [email]);
            return res.json({ 
                success: false, 
                message: "OTP has expired. Please request a new one." 
            });
        }

        // Hash password
        const hash = await bcrypt.hash(password, 10);

        // Create unique user_id
        let userID;
        let attempts = 0;
        while (attempts < 10) {
            userID = "USR" + Math.floor(100000 + Math.random() * 900000);
            const exists = await pool.query("SELECT * FROM users WHERE user_id=$1", [userID]);
            if (exists.rows.length === 0) break;
            attempts++;
        }

        // Create UUID
        const id = uuidv4();

        // Normalize inputs
        cnic = cnic.replace(/\D/g, "");
        name = name.trim();
        mobile = mobile.trim();

        console.log("🔍 Creating user with:", { id, userID, role, name, cnic, email, mobile });

        // Insert user
        await pool.query(`
            INSERT INTO users (id, user_id, role, name, cnic, email, mobile, password_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [id, userID, role.toUpperCase(), name, cnic, email, mobile, hash]);

        console.log("✅ User created successfully");

        // Delete OTP after successful registration
        await pool.query("DELETE FROM otp_verification WHERE email=$1", [email]);

        return res.json({
            success: true,
            message: "User registered successfully",
            userID
        });

    } catch (err) {
        console.error("❌ verify-otp error:", err);
        return res.status(500).json({ 
            success: false, 
            message: "Server error: " + err.message 
        });
    }
});

// --------------------------------------------------
// LOGIN ROUTE: Authenticate via Email and Password
// --------------------------------------------------
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body; 

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required.' 
            });
        }
        
        // Query the database using the 'email' column
        const result = await pool.query(
            'SELECT role, password_hash FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        const user = result.rows[0];

        // Compare the provided password with the stored hash
        const match = await bcrypt.compare(password, user.password_hash);
        
        if (!match) {
            return res.json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        // Success: User is authenticated
        return res.json({
            success: true,
            role: user.role,
            message: 'Login successful'
        });
        
    } catch (err) {
        console.error('❌ Login error:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + err.message 
        });
    }
})

module.exports = router;