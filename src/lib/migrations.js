const fs = require("node:fs/promises");
const path = require("node:path");
const { Client } = require("pg");

const migrationsDir = path.resolve(__dirname, "..", "..", "db", "migrations");

async function ensureSchemaMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function readMigrationFiles() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

async function getAppliedMigrations(client) {
  const result = await client.query("SELECT filename FROM schema_migrations;");
  return new Set(result.rows.map((row) => row.filename));
}

async function applyMigration(client, filename) {
  const filePath = path.join(migrationsDir, filename);
  const sql = await fs.readFile(filePath, "utf8");

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING;",
      [filename],
    );
    await client.query("COMMIT");
    console.log(`Applied migration: ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function migrateDatabase(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensureSchemaMigrationsTable(client);
    const allMigrations = await readMigrationFiles();
    const appliedMigrations = await getAppliedMigrations(client);
    const pendingMigrations = allMigrations.filter(
      (filename) => !appliedMigrations.has(filename),
    );

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations");
      return;
    }

    for (const filename of pendingMigrations) {
      await applyMigration(client, filename);
    }

    console.log("Migrations completed");
  } finally {
    await client.end();
  }
}

module.exports = {
  migrateDatabase,
};

