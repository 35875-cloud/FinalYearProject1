// =====================================================
// COMPLETE auth.js WITH ALL SECURITY FEATURES
// Location: backend/src/routes/auth.js
// =====================================================

const express = require("express");
const router = express.Router();
const pool = require("../config/db");
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

// Generate Public/Private Key Pair
function generateKeyPair() {
  const keyPair = ec.genKeyPair();
  const publicKey = keyPair.getPublic("hex");
  const privateKey = keyPair.getPrivate("hex");
  return { publicKey, privateKey };
}

// Encrypt Private Key with AES-256
function encryptPrivateKey(privateKey, password) {
  const encrypted = CryptoJS.AES.encrypt(
    privateKey,
    password + process.env.AES_SECRET_KEY
  ).toString();
  return encrypted;
}

// Decrypt Private Key
function decryptPrivateKey(encryptedKey, password) {
  try {
    const decrypted = CryptoJS.AES.decrypt(
      encryptedKey,
      password + process.env.AES_SECRET_KEY
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    return null;
  }
}

// Generate JWT Token
function generateJWT(userId, role, userEmail) {
  const payload = {
    userId,
    role,
    email: userEmail,
    timestamp: Date.now(),
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  });

  return token;
}

// Generate Blockchain Address (simplified)
function generateBlockchainAddress(publicKey) {
  return "0x" + crypto.createHash("sha256").update(publicKey).digest("hex").substring(0, 40);
}

// Send Email (Placeholder - implement with nodemailer)
async function sendEmail(to, subject, body) {
  console.log(`📧 Sending email to ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);
  // TODO: Implement actual email sending with nodemailer
  return true;
}

// Check if account is locked
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

  // Unlock if lock period has passed
  if (user.account_locked && user.lock_until && new Date(user.lock_until) <= new Date()) {
    await pool.query(
      "UPDATE users SET account_locked = FALSE, lock_until = NULL, failed_login_attempts = 0 WHERE email = $1",
      [email]
    );
    return false;
  }

  return false;
}

// Record login attempt
async function recordLoginAttempt(email, ipAddress, success, failureReason = null) {
  await pool.query(
    "INSERT INTO login_attempts (email, ip_address, success, failure_reason) VALUES ($1, $2, $3, $4)",
    [email, ipAddress, success, failureReason]
  );
}

// Handle failed login
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

    // Log suspicious activity
    const userResult = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
    if (userResult.rows.length > 0) {
      await pool.query(
        "INSERT INTO suspicious_activity (user_id, activity_type, ip_address, details) VALUES ($1, $2, $3, $4)",
        [
          userResult.rows[0].user_id,
          "multiple_failed_login",
          ipAddress,
          `Account locked after ${attempts} failed attempts`,
        ]
      );

      // Notify admin
      await sendEmail(
        process.env.ADMIN_EMAIL,
        "Suspicious Login Activity Detected",
        `User ${email} has been locked after ${attempts} failed login attempts from IP: ${ipAddress}`
      );
    }
  } else {
    await pool.query(
      "UPDATE users SET failed_login_attempts = $1 WHERE email = $2",
      [attempts, email]
    );
  }
}

// =====================================================
// 1️⃣ REGISTER USER (SEND OTP)
// =====================================================
router.post("/register-citizen", async (req, res) => {
  try {
    let { name, cnic, email, mobile, password, role } = req.body;

    // Normalize inputs
    name = name.trim();
    email = email.trim().toLowerCase();
    mobile = mobile.trim();
    cnic = cnic.replace(/\D/g, "");

    // Validate required fields
    if (!name || !cnic || !email || !mobile || !password || !role) {
      return res.json({ success: false, message: "All fields are required" });
    }

    // Check existing user
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

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete existing OTPs
    await pool.query("DELETE FROM otp_verification WHERE email=$1", [email]);

    // Insert OTP
    await pool.query(
      "INSERT INTO otp_verification (email, otp, expires_at, otp_type) VALUES ($1, $2, $3, $4)",
      [email, otp, expires, "registration"]
    );

    // Send OTP via email
    await sendEmail(
      email,
      "Your Registration OTP",
      `Your OTP for registration is: ${otp}. Valid for 5 minutes.`
    );

    console.log("📧 OTP sent to:", email, "OTP:", otp);

    return res.json({
      success: true,
      message: "OTP sent to email",
    });
  } catch (err) {
    console.error("❌ register-citizen error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

// =====================================================
// 2️⃣ VERIFY OTP & CREATE USER
// =====================================================
router.post("/verify-otp", async (req, res) => {
  try {
    let { name, cnic, email, mobile, password, role, otp } = req.body;

    // Normalize
    email = email.trim().toLowerCase();
    otp = otp.trim();

    // Check OTP
    const checkOtp = await pool.query(
      "SELECT * FROM otp_verification WHERE email = $1 AND otp = $2 AND otp_type = 'registration'",
      [email, otp]
    );

    if (checkOtp.rows.length === 0) {
      return res.json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Check expiration
    if (new Date(checkOtp.rows[0].expires_at) < new Date()) {
      await pool.query("DELETE FROM otp_verification WHERE email=$1", [email]);
      return res.json({
        success: false,
        message: "OTP has expired",
      });
    }

    // Generate Key Pair
    const { publicKey, privateKey } = generateKeyPair();

    // Encrypt Private Key
    const encryptedPrivateKey = encryptPrivateKey(privateKey, password);

    // Generate Blockchain Address
    const blockchainAddress = generateBlockchainAddress(publicKey);

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Generate User ID
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

    // Insert user
    await pool.query(
      `INSERT INTO users (id, user_id, role, name, cnic, email, mobile, password_hash, 
       public_key, encrypted_private_key, blockchain_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, userID, role.toUpperCase(), name, cnic, email, mobile, hash, publicKey, encryptedPrivateKey, blockchainAddress]
    );

    // Store blockchain identity
    await pool.query(
      `INSERT INTO blockchain_identities (user_id, public_key, blockchain_address) 
       VALUES ($1, $2, $3)`,
      [userID, publicKey, blockchainAddress]
    );

    // Delete OTP
    await pool.query("DELETE FROM otp_verification WHERE email=$1", [email]);

    // Send welcome email
    await sendEmail(
      email,
      "Welcome to Blockchain Land Records",
      `Welcome ${name}! Your User ID is: ${userID}. Your blockchain address: ${blockchainAddress}`
    );

    return res.json({
      success: true,
      message: "User registered successfully",
      userID,
      blockchainAddress,
    });
  } catch (err) {
    console.error("❌ verify-otp error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

// =====================================================
// 3️⃣ LOGIN WITH SECURITY
// =====================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Check if account is locked
    const locked = await isAccountLocked(email);
    if (locked) {
      await recordLoginAttempt(email, ipAddress, false, "Account locked");
      return res.json({
        success: false,
        message: "Account is locked due to multiple failed attempts. Please try again later.",
      });
    }

    // Get user
    const result = await pool.query(
      "SELECT user_id, role, password_hash, is_active FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      await recordLoginAttempt(email, ipAddress, false, "User not found");
      return res.json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    // Check if account is active
    if (!user.is_active) {
      await recordLoginAttempt(email, ipAddress, false, "Account inactive");
      return res.json({
        success: false,
        message: "Account is inactive. Contact administrator.",
      });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      await handleFailedLogin(email, ipAddress);
      await recordLoginAttempt(email, ipAddress, false, "Invalid password");
      return res.json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Reset failed attempts on successful login
    await pool.query(
      "UPDATE users SET failed_login_attempts = 0, last_login = NOW() WHERE email = $1",
      [email]
    );

    // Generate JWT
    const token = generateJWT(user.user_id, user.role, email);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store session
    await pool.query(
      `INSERT INTO jwt_sessions (user_id, token, expires_at, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4, $5)`,
      [user.user_id, token, expiresAt, ipAddress, req.get("user-agent")]
    );

    // Record successful login
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
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

// =====================================================
// 4️⃣ REQUEST PASSWORD RESET
// =====================================================
router.post("/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    // Check if user exists
    const user = await pool.query("SELECT user_id, name FROM users WHERE email = $1", [email.toLowerCase()]);

    if (user.rows.length === 0) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: "If the email exists, a reset code has been sent",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete old reset tokens
    await pool.query("DELETE FROM password_reset_tokens WHERE email = $1", [email]);

    // Insert new token
    await pool.query(
      "INSERT INTO password_reset_tokens (email, otp, expires_at) VALUES ($1, $2, $3)",
      [email, otp, expires]
    );

    // Send email
    await sendEmail(
      email,
      "Password Reset Code",
      `Hi ${user.rows[0].name}, your password reset code is: ${otp}. Valid for 15 minutes.`
    );

    console.log("📧 Password reset OTP sent to:", email, "OTP:", otp);

    return res.json({
      success: true,
      message: "If the email exists, a reset code has been sent",
    });
  } catch (err) {
    console.error("❌ Password reset request error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

// =====================================================
// 5️⃣ RESET PASSWORD
// =====================================================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.json({
        success: false,
        message: "Email, OTP, and new password are required",
      });
    }

    // Verify OTP
    const token = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE email = $1 AND otp = $2 AND used = FALSE",
      [email.toLowerCase(), otp]
    );

    if (token.rows.length === 0) {
      return res.json({
        success: false,
        message: "Invalid or expired reset code",
      });
    }

    // Check expiration
    if (new Date(token.rows[0].expires_at) < new Date()) {
      return res.json({
        success: false,
        message: "Reset code has expired",
      });
    }

    // Hash new password
    const hash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2",
      [hash, email]
    );

    // Mark token as used
    await pool.query(
      "UPDATE password_reset_tokens SET used = TRUE WHERE email = $1 AND otp = $2",
      [email, otp]
    );

    // Revoke all active sessions
    await pool.query(
      "UPDATE jwt_sessions SET revoked = TRUE, revoked_at = NOW() WHERE user_id = (SELECT user_id FROM users WHERE email = $1)",
      [email]
    );

    // Send notification
    const user = await pool.query("SELECT name FROM users WHERE email = $1", [email]);
    await sendEmail(
      email,
      "Password Changed Successfully",
      `Hi ${user.rows[0].name}, your password has been changed successfully. If you did not make this change, contact support immediately.`
    );

    return res.json({
      success: true,
      message: "Password reset successful. Please login with your new password.",
    });
  } catch (err) {
    console.error("❌ Password reset error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

// =====================================================
// 6️⃣ LOGOUT
// =====================================================
router.post("/logout", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.json({ success: false, message: "Token is required" });
    }

    // Revoke token
    await pool.query(
      "UPDATE jwt_sessions SET revoked = TRUE, revoked_at = NOW() WHERE token = $1",
      [token]
    );

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("❌ Logout error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

// =====================================================
// 7️⃣ CHANGE USER ROLE (LRO ONLY)
// =====================================================
router.post("/change-role", async (req, res) => {
  try {
    const { adminUserId, targetUserId, newRole, reason } = req.body;

    // Verify admin is LRO
    const admin = await pool.query(
      "SELECT role FROM users WHERE user_id = $1",
      [adminUserId]
    );

    if (admin.rows.length === 0 || admin.rows[0].role !== "LRO") {
      return res.json({
        success: false,
        message: "Only Land Record Officers can change roles",
      });
    }

    // Get current user info
    const user = await pool.query(
      "SELECT role, email, name FROM users WHERE user_id = $1",
      [targetUserId]
    );

    if (user.rows.length === 0) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const oldRole = user.rows[0].role;

    // Update role
    await pool.query(
      "UPDATE users SET role = $1, updated_at = NOW() WHERE user_id = $2",
      [newRole.toUpperCase(), targetUserId]
    );

    // Log role change
    await pool.query(
      `INSERT INTO role_change_log (user_id, old_role, new_role, changed_by, reason) 
       VALUES ($1, $2, $3, $4, $5)`,
      [targetUserId, oldRole, newRole.toUpperCase(), adminUserId, reason]
    );

    // Create notification for user
    await pool.query(
      `INSERT INTO user_notifications (user_id, notification_type, message) 
       VALUES ($1, $2, $3)`,
      [
        targetUserId,
        "role_change",
        `Your role has been changed from ${oldRole} to ${newRole.toUpperCase()} by administrator.`,
      ]
    );

    // Send email notification
    await sendEmail(
      user.rows[0].email,
      "Your Role Has Been Updated",
      `Hi ${user.rows[0].name}, your role has been updated from ${oldRole} to ${newRole.toUpperCase()}. Reason: ${reason || "Administrative decision"}`
    );

    return res.json({
      success: true,
      message: "Role updated successfully",
    });
  } catch (err) {
    console.error("❌ Role change error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

module.exports = router;