// =====================================================
// BLOCKCHAIN SERVICE - FIXED VERSION
// Location: backend/src/services/blockchain.service.js
// =====================================================

import crypto from 'crypto';
import pool from '../config/db.js';

class BlockchainService {
    constructor() {
        this.difficulty = 4; // Proof of Work difficulty
    }

    calculateHash(index, previousHash, timestamp, data, nonce) {
        return crypto
            .createHash('sha256')
            .update(index + previousHash + timestamp + JSON.stringify(data) + nonce)
            .digest('hex');
    }

    async getLatestBlock() {
        const result = await pool.query(
            "SELECT * FROM blockchain_ledger ORDER BY block_index DESC LIMIT 1"
        );
        return result.rows[0];
    }

    async getPropertyData(propertyId) {
        const result = await pool.query(
            `SELECT * FROM properties 
             WHERE property_id = $1 AND status = 'APPROVED'`,
            [propertyId]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    async mineBlock(propertyData, adminId) {
        const latestBlock = await this.getLatestBlock();
        const index = latestBlock ? latestBlock.block_index + 1 : 0;
        const previousHash = latestBlock ? latestBlock.blockchain_hash : "0";
        const timestamp = new Date().toISOString();
        let nonce = 0;
        let hash = '';

        console.log(`⛏️  Mining Block ${index}...`);
        
        const target = Array(this.difficulty + 1).join("0");
        const startTime = Date.now();
        
        while (true) {
            hash = this.calculateHash(index, previousHash, timestamp, propertyData, nonce);
            
            if (hash.substring(0, this.difficulty) === target) {
                const miningTime = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`✅ Block mined! Time: ${miningTime}s, Nonce: ${nonce}`);
                break;
            }
            nonce++;
        }

        const newBlock = await pool.query(
            `INSERT INTO blockchain_ledger 
            (block_index, property_id, transaction_data, previous_hash, 
             blockchain_hash, nonce, mined_by, mined_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
            RETURNING *`,
            [index, propertyData.property_id, JSON.stringify(propertyData), 
             previousHash, hash, nonce, adminId]
        );

        return newBlock.rows[0];
    }

    // ✅ FIXED: No type casting needed since mined_by is now VARCHAR
    async getFullChain() {
        const result = await pool.query(
            `SELECT 
                bl.*,
                u.name as miner_name
             FROM blockchain_ledger bl
             LEFT JOIN users u ON bl.mined_by = u.user_id
             ORDER BY bl.block_index DESC`
        );
        return result.rows;
    }

    async getPropertyHistory(propertyId) {
        const result = await pool.query(
            `SELECT 
                bl.*,
                u.name as miner_name
             FROM blockchain_ledger bl
             LEFT JOIN users u ON bl.mined_by = u.user_id
             WHERE bl.property_id = $1 
             ORDER BY bl.block_index ASC`,
            [propertyId]
        );
        return result.rows;
    }

    async verifyChain() {
        const chain = await pool.query(
            "SELECT * FROM blockchain_ledger ORDER BY block_index ASC"
        );

        if (chain.rows.length === 0) return true;

        for (let i = 1; i < chain.rows.length; i++) {
            const currentBlock = chain.rows[i];
            const previousBlock = chain.rows[i - 1];

            if (currentBlock.previous_hash !== previousBlock.blockchain_hash) {
                return false;
            }

            const calculatedHash = this.calculateHash(
                currentBlock.block_index,
                currentBlock.previous_hash,
                currentBlock.mined_at,
                currentBlock.transaction_data,
                currentBlock.nonce
            );

            if (calculatedHash !== currentBlock.blockchain_hash) {
                return false;
            }
        }

        return true;
    }

    async getBlockchainStats() {
        const totalBlocksResult = await pool.query(
            "SELECT COUNT(*) as total FROM blockchain_ledger"
        );

        const uniquePropertiesResult = await pool.query(
            "SELECT COUNT(DISTINCT property_id) as total FROM blockchain_ledger"
        );

        const latestBlock = await this.getLatestBlock();

        const topMinersResult = await pool.query(
            `SELECT 
                u.name as miner_name,
                bl.mined_by,
                COUNT(*) as blocks_mined
             FROM blockchain_ledger bl
             LEFT JOIN users u ON bl.mined_by = u.user_id
             GROUP BY bl.mined_by, u.name
             ORDER BY blocks_mined DESC
             LIMIT 10`
        );

        const isValid = await this.verifyChain();

        return {
            total_blocks: parseInt(totalBlocksResult.rows[0].total),
            unique_properties: parseInt(uniquePropertiesResult.rows[0].total),
            latest_block_index: latestBlock ? latestBlock.block_index : null,
            latest_block_hash: latestBlock ? latestBlock.blockchain_hash : null,
            blockchain_valid: isValid,
            difficulty_level: this.difficulty,
            top_miners: topMinersResult.rows
        };
    }

    async getBlockByIndex(blockIndex) {
        const result = await pool.query(
            `SELECT 
                bl.*,
                u.name as miner_name
             FROM blockchain_ledger bl
             LEFT JOIN users u ON bl.mined_by = u.user_id
             WHERE bl.block_index = $1`,
            [blockIndex]
        );
        return result.rows[0] || null;
    }
}

export default new BlockchainService();