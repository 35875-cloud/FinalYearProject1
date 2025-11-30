// src/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// Debug log all requests
app.use((req, res, next) => {
    console.log("➡️", req.method, req.url);
    next();
});

// ROUTES
app.use("/api/auth", require("./routes/auth"));

const PORT = 4000;
app.listen(PORT, () => console.log("🚀 Server running on port " + PORT));
