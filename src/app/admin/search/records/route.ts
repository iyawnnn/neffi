import { connection } from "next/server";
import { authorize, denialResponse } from "@/auth/access";
import { db } from "@/db";
import { searchRecords } from "@/modules/search";

// Read-only record search for the command palette. Owner only; answers with a status instead of redirecting.
export async function GET(request: Request) {
  await connection();
  const auth = await authorize("owner");
  if (!auth.ok) return denialResponse(auth.denial);
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const { hits, total } = await searchRecords(db, query, { perType: 4, limit: 20 });
  return Response.json({ hits, total }, { headers: { "cache-control": "no-store" } });
}
