import "server-only";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";

export type OwnedCard = { id: string; publicToken: string; profileId: string | null };

// shortcut: capped at 50 for the Home summary; M6's Cards page owns pagination.
export async function ownedCards(db: Db, accountId: string): Promise<OwnedCard[]> {
  const rows = await db
    .select({ id: schema.cards.id, publicToken: schema.cards.publicToken, profileId: schema.cards.profileId })
    .from(schema.cards)
    .where(and(eq(schema.cards.ownerAccountId, accountId), eq(schema.cards.kind, "dbc")))
    .orderBy(desc(schema.cards.updatedAt))
    .limit(50);
  // An owned DBC is always provisioned, so it always has its permanent token (cards_dbc_token_when_provisioned).
  return rows.map((row) => ({ ...row, publicToken: row.publicToken! }));
}
