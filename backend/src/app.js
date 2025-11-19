const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// test route
app.get("/", (req, res) => {
  res.send("Backend API Working");
});

module.exports = app;
const authRoutes = require("./routes/auth.routes");

app.use("/api/v1/auth", authRoutes);
