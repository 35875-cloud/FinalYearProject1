const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

router.post("/register-citizen", async (req, res) => {
    try {
        const { name, cnic, email, mobile, password } = req.body;

        console.log("📩 Received:", req.body);

        const hash = await bcrypt.hash(password, 10);
        const id = uuidv4();
        const userID = "USR" + Math.floor(100000 + Math.random() * 900000);

        await pool.query(
            `INSERT INTO users (id, user_id, name, cnic, email, mobile, password_hash, role)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, userID, name, cnic, email, mobile, hash, "CITIZEN"]
        );

        res.json({ success: true, userID });

    } catch (err) {
        console.error("🔥 ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get("/test", (req, res) => {
    res.json({ success: true, message: "Backend is running fine!" });
});

module.exports = router;
