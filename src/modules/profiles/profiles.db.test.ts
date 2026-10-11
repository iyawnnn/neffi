import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { activityEvents, cards, formDefinitions, formSubmissions, profiles, sceneBlocks, scenes } from "@/db/schema";
import { insertAccount, insertProfileWithScene, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { createProfileFromStarter, getOwnedProfile, ownedProfiles } from "./profiles";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

async function ownedUnsetCard(tx: TestTx) {
  const { card } = await insertReleasedDbc(tx);
  const owner = await insertAccount(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  return { card, owner };
}
const ESSENTIALS = { fullName: "Ana", headline: "Designer", bio: null, email: "ana@e.test", phone: null, link: "https://cal.com/ana" };

test("creates a Draft profile with its Default Scene, seeded blocks and form, and connects the card", () =>
  rollback(db, async (tx) => {
    const { card, owner } = await ownedUnsetCard(tx);
    const result = await createProfileFromStarter(tx, { accountId: owner.id, cardId: card.id, purpose: "get_clients", essentials: ESSENTIALS });
    expect(result).toEqual({ profileId: expect.any(String), created: true });
    const [profile] = await tx.select().from(profiles).where(eq(profiles.id, result.profileId));
    expect(profile).toMatchObject({ status: "draft", fullName: "Ana", email: "ana@e.test", defaultSceneId: expect.any(String), activeSceneId: null });
    const [scene] = await tx.select().from(scenes).where(eq(scenes.id, profile.defaultSceneId!));
    expect(scene.name).toBe("Clients");
    const blocks = await tx.select().from(sceneBlocks).where(eq(sceneBlocks.sceneId, scene.id)).orderBy(asc(sceneBlocks.position));
    expect(blocks.map(b => b.type)).toEqual(["booking", "form", "contact"]);
    expect(blocks.map(b => b.position)).toEqual([0, 1, 2]);
    const [form] = await tx.select().from(formDefinitions).where(eq(formDefinitions.id, blocks[1].formId!));
    expect(form).toMatchObject({ profileId: profile.id, preset: "project_inquiry", title: "Tell me about your project" });
    expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0].profileId).toBe(profile.id);
    expect(await tx.select().from(activityEvents).where(eq(activityEvents.cardId, card.id))).toEqual([
      expect.objectContaining({ type: "card_profile_changed", cardId: card.id, actorAccountId: owner.id, accountId: owner.id, note: null }),
    ]);
  }));

test("a repeated submit returns the same profile and creates nothing new", () =>
  rollback(db, async (tx) => {
    const { card, owner } = await ownedUnsetCard(tx);
    const input = { accountId: owner.id, cardId: card.id, purpose: "get_clients" as const, essentials: ESSENTIALS };
    const first = await createProfileFromStarter(tx, input);
    expect(await createProfileFromStarter(tx, input)).toEqual({ profileId: first.profileId, created: false });
    expect(await tx.select().from(profiles).where(eq(profiles.accountId, owner.id))).toHaveLength(1);
    expect(await tx.select().from(scenes).where(eq(scenes.profileId, first.profileId))).toHaveLength(1);
    expect(await tx.select().from(activityEvents).where(eq(activityEvents.accountId, owner.id))).toHaveLength(1);
  }));

test("someone else's card is not found", () =>
  rollback(db, async (tx) => {
    const { card } = await ownedUnsetCard(tx);
    const other = await insertAccount(tx);
    for (const cardId of [card.id, randomUUID()]) {
      await expect(createProfileFromStarter(tx, { accountId: other.id, cardId, purpose: "network", essentials: ESSENTIALS })).rejects.toMatchObject({ name: "ProfileError", code: "not_found" });
    }
    expect(await tx.select().from(profiles)).toHaveLength(0);
    expect(await tx.select().from(scenes)).toHaveLength(0);
  }));

test("the tenth profile is the last", () =>
  rollback(db, async (tx) => {
    const { card, owner } = await ownedUnsetCard(tx);
    for (let i = 0; i < 10; i++) await insertProfileWithScene(tx, owner.id);
    await expect(createProfileFromStarter(tx, { accountId: owner.id, cardId: card.id, purpose: "network", essentials: ESSENTIALS })).rejects.toMatchObject({ code: "limit_reached" });
    expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0].profileId).toBeNull();
  }));

test("ownedProfiles lists only the account's profiles, oldest first, with unread counts", () =>
  rollback(db, async (tx) => {
    const { card, owner } = await ownedUnsetCard(tx);
    const { profileId } = await createProfileFromStarter(tx, { accountId: owner.id, cardId: card.id, purpose: "get_clients", essentials: ESSENTIALS });
    const [form] = await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, profileId));
    await tx.insert(formSubmissions).values([
      { formId: form.id, profileId, clientKey: randomUUID(), answers: [] },
      { formId: form.id, profileId, clientKey: randomUUID(), answers: [], readAt: new Date() },
    ]);
    const { profile: second } = await insertProfileWithScene(tx, owner.id);
    await tx.update(profiles).set({ createdAt: new Date("2099-01-01") }).where(eq(profiles.id, second.id));
    expect(await ownedProfiles(tx, owner.id)).toEqual([
      { id: profileId, fullName: "Ana", status: "draft", unread: 1 },
      { id: second.id, fullName: null, status: "draft", unread: 0 },
    ]);
    expect(await ownedProfiles(tx, (await insertAccount(tx)).id)).toEqual([]);
  }));

test("getOwnedProfile returns scenes (Default first), connected card suffixes, publish gaps and unread; null for anyone else", () =>
  rollback(db, async (tx) => {
    const { card, owner } = await ownedUnsetCard(tx);
    const { profileId } = await createProfileFromStarter(tx, { accountId: owner.id, cardId: card.id, purpose: "get_clients", essentials: ESSENTIALS });
    const profile = await getOwnedProfile(tx, owner.id, profileId);
    expect(profile).toMatchObject({ gaps: [], unread: 0, cards: [{ id: card.id, suffix: card.publicToken!.slice(-4) }] });
    expect(profile!.scenes).toEqual([{ id: profile!.defaultSceneId, name: "Clients", isDefault: true, isShown: true }]);
    const [extra] = await tx.insert(scenes).values({ profileId, name: "Events", createdAt: new Date("2000-01-01") }).returning();
    await tx.update(profiles).set({ activeSceneId: extra.id }).where(eq(profiles.id, profileId));
    expect((await getOwnedProfile(tx, owner.id, profileId))!.scenes).toEqual([
      { id: profile!.defaultSceneId, name: "Clients", isDefault: true, isShown: false },
      { id: extra.id, name: "Events", isDefault: false, isShown: true },
    ]);
    expect(await getOwnedProfile(tx, (await insertAccount(tx)).id, profileId)).toBeNull();
  }));
