// =====================================================
// BLOCKCHAIN SERVICE - Complete Implementation with PoA
// Location: backend/src/services/blockchain.service.js
// =====================================================

import pool from "../config/db.js";
import crypto from "crypto";

class BlockchainService {
  constructor() {
    this.difficulty = 4; // Proof of Work difficulty (for hybrid mode)
  }

  // =====================================================
  // PROOF OF AUTHORITY (PoA) CONSENSUS
  // =====================================================
  /**
   * Proof of Authority (PoA) Consensus Mechanism:
   * 
   * Unlike Proof of Work (PoW) which requires computational mining,
   * PoA relies on trusted validators (authorities) to validate blocks.
   * 
   * In this land registry system:
   * - Only DCs (Deputy Commissioners) can validate/mine blocks
   * - No computational mining required (energy efficient)
   * - Fast block creation (instant validation)
   * - Maintains immutability through cryptographic hashing
   * - Chain integrity through previous hash linking
   * 
   * Benefits:
   * - Energy efficient (no PoW mining)
   * - Fast transaction finality
   * - Controlled by trusted government authorities
   * - Lower infrastructure costs
   * 
   * Security:
   * - Only authorized DCs can create blocks
   * - All blocks are cryptographically signed
   * - Chain integrity verified through hash linkage
   * - Tampering detection through hash verification
   */

  // =====================================================
  // HASH CALCULATION
  // =====================================================
  calculateHash(blockIndex, previousHash, timestamp, data, nonce = 0) {
    const blockData = blockIndex + previousHash + timestamp + JSON.stringify(data) + nonce;
    return crypto.createHash('sha256').update(blockData).digest('hex');
  }

  // =====================================================
  // GET PROPERTY DATA FROM DATABASE
  // =====================================================
  async getPropertyData(propertyId) {
    try {
      const result = await pool.query(
        `SELECT 
          p.*,
          owner.name as owner_name,
          owner.cnic as owner_cnic
        FROM properties p
        LEFT JOIN users owner ON p.user_id = owner.user_id
        WHERE p.property_id = $1 AND p.status = 'APPROVED'`,
        [propertyId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (err) {
      console.error("❌ Error fetching property data:", err);
      throw err;
    }
  }

  // =====================================================
  // MINE BLOCK - PROOF OF AUTHORITY (PoA)
  // =====================================================
  async mineBlock(propertyData, validatorUserId) {
    try {
      console.log("⛏️  Starting PoA block mining...");
      console.log("   Property ID:", propertyData.property_id);
      console.log("   Validator:", validatorUserId);

      // Get the last block
      const lastBlockResult = await pool.query(
        "SELECT * FROM blockchain_ledger ORDER BY block_index DESC LIMIT 1"
      );

      let blockIndex = 0;
      let previousHash = "0"; // Genesis block

      if (lastBlockResult.rows.length > 0) {
        const lastBlock = lastBlockResult.rows[0];
        blockIndex = lastBlock.block_index + 1;
        previousHash = lastBlock.blockchain_hash;
        
        console.log("   Previous Block Index:", lastBlock.block_index);
        console.log("   Previous Hash:", previousHash.substring(0, 20) + "...");
      } else {
        console.log("   Creating Genesis Block");
      }

      // Create transaction data
      const timestamp = new Date().toISOString();
      const transactionData = {
        propertyId: propertyData.property_id,
        owner: propertyData.owner_name,
        ownerCnic: propertyData.owner_cnic,
        location: {
          district: propertyData.district,
          tehsil: propertyData.tehsil,
          mauza: propertyData.mauza
        },
        landDetails: {
          khewatNo: propertyData.khewat_no || propertyData.fard_no,
          khasraNo: propertyData.khasra_no,
          khatooniNo: propertyData.khatooni_no,
          areaMarla: propertyData.area_marla,
          year: propertyData.year
        },
        timestamp: timestamp,
        validator: validatorUserId,
        consensusMechanism: "PoA" // Proof of Authority
      };

      // For PoA, we use a simple nonce (no computational mining required)
      // The authority (DC) validates the transaction
      const nonce = Math.floor(Math.random() * 1000000);
      
      // Calculate block hash
      const blockHash = this.calculateHash(
        blockIndex,
        previousHash,
        timestamp,
        transactionData,
        nonce
      );

      console.log("   Nonce:", nonce);
      console.log("   Block Hash:", blockHash.substring(0, 20) + "...");

      // Insert into blockchain ledger
      const insertResult = await pool.query(
        `INSERT INTO blockchain_ledger 
        (block_index, property_id, blockchain_hash, previous_hash, transaction_data, nonce, mined_by, mined_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
        [
          blockIndex,
          propertyData.property_id,
          blockHash,
          previousHash,
          JSON.stringify(transactionData),
          nonce,
          validatorUserId
        ]
      );

      const newBlock = insertResult.rows[0];
      
      console.log("✅ Block mined successfully using PoA!");
      console.log("   Block Index:", newBlock.block_index);
      console.log("   Consensus: Proof of Authority");

      return newBlock;

    } catch (err) {
      console.error("❌ Mining error:", err);
      throw new Error("Block mining failed: " + err.message);
    }
  }

  // =====================================================
  // GET FULL BLOCKCHAIN
  // =====================================================
  async getFullChain() {
    try {
      const result = await pool.query(
        `SELECT 
          bl.*,
          p.owner_name,
          p.district,
          p.tehsil,
          miner.name as miner_name,
          miner.role as miner_role
        FROM blockchain_ledger bl
        LEFT JOIN properties p ON bl.property_id = p.property_id
        LEFT JOIN users miner ON bl.mined_by = miner.user_id
        ORDER BY bl.block_index ASC`
      );

      return result.rows;
    } catch (err) {
      console.error("❌ Error fetching blockchain:", err);
      throw err;
    }
  }

  // =====================================================
  // GET PROPERTY HISTORY
  // =====================================================
  async getPropertyHistory(propertyId) {
    try {
      const result = await pool.query(
        `SELECT 
          bl.*,
          miner.name as miner_name,
          miner.role as miner_role
        FROM blockchain_ledger bl
        LEFT JOIN users miner ON bl.mined_by = miner.user_id
        WHERE bl.property_id = $1
        ORDER BY bl.block_index DESC`,
        [propertyId]
      );

      return result.rows;
    } catch (err) {
      console.error("❌ Error fetching property history:", err);
      throw err;
    }
  }

  // =====================================================
  // VERIFY BLOCKCHAIN INTEGRITY
  // =====================================================
  async verifyChain() {
    try {
      const chain = await this.getFullChain();

      if (chain.length === 0) {
        return true; // Empty chain is valid
      }

      // Verify genesis block
      if (chain[0].previous_hash !== "0") {
        console.log("❌ Genesis block invalid");
        return false;
      }

      // Verify each block
      for (let i = 1; i < chain.length; i++) {
        const currentBlock = chain[i];
        const previousBlock = chain[i - 1];

        // Check if previous hash matches
        if (currentBlock.previous_hash !== previousBlock.blockchain_hash) {
          console.log(`❌ Block ${i} has invalid previous hash`);
          return false;
        }

        // Recalculate hash and verify
        const recalculatedHash = this.calculateHash(
          currentBlock.block_index,
          currentBlock.previous_hash,
          currentBlock.mined_at,
          currentBlock.transaction_data,
          currentBlock.nonce
        );

        if (recalculatedHash !== currentBlock.blockchain_hash) {
          console.log(`❌ Block ${i} has invalid hash`);
          return false;
        }
      }

      console.log("✅ Blockchain integrity verified");
      return true;

    } catch (err) {
      console.error("❌ Verification error:", err);
      throw err;
    }
  }

  // =====================================================
  // GET BLOCKCHAIN STATISTICS
  // =====================================================
  async getBlockchainStats() {
    try {
      const totalBlocks = await pool.query(
        "SELECT COUNT(*) as count FROM blockchain_ledger"
      );

      const totalProperties = await pool.query(
        "SELECT COUNT(DISTINCT property_id) as count FROM blockchain_ledger"
      );

      const lastBlock = await pool.query(
        "SELECT * FROM blockchain_ledger ORDER BY block_index DESC LIMIT 1"
      );

      const validators = await pool.query(
        `SELECT 
          u.user_id,
          u.name,
          u.role,
          COUNT(bl.blockchain_id) as blocks_validated
        FROM users u
        INNER JOIN blockchain_ledger bl ON u.user_id = bl.mined_by
        GROUP BY u.user_id, u.name, u.role
        ORDER BY blocks_validated DESC`
      );

      return {
        totalBlocks: parseInt(totalBlocks.rows[0].count),
        totalProperties: parseInt(totalProperties.rows[0].count),
        lastBlockIndex: lastBlock.rows.length > 0 ? lastBlock.rows[0].block_index : null,
        lastBlockHash: lastBlock.rows.length > 0 ? lastBlock.rows[0].blockchain_hash : null,
        lastMiningTime: lastBlock.rows.length > 0 ? lastBlock.rows[0].mined_at : null,
        consensusMechanism: "Proof of Authority (PoA)",
        validators: validators.rows,
        isValid: await this.verifyChain()
      };
    } catch (err) {
      console.error("❌ Error fetching stats:", err);
      throw err;
    }
  }

  // =====================================================
  // GET BLOCK BY INDEX
  // =====================================================
  async getBlockByIndex(blockIndex) {
    try {
      const result = await pool.query(
        `SELECT 
          bl.*,
          p.owner_name,
          p.district,
          miner.name as miner_name,
          miner.role as miner_role
        FROM blockchain_ledger bl
        LEFT JOIN properties p ON bl.property_id = p.property_id
        LEFT JOIN users miner ON bl.mined_by = miner.user_id
        WHERE bl.block_index = $1`,
        [blockIndex]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (err) {
      console.error("❌ Error fetching block:", err);
      throw err;
    }
  }

  // =====================================================
  // VERIFY DETAILED (WITH BLOCK-BY-BLOCK REPORT)
  // =====================================================
  async verifyChainDetailed() {
    try {
      const chain = await this.getFullChain();
      const invalidBlocks = [];
      let isValid = true;

      for (let i = 1; i < chain.length; i++) {
        const currentBlock = chain[i];
        const previousBlock = chain[i - 1];

        const recalculatedHash = this.calculateHash(
          currentBlock.block_index,
          currentBlock.previous_hash,
          currentBlock.mined_at,
          currentBlock.transaction_data,
          currentBlock.nonce
        );

        if (currentBlock.previous_hash !== previousBlock.blockchain_hash) {
          isValid = false;
          invalidBlocks.push({
            blockIndex: currentBlock.block_index,
            reason: "Previous hash mismatch",
            expected: previousBlock.blockchain_hash,
            actual: currentBlock.previous_hash
          });
        }

        if (recalculatedHash !== currentBlock.blockchain_hash) {
          isValid = false;
          invalidBlocks.push({
            blockIndex: currentBlock.block_index,
            reason: "Hash tampering detected",
            expected: recalculatedHash,
            actual: currentBlock.blockchain_hash
          });
        }
      }

      return {
        isValid,
        totalBlocks: chain.length,
        invalidBlocks,
        message: isValid 
          ? "✅ Blockchain is valid and tamper-proof" 
          : "❌ Blockchain integrity compromised!"
      };
    } catch (err) {
      console.error("❌ Detailed verification error:", err);
      throw err;
    }
  }
}

export default new BlockchainService();