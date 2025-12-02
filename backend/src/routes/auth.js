const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

router.post("/register-citizen", async (req, res) => {
    try {
        let { name, cnic, email, mobile, password } = req.body;

        // 1️⃣ Trim and normalize all input
        name = name.trim();
        email = email.trim().toLowerCase();
        mobile = mobile.trim();
        cnic = cnic.replace(/\D/g, ""); // remove all non-digit characters

        // 2️⃣ Check duplicates BEFORE inserting
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE cnic=$1 OR email=$2 OR mobile=$3",
            [cnic, email, mobile]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: "CNIC, Email, or Mobile already exists" });
        }

        // 3️⃣ Hash password
        const hash = await bcrypt.hash(password, 10);

        // 4️⃣ Generate unique IDs
        const id = uuidv4();

        let userID;
        while (true) {
            userID = "USR" + Math.floor(100000 + Math.random() * 900000);
            const existingID = await pool.query("SELECT * FROM users WHERE user_id=$1", [userID]);
            if (existingID.rows.length === 0) break; // unique userID
        }

        // 5️⃣ Insert new user
        const queryText = `
            INSERT INTO users (id, user_id, name, cnic, email, mobile, password_hash, role)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        const params = [id, userID, name, cnic, email, mobile, hash, "CITIZEN"];

        await pool.query(queryText, params);

        return res.json({ success: true, userID });

    } catch (err) {
        console.error("🔥 ERROR:", err);

        // Handle unique constraint errors from PostgreSQL
        if (err.code === "23505") { 
            return res.status(400).json({ success: false, message: "Duplicate entry detected" });
        }

        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
