import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "../db/schema";

// Domain services accept either the app's pooled database or a transaction (both are PgDatabase), so tests can
// run them on in-process PGlite and callers can compose them.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
