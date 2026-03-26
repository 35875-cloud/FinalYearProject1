// const { Pool } = require("pg");

// const pool = new Pool({
//     user: "postgres",
//     host: "localhost",
//     database: "landdb",
//     password: "6700",
//     port: 5432,
// });

// pool.connect()
//     .then(() => {
//         console.log("✅ PostgreSQL Connected to database: landdb");
//     })
//     .catch(err => {
//         console.error("❌ DB Connection Error:", err.message);
//         process.exit(1); // Exit if DB fails
//     });

// module.exports = pool;
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
    user:     process.env.DB_USER     || "postgres",
    host:     process.env.DB_HOST     || "localhost",
    database: process.env.DB_NAME     || "landdb",
    password: process.env.DB_PASSWORD || "6700",
    port:     parseInt(process.env.DB_PORT || "5432"),
});

pool.connect()
    .then(() => {
        console.log(`✅ PostgreSQL Connected — ${process.env.NODE_ID || 'MAIN'} → ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
    })
    .catch(err => {
        console.error("❌ DB Connection Error:", err.message);
        process.exit(1);
    });

    
export default pool;
