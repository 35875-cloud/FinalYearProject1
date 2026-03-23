// =====================================================
// SERVER.JS — backend/src/server.js
// =====================================================
import 'dotenv/config';
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import express              from "express";
import cors                 from "cors";
import helmet               from "helmet";
import morgan               from "morgan";
import http                 from "http";
import path                 from 'path';
import { fileURLToPath }    from 'url';

// Routes
import blockchainRouter         from './routes/blockchain.routes.js';
import authRoutes               from "./routes/auth.js";
import propertyRoutes           from "./routes/property.js";
import transferRoutes           from "./routes/transfer.js";
import ownershipHistoryRoutes   from "./routes/ownershipHistory.js";
import marketAnalyticsRoutes    from "./routes/marketAnalytics.js";
import blockchainRoutes         from "./routes/blockchain.js";
import channelRoutes            from "./routes/channel.js";
import paymentRoutes            from './routes/payment.js';
import p2pRoutes                from './routes/p2p_routes.js';
import marketplaceRoutes        from './routes/marketplace_routes.js';
import transferNewRoutes        from './routes/transfer_new_routes.js';
import regBlockchainRouter      from './routes/blockchainRegistration.routes.js';
import fabricStatusRouter from './routes/fabricStatus.routes.js';
// Services
import websocketService         from "./services/websocket.service.js";
import { startTamperMonitor }   from './services/tamperMonitor.js';
import pool                     from "./config/db.js";

// Path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

// =====================================================
// Static uploads (IMPORTANT: before helmet)
// =====================================================
const uploadsPath = path.join(__dirname, '../uploads');

app.use('/uploads', (req, res, next) => {
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Accept-Ranges', 'bytes');

  if (req.path.endsWith('.webm'))
    res.set('Content-Type', 'audio/webm; codecs=opus');
  else if (req.path.endsWith('.ogg'))
    res.set('Content-Type', 'audio/ogg; codecs=opus');

  next();
}, express.static(uploadsPath));

// =====================================================
// Middleware
// =====================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","DELETE","PATCH"],
  credentials: true,
  allowedHeaders: ["Content-Type","Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// =====================================================
// Routes
// =====================================================
app.get("/", (req, res) => {
  res.json({
    message: "✅ Backend Running",
    websocket: "enabled",
    e2e: "enabled"
  });
});

app.use('/api/payments', paymentRoutes);

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
      error: err.message
    });
  }
});

app.use("/api/auth",              authRoutes);
app.use("/api/properties",        propertyRoutes);
app.use('/api/blockchain/registration', regBlockchainRouter);
app.use("/api/transfers",         transferNewRoutes); // NEW WORKFLOW
app.use("/api/transfers",         transferRoutes);
app.use("/api/ownership-history", ownershipHistoryRoutes);
app.use("/api/market",            marketAnalyticsRoutes);
app.use("/api/blockchain",        blockchainRoutes);
app.use('/api/blockchain',        blockchainRouter);
app.use("/api/channels",          channelRoutes);
app.use("/api/p2p",               p2pRoutes);
app.use("/api/marketplace",       marketplaceRoutes);
app.use('/api/blockchain/fabric', fabricStatusRouter);
// =====================================================
// 404 + Error Handling
// =====================================================
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error"
  });
});

// =====================================================
// HTTP Server + WebSocket
// =====================================================
const httpServer = http.createServer(app);

try {
  websocketService.initializeSocketIO(httpServer);
  globalThis.__websocketService = websocketService;
  console.log("✅ WebSocket (Socket.IO) initialized");
} catch (error) {
  console.error("❌ Failed to initialize WebSocket:", error.message);
}

// =====================================================
// START SERVER
// =====================================================
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log("\n=====================================================");
  console.log("🚀 Blockchain Land Records Backend Server");
  console.log("=====================================================");
  console.log(`✅ Server:      http://localhost:${PORT}`);
  console.log(`🔒 P2P Crypto:  http://localhost:${PORT}/api/p2p`);
  console.log(`🔌 WebSocket:   ws://localhost:${PORT}`);
  console.log(`📅 Started:     ${new Date().toLocaleString()}`);
  console.log("=====================================================\n");

  // ✅ FIXED: Start AFTER server starts
  startTamperMonitor();
});

// =====================================================
// Process Handlers
// =====================================================
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("SIGTERM", () => {
  httpServer.close(() => {
    pool.end();
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  httpServer.close(() => {
    pool.end();
    process.exit(0);
  });
});

export default app;