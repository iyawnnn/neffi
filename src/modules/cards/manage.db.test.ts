import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { activityEvents, cards } from "@/db/schema";
import { insertAccount, insertProfileWithScene, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { connectCardToProfile } from "./manage";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("connects an owned card to an owned profile and records it", () =>
  rollback(db, async (tx) => {
    const owner = await insertAccount(tx);
    const { card } = await insertReleasedDbc(tx);
    const { profile } = await insertProfileWithScene(tx, owner.id);
    await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
    await connectCardToProfile(tx, { accountId: owner.id, cardId: card.id, profileId: profile.id });
    await connectCardToProfile(tx, { accountId: owner.id, cardId: card.id, profileId: profile.id });
    expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0].profileId).toBe(profile.id);
    expect(await tx.select().from(activityEvents).where(eq(activityEvents.cardId, card.id))).toEqual([
      expect.objectContaining({ type: "card_profile_changed", actorAccountId: owner.id, accountId: owner.id, note: null }),
    ]);
  }));

test("another account's profile is not found and the card is unchanged", () =>
  rollback(db, async (tx) => {
    const owner = await insertAccount(tx);
    const { card } = await insertReleasedDbc(tx);
    const { profile } = await insertProfileWithScene(tx, (await insertAccount(tx)).id);
    await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
    await expect(connectCardToProfile(tx, { accountId: owner.id, cardId: card.id, profileId: profile.id })).rejects.toMatchObject({ name: "ProfileError", code: "not_found" });
    expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0].profileId).toBeNull();
    expect(await tx.select().from(activityEvents).where(eq(activityEvents.cardId, card.id))).toHaveLength(0);
  }));

test("another account's card is not found", () =>
  rollback(db, async (tx) => {
    const owner = await insertAccount(tx);
    const { card } = await insertReleasedDbc(tx);
    await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
    const other = await insertAccount(tx);
    const { profile } = await insertProfileWithScene(tx, other.id);
    await expect(connectCardToProfile(tx, { accountId: other.id, cardId: card.id, profileId: profile.id })).rejects.toMatchObject({ code: "not_found" });
  }));
