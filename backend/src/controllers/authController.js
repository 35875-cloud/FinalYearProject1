// src/controllers/authController.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const nacl = require('tweetnacl');
const CryptoJS = require('crypto-js');
const nodemailer = require('nodemailer');
require('dotenv').config();

// create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Helper: send OTP email
async function sendOtpEmail(toEmail, otp) {
  const html = `
    <p>Use this OTP to complete your registration: <strong>${otp}</strong></p>
    <p>Valid for 2 minutes.</p>
  `;

  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: toEmail,
    subject: 'Your Registration OTP',
    html
  });
}

// STEP 1: register-citizen -> generate OTP & save in pending_otps
exports.registerCitizen = async (req, res) => {
  try {
    const { name, cnic, email, mobile, password } = req.body;
    if (!name || !cnic || !email || !mobile || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const cleanCnic = cnic.replace(/-/g, '').trim();
    if (cleanCnic.length !== 13) {
      return res.status(400).json({ success: false, message: 'Invalid CNIC' });
    }

    // Check duplicates in users table
    const dup = await pool.query(
      'SELECT id FROM users WHERE cnic=$1 OR email=$2 OR mobile=$3',
      [cleanCnic, email, mobile]
    );
    if (dup.rows.length > 0) {
      return res.json({ success: false, message: 'User already exists' });
    }

    // generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    // upsert into pending_otps (insert or update)
    await pool.query(
      `INSERT INTO pending_otps(email, otp, expires_at) 
       VALUES($1,$2,$3)
       ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3, created_at = NOW()`,
      [email, otp, expiresAt]
    );

    // send email
    await sendOtpEmail(email, otp);

    // return success (do not create user yet)
    return res.json({ success: true, message: 'OTP sent to email' });

  } catch (err) {
    console.error('registerCitizen error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// STEP 2: verify-otp -> create user if OTP matches
exports.verifyOtpAndCreate = async (req, res) => {
  try {
    const { name, cnic, email, mobile, password, otp } = req.body;
    if (!name || !cnic || !email || !mobile || !password || !otp) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // fetch pending OTP
    const row = await pool.query('SELECT otp, expires_at FROM pending_otps WHERE email=$1', [email]);
    if (row.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No OTP request found for this email' });
    }

    const record = row.rows[0];
    const now = new Date();
    const expiresAt = new Date(record.expires_at);

    if (now > expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    if (record.otp !== otp.toString()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // double-check duplicates again
    const cleanCnic = cnic.replace(/-/g, '').trim();
    const dup = await pool.query('SELECT id FROM users WHERE cnic=$1 OR email=$2 OR mobile=$3', [cleanCnic, email, mobile]);
    if (dup.rows.length > 0) {
      // remove pending otp for cleanliness
      await pool.query('DELETE FROM pending_otps WHERE email=$1', [email]);
      return res.json({ success: false, message: 'User already exists' });
    }

    // create user now
    const id = uuidv4();
    const userid = 'U' + Math.floor(100000 + Math.random() * 900000);

    // keypair
    const keyPair = nacl.sign.keyPair();
    const publicKey = Buffer.from(keyPair.publicKey).toString('hex');
    const privateKey = Buffer.from(keyPair.secretKey).toString('hex');

    const encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, password).toString();
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (id, userid, name, cnic, email, mobile, password_hash, public_key, private_key_encrypted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, userid, name, cleanCnic, email, mobile, passwordHash, publicKey, encryptedPrivateKey]
    );

    // assign role CITIZEN (assumes role id 1 exists)
    await pool.query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, 1)`, [id]);

    // delete the pending otp
    await pool.query('DELETE FROM pending_otps WHERE email=$1', [email]);

    return res.json({
      success: true,
      message: 'Registration complete',
      userID: userid,
      publicKey
    });

  } catch (err) {
    console.error('verifyOtpAndCreate error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
