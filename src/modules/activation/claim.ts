import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import { lockCard } from "../cards/card";
import type { Db } from "../db";
import { activationLookup, normalizeActivationCode } from "./code";

export type CodeCheck =
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "yours"; cardId: string }
  | { status: "claimable"; credentialId: string };

export type ClaimResult = { status: "claimed" | "already_yours"; cardId: string } | { status: "unavailable" };

// Read-only. Outward answers stay generic; who owns a card is only ever revealed to that owner.
export async function checkActivationCode(db: Db, input: { secret: string; code: string; accountId?: string }): Promise<CodeCheck> {
  const code = normalizeActivationCode(input.code);
  if (!code) return { status: "invalid" };
  const [row] = await db
    .select({
      credentialId: schema.activationCredentials.id,
      usedAt: schema.activationCredentials.usedAt,
      revokedAt: schema.activationCredentials.revokedAt,
      cardId: schema.cards.id,
      kind: schema.cards.kind,
      state: schema.cards.state,
      ownerAccountId: schema.cards.ownerAccountId,
    })
    .from(schema.activationCredentials)
    .innerJoin(schema.cards, eq(schema.cards.id, schema.activationCredentials.cardId))
    .where(eq(schema.activationCredentials.lookupHmac, activationLookup(input.secret, code)));
  if (!row) return { status: "invalid" };
  if (input.accountId && row.ownerAccountId === input.accountId) return { status: "yours", cardId: row.cardId };
  const claimable = !row.usedAt && !row.revokedAt && row.kind === "dbc" && row.state === "released" && !row.ownerAccountId;
  return claimable ? { status: "claimable", credentialId: row.credentialId } : { status: "unavailable" };
}

export async function claimCard(db: Db, input: { credentialId: string; accountId: string }): Promise<ClaimResult> {
  return db.transaction(async (tx) => {
    const [credential] = await tx
      .select({ cardId: schema.activationCredentials.cardId })
      .from(schema.activationCredentials)
      .where(eq(schema.activationCredentials.id, input.credentialId));
    if (!credential) return { status: "unavailable" };
    // Card row first, like every M4 card mutation, so claim serializes with retire/replace and with other claims.
    const card = await lockCard(tx, credential.cardId);
    if (card.ownerAccountId === input.accountId) return { status: "already_yours", cardId: card.id };
    if (card.kind !== "dbc" || card.state !== "released" || card.ownerAccountId) return { status: "unavailable" };
    const [used] = await tx
      .update(schema.activationCredentials)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.activationCredentials.id, input.credentialId), isNull(schema.activationCredentials.usedAt), isNull(schema.activationCredentials.revokedAt)))
      .returning({ id: schema.activationCredentials.id });
    if (!used) return { status: "unavailable" };
    await tx.update(schema.cards).set({ ownerAccountId: input.accountId }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, { type: "card_claimed", actorAccountId: input.accountId, accountId: input.accountId, cardId: card.id });
    return { status: "claimed", cardId: card.id };
  });
}
