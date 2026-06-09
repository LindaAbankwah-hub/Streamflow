import "dotenv/config";
import { Pool } from "pg";

export const db = new Pool({
  host: "127.0.0.1",
  port: 5432,
  user: "stream",
  password: "stream",
  database: "streamdb",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on("error", (err) => {
  console.error("Unexpected DB error", err);
});