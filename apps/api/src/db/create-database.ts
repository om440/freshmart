import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before creating the database.");
}

const target = new URL(connectionString);
const databaseName = decodeURIComponent(target.pathname.replace(/^\/+/, ""));
if (!databaseName) {
  throw new Error("DATABASE_URL must include a target database name.");
}

target.pathname = "/postgres";
const client = new pg.Client({ connectionString: target.toString() });
const quoteIdentifier = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

try {
  await client.connect();
  const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);

  if (existing.rowCount) {
    console.log(`Database "${databaseName}" already exists; leaving it unchanged.`);
  } else {
    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`Created database "${databaseName}".`);
  }
} finally {
  await client.end();
}
