// =====================================================
// SERVER.JS - Main Backend Server with WebSocket Support
// Location: backend/src/server.js
// MODIFIED: Added Socket.IO for P2P negotiation channels
// =====================================================
import 'dotenv/config';
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });


import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http"; // NEW: For WebSocket support
import path from "path";
import { fileURLToPath } from 'url';

// Import existing routes
import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/property.js";
import transferRoutes from "./routes/transfer.js";
import ownershipHistoryRoutes from "./routes/ownershipHistory.js";
import marketAnalyticsRoutes from "./routes/marketAnalytics.js";
import blockchainRoutes from "./routes/blockchain.js";

// NEW: Import P2P channel routes and WebSocket service
import channelRoutes from "./routes/channel.js";
import websocketService from "./services/websocket.service.js";
import paymentRoutes from './routes/payment.js';
// Import DB pool
import pool from "./config/db.js";

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



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

// NEW: Serve uploaded files (for agreement screenshots)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =====================================================
// ROOT ROUTE - Health Check
// =====================================================
app.get("/", (req, res) => {
    res.json({ 
        message: "✅ Blockchain Land Records Backend Server",
        status: "Running",
        version: "1.0.0",
        websocket: "enabled", // NEW: Indicate WebSocket is available
        timestamp: new Date().toISOString()
    });
});
app.use('/api/payments', paymentRoutes);

// Test Database Connection
app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({
            status: "OK",
            database: "Connected",
            websocket: "enabled",
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
app.use("/api/transfers", transferRoutes);
app.use("/api/ownership-history", ownershipHistoryRoutes);
app.use("/api/market", marketAnalyticsRoutes);
app.use("/api/blockchain", blockchainRoutes);

// NEW: P2P Negotiation Channel Routes
app.use("/api/channels", channelRoutes);

console.log("✅ Routes registered:");
console.log("   - /api/auth");
console.log("   - /api/properties");
console.log("   - /api/transfers");
console.log("   - /api/ownership-history");
console.log("   - /api/blockchain");
console.log("   - /api/market");
console.log("   - /api/channels          [NEW - P2P Negotiation]");

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
// CREATE HTTP SERVER & INITIALIZE WEBSOCKET
// =====================================================

// NEW: Create HTTP server instead of directly using app.listen
const httpServer = http.createServer(app);

// NEW: Initialize Socket.IO for real-time communication
try {
    websocketService.initializeSocketIO(httpServer);
    console.log("✅ WebSocket (Socket.IO) initialized successfully");
} catch (error) {
    console.error("❌ Failed to initialize WebSocket:", error.message);
    // Server can still run without WebSocket if needed
}

// =====================================================
// START SERVER
// =====================================================
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
    console.log("\n=====================================================");
    console.log("🚀 Blockchain Land Records Backend Server");
    console.log("=====================================================");
    console.log(`✅ Server running on: http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`🏠 Property API: http://localhost:${PORT}/api/properties`);
    console.log(`📄 Transfer API: http://localhost:${PORT}/api/transfers`);
    console.log(`📊 Market API: http://localhost:${PORT}/api/market`);
    console.log(`⛓️  Blockchain API: http://localhost:${PORT}/api/blockchain`);
    console.log(`💬 Channel API: http://localhost:${PORT}/api/channels [NEW]`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT} [NEW]`);
    console.log(`📅 Started at: ${new Date().toLocaleString()}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log("=====================================================\n");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err);
    // Don't exit immediately in production
    if (process.env.NODE_ENV === "production") {
        console.error("Server will continue running...");
    } else {
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
    // Don't exit immediately in production
    if (process.env.NODE_ENV === "production") {
        console.error("Server will continue running...");
    } else {
        process.exit(1);
    }
});

// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("SIGTERM received, closing server gracefully...");
    httpServer.close(() => {
        console.log("✅ Server closed successfully");
        pool.end(); // Close database connections
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    console.log("\nSIGINT received, closing server gracefully...");
    httpServer.close(() => {
        console.log("✅ Server closed successfully");
        pool.end(); // Close database connections
        process.exit(0);
    });
});

// Export app for testing
export default app;