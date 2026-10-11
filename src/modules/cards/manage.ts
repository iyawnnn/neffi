import "server-only";
import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { ProfileError } from "../profiles/errors";
import { lockOwnedProfile } from "../profiles/profiles";
import { CardError, lockCard } from "./card";

// Card row first, then the profile (D20). A card can only show a profile of its own owner (also cards_profile_owner_fk).
export async function lockOwnedCard(tx: Db, accountId: string, cardId: string) {
  const card = await lockCard(tx, cardId).catch((error) => {
    if (error instanceof CardError) return null;
    throw error;
  });
  if (!card || card.ownerAccountId !== accountId || card.kind !== "dbc") throw new ProfileError("not_found");
  return card;
}

export async function connectCardToProfile(db: Db, input: { accountId: string; cardId: string; profileId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const card = await lockOwnedCard(tx, input.accountId, input.cardId);
    await lockOwnedProfile(tx, input.accountId, input.profileId);
    if (card.profileId === input.profileId) return;
    await tx.update(schema.cards).set({ profileId: input.profileId }).where(and(eq(schema.cards.id, card.id)));
    await recordActivity(tx, { type: "card_profile_changed", actorAccountId: input.accountId, accountId: input.accountId, cardId: card.id });
  });
}
