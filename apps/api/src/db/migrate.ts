import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const migrationsDirectory = fileURLToPath(
  new URL("../../../../database/migrations/", import.meta.url),
);
const migrationFilenamePattern = /^\d{3}_[a-z0-9_]+\.sql$/;

try {
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of filenames) {
    if (!migrationFilenamePattern.test(filename)) {
      throw new Error(`Invalid migration filename: ${filename}`);
    }

    const sql = await readFile(new URL(`../../../../database/migrations/${filename}`, import.meta.url), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["grocery-shop:migrations"]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename TEXT PRIMARY KEY,
          checksum TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const applied = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE filename = $1",
        [filename],
      );

      if (applied.rowCount) {
        if (applied.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration ${filename} has changed; refusing to continue.`);
        }
        await client.query("COMMIT");
        console.log(`Already applied: ${filename}`);
        continue;
      }

      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
        [filename, checksum],
      );
      await client.query("COMMIT");
      console.log(`Applied migration: ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  if (filenames.length === 0) {
    console.log("No database migrations found.");
  }
} finally {
  await pool.end();
}
