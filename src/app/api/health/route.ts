import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";

const NO_STORE = { "cache-control": "no-store" };

export async function GET() {
  // Keep the check request-time; with Cache Components a GET handler would otherwise be prerendered at build.
  await connection();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", db: "ok" }, { headers: NO_STORE });
  } catch {
    // Never expose driver errors: they can contain hostnames, usernames or query text.
    return Response.json({ status: "degraded", db: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
