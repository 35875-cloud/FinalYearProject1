const db = require("../config/db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const nacl = require("tweetnacl"); // Ed25519
const CryptoJS = require("crypto-js");

exports.registerUser = async (req, res) => {
    try {
        const { name, cnic, email, mobile, password } = req.body;

        // 1. Check duplicates
        const dup = await db.query(
            "SELECT * FROM users WHERE cnic=$1 OR email=$2 OR mobile=$3",
            [cnic, email, mobile]
        );
        if (dup.rows.length > 0) {
            return res.json({ success: false, message: "User already exists" });
        }

        // 2. Generate UserID
        const userID = "U" + Math.floor(100000 + Math.random() * 900000);

        // 3. Generate Ed25519 Key Pair
        const keyPair = nacl.sign.keyPair();

        const publicKey = Buffer.from(keyPair.publicKey).toString("hex");
        const privateKey = Buffer.from(keyPair.secretKey).toString("hex");

        // 4. Encrypt private key with AES-256 using password
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

        // 7. Assign CITIZEN role
        await db.query(
            `INSERT INTO user_roles(user_id, role_id) VALUES($1, 1)`,
            [id]
        );

        return res.json({
            success: true,
            message: "Registration successful",
            userID: userID
        });

    } catch (err) {
        console.log(err);
        res.json({ success: false, message: "Server error" });
    }
};
