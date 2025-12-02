const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

// MIDDLEWARE
app.use(cors());          // FIXES "Failed to fetch"
app.use(express.json());  // FIXES req.body undefined

// ROUTES
app.use("/api/auth", require("./routes/auth"));

app.listen(4000, () => {
    console.log("🚀 Server running on 4000");
});
