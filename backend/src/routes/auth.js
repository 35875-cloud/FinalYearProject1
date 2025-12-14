// =====================================================
// WORKING auth.js with Password Reset
// Location: backend/src/routes/auth.js
// =====================================================

const express = require("express");
const router = express.Router();
const pool = require("../config/db"); // CORRECT PATH: src/routes -> src -> backend -> config
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const CryptoJS = require("crypto-js");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function generateKeyPair() {
  const keyPair = ec.genKeyPair();
  return {
    publicKey: keyPair.getPublic("hex"),
    privateKey: keyPair.getPrivate("hex")
  };
}

function encryptPrivateKey(privateKey, password) {
  const secretKey = process.env.AES_SECRET_KEY || "default-secret-key-32chars-long";
  return CryptoJS.AES.encrypt(privateKey, password + secretKey).toString();
}

function generateBlockchainAddress(publicKey) {
  return "0x" + crypto.createHash("sha256").update(publicKey).digest("hex").substring(0, 40);
}

function generateJWT(userId, role, userEmail) {
  const payload = { userId, role, email: userEmail, timestamp: Date.now() };
  return jwt.sign(payload, process.env.JWT_SECRET || "default-jwt-secret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  });
}

async function sendEmail(to, subject, body) {
  console.log("\n📧 ============ EMAIL ============");
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`${body}`);
  console.log("=================================\n");
  return true;
}

async function isAccountLocked(email) {
  const result = await pool.query(
    "SELECT account_locked, lock_until FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) return false;

  const user = result.rows[0];
  if (user.account_locked && user.lock_until && new Date(user.lock_until) > new Date()) {
    return true;
  }

  if (user.account_locked && user.lock_until && new Date(user.lock_until) <= new Date()) {
    await pool.query(
      "UPDATE users SET account_locked = FALSE, lock_until = NULL, failed_login_attempts = 0 WHERE email = $1",
      [email]
    );
    return false;
  }

  return false;
}

async function recordLoginAttempt(email, ipAddress, success, failureReason = null) {
  try {
    await pool.query(
      "INSERT INTO login_attempts (email, ip_address, success, failure_reason) VALUES ($1, $2, $3, $4)",
      [email, ipAddress, success, failureReason]
    );
  } catch (err) {
    console.error("Error recording login attempt:", err.message);
  }
}

async function handleFailedLogin(email, ipAddress) {
  const result = await pool.query(
    "SELECT failed_login_attempts FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) return;

  const attempts = result.rows[0].failed_login_attempts + 1;
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || 5);

  if (attempts >= maxAttempts) {
    const lockDuration = parseInt(process.env.ACCOUNT_LOCK_DURATION_MINUTES || 25);
    const lockUntil = new Date(Date.now() + lockDuration * 60 * 1000);

    await pool.query(
      "UPDATE users SET failed_login_attempts = $1, account_locked = TRUE, lock_until = $2 WHERE email = $3",
      [attempts, lockUntil, email]
    );

    await sendEmail(
      process.env.ADMIN_EMAIL || "admin@landrecords.gov.pk",
      "⚠️ Account Locked - Multiple Failed Attempts",
      `User ${email} locked after ${attempts} failed attempts from IP: ${ipAddress}`
    );
  } else {
    await pool.query(
      "UPDATE users SET failed_login_attempts = $1 WHERE email = $2",
      [attempts, email]
    );
  }
}

// =====================================================
// 1️⃣ REGISTER - SEND OTP
// =====================================================
router.post("/register-citizen", async (req, res) => {
  try {
    let { name, cnic, email, mobile, password, role } = req.body;

    name = name.trim();
    email = email.trim().toLowerCase();
    mobile = mobile.trim();
    cnic = cnic.replace(/\D/g, "");

    if (!name || !cnic || !email || !mobile || !password || !role) {
      return res.json({ success: false, message: "All fields are required" });
    }

    const existing = await pool.query(
      "SELECT * FROM users WHERE cnic=$1 OR email=$2 OR mobile=$3",
      [cnic, email, mobile]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: false,
        message: "CNIC, Email or Mobile already registered",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query("DELETE FROM otp_verification WHERE email=$1", [email]);

    await pool.query(
      "INSERT INTO otp_verification (email, otp, expires_at, otp_type) VALUES ($1, $2, $3, $4)",
      [email, otp, expires, "registration"]
    );

    await sendEmail(email, "Registration OTP", `Your OTP: ${otp}\nValid for 5 minutes.`);

    console.log("📧 Registration OTP:", otp);

    return res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error("❌ register-citizen error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// =====================================================
// 2️⃣ VERIFY OTP & CREATE USER
// =====================================================
router.post("/verify-otp", async (req, res) => {
  try {
    let { name, cnic, email, mobile, password, role, otp } = req.body;

    email = email.trim().toLowerCase();
    otp = otp.trim();

    const checkOtp = await pool.query(
      "SELECT * FROM otp_verification WHERE email = $1 AND otp = $2 AND otp_type = 'registration'",
      [email, otp]
    );

    if (checkOtp.rows.length === 0) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    if (new Date(checkOtp.rows[0].expires_at) < new Date()) {
      await pool.query("DELETE FROM otp_verification WHERE email=$1", [email]);
      return res.json({ success: false, message: "OTP has expired" });
    }

    const { publicKey, privateKey } = generateKeyPair();
    const encryptedPrivateKey = encryptPrivateKey(privateKey, password);
    const blockchainAddress = generateBlockchainAddress(publicKey);
    const hash = await bcrypt.hash(password, 10);

    let userID;
    let attempts = 0;
    while (attempts < 10) {
      userID = "USR" + Math.floor(100000 + Math.random() * 900000);
      const exists = await pool.query("SELECT * FROM users WHERE user_id=$1", [userID]);
      if (exists.rows.length === 0) break;
      attempts++;
    }

    const id = uuidv4();
    cnic = cnic.replace(/\D/g, "");
    name = name.trim();
    mobile = mobile.trim();

    await pool.query(
      `INSERT INTO users (id, user_id, role, name, cnic, email, mobile, password_hash, 
       public_key, encrypted_private_key, blockchain_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, userID, role.toUpperCase(), name, cnic, email, mobile, hash, publicKey, encryptedPrivateKey, blockchainAddress]
    );

    await pool.query(
      `INSERT INTO blockchain_identities (user_id, public_key, blockchain_address) 
       VALUES ($1, $2, $3)`,
      [userID, publicKey, blockchainAddress]
    );

    await pool.query("DELETE FROM otp_verification WHERE email=$1", [email]);

    await sendEmail(email, "Welcome!", `Welcome ${name}!\nUser ID: ${userID}\nBlockchain: ${blockchainAddress}`);

    return res.json({
      success: true,
      message: "User registered successfully",
      userID,
      blockchainAddress,
    });
  } catch (err) {
    console.error("❌ verify-otp error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// =====================================================
// 3️⃣ LOGIN
// =====================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const locked = await isAccountLocked(email);
    if (locked) {
      await recordLoginAttempt(email, ipAddress, false, "Account locked");
      return res.json({
        success: false,
        message: "Account locked. Try again in 25 minutes.",
      });
    }

    const result = await pool.query(
      "SELECT user_id, role, password_hash, is_active FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      await recordLoginAttempt(email, ipAddress, false, "User not found");
      return res.json({ success: false, message: "Invalid email or password" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      await recordLoginAttempt(email, ipAddress, false, "Account inactive");
      return res.json({ success: false, message: "Account inactive. Contact admin." });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      await handleFailedLogin(email, ipAddress);
      await recordLoginAttempt(email, ipAddress, false, "Invalid password");
      return res.json({ success: false, message: "Invalid email or password" });
    }

    await pool.query(
      "UPDATE users SET failed_login_attempts = 0, last_login = NOW() WHERE email = $1",
      [email]
    );

    const token = generateJWT(user.user_id, user.role, email);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO jwt_sessions (user_id, token, expires_at, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4, $5)`,
      [user.user_id, token, expiresAt, ipAddress, req.get("user-agent") || "unknown"]
    );

    await recordLoginAttempt(email, ipAddress, true);

    return res.json({
      success: true,
      role: user.role,
      userId: user.user_id,
      token,
      message: "Login successful",
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// =====================================================
// 4️⃣ REQUEST PASSWORD RESET (SEND OTP)
// =====================================================
router.post("/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    const user = await pool.query(
      "SELECT user_id, name FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (user.rows.length === 0) {
      return res.json({
        success: true,
        message: "If email exists, reset code sent",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query("DELETE FROM password_reset_tokens WHERE email = $1", [email]);

    await pool.query(
      "INSERT INTO password_reset_tokens (email, otp, expires_at) VALUES ($1, $2, $3)",
      [email, otp, expires]
    );

    await sendEmail(
      email,
      "Password Reset Code",
      `Hi ${user.rows[0].name},\n\nYour reset code: ${otp}\nValid for 15 minutes.`
    );

    console.log("📧 Password Reset OTP:", otp);

    return res.json({
      success: true,
      message: "If email exists, reset code sent",
    });
  } catch (err) {
    console.error("❌ reset request error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// =====================================================
// 5️⃣ VERIFY RESET OTP (NEW - Frontend needs this!)
// =====================================================
router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.json({ success: false, message: "Email and OTP required" });
    }

    const token = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE email = $1 AND otp = $2 AND used = FALSE",
      [email.toLowerCase(), otp.trim()]
    );

    if (token.rows.length === 0) {
      return res.json({ success: false, message: "Invalid or expired code" });
    }

    if (new Date(token.rows[0].expires_at) < new Date()) {
      await pool.query("DELETE FROM password_reset_tokens WHERE email = $1", [email]);
      return res.json({ success: false, message: "Code has expired" });
    }

    return res.json({
      success: true,
      message: "OTP verified. You can now reset password.",
    });
  } catch (err) {
    console.error("❌ verify reset otp error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// =====================================================
// 6️⃣ RESET PASSWORD (FINAL STEP)
// =====================================================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.json({
        success: false,
        message: "Email, OTP, and new password required",
      });
    }

    const token = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE email = $1 AND otp = $2 AND used = FALSE",
      [email.toLowerCase(), otp.trim()]
    );

    if (token.rows.length === 0) {
      return res.json({ success: false, message: "Invalid or expired code" });
    }

    if (new Date(token.rows[0].expires_at) < new Date()) {
      await pool.query("DELETE FROM password_reset_tokens WHERE email = $1", [email]);
      return res.json({ success: false, message: "Code has expired" });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2",
      [hash, email]
    );

    await pool.query(
      "UPDATE password_reset_tokens SET used = TRUE WHERE email = $1 AND otp = $2",
      [email, otp]
    );

    await pool.query(
      "UPDATE jwt_sessions SET revoked = TRUE, revoked_at = NOW() WHERE user_id = (SELECT user_id FROM users WHERE email = $1)",
      [email]
    );

    const user = await pool.query("SELECT name FROM users WHERE email = $1", [email]);
    await sendEmail(
      email,
      "Password Changed",
      `Hi ${user.rows[0].name},\n\nPassword changed successfully.\nIf not you, contact support immediately.`
    );

    return res.json({
      success: true,
      message: "Password reset successful. Please login.",
    });
  } catch (err) {
    console.error("❌ reset password error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// =====================================================
// 7️⃣ GET USER PROFILE
// =====================================================
router.get("/user-profile", async (req, res) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-jwt-secret");

    // Get user details from database
    const result = await pool.query(
      `SELECT user_id, name, email, cnic, mobile, role, blockchain_address, 
       created_at, last_login FROM users WHERE user_id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];

    return res.json({
      success: true,
      userId: user.user_id,
      name: user.name,
      email: user.email,
      cnic: user.cnic,
      mobile: user.mobile,
      role: user.role,
      blockchain_address: user.blockchain_address,
      created_at: user.created_at,
      last_login: user.last_login
    });
  } catch (err) {
    console.error("❌ Get profile error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// =====================================================
// 8️⃣ LOGOUT
// =====================================================
router.post("/logout", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.json({ success: false, message: "Token required" });
    }

    await pool.query(
      "UPDATE jwt_sessions SET revoked = TRUE, revoked_at = NOW() WHERE token = $1",
      [token]
    );

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("❌ Logout error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

module.exports = router;