import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before using the database.");
}

export const pool = new pg.Pool({
  connectionString,
  application_name: "grocery-shop-api",
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL client error.", error);
});
