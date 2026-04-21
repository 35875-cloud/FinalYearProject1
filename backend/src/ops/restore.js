import fs from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";
import {
  BACKUP_ROOT,
  createPool,
  ensureDirectory,
  fileExists,
  getDbConfig,
  getPublicTablesInDependencyOrder,
  parseCliArgs,
  quoteIdentifier,
  backupTimestamp,
} from "./runtime.js";

const pool = createPool();

function findBinary(binaryName, overridePath) {
  const candidates = [];
  if (overridePath) candidates.push(overridePath);
  candidates.push(binaryName);

  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ["--version"], {
        encoding: "utf8",
        stdio: "pipe",
      });
      if (result.status === 0) {
        return candidate;
      }
    } catch {
      // Keep trying candidates.
    }
  }

  return null;
}

async function tableExists(client, tableName) {
  const result = await client.query(`SELECT to_regclass($1) AS name`, [`public.${tableName}`]);
  return Boolean(result.rows[0]?.name);
}

async function recordRestore(client, payload) {
  if (!(await tableExists(client, "system_restore_runs"))) {
    return;
  }

  await client.query(
    `
      INSERT INTO system_restore_runs (
        restore_id, backup_id, restore_mode, status,
        source_path, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      payload.restoreId,
      payload.backupId,
      payload.restoreMode,
      payload.status,
      payload.sourcePath,
      JSON.stringify(payload.metadata || {}),
    ]
  );
}

async function resolveManifest(backupArgument) {
  if (!backupArgument) {
    throw new Error("Provide a backup directory or backup id with --backup=<id>");
  }

  const directPath = path.resolve(backupArgument);
  const backupDir = path.isAbsolute(backupArgument)
    ? directPath
    : path.join(BACKUP_ROOT, backupArgument);

  const manifestPath = backupArgument.endsWith(".json")
    ? directPath
    : path.join(backupDir, "manifest.json");

  if (!(await fileExists(manifestPath))) {
    throw new Error(`Backup manifest not found: ${manifestPath}`);
  }

  const raw = await fs.readFile(manifestPath, "utf8");
  return {
    manifestPath,
    backupDir: path.dirname(manifestPath),
    manifest: JSON.parse(raw),
  };
}

async function resetSequences(client, tableName) {
  const serialColumns = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_default LIKE 'nextval(%'
    `,
    [tableName]
  );

  for (const row of serialColumns.rows) {
    const columnName = row.column_name;
    await client.query(
      `
        SELECT setval(
          pg_get_serial_sequence($1, $2),
          COALESCE((SELECT MAX(${quoteIdentifier(columnName)}) FROM ${quoteIdentifier(tableName)}), 1),
          COALESCE((SELECT MAX(${quoteIdentifier(columnName)}) IS NOT NULL FROM ${quoteIdentifier(tableName)}), FALSE)
        )
      `,
      [`public.${tableName}`, columnName]
    );
  }
}

async function restoreJsonSnapshot(client, snapshotPath) {
  const raw = await fs.readFile(snapshotPath, "utf8");
  const snapshot = JSON.parse(raw);
  const snapshotTables = Array.isArray(snapshot.tables) ? snapshot.tables : [];

  if (snapshotTables.length === 0) {
    throw new Error("Snapshot contains no tables.");
  }

  const availableTables = new Set(await getPublicTablesInDependencyOrder(client));
  const tablesToRestore = snapshotTables.filter((table) => availableTables.has(table.name));

  if (tablesToRestore.length === 0) {
    throw new Error("None of the snapshot tables exist in the current database.");
  }

  await client.query("BEGIN");
  try {
    await client.query(
      `TRUNCATE TABLE ${tablesToRestore.map((table) => quoteIdentifier(table.name)).join(", ")} RESTART IDENTITY CASCADE`
    );

    for (const table of tablesToRestore) {
      if (!Array.isArray(table.rows) || table.rows.length === 0) {
        continue;
      }

      const columns = Array.isArray(table.columns) ? table.columns : Object.keys(table.rows[0] || {});
      const columnList = columns.map((column) => quoteIdentifier(column)).join(", ");
      const placeholderList = columns.map((_, index) => `$${index + 1}`).join(", ");

      for (const row of table.rows) {
        const values = columns.map((column) => (row[column] === undefined ? null : row[column]));
        await client.query(
          `INSERT INTO ${quoteIdentifier(table.name)} (${columnList}) VALUES (${placeholderList})`,
          values
        );
      }

      await resetSequences(client, table.name);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function restoreSqlDump(sqlPath) {
  const psqlBinary = findBinary("psql", process.env.PSQL_PATH);
  if (!psqlBinary) {
    throw new Error("psql was not found. Install PostgreSQL client tools or restore from a JSON snapshot backup.");
  }

  const db = getDbConfig();
  const args = [
    "--host",
    db.host,
    "--port",
    String(db.port),
    "--username",
    db.user,
    "--dbname",
    db.database,
    "--file",
    sqlPath,
  ];

  const result = spawnSync(psqlBinary, args, {
    env: {
      ...process.env,
      PGPASSWORD: db.password,
    },
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "psql restore failed");
  }
}

async function restoreBackup(backupArgument) {
  await ensureDirectory(BACKUP_ROOT);
  const { manifest, manifestPath, backupDir } = await resolveManifest(backupArgument);
  const client = await pool.connect();
  const restoreId = `restore-${backupTimestamp()}`;

  try {
    const mode = manifest?.database?.mode;
    if (!mode) {
      throw new Error("Backup manifest does not describe the database mode.");
    }

    if (mode === "json_snapshot") {
      const snapshotPath = manifest.database.snapshotPath || path.join(backupDir, "database.snapshot.json");
      await restoreJsonSnapshot(client, snapshotPath);
    } else if (mode === "pg_dump_sql") {
      const sqlPath = manifest.database.sqlDumpPath || path.join(backupDir, "database.sql");
      restoreSqlDump(sqlPath);
    } else {
      throw new Error(`Unsupported backup mode: ${mode}`);
    }

    await recordRestore(client, {
      restoreId,
      backupId: manifest.backupId || null,
      restoreMode: mode,
      status: "COMPLETED",
      sourcePath: manifestPath,
      metadata: {
        backupDir,
        restoredAt: new Date().toISOString(),
      },
    });

    console.log(`Restore completed from ${manifest.backupId || backupDir}`);
  } finally {
    client.release();
  }
}

async function main() {
  const { positional, options } = parseCliArgs(process.argv.slice(2));
  const backupArgument = options.backup || positional[0];

  try {
    await restoreBackup(backupArgument);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Restore command failed:", error.message);
  process.exit(1);
});
