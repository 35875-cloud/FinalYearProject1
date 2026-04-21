import fs from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import {
  BACKEND_ROOT,
  BACKUP_ROOT,
  backupTimestamp,
  createPool,
  ensureDirectory,
  fileExists,
  getDbConfig,
  getFabricContext,
  getPublicTablesInDependencyOrder,
  parseCliArgs,
  quoteIdentifier,
  slugify,
} from "./runtime.js";

const pool = createPool();
const __filename = fileURLToPath(import.meta.url);

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
      // Keep checking candidates.
    }
  }

  return null;
}

async function tableExists(client, tableName) {
  const result = await client.query(`SELECT to_regclass($1) AS name`, [`public.${tableName}`]);
  return Boolean(result.rows[0]?.name);
}

async function recordBackup(client, payload) {
  if (!(await tableExists(client, "system_backups"))) {
    return;
  }

  await client.query(
    `
      INSERT INTO system_backups (
        backup_id, label, backup_mode, status,
        backup_path, manifest_path, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (backup_id) DO UPDATE
      SET label = EXCLUDED.label,
          backup_mode = EXCLUDED.backup_mode,
          status = EXCLUDED.status,
          backup_path = EXCLUDED.backup_path,
          manifest_path = EXCLUDED.manifest_path,
          metadata = EXCLUDED.metadata
    `,
    [
      payload.backupId,
      payload.label,
      payload.backupMode,
      payload.status,
      payload.backupPath,
      payload.manifestPath,
      JSON.stringify(payload.metadata || {}),
    ]
  );
}

async function copyFabricReferences(targetDir) {
  const fabricDir = path.join(targetDir, "fabric");
  await ensureDirectory(fabricDir);

  const fabricContext = getFabricContext();
  const candidates = [
    fabricContext.connectionProfile,
    "./connection-plra.json",
    "./connection.json",
  ];

  const copiedFiles = [];

  for (const relativeFile of candidates) {
    const absoluteFile = path.resolve(BACKEND_ROOT, relativeFile);
    if (!(await fileExists(absoluteFile))) {
      continue;
    }

    const targetFile = path.join(fabricDir, path.basename(absoluteFile));
    await fs.copyFile(absoluteFile, targetFile);
    copiedFiles.push({
      source: absoluteFile,
      backupCopy: targetFile,
    });
  }

  const contextFile = path.join(fabricDir, "fabric-context.json");
  await fs.writeFile(
    contextFile,
    JSON.stringify(
      {
        ...fabricContext,
        copiedFiles,
      },
      null,
      2
    ),
    "utf8"
  );

  return { ...fabricContext, copiedFiles, contextFile };
}

async function createJsonSnapshot(client, outputDir) {
  const snapshotPath = path.join(outputDir, "database.snapshot.json");
  const orderedTables = await getPublicTablesInDependencyOrder(client);
  const tables = [];

  for (const tableName of orderedTables) {
    const columnsResult = await client.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `,
      [tableName]
    );

    const columns = columnsResult.rows.map((row) => row.column_name);
    const rowsResult = await client.query(`SELECT * FROM ${quoteIdentifier(tableName)}`);

    tables.push({
      name: tableName,
      columns,
      rowCount: rowsResult.rows.length,
      rows: rowsResult.rows,
    });
  }

  await fs.writeFile(
    snapshotPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        tables,
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    mode: "json_snapshot",
    snapshotPath,
    tableCount: tables.length,
    totalRows: tables.reduce((sum, table) => sum + table.rowCount, 0),
  };
}

function runPgDump(outputDir) {
  const pgDumpBinary = findBinary("pg_dump", process.env.PG_DUMP_PATH);
  if (!pgDumpBinary) {
    return null;
  }

  const db = getDbConfig();
  const dumpPath = path.join(outputDir, "database.sql");
  const args = [
    "--file",
    dumpPath,
    "--format",
    "p",
    "--no-owner",
    "--no-privileges",
    "--host",
    db.host,
    "--port",
    String(db.port),
    "--username",
    db.user,
    db.database,
  ];

  const result = spawnSync(pgDumpBinary, args, {
    env: {
      ...process.env,
      PGPASSWORD: db.password,
    },
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    return {
      failed: true,
      error: result.stderr || result.stdout || "pg_dump failed",
    };
  }

  return {
    failed: false,
    mode: "pg_dump_sql",
    sqlDumpPath: dumpPath,
    binary: pgDumpBinary,
  };
}

export async function createBackup(options = {}) {
  const label = options.label ? slugify(options.label) : "";
  const backupId = `${backupTimestamp()}${label ? `-${label}` : ""}`;
  const backupDir = path.join(BACKUP_ROOT, backupId);
  await ensureDirectory(backupDir);

  const client = await pool.connect();
  try {
    const preferredMode = String(options.mode || "auto").toLowerCase();

    let databaseBackup = null;
    if (preferredMode !== "json") {
      const sqlDump = runPgDump(backupDir);
      if (sqlDump && !sqlDump.failed) {
        databaseBackup = sqlDump;
      } else if (sqlDump?.failed && preferredMode === "sql") {
        throw new Error(sqlDump.error);
      }
    }

    if (!databaseBackup) {
      databaseBackup = await createJsonSnapshot(client, backupDir);
    }

    const fabric = await copyFabricReferences(backupDir);
    const manifestPath = path.join(backupDir, "manifest.json");
    const manifest = {
      backupId,
      label: options.label || null,
      createdAt: new Date().toISOString(),
      backupDir,
      database: databaseBackup,
      fabric,
      db: {
        ...getDbConfig(),
        password: dbPasswordHidden(getDbConfig().password),
      },
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    await recordBackup(client, {
      backupId,
      label: options.label || null,
      backupMode: databaseBackup.mode,
      status: "CREATED",
      backupPath: backupDir,
      manifestPath,
      metadata: {
        database: databaseBackup,
        fabric: {
          channel: fabric.channel,
          votingChaincode: fabric.votingChaincode,
          agreementChaincode: fabric.agreementChaincode,
          copiedFiles: fabric.copiedFiles,
        },
      },
    });

    console.log(`Backup created: ${backupId}`);
    console.log(`Location: ${backupDir}`);
    console.log(`Database mode: ${databaseBackup.mode}`);
  } finally {
    client.release();
  }
}

function dbPasswordHidden(password) {
  if (!password) return null;
  return "*".repeat(Math.min(String(password).length, 8));
}

export async function listBackups() {
  await ensureDirectory(BACKUP_ROOT);
  const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true });
  const manifests = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(BACKUP_ROOT, entry.name, "manifest.json");
    if (!(await fileExists(manifestPath))) continue;
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    manifests.push(parsed);
  }

  manifests.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  if (manifests.length === 0) {
    console.log("No backups found.");
    return;
  }

  console.log("");
  console.log("Available Backups");
  console.log("=".repeat(96));
  console.log("Backup ID                              Mode            Created At");
  console.log("-".repeat(96));
  for (const manifest of manifests) {
    const backupId = String(manifest.backupId || "").padEnd(38, " ");
    const mode = String(manifest.database?.mode || "--").padEnd(15, " ");
    const createdAt = new Date(manifest.createdAt).toLocaleString();
    console.log(`${backupId} ${mode} ${createdAt}`);
  }
  console.log("-".repeat(96));
  console.log("");
}

async function main() {
  const { positional, options } = parseCliArgs(process.argv.slice(2));
  const command = positional[0] || "create";

  try {
    if (command === "create") {
      await createBackup(options);
    } else if (command === "list") {
      await listBackups();
    } else {
      throw new Error(`Unsupported backup command: ${command}`);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error("Backup command failed:", error.message);
    process.exit(1);
  });
}
