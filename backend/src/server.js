// =====================================================
// SERVER.JS - Main Backend Server (ESM Version)
// Location: backend/src/server.js
// =====================================================
import 'dotenv/config';  // add at the very top of server.js
import dotenv from "dotenv";
dotenv.config({ path: "../.env" }); // Load .env from backend folder

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Import routes using ESM syntax
import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";

// Import DB pool (ESM-compatible)
import pool from "./config/db.js";

const app = express();

// =====================================================
// MIDDLEWARE CONFIGURATION
// =====================================================

// Security Headers
app.use(helmet());

// CORS Configuration
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request Logging (Development)
if (process.env.NODE_ENV !== "production") {
    app.use(morgan("dev"));
}

// =====================================================
// ROOT ROUTE - Health Check
// =====================================================
app.get("/", (req, res) => {
    res.json({ 
        message: "✅ Blockchain Land Records Backend Server",
        status: "Running",
        version: "1.0.0",
        timestamp: new Date().toISOString()
    });
});

// Test Database Connection
app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({
            status: "OK",
            database: "Connected",
            timestamp: result.rows[0].now
        });
    } catch (err) {
        res.status(500).json({
            status: "ERROR",
            database: "Disconnected",
            error: err.message
        });
    }
});

// =====================================================
// API ROUTES
// =====================================================
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);

// =====================================================
// ERROR HANDLING
// =====================================================
app.use((req, res) => {
    res.status(404).json({ 
        error: "Route not found",
        path: req.originalUrl,
        method: req.method
    });
});

app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error",
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
    });
});

// =====================================================
// START SERVER
// =====================================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("\n=====================================================");
    console.log("🚀 Blockchain Land Records Backend Server");
    console.log("=====================================================");
    console.log(`✅ Server running on: http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`📅 Started at: ${new Date().toLocaleString()}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log("=====================================================\n");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err);
    process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
    process.exit(1);
});

// Export app for testing
export default app;
