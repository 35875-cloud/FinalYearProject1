// src/config/db.js
const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "landdb",
    password: "6700",
    port: 5432
});

pool.connect()
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ DB Error:", err));

module.exports = pool;
