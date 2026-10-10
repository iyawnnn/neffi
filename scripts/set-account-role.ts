import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { parseMigrationEnv } from "../src/config/env-schema";
import * as schema from "../src/db/schema";
import { setAccountRole } from "../src/modules/accounts/set-role";

async function main() {
  const [email, role, ...extra] = process.argv.slice(2);
  if (!email || (role !== "owner" && role !== "customer") || extra.length) {
    console.error("Usage: accounts:set-role <email> <owner|customer>");
    process.exitCode = 1;
    return;
  }
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const { migrationDatabaseUrl } = parseMigrationEnv(process.env);
  const pool = new Pool({ connectionString: migrationDatabaseUrl });
  try {
    const db = drizzle({ client: pool, schema, casing: "snake_case" });
    const result = await setAccountRole(db, email, role);
    console.log(result.accountId);
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  // Driver errors can contain SQL parameters or credentials.
  console.error("accounts:set-role failed. Check arguments, environment and database access.");
  process.exitCode = 1;
});
