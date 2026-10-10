import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/config/env";
import * as schema from "./schema";

// ponytail: plain Pool, no globalThis cache; dev HMR may open extra pools. Add @vercel/functions
// attachDatabasePool if idle connections pile up on Fluid compute.
const pool = new Pool({ connectionString: env.databaseUrl });

// Idle clients error when the server drops them (Neon scale-to-zero, pooler restarts). Without a
// listener the Pool re-emits as an uncaught exception and crashes the process; the client is discarded either way.
pool.on("error", (error) => console.error("Idle database client error:", error.message));

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
