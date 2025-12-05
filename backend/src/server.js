require("dotenv").config({ path: "../.env" }); // Load .env from parent folder
const express = require("express");
const cors = require("cors");
const app = express();

// CORS Configuration - MUST BE BEFORE ROUTES
app.use(cors({
    origin: "*", // Allow all origins for testing (change later for production)
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.json());

// Test route to verify server is working
app.get("/", (req, res) => {
    res.json({ message: "✅ Backend Server is Running!", status: "OK" });
});

// API Routes
app.use("/api/auth", require("../src/routes/auth"));
// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Test it: http://localhost:${PORT}/`);
});