import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { parseMigrationEnv } from "./src/config/env-schema";

// Drizzle Kit runs outside Next.js, so load local development config the same way Next does.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Migrations use Neon's direct (unpooled) connection and the same isolation guard as the app.
const { migrationDatabaseUrl } = parseMigrationEnv(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: migrationDatabaseUrl },
  strict: true,
  verbose: true,
});
