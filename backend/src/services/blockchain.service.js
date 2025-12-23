// // backend/src/services/blockchain.service.js
// import { ethers } from "ethers";
// import fs from "fs";
// import path from "path";

// const PropertyRegistryJSON = JSON.parse(
//   fs.readFileSync(
//     path.resolve("../../blockchain/artifacts/contracts/PropertyRegistry.sol/PropertyRegistry.json"),
//     "utf-8"
//   )
// );

// const PropertyTransferJSON = JSON.parse(
//   fs.readFileSync(
//     path.resolve("../../blockchain/artifacts/contracts/PropertyTransfer.sol/PropertyTransfer.json"),
//     "utf-8"
//   )
// );

// class BlockchainService {
//   constructor() {
//     this.provider = new ethers.JsonRpcProvider(
//       process.env.BLOCKCHAIN_RPC_URL || "http://localhost:8545"
//     );

//     const deploymentInfo = JSON.parse(
//       fs.readFileSync(path.resolve("../../blockchain/deployment-info.json"), "utf-8")
//     );

//     this.propertyRegistryAddress = deploymentInfo.propertyRegistry;
//     this.propertyTransferAddress = deploymentInfo.propertyTransfer;

//     this.adminWallet = new ethers.Wallet(
//       process.env.ADMIN_PRIVATE_KEY,
//       this.provider
//     );

//     this.propertyRegistry = new ethers.Contract(
//       this.propertyRegistryAddress,
//       PropertyRegistryJSON.abi,
//       this.adminWallet
//     );

//     this.propertyTransfer = new ethers.Contract(
//       this.propertyTransferAddress,
//       PropertyTransferJSON.abi,
//       this.adminWallet
//     );

//     console.log("✅ Blockchain Service initialized");
//   }

//   // ... Keep your methods: registerProperty, approveProperty, etc. ...



//   async registerProperty(propertyData) {
//     const tx = await this.propertyRegistry.registerProperty(
//       propertyData.propertyId,
//       propertyData.ownerId,
//       propertyData.ownerName,
//       propertyData.ownerCnic,
//       propertyData.fatherName,
//       propertyData.fardNo,
//       propertyData.khasraNo,
//       propertyData.khatooniNo,
//       propertyData.areaMarla,
//       propertyData.propertyType,
//       propertyData.district,
//       propertyData.tehsil,
//       propertyData.documentHash
//     );
//     const receipt = await tx.wait();
//     return {
//       success: true,
//       transactionHash: receipt.transactionHash,
//       blockNumber: receipt.blockNumber,
//       gasUsed: receipt.gasUsed.toString()
//     };
//   }

//   // ... Keep other methods the same (approveProperty, getProperty, etc.) ...


//   /**
//    * Approve property (Tehsildar)
//    */
//   async approveProperty(propertyId, tehsildarWallet) {
//     try {
//       console.log("✅ Approving property:", propertyId);

//       const contract = this.propertyRegistry.connect(tehsildarWallet);
//       const tx = await contract.approveProperty(propertyId);
//       const receipt = await tx.wait();

//       console.log("✅ Property approved on blockchain");

//       return {
//         success: true,
//         transactionHash: receipt.transactionHash,
//         blockNumber: receipt.blockNumber
//       };
//     } catch (error) {
//       console.error("❌ Approval error:", error);
//       throw error;
//     }
//   }

//   /**
//    * Get property from blockchain
//    */
//   async getProperty(propertyId) {
//     try {
//       const property = await this.propertyRegistry.getProperty(propertyId);
      
//       return {
//         propertyId: property.propertyId,
//         ownerId: property.ownerId,
//         ownerName: property.ownerName,
//         ownerCnic: property.ownerCnic,
//         fardNo: property.fardNo,
//         khasraNo: property.khasraNo,
//         isApproved: property.isApproved,
//         isFrozen: property.isFrozen,
//         status: property.status,
//         registrationDate: new Date(property.registrationDate.toNumber() * 1000),
//         addedBy: property.addedBy,
//         approvedBy: property.approvedBy
//       };
//     } catch (error) {
//       console.error("❌ Get property error:", error);
//       throw error;
//     }
//   }

//   /**
//    * Initiate property transfer
//    */
//   async initiateTransfer(transferData) {
//     try {
//       console.log("🔄 Initiating transfer:", transferData.transferId);

//       const tx = await this.propertyTransfer.initiateTransfer(
//         transferData.transferId,
//         transferData.propertyId,
//         transferData.sellerId,
//         transferData.sellerCnic,
//         transferData.buyerId,
//         transferData.buyerCnic,
//         transferData.buyerName,
//         transferData.buyerFatherName,
//         transferData.transferAmount,
//         transferData.durationDays
//       );

//       const receipt = await tx.wait();

//       console.log("✅ Transfer initiated on blockchain");

//       return {
//         success: true,
//         transactionHash: receipt.transactionHash,
//         blockNumber: receipt.blockNumber
//       };
//     } catch (error) {
//       console.error("❌ Transfer initiation error:", error);
//       throw error;
//     }
//   }

//   /**
//    * Complete property transfer
//    */
//   async completeTransfer(transferId, tehsildarWallet) {
//     try {
//       console.log("✅ Completing transfer:", transferId);

//       const contract = this.propertyTransfer.connect(tehsildarWallet);
//       const tx = await contract.completeTransfer(transferId);
//       const receipt = await tx.wait();

//       console.log("✅ Transfer completed on blockchain");

//       return {
//         success: true,
//         transactionHash: receipt.transactionHash,
//         blockNumber: receipt.blockNumber
//       };
//     } catch (error) {
//       console.error("❌ Transfer completion error:", error);
//       throw error;
//     }
//   }

//   /**
//    * Verify blockchain integrity
//    */
//   async verifyBlockchainIntegrity() {
//     try {
//       const blockNumber = await this.provider.getBlockNumber();
//       const network = await this.provider.getNetwork();

//       return {
//         isConnected: true,
//         currentBlock: blockNumber,
//         chainId: network.chainId,
//         networkName: network.name
//       };
//     } catch (error) {
//       return {
//         isConnected: false,
//         error: error.message
//       };
//     }
//   }
// }


// export default new BlockchainService();

// import { Wallet, JsonRpcProvider } from "ethers";

// this.provider = new JsonRpcProvider(process.env.RPC_URL);

// if (process.env.PRIVATE_KEY) {
//   this.wallet = new Wallet(process.env.PRIVATE_KEY, this.provider);
// } else {
//   console.warn("⚠️ No PRIVATE_KEY found. Running in read-only mode.");
//   this.wallet = null;
// }
// =====================================================
// BLOCKCHAIN SERVICE - Updated for Private Key Management
// Location: backend/src/services/blockchain.service.js
// =====================================================

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import CryptoJS from "crypto-js";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BlockchainService {
  constructor() {
    this.isConnected = false;
    this.provider = null;
    this.propertyRegistry = null;
    this.propertyTransfer = null;
    
    this.initialize();
  }

  async initialize() {
    try {
      console.log("\n🔗 Initializing Blockchain Service...");

      // Check if blockchain is configured
      if (!process.env.BLOCKCHAIN_RPC_URL) {
        console.warn("⚠️  Blockchain RPC URL not configured.");
        return;
      }

      // Connect to provider
      this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);

      // Test connection
      const network = await this.provider.getNetwork();
      console.log("✅ Connected to blockchain network:", network.chainId.toString());

      // Load contract addresses from deployment info
      const deploymentPath = path.join(__dirname, "../../../blockchain/deployment-info.json");
      
      if (!fs.existsSync(deploymentPath)) {
        console.warn("⚠️  Deployment info not found. Please deploy contracts first.");
        return;
      }

      const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      
      // Load ABIs
     const registryArtifact = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../../blockchain/artifacts/contracts/PropertyRegistry.sol/PropertyRegistry.json"),
    "utf8"
  )
);

const transferArtifact = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../../blockchain/artifacts/contracts/PropertyTransfer.sol/PropertyTransfer.json"),
    "utf8"
  )
);

      // Store contract addresses and ABIs
      this.registryAddress = deploymentInfo.contracts.PropertyRegistry.address;
      this.transferAddress = deploymentInfo.contracts.PropertyTransfer.address;
      this.registryABI = registryArtifact.abi;
      this.transferABI = transferArtifact.abi;


      this.isConnected = true;
      console.log("✅ Blockchain Service initialized");
      console.log("   PropertyRegistry:", this.registryAddress);
      console.log("   PropertyTransfer:", this.transferAddress);

    } catch (error) {
      console.error("❌ Blockchain Service initialization failed:", error.message);
      this.isConnected = false;
    }
  }

  /**
   * Check if blockchain is available
   */
  isAvailable() {
    return this.isConnected;
  }

  /**
   * Decrypt user's private key using their password
   */
  decryptPrivateKey(encryptedKey, userPassword) {
    try {
      const secretKey = process.env.AES_SECRET_KEY || "default-secret-key-32chars-long";
      const decrypted = CryptoJS.AES.decrypt(
        encryptedKey,
        userPassword + secretKey
      ).toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        throw new Error("Failed to decrypt private key");
      }
      
      return decrypted;
    } catch (error) {
      console.error("❌ Decryption error:", error);
      throw new Error("Invalid password or corrupted private key");
    }
  }

  /**
   * Get user's wallet for signing transactions
   * IMPORTANT: This is called every time user performs blockchain action
   */
  async getUserWallet(userId, userPassword) {
    try {
      // Get encrypted private key from database
      const result = await pool.query(
        "SELECT encrypted_private_key, blockchain_address FROM users WHERE user_id = $1",
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error("User not found");
      }

      const { encrypted_private_key, blockchain_address } = result.rows[0];

      // Decrypt private key
      const privateKey = this.decryptPrivateKey(encrypted_private_key, userPassword);

      // Create and return wallet
      const wallet = new ethers.Wallet(privateKey, this.provider);
      
      console.log("✅ Wallet created for user:", userId);
      console.log("   Address:", wallet.address);
      console.log("   Expected:", blockchain_address);

      return wallet;
    } catch (error) {
      console.error("❌ Error creating wallet:", error);
      throw error;
    }
  }

  /**
   * Register property on blockchain
   * Called from: POST /api/properties/add-property
   */
  async registerProperty(propertyData, lroUserId, lroPassword) {
    if (!this.isConnected) {
      throw new Error("Blockchain not connected");
    }

    try {
      console.log("📝 Registering property on blockchain:", propertyData.propertyId);

      // Get LRO's wallet
      const lroWallet = await this.getUserWallet(lroUserId, lroPassword);

      // Create contract instance with LRO's wallet
      const contract = new ethers.Contract(
        this.registryAddress,
        this.registryABI,
        lroWallet
      );

      // Call smart contract
      const tx = await contract.registerProperty(
        propertyData.propertyId,
        propertyData.ownerId,
        propertyData.ownerName,
        propertyData.ownerCnic,
        propertyData.fatherName,
        propertyData.fardNo,
        propertyData.khasraNo,
        propertyData.khatooniNo,
        ethers.parseUnits(propertyData.areaMarla.toString(), 0), // Convert to BigNumber
        propertyData.propertyType,
        propertyData.district,
        propertyData.tehsil,
        propertyData.documentHash
      );

      console.log("⏳ Transaction sent:", tx.hash);
      console.log("   Waiting for confirmation...");
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      console.log("✅ Transaction confirmed!");
      console.log("   Block:", receipt.blockNumber);
      console.log("   Gas used:", receipt.gasUsed.toString());

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error("❌ Blockchain registration error:", error);
      throw error;
    }
  }

  /**
   * Approve property registration (LRO)
   * Called from: POST /api/properties/approve
   */
  async approveProperty(propertyId, lroUserId, lroPassword) {
    if (!this.isConnected) {
      throw new Error("Blockchain not connected");
    }

    try {
      console.log("✅ Approving property on blockchain:", propertyId);

      const lroWallet = await this.getUserWallet(lroUserId, lroPassword);
      
      const contract = new ethers.Contract(
        this.registryAddress,
        this.registryABI,
        lroWallet
      );

      const tx = await contract.approveProperty(propertyId);
      console.log("⏳ Transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✅ Property approved on blockchain!");

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error("❌ Approval error:", error);
      throw error;
    }
  }

  /**
   * Get property from blockchain
   */
  async getProperty(propertyId) {
    if (!this.isConnected) {
      throw new Error("Blockchain not connected");
    }

    try {
      // Read-only, no wallet needed
      const contract = new ethers.Contract(
        this.registryAddress,
        this.registryABI,
        this.provider
      );

      const property = await contract.getProperty(propertyId);
      
      return {
        propertyId: property.propertyId,
        ownerId: property.ownerId,
        ownerName: property.ownerName,
        ownerCnic: property.ownerCnic,
        fardNo: property.fardNo,
        isApproved: property.isApproved,
        isFrozen: property.isFrozen,
        status: Number(property.status),
        registrationDate: new Date(Number(property.registrationDate) * 1000),
        addedBy: property.addedBy,
        approvedBy: property.approvedBy
      };
    } catch (error) {
      console.error("❌ Get property error:", error);
      throw error;
    }
  }

  /**
   * Initiate property transfer
   * Called from: POST /api/transfers/initiate
   */
  async initiateTransfer(transferData, sellerUserId, sellerPassword) {
    if (!this.isConnected) {
      throw new Error("Blockchain not connected");
    }

    try {
      console.log("🔄 Initiating transfer on blockchain:", transferData.transferId);

      const sellerWallet = await this.getUserWallet(sellerUserId, sellerPassword);
      
      const contract = new ethers.Contract(
        this.transferAddress,
        this.transferABI,
        sellerWallet
      );

      const tx = await contract.initiateTransfer(
        transferData.transferId,
        transferData.propertyId,
        transferData.sellerId,
        transferData.sellerCnic,
        transferData.buyerId,
        transferData.buyerCnic,
        transferData.buyerName,
        transferData.buyerFatherName,
        ethers.parseUnits(transferData.transferAmount.toString(), 0),
        transferData.durationDays
      );

      console.log("⏳ Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Transfer initiated on blockchain!");

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error("❌ Transfer initiation error:", error);
      throw error;
    }
  }

  /**
   * Verify blockchain health
   */
  async verifyBlockchainIntegrity() {
    if (!this.isConnected) {
      return { isConnected: false, message: "Blockchain not available" };
    }

    try {
      const blockNumber = await this.provider.getBlockNumber();
      const network = await this.provider.getNetwork();

      return {
        isConnected: true,
        currentBlock: blockNumber,
        chainId: network.chainId.toString(),
        registryAddress: this.registryAddress,
        transferAddress: this.transferAddress
      };
    } catch (error) {
      return { isConnected: false, error: error.message };
    }
  }
  



//   async buyProperty(transferId, buyerUserId, buyerPassword) {
//   if (!this.isConnected) throw new Error("Blockchain not connected");

//   try {
//     const buyerWallet = await this.getUserWallet(buyerUserId, buyerPassword);

//     const transferContract = new ethers.Contract(
//       this.transferAddress,
//       this.transferABI,
//       buyerWallet
//     );

//     const tx = await transferContract.completeTransfer(transferId, {
//       value: await transferContract.getPrice(transferId) // send ETH if needed
//     });

//     const receipt = await tx.wait();
//     console.log("✅ Property purchased on blockchain:", transferId);

//     return {
//       success: true,
//       transactionHash: receipt.hash,
//       blockNumber: receipt.blockNumber
//     };
//   } catch (error) {
//     console.error("❌ Buy property error:", error);
//     throw error;
//   }
// }

}

export default new BlockchainService();
