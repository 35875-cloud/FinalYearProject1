const db = require("../config/db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const nacl = require("tweetnacl"); 
const CryptoJS = require("crypto-js");

// /---------------------------------------------------
// REGISTER CITIZEN
// ---------------------------------------------------
exports.registerCitizen = async (req, res) => {
    try {
        const { name, cnic, email, mobile, password } = req.body;

        if (!name || !cnic || !email || !mobile || !password) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // 1. Check duplicates
        const dup = await db.query(
            "SELECT * FROM users WHERE cnic=$1 OR email=$2 OR mobile=$3",
            [cnic, email, mobile]
        );

        if (dup.rows.length > 0) {
            return res.json({ success: false, message: "User already exists" });
        }

        // 2. Generate unique UserID
        const userID = "U" + Math.floor(100000 + Math.random() * 900000);

        // 3. Generate Ed25519 keypair
        const keyPair = nacl.sign.keyPair();

        const publicKey = Buffer.from(keyPair.publicKey).toString("hex");
        const privateKey = Buffer.from(keyPair.secretKey).toString("hex");

        // 4. Encrypt private key
        const encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, password).toString();

        // 5. Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // 6. Insert user
        const id = uuidv4();
        await db.query(
            `INSERT INTO users(id, userid, name, cnic, email, mobile, password_hash, public_key, private_key_encrypted)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [id, userID, name, cnic, email, mobile, passwordHash, publicKey, encryptedPrivateKey]
        );

        // 7. Assign default role: CITIZEN (role_id = 1)
        await db.query(
            `INSERT INTO user_roles(user_id, role_id) VALUES($1, 1)`,
            [id]
        );

        return res.json({
            success: true,
            message: "Citizen registered successfully",
            userID,
            publicKey
        });

    } catch (err) {
        console.log("REGISTER ERROR:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ---------------------------------------------------
// LOGIN
// ---------------------------------------------------
exports.login = async (req, res) => {
    try {
        return res.json({
            success: true,
            message: "Login working."
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
};
