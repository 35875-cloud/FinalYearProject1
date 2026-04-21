import pool from "../config/db.js";
import blockchainService from "../services/blockchain.service.js";
import propertyRegistryIntegrityService from "../services/propertyRegistryIntegrity.service.js";

async function getLandRecordSummary(req, res) {
  try {
    const [pending, approved, rejected, blockchainSummary] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM properties WHERE status = 'PENDING'"),
      pool.query("SELECT COUNT(*)::int AS count FROM properties WHERE status = 'APPROVED'"),
      pool.query("SELECT COUNT(*)::int AS count FROM properties WHERE status = 'REJECTED'"),
      propertyRegistryIntegrityService.getSummary(),
    ]);

    return res.json({
      success: true,
      summary: {
        pending: pending.rows[0].count,
        approved: approved.rows[0].count,
        rejected: rejected.rows[0].count,
        blockchain: blockchainSummary,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function listPendingLandRecords(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         property_id,
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
       WHERE status = 'PENDING'
       ORDER BY created_at DESC`
    );

    return res.json({
      success: true,
      records: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function listApprovedLandRecords(req, res) {
  try {
    const result = await pool.query(
      `SELECT property_id
       FROM properties
       WHERE status = 'APPROVED'
       ORDER BY COALESCE(updated_at, created_at) DESC`
    );

    const records = await Promise.all(
      result.rows.map((row) => propertyRegistryIntegrityService.verifyProperty(row.property_id))
    );

    return res.json({
      success: true,
      records: records.filter(Boolean),
      total: records.filter(Boolean).length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getLandRecordById(req, res) {
  try {
    const { propertyId } = req.params;

    const [integrity, history] = await Promise.all([
      propertyRegistryIntegrityService.verifyProperty(propertyId),
      blockchainService.getPropertyHistory(propertyId),
    ]);

    if (!integrity) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    return res.json({
      success: true,
      record: integrity,
      history,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export {
  getLandRecordSummary,
  listPendingLandRecords,
  listApprovedLandRecords,
  getLandRecordById,
};

export default {
  getLandRecordSummary,
  listPendingLandRecords,
  listApprovedLandRecords,
  getLandRecordById,
};
