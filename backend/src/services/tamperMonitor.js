import pool from '../config/db.js';
import crypto from 'crypto';

function sha256(data) {
  return crypto.createHash('sha256').update(
    typeof data === 'string' ? data : JSON.stringify(data)
  ).digest('hex');
}

function buildPropertyHash(prop) {
  return sha256(JSON.stringify({
    property_id: prop.property_id,
    owner_cnic: prop.owner_cnic,
    father_name: prop.father_name,
    khewat_no: prop.khewat_no || prop.fard_no,
    khasra_no: prop.khasra_no,
    khatooni_no: prop.khatooni_no,
    area_marla: prop.area_marla,
    district: prop.district,
    tehsil: prop.tehsil,
    mauza: prop.mauza,
    property_type: prop.property_type,
  }));
}

async function runTamperScan() {
  try {
    const cases = await pool.query(`
      SELECT bc.property_id, bc.property_hash, bc.status
      FROM reg_blockchain_cases bc
      WHERE bc.status IN ('VOTING','LRO_APPROVED','FINALIZED')
    `);

    let clean = 0, tampered = 0;

    for (const bc of cases.rows) {
      const propRow = await pool.query(
        'SELECT * FROM properties WHERE property_id=$1', [bc.property_id]
      );
      if (propRow.rows.length === 0) continue;

      const currentHash = buildPropertyHash(propRow.rows[0]);

      if (currentHash !== bc.property_hash) {
        tampered++;
        console.error(`\n${'='.repeat(60)}`);
        console.error(`TAMPER DETECTED — Property: ${bc.property_id}`);
        console.error(`   Original Hash: ${bc.property_hash}`);
        console.error(`   Current Hash:  ${currentHash}`);
        console.error(`   Status: ${bc.status}`);
        console.error(`   Time: ${new Date().toLocaleString()}`);
        console.error(`${'='.repeat(60)}\n`);

        await pool.query(`
          INSERT INTO reg_blockchain_audit (property_id, event_type, actor, event_data)
          VALUES ($1, 'AUTO_TAMPER_DETECTED', 'SYSTEM', $2)
        `, [bc.property_id, JSON.stringify({
          originalHash: bc.property_hash,
          currentHash,
          detectedAt: new Date()
        })]);

        await pool.query(`
          UPDATE properties SET status='rejected', rejection_reason='BLOCKCHAIN TAMPER DETECTED - Data modified after blockchain submission'
          WHERE property_id=$1 AND status != 'TAMPERED_BLOCKED'
        `, [bc.property_id]);

      } else {
        clean++;
      }
    }

    if (tampered > 0) {
      console.error(`SCAN COMPLETE — ${tampered} TAMPERED, ${clean} clean`);
    } else {
      console.log(`✅ Auto tamper scan — all ${clean} properties CLEAN [${new Date().toLocaleTimeString()}]`);
    }

  } catch (e) {
    console.error('Tamper monitor error:', e.message);
  }
}

export function startTamperMonitor() {
  console.log('Tamper monitor started — scanning every 60 seconds');
  runTamperScan();
  setInterval(runTamperScan, 60 * 1000);
}
