import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/config/env";

// ponytail: plain Pool; add @vercel/functions attachDatabasePool if idle connections pile up on Fluid compute
export const db = drizzle({ client: new Pool({ connectionString: env.databaseUrl }) });
