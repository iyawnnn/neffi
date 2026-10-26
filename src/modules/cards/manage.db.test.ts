import { eq } from "drizzle-orm";
import { beforeAll, expect, test, vi } from "vitest";
import { activityEvents, cards, profiles, scenes } from "@/db/schema";
import { insertAccount, insertProfileWithScene, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import * as activity from "../activity/record";
import { cardSummaries, connectCardToProfile, getOwnedCard, setCardDisabled, saveCardSettings } from "./manage";

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

test("summaries list only owned DBCs with profile and disabled status", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const { profile } = await insertProfileWithScene(tx, owner.id);
  const { card } = await insertReleasedDbc(tx); const { card: foreign } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id, profileId: profile.id, disabledAt: new Date() }).where(eq(cards.id, card.id));
  const rows = await cardSummaries(tx, owner.id);
  expect(rows).toEqual([{ id: card.id, publicToken: card.publicToken, suffix: card.publicToken!.slice(-4), profileId: profile.id, profileName: profile.fullName, previewSceneId: profile.defaultSceneId, disabled: true }]);
  const [shown] = await tx.insert(scenes).values({ profileId: profile.id, name: "Work" }).returning();
  await tx.update(profiles).set({ activeSceneId: shown.id }).where(eq(profiles.id, profile.id));
  expect((await getOwnedCard(tx, owner.id, card.id))?.previewSceneId).toBe(shown.id);
  expect(await getOwnedCard(tx, owner.id, foreign.id)).toBeNull();
}));
test("disable is idempotent and enable clears disabledAt, recording each transition", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const { profile } = await insertProfileWithScene(tx, owner.id); const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id, profileId: profile.id }).where(eq(cards.id, card.id));
  const input = { accountId: owner.id, cardId: card.id };
  await setCardDisabled(tx, { ...input, disabled: true });
  const [disabled] = await tx.select().from(cards).where(eq(cards.id, card.id)); expect(disabled.disabledAt).toBeInstanceOf(Date); expect(disabled.profileId).toBe(profile.id);
  await setCardDisabled(tx, { ...input, disabled: true });
  expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0].disabledAt).toEqual(disabled.disabledAt);
  await setCardDisabled(tx, { ...input, disabled: false });
  expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0]).toMatchObject({ disabledAt: null, profileId: profile.id });
  expect((await tx.select().from(activityEvents).where(eq(activityEvents.cardId, card.id))).map(e => ({ type: e.type, actorAccountId: e.actorAccountId, accountId: e.accountId }))).toEqual([{ type: "card_disabled", actorAccountId: owner.id, accountId: owner.id }, { type: "card_enabled", actorAccountId: owner.id, accountId: owner.id }]);
}));
test("another account cannot disable or read the card", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const other = await insertAccount(tx); const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  await expect(setCardDisabled(tx, { accountId: other.id, cardId: card.id, disabled: true })).rejects.toMatchObject({ code: "not_found" });
  expect(await getOwnedCard(tx, other.id, card.id)).toBeNull();
  expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0].disabledAt).toBeNull();
}));

test.each(["profile", "status", "both", "unchanged"])("settings save persists %s changes and only records actual transitions", change => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile: original } = await insertProfileWithScene(tx, owner.id);
  const { profile: next } = await insertProfileWithScene(tx, owner.id);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id, profileId: original.id }).where(eq(cards.id, card.id));
  const profileId = change === "profile" || change === "both" ? next.id : original.id;
  const disabled = change === "status" || change === "both";
  await saveCardSettings(tx, { accountId: owner.id, cardId: card.id, profileId, disabled });
  const [saved] = await tx.select().from(cards).where(eq(cards.id, card.id));
  expect(saved.profileId).toBe(profileId);
  expect(Boolean(saved.disabledAt)).toBe(disabled);
  const events = await tx.select().from(activityEvents).where(eq(activityEvents.cardId, card.id));
  expect(events.map(event => event.type).sort()).toEqual([
    ...(profileId !== original.id ? ["card_profile_changed"] : []),
    ...(disabled ? ["card_disabled"] : []),
  ].sort());
}));

test("settings save rejects foreign profiles and cards without changing either field", () => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const other = await insertAccount(tx);
  const { profile } = await insertProfileWithScene(tx, other.id);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  for (const accountId of [owner.id, other.id]) {
    await expect(saveCardSettings(tx, { accountId, cardId: card.id, profileId: profile.id, disabled: true })).rejects.toMatchObject({ code: "not_found" });
  }
  expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0]).toMatchObject({ profileId: null, disabledAt: null });
  expect(await tx.select().from(activityEvents).where(eq(activityEvents.cardId, card.id))).toHaveLength(0);
}));

test("a failure in the second change rolls back both fields and activity", () => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile } = await insertProfileWithScene(tx, owner.id);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  const recordActivity = activity.recordActivity;
  const spy = vi.spyOn(activity, "recordActivity").mockImplementation(async (transaction, event) => {
    if (event.type === "card_disabled") throw new Error("activity write failed");
    await recordActivity(transaction, event);
  });
  try {
    await expect(saveCardSettings(tx, { accountId: owner.id, cardId: card.id, profileId: profile.id, disabled: true })).rejects.toThrow("activity write failed");
    expect(spy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: "card_profile_changed" }));
    expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0]).toMatchObject({ profileId: null, disabledAt: null });
    expect(await tx.select().from(activityEvents).where(eq(activityEvents.cardId, card.id))).toHaveLength(0);
  } finally {
    spy.mockRestore();
  }
}));
