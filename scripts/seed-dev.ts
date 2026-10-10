// `pnpm db:seed`: resets the DEVELOPMENT database to the deterministic synthetic dataset in src/db/seed.ts.
// It empties the domain tables first, so it refuses to run in any environment but development and goes
// through the same database-isolation guard as migrations. Prints row counts only.
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { parseMigrationEnv } from "../src/config/env-schema";
import * as schema from "../src/db/schema";
import { countRows, seed } from "../src/db/seed";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const { appEnv, migrationDatabaseUrl } = parseMigrationEnv(process.env);
  if (appEnv !== "development") {
    throw new Error(`db:seed resets data and only runs against the development database (VERCEL_ENV is ${appEnv})`);
  }

  const pool = new Pool({ connectionString: migrationDatabaseUrl });
  try {
    const db = drizzle({ client: pool, schema, casing: "snake_case" });
    await seed(db);
    console.table(await countRows(db));
  } finally {
    await pool.end();
  }
}

main().catch((error: Error) => {
  console.error(`db:seed failed: ${error.message}`);
  process.exit(1);
});
