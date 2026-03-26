import fabricGatewayPkg from '@hyperledger/fabric-gateway';
const { connect, signers } = fabricGatewayPkg;
import grpcPkg from '@grpc/grpc-js';
const grpc = grpcPkg;
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// ═══════════════════════════════════════════════════════════════════
//  Punjab Land Registry — Fabric Gateway Service
//
//  Connects backend to Hyperledger Fabric peer.
//  Used by: websocket.service.js (after both_agreed)
//           blockchain.routes.js (verify / query endpoints)
//
//  ENV VARS required:
//    FABRIC_CHANNEL_NAME   default: land-registry-channel
//    FABRIC_CHAINCODE_NAME default: land-agreement
//    FABRIC_MSP_ID         default: PunjabLandMSP
//    FABRIC_PEER_ENDPOINT  default: localhost:7051
//    FABRIC_PEER_HOST_ALIAS default: peer0.punjabland.example.com
//    FABRIC_TLS_CERT_PATH  path to peer TLS cert
//    FABRIC_CERT_PATH      path to user identity cert
//    FABRIC_KEY_PATH       path to user identity private key
// ═══════════════════════════════════════════════════════════════════

const CHANNEL_NAME   = process.env.FABRIC_CHANNEL_NAME   || 'land-registry-channel';
const CHAINCODE_NAME = process.env.FABRIC_CHAINCODE_NAME || 'land-agreement';
const MSP_ID         = process.env.FABRIC_MSP_ID         || 'PunjabLandMSP';
const PEER_ENDPOINT  = process.env.FABRIC_PEER_ENDPOINT  || 'localhost:7051';
const PEER_ALIAS     = process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.punjabland.example.com';

// Default paths for dev (test-network layout)
const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const CRYPTO_PATH = process.env.FABRIC_CRYPTO_PATH ||
  path.resolve(__dirname, '..', '..', 'network', 'crypto-config');

const TLS_CERT = process.env.FABRIC_TLS_CERT_PATH ||
  path.join(CRYPTO_PATH, 'peerOrganizations', 'punjabland.example.com',
    'peers', 'peer0.punjabland.example.com', 'tls', 'ca.crt');

const CERT_PATH = process.env.FABRIC_CERT_PATH ||
  path.join(CRYPTO_PATH, 'peerOrganizations', 'punjabland.example.com',
    'users', 'Admin@punjabland.example.com', 'msp', 'signcerts', 'cert.pem');

const KEY_PATH = process.env.FABRIC_KEY_PATH ||
  path.join(CRYPTO_PATH, 'peerOrganizations', 'punjabland.example.com',
    'users', 'Admin@punjabland.example.com', 'msp', 'keystore', 'priv_sk');

// ── Module-level connection (reuse across requests) ───────────────
let _gateway   = null;
let _client    = null;
let _network   = null;
let _contract  = null;

// ─────────────────────────────────────────────────────────────────
// CONNECT  — fabric-gateway v1 API (connect() function, not new Gateway())
// ─────────────────────────────────────────────────────────────────
async function getContract() {
  if (_contract) return _contract;   // reuse existing connection

  try {
    const tlsCertPem = await fs.readFile(TLS_CERT);
    const certPem    = await fs.readFile(CERT_PATH);
    const keyPem     = await fs.readFile(KEY_PATH);

    // 1. gRPC channel to peer
    const tlsCredentials = grpc.credentials.createSsl(tlsCertPem);
    _client = new grpc.Client(PEER_ENDPOINT, tlsCredentials, {
      'grpc.ssl_target_name_override': PEER_ALIAS,
    });

    // 2. Identity + signer
    const privateKey = crypto.createPrivateKey(keyPem);
    const identity   = { mspId: MSP_ID, credentials: certPem };
    const signer     = signers.newPrivateKeySigner(privateKey);

    // 3. Gateway (v1 API uses connect() function, not new Gateway())
    _gateway = connect({
      client: _client,
      identity,
      signer,
      evaluateOptions:     () => ({ deadline: Date.now() + 5000  }),
      endorseOptions:      () => ({ deadline: Date.now() + 15000 }),
      submitOptions:       () => ({ deadline: Date.now() + 5000  }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });

    _network  = _gateway.getNetwork(CHANNEL_NAME);
    _contract = _network.getContract(CHAINCODE_NAME);

    console.log(`✅ Fabric connected: channel=${CHANNEL_NAME} chaincode=${CHAINCODE_NAME}`);
    return _contract;

  } catch (err) {
    console.error('❌ Fabric connection failed:', err.message);
    _gateway = _client = _network = _contract = null;
    throw err;
  }
}

function disconnect() {
  try { _gateway?.close(); } catch (_) {}
  try { _client?.close();  } catch (_) {}
  _gateway = _client = _network = _contract = null;
}

// ─────────────────────────────────────────────────────────────────
// RECORD AGREEMENT ON CHAIN
// Called from websocket.service.js after both parties agree and
// SHA-256 hash is generated.
// ─────────────────────────────────────────────────────────────────
async function recordAgreementOnChain({
  channelId, transferId, propertyId,
  sellerId, buyerId,
  agreedPrice, agreementHash, timestamp
}) {
  try {
    const contract = await getContract();

    const resultBytes = await contract.submitTransaction(
      'recordAgreement',
      String(channelId),
      String(transferId || ''),
      String(propertyId || ''),
      String(sellerId),
      String(buyerId),
      String(agreedPrice),
      String(agreementHash),
      String(timestamp || new Date().toISOString())
    );

    const result = JSON.parse(resultBytes.toString());
    console.log(`⛓️  Agreement anchored: channel=${channelId} txId=${result.txId}`);
    return { success: true, txId: result.txId, agreementHash };

  } catch (err) {
    // Fabric unavailable → log but don't crash the main flow
    // The agreement is still recorded in PostgreSQL with the hash.
    // Blockchain anchoring can be retried via /api/blockchain/retry-anchor
    console.error('❌ Fabric recordAgreement failed:', err.message);
    return { success: false, error: err.message, agreementHash };
  }
}

// ─────────────────────────────────────────────────────────────────
// VERIFY HASH — TAMPER DETECTION
// Pass the hash stored in your PostgreSQL DB.
// If the DB was tampered, hashes won't match.
// ─────────────────────────────────────────────────────────────────
async function verifyAgreementHash(channelId, hashFromDB) {
  try {
    const contract = await getContract();

    const resultBytes = await contract.evaluateTransaction(
      'verifyAgreement',
      String(channelId),
      String(hashFromDB)
    );

    return JSON.parse(resultBytes.toString());

  } catch (err) {
    console.error('❌ Fabric verifyAgreement failed:', err.message);
    return { verified: false, error: err.message, channelId };
  }
}

// ─────────────────────────────────────────────────────────────────
// GET AGREEMENT FROM CHAIN
// ─────────────────────────────────────────────────────────────────
async function getAgreementFromChain(channelId) {
  try {
    const contract    = await getContract();
    const resultBytes = await contract.evaluateTransaction('getAgreement', String(channelId));
    return JSON.parse(resultBytes.toString());
  } catch (err) {
    return { found: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────
// GET FULL AUDIT TRAIL
// ─────────────────────────────────────────────────────────────────
async function getAgreementHistory(channelId) {
  try {
    const contract    = await getContract();
    const resultBytes = await contract.evaluateTransaction('getAgreementHistory', String(channelId));
    return JSON.parse(resultBytes.toString());
  } catch (err) {
    return { channelId, history: [], error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────
// SUBMIT FOR LRO VERIFICATION (PoA)
// ─────────────────────────────────────────────────────────────────
async function submitForLROVerification(channelId, lroOfficerId) {
  try {
    const contract    = await getContract();
    const resultBytes = await contract.submitTransaction(
      'submitForLROVerification', String(channelId), String(lroOfficerId)
    );
    return JSON.parse(resultBytes.toString());
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────
// CAST POA VOTE
// nodeId: 'LRO_NODE_1' ... 'LRO_NODE_5'
// vote:   'APPROVE' | 'REJECT'
// ─────────────────────────────────────────────────────────────────
async function castPoAVote(channelId, nodeId, vote, reason) {
  try {
    const contract    = await getContract();
    const resultBytes = await contract.submitTransaction(
      'castPoAVote', String(channelId), String(nodeId), String(vote), String(reason || '')
    );
    return JSON.parse(resultBytes.toString());
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────
// EXECUTE TRANSFER (after PoA approval)
// ─────────────────────────────────────────────────────────────────
async function executeTransfer(channelId, executedBy) {
  try {
    const contract    = await getContract();
    const resultBytes = await contract.submitTransaction(
      'executeTransfer', String(channelId), String(executedBy)
    );
    return JSON.parse(resultBytes.toString());
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────
// BATCH TAMPER SCAN
// Checks all transfer_requests that have agreement_hash and
// compares each against the chain. Returns mismatches.
// ─────────────────────────────────────────────────────────────────
async function batchTamperScan(dbRows) {
  // dbRows: [{ channel_id, agreement_hash, ... }]
  const results = await Promise.all(
    dbRows.map(async (row) => {
      const result = await verifyAgreementHash(row.channel_id, row.agreement_hash);
      return {
        channelId:   row.channel_id,
        dbHash:      row.agreement_hash,
        chainHash:   result.chainHash,
        verified:    result.verified,
        tampered:    result.tampered || false,
        error:       result.error || null,
      };
    })
  );

  const tampered = results.filter(r => r.tampered);
  const errors   = results.filter(r => r.error && !r.tampered);

  return {
    scanned:  results.length,
    clean:    results.filter(r => r.verified).length,
    tampered: tampered.length,
    errors:   errors.length,
    details:  results,
    tamperedRecords: tampered,
  };
}

export default {
  disconnect,
  recordAgreementOnChain,
  verifyAgreementHash,
  getAgreementFromChain,
  getAgreementHistory,
  submitForLROVerification,
  castPoAVote,
  executeTransfer,
  batchTamperScan,
};