const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const bcrypt = require("bcrypt");

// Citizen registration
router.post("/register-citizen", async (req, res) => {
    try {
        const { name, cnic, email, mobile, password } = req.body;

        // Check duplicate CNIC
        const checkCnic = await pool.query(
            "SELECT * FROM users WHERE cnic = $1",
            [cnic]
        );

        if (checkCnic.rows.length > 0) {
            return res.json({ success: false, message: "CNIC already registered" });
        }

        // Hash Password
        const hash = await bcrypt.hash(password, 10);

        // Generate UserID
        const userID = "USR" + Math.floor(100000 + Math.random() * 900000);

        // Insert user into DB
        await pool.query(
            `INSERT INTO users (user_id, name, cnic, email, mobile, password_hash, role)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userID, name, cnic, email, mobile, hash, "CITIZEN"]
        );

        res.json({
            success: true,
            message: "User registered",
            userID
        });

    }catch (err) {
    console.error("🔥 REAL REGISTRATION ERROR:", err.message);
    res.status(500).json({ success: false, message: err.message });
}

});

router.get("/test", (req, res) => {
    res.json({ success: true, message: "Auth route is working!" });
});


module.exports = router;
