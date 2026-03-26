import express from 'express';
import { testFabricConnection, fabricQuery } from '../services/fabricPLRA.service.js';
import pool from '../config/db.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    // PostgreSQL blockchain tables check
    const [cases, blocks, votes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM reg_blockchain_cases'),
      pool.query('SELECT COUNT(*) FROM reg_blockchain_ledger'),
      pool.query('SELECT COUNT(*) FROM reg_blockchain_votes'),
    ]);

    // Fabric connection check
    let fabricStatus = { connected: false };
    if (process.env.FABRIC_ENABLED === 'true') {
      fabricStatus = await testFabricConnection();
    }

    // Latest blocks
    const latestBlocks = await pool.query(
      'SELECT block_index, property_id, block_type, block_hash, created_at FROM reg_blockchain_ledger ORDER BY block_index DESC LIMIT 5'
    );

    // Node status
    const nodes = [
      { id: 'LRO_NODE_1', city: 'Lahore',     port: 7051  },
      { id: 'LRO_NODE_2', city: 'Rawalpindi', port: 8051  },
      { id: 'LRO_NODE_3', city: 'Faisalabad', port: 9051  },
      { id: 'LRO_NODE_4', city: 'Multan',     port: 20051 },
      { id: 'LRO_NODE_5', city: 'Gujranwala', port: 11051 },
    ];

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      blockchain: {
        type: 'Hyperledger Fabric + PostgreSQL',
        consensus: 'Proof of Authority (PoA)',
        channel: 'plra-channel',
        chaincode: 'land-registry',
        requiredVotes: 3,
        totalNodes: 5,
      },
      fabric: {
        enabled: process.env.FABRIC_ENABLED === 'true',
        ...fabricStatus,
      },
      postgresql: {
        connected: true,
        totalCases:  parseInt(cases.rows[0].count),
        totalBlocks: parseInt(blocks.rows[0].count),
        totalVotes:  parseInt(votes.rows[0].count),
      },
      nodes,
      latestBlocks: latestBlocks.rows,
    });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
