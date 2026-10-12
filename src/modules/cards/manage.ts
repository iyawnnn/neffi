import "server-only";
import { and, asc, eq } from "drizzle-orm";
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

export type CardSummary = { id: string; publicToken: string; suffix: string; profileId: string | null; profileName: string | null; disabled: boolean };
const cardColumns = { id: schema.cards.id, publicToken: schema.cards.publicToken, profileId: schema.cards.profileId, profileName: schema.profiles.fullName, disabledAt: schema.cards.disabledAt };

// shortcut: capped at 50 for the V1 Cards list; add pagination when accounts need more.
export async function cardSummaries(db: Db, accountId: string): Promise<CardSummary[]> {
  const rows = await db.select(cardColumns).from(schema.cards).leftJoin(schema.profiles, eq(schema.profiles.id, schema.cards.profileId))
    .where(and(eq(schema.cards.ownerAccountId, accountId), eq(schema.cards.kind, "dbc"))).orderBy(asc(schema.cards.createdAt)).limit(50);
  return rows.map(row => ({ id: row.id, publicToken: row.publicToken!, suffix: row.publicToken!.slice(-4), profileId: row.profileId, profileName: row.profileName, disabled: row.disabledAt !== null }));
}

export async function getOwnedCard(db: Db, accountId: string, cardId: string): Promise<CardSummary | null> {
  const [row] = await db.select(cardColumns).from(schema.cards).leftJoin(schema.profiles, eq(schema.profiles.id, schema.cards.profileId))
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.ownerAccountId, accountId), eq(schema.cards.kind, "dbc")));
  return row ? { id: row.id, publicToken: row.publicToken!, suffix: row.publicToken!.slice(-4), profileId: row.profileId, profileName: row.profileName, disabled: row.disabledAt !== null } : null;
}

export async function setCardDisabled(db: Db, input: { accountId: string; cardId: string; disabled: boolean }): Promise<void> {
  await db.transaction(async tx => {
    const card = await lockOwnedCard(tx, input.accountId, input.cardId);
    if (Boolean(card.disabledAt) === input.disabled) return;
    await tx.update(schema.cards).set({ disabledAt: input.disabled ? new Date() : null }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, { type: input.disabled ? "card_disabled" : "card_enabled", actorAccountId: input.accountId, accountId: input.accountId, cardId: card.id });
  });
}
