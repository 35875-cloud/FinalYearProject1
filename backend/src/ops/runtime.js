import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
export const PROJECT_ROOT = path.resolve(BACKEND_ROOT, "..");
export const BACKUP_ROOT = path.join(BACKEND_ROOT, "backups");
export const SQL_MIGRATIONS_DIR = path.join(BACKEND_ROOT, "src", "migrations", "sql");

dotenv.config({ path: path.join(BACKEND_ROOT, ".env") });

export function getDbConfig() {
  return {
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "landdb",
    password: process.env.DB_PASSWORD || "",
    port: Number(process.env.DB_PORT || 5432),
  };
}

export function createPool() {
  return new Pool(getDbConfig());
}

export async function withClient(callback) {
  const pool = createPool();
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
    await pool.end();
  }
}

export function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function backupTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function parseCliArgs(argv = []) {
  const positional = [];
  const options = {};

  for (const token of argv) {
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const normalized = token.slice(2);
    const [rawKey, ...rest] = normalized.split("=");
    const key = rawKey.trim();
    const value = rest.length ? rest.join("=") : true;
    options[key] = value;
  }

  return { positional, options };
}

export async function getPublicTables(client) {
  const result = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  return result.rows.map((row) => row.tablename);
}

export async function getPublicTablesInDependencyOrder(client) {
  const tables = await getPublicTables(client);
  const edgesResult = await client.query(`
    SELECT
      tc.table_name AS child_table,
      ccu.table_name AS parent_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public'
  `);

  const dependencies = new Map();
  const dependents = new Map();
  const inDegree = new Map();

  for (const table of tables) {
    dependencies.set(table, new Set());
    dependents.set(table, new Set());
    inDegree.set(table, 0);
  }

  for (const row of edgesResult.rows) {
    const child = row.child_table;
    const parent = row.parent_table;
    if (!dependencies.has(child) || !dependencies.has(parent) || child === parent) {
      continue;
    }
    if (dependencies.get(child).has(parent)) {
      continue;
    }
    dependencies.get(child).add(parent);
    dependents.get(parent).add(child);
    inDegree.set(child, (inDegree.get(child) || 0) + 1);
  }

  const ready = tables.filter((table) => (inDegree.get(table) || 0) === 0).sort();
  const ordered = [];

  while (ready.length > 0) {
    const table = ready.shift();
    ordered.push(table);

    for (const child of dependents.get(table) || []) {
      inDegree.set(child, (inDegree.get(child) || 0) - 1);
      if ((inDegree.get(child) || 0) === 0) {
        ready.push(child);
        ready.sort();
      }
    }
  }

  if (ordered.length !== tables.length) {
    return tables;
  }

  return ordered;
}

export function getFabricContext() {
  return {
    connectionProfile: process.env.FABRIC_CONNECTION_PROFILE || "./connection-plra.json",
    channel: process.env.FABRIC_CHANNEL_NAME || "landregistry",
    votingChaincode: process.env.FABRIC_VOTING_CHAINCODE || "voting",
    agreementChaincode: process.env.FABRIC_AGREEMENT_CHAINCODE || "land-agreement",
    walletPath: process.env.FABRIC_WALLET_PATH || "./wallet",
  };
}
