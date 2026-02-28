import crypto from "crypto";

import pool from "../config/db.js";
import blockchainService from "./blockchain.service.js";
import fabricGatewayService from "./fabricGateway.service.js";

const SNAPSHOT_KEYS = [
  "property_id",
  "owner_cnic",
  "father_name",
  "district",
  "tehsil",
  "mauza",
  "khewat_no",
  "khatooni_no",
  "khasra_no",
  "area_marla",
  "property_type",
];

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS property_registry_integrity (
    property_id VARCHAR(120) PRIMARY KEY,
    property_hash VARCHAR(128) NOT NULL,
    property_snapshot JSONB NOT NULL,
    chain_tx_id VARCHAR(180),
    chain_status VARCHAR(40),
    submitted_by_node VARCHAR(60),
    submitted_by_user_id VARCHAR(60),
    anchored_at TIMESTAMPTZ,
    finalized_tx_id VARCHAR(180),
    finalized_at TIMESTAMPTZ,
    last_verified_hash VARCHAR(128),
    last_verified_at TIMESTAMPTZ,
    integrity_status VARCHAR(40),
    tamper_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

function compactProperty(property = {}) {
  return SNAPSHOT_KEYS.reduce((acc, key) => {
    acc[key] = property[key] ?? null;
    return acc;
  }, {});
}

function hashSnapshot(snapshot) {
  return crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function normalizeProofSource(classification, hasFabricRecord, hasIntegrityRecord, hasRegCase, hasLegacyHistory) {
  if (classification === "APPROVED_ON_CHAIN" || classification === "TAMPERED") {
    return "Hyperledger Fabric";
  }
  if (hasIntegrityRecord) return "Local Integrity Mirror";
  if (hasRegCase) return "Registration Vote Mirror";
  if (hasLegacyHistory) return "Legacy Local Ledger";
  return "Database Only";
}

class PropertyRegistryIntegrityService {
  async ensureTables() {
    await pool.query(CREATE_TABLE_SQL);
  }

  buildPropertySnapshot(property) {
    return compactProperty(property);
  }

  hashPropertySnapshot(snapshot) {
    return hashSnapshot(snapshot);
  }

  async getIntegrityRecord(propertyId) {
    const result = await pool.query(
      "SELECT * FROM property_registry_integrity WHERE property_id = $1 LIMIT 1",
      [propertyId]
    );
    return result.rows[0] || null;
  }

  async getRegistrationCase(propertyId) {
    const result = await pool.query(
      "SELECT * FROM reg_blockchain_cases WHERE property_id = $1 LIMIT 1",
      [propertyId]
    );
    return result.rows[0] || null;
  }

  async getVotes(propertyId) {
    const result = await pool.query(
      `SELECT property_id, lro_node_id, lro_name, lro_user_id, vote, reason, tx_id, voted_at
       FROM reg_blockchain_votes
       WHERE property_id = $1
       ORDER BY voted_at DESC`,
      [propertyId]
    );
    return result.rows;
  }

  async getPropertyRow(propertyId) {
    const result = await pool.query(
      `SELECT
         property_id,
         owner_id,
         owner_name,
         owner_cnic,
         father_name,
         district,
         tehsil,
         mauza,
         khewat_no,
         khatooni_no,
         khasra_no,
         area_marla,
         property_type,
         status,
         created_at,
         updated_at
       FROM properties
       WHERE property_id = $1
       LIMIT 1`,
      [propertyId]
    );

    return result.rows[0] || null;
  }

  async verifyProperty(propertyId) {
    await this.ensureTables();

    const property = await this.getPropertyRow(propertyId);
    if (!property) return null;

    const [integrity, regCase, votes, legacyChainHistory, fabricRecord] = await Promise.all([
      this.getIntegrityRecord(propertyId),
      this.getRegistrationCase(propertyId),
      this.getVotes(propertyId),
      blockchainService.getPropertyHistory(propertyId),
      fabricGatewayService.queryLandRecord(propertyId).catch(() => null),
    ]);

    const snapshot = this.buildPropertySnapshot(property);
    const currentHash = this.hashPropertySnapshot(snapshot);

    let classification = "NOT_ANCHORED";
    let tamperReason = null;
    const fabricFound = fabricGatewayService.isRecordFound(fabricRecord);
    const fabricHash = fabricGatewayService.extractRecordHash(fabricRecord);

    if (fabricFound) {
      classification = "APPROVED_ON_CHAIN";

      if (fabricHash && fabricHash !== currentHash) {
        classification = "TAMPERED";
        tamperReason = "Current property snapshot does not match the hash resolved from Hyperledger Fabric";
      } else if (integrity?.property_hash && integrity.property_hash !== currentHash && !fabricHash) {
        // When Fabric confirms the record exists but the legacy local mirror hash is stale,
        // treat the stale mirror as secondary evidence instead of a tamper source.
        classification = "APPROVED_ON_CHAIN";
      }
    } else if (integrity) {
      if (integrity.property_hash && integrity.property_hash !== currentHash) {
        classification = "TAMPERED";
        tamperReason = integrity.tamper_reason || "Hash mismatch against current property snapshot";
      } else if (integrity.integrity_status === "TAMPERED") {
        classification = "TAMPERED";
        tamperReason = integrity.tamper_reason || "Integrity mirror flagged this property as tampered";
      } else {
        classification = "LOCAL_MIRROR_ONLY";
      }
    } else if (regCase) {
      classification = "LOCAL_MIRROR_ONLY";
    } else if (legacyChainHistory.length > 0) {
      classification = "LEGACY_ONLY";
    }

    const proofSource = normalizeProofSource(
      classification,
      fabricFound,
      Boolean(integrity),
      Boolean(regCase),
      legacyChainHistory.length > 0
    );

    return {
      property,
      snapshot,
      currentHash,
      integrity,
      regCase,
      votes,
      chainHistory: legacyChainHistory,
      fabricRecord,
      classification,
      proofSource,
      tamperDetected: classification === "TAMPERED",
      tamperReason,
    };
  }

  async listRecords() {
    await this.ensureTables();

    const result = await pool.query(
      `SELECT property_id
       FROM properties
       ORDER BY COALESCE(updated_at, created_at) DESC`
    );

    return Promise.all(
      result.rows.map((row) => this.verifyProperty(row.property_id))
    );
  }

  async getSummary() {
    const records = (await this.listRecords()).filter(Boolean);

    return {
      scannedRecords: records.length,
      approvedOnChain: records.filter((item) => item.classification === "APPROVED_ON_CHAIN").length,
      clean: records.filter((item) => item.classification === "APPROVED_ON_CHAIN").length,
      tampered: records.filter((item) => item.classification === "TAMPERED").length,
      localMirrorOnly: records.filter((item) => item.classification === "LOCAL_MIRROR_ONLY").length,
      notAnchored: records.filter((item) => item.classification === "NOT_ANCHORED").length,
      legacyOnly: records.filter((item) => item.classification === "LEGACY_ONLY").length,
    };
  }
}

export default new PropertyRegistryIntegrityService();
