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
    user: "postgres",
    host: "localhost",
    database: "landdb",
    password: "6700",
    port: 5432,
});

pool.connect()
    .then(() => {
        console.log("✅ PostgreSQL Connected to database: landdb");
    })
    .catch(err => {
        console.error("❌ DB Connection Error:", err.message);
        process.exit(1);
    });

    
export default pool;
