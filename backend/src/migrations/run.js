import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  SQL_MIGRATIONS_DIR,
  createPool,
  parseCliArgs,
  ensureDirectory,
} from "../ops/runtime.js";

const pool = createPool();

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(64) NOT NULL,
      execution_ms INTEGER NOT NULL DEFAULT 0,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function discoverMigrationFiles() {
  await ensureDirectory(SQL_MIGRATIONS_DIR);
  const entries = await fs.readdir(SQL_MIGRATIONS_DIR, { withFileTypes: true });

  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) {
      continue;
    }
    const fullPath = path.join(SQL_MIGRATIONS_DIR, entry.name);
    const sql = await fs.readFile(fullPath, "utf8");
    files.push({
      filename: entry.name,
      fullPath,
      sql,
      checksum: sha256(sql),
    });
  }

  files.sort((a, b) => a.filename.localeCompare(b.filename));
  return files;
}

async function getAppliedMap(client) {
  const result = await client.query(`
    SELECT filename, checksum, execution_ms, applied_at
    FROM schema_migrations
    ORDER BY filename
  `);

  return new Map(result.rows.map((row) => [row.filename, row]));
}

function printStatusRows(rows) {
  if (rows.length === 0) {
    console.log("No SQL migrations found.");
    return;
  }

  console.log("");
  console.log("Migration Status");
  console.log("=".repeat(84));
  console.log("State       Filename                                      Applied At");
  console.log("-".repeat(84));
  for (const row of rows) {
    const state = row.state.padEnd(10, " ");
    const filename = row.filename.padEnd(44, " ");
    const appliedAt = row.appliedAt || "--";
    console.log(`${state} ${filename} ${appliedAt}`);
  }
  console.log("-".repeat(84));
  console.log("");
}

async function statusCommand(client) {
  await ensureMigrationTable(client);
  const files = await discoverMigrationFiles();
  const applied = await getAppliedMap(client);

  const rows = files.map((file) => {
    const appliedRow = applied.get(file.filename);
    if (!appliedRow) {
      return {
        filename: file.filename,
        state: "PENDING",
        appliedAt: null,
      };
    }

    if (appliedRow.checksum !== file.checksum) {
      return {
        filename: file.filename,
        state: "CHANGED",
        appliedAt: new Date(appliedRow.applied_at).toLocaleString(),
      };
    }

    return {
      filename: file.filename,
      state: "APPLIED",
      appliedAt: new Date(appliedRow.applied_at).toLocaleString(),
    };
  });

  printStatusRows(rows);
  const changed = rows.filter((row) => row.state === "CHANGED");
  if (changed.length > 0) {
    console.error("Changed migrations detected. Do not continue until the mismatch is reviewed.");
    process.exitCode = 1;
  }
}

async function upCommand(client) {
  await ensureMigrationTable(client);
  const files = await discoverMigrationFiles();
  const applied = await getAppliedMap(client);

  const changed = files.filter((file) => {
    const appliedRow = applied.get(file.filename);
    return appliedRow && appliedRow.checksum !== file.checksum;
  });

  if (changed.length > 0) {
    console.error("Migration checksum mismatch detected:");
    for (const item of changed) {
      console.error(` - ${item.filename}`);
    }
    process.exitCode = 1;
    return;
  }

  const pending = files.filter((file) => !applied.has(file.filename));
  if (pending.length === 0) {
    console.log("Database schema is already up to date.");
    return;
  }

  console.log(`Applying ${pending.length} migration(s)...`);

  for (const file of pending) {
    const startedAt = Date.now();
    console.log(`\n→ ${file.filename}`);
    await client.query("BEGIN");
    try {
      await client.query(file.sql);
      await client.query(
        `
          INSERT INTO schema_migrations (filename, checksum, execution_ms)
          VALUES ($1, $2, $3)
        `,
        [file.filename, file.checksum, Date.now() - startedAt]
      );
      await client.query("COMMIT");
      console.log(`  Applied in ${Date.now() - startedAt} ms`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`  Failed: ${error.message}`);
      throw error;
    }
  }

  console.log("\nAll pending migrations applied successfully.");
}

async function main() {
  const { positional } = parseCliArgs(process.argv.slice(2));
  const command = positional[0] || "up";
  const client = await pool.connect();

  try {
    if (command === "status") {
      await statusCommand(client);
    } else if (command === "up") {
      await upCommand(client);
    } else {
      throw new Error(`Unsupported migration command: ${command}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration runner failed:", error.message);
  process.exit(1);
});
