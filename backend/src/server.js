require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("===========================================");
  console.log(`🚀 Backend running at: http://localhost:${PORT}`);
  console.log("===========================================");
});
const os = require("os");
const networkInterfaces = os.networkInterfaces();
let localIP = "localhost";

for (let iface of Object.values(networkInterfaces)) {
  for (let alias of iface) {
    if (alias.family === "IPv4" && !alias.internal) {
      localIP = alias.address;
    }
  }
}

app.listen(PORT, () => {
  console.log("===========================================");
  console.log(`🚀 Backend running locally:  http://localhost:${PORT}`);
  console.log(`🌐 Backend on network:     http://${localIP}:${PORT}`);
  console.log("===========================================");
});


// const db = require("./config/db");

// db.authenticate()
//   .then(() => console.log("Database connected"))
//   .catch(err => console.log("DB error:", err));
// db.sync({ force: false });
