const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// DB Connection
require("./config/db");

// Load routes (CORRECT PATH)
app.use("/api/auth", require("./routes/auth"));

app.listen(4000, () => console.log("🚀 Server running on port 4000"));
