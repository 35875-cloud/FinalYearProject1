// hardhat.config.cjs
require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config({ path: '../backend/.env' });

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 },
      viaIR: true
 }
  },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    privateNetwork: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: [process.env.PRIVATE_KEY],
      gas: 8000000,
      gasPrice: 0
    }
  }
};
