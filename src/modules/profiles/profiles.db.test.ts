import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { activityEvents, cards, formDefinitions, formSubmissions, profiles, sceneBlocks, scenes } from "@/db/schema";
import { insertAccount, insertProfileWithScene, insertReleasedDbc } from "@/db/test-fixtures";
import { createSetupTestProfile } from "@/db/setup-test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { createProfileFromSetup, getOwnedProfile, ownedProfiles, setProfileGoal, updateAppearance, updateIdentity } from "./profiles";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

async function ownedUnsetCard(tx: TestTx) {
  const { card } = await insertReleasedDbc(tx);
  const owner = await insertAccount(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  return { card, owner };
}
const SETUP_IDENTITY = { fullName: "Ana", headline: "Designer", company: null, bio: "No starter content", email: "ana@e.test", phone: null, website: null, location: null };

test.each([
  ["networking", "classic", "Networking"],
  ["freelance", "showcase", "My work"],
  ["business", "editorial", "Business"],
  ["student", "classic", "Main"],
  [null, "classic", "Main"],
] as const)("setup creates a clean Draft with %s defaults", (goal, layout, sceneName) => rollback(db, async tx => {
  const { card, owner } = await ownedUnsetCard(tx);
  const result = await createProfileFromSetup(tx, { accountId: owner.id, cardId: card.id, goal, identity: SETUP_IDENTITY });
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, result.profileId));
  const [scene] = await tx.select().from(scenes).where(eq(scenes.id, profile.defaultSceneId!));
  expect(profile).toMatchObject({ status: "draft", layout, colorMode: "light", goal, accentColor: null, contentVersion: 0 });
  expect(profile).toMatchObject(SETUP_IDENTITY);
  expect(scene.name).toBe(sceneName);
  expect(await tx.select().from(scenes).where(eq(scenes.profileId, profile.id))).toHaveLength(1);
  expect(await tx.select().from(sceneBlocks).where(eq(sceneBlocks.sceneId, scene.id))).toEqual([]);
  expect(await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, profile.id))).toEqual([]);
  expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0].profileId).toBe(profile.id);
  expect(await tx.select().from(activityEvents).where(eq(activityEvents.cardId, card.id))).toEqual([expect.objectContaining({ type: "card_profile_changed" })]);
}));

test("setup is idempotent, enforces ownership and the ten-profile limit", () => rollback(db, async tx => {
  const { card, owner } = await ownedUnsetCard(tx);
  const input = { accountId: owner.id, cardId: card.id, goal: "freelance" as const, identity: SETUP_IDENTITY };
  const first = await createProfileFromSetup(tx, input);
  expect(await createProfileFromSetup(tx, input)).toEqual({ ...first, created: false });
  await expect(createProfileFromSetup(tx, { ...input, accountId: (await insertAccount(tx)).id })).rejects.toMatchObject({ code: "not_found" });
  await tx.update(profiles).set({ layout: "editorial", colorMode: "dark", fullName: "Changed" }).where(eq(profiles.id, first.profileId));
  expect(await createProfileFromSetup(tx, { ...input, goal: "student" })).toEqual({ ...first, created: false });
  expect((await tx.select().from(profiles).where(eq(profiles.id, first.profileId)))[0]).toMatchObject({ goal: "freelance", layout: "editorial", colorMode: "dark", fullName: "Changed" });
  const { card: limitCard, owner: limitOwner } = await ownedUnsetCard(tx);
  for (let i = 0; i < 10; i++) await insertProfileWithScene(tx, limitOwner.id);
  await expect(createProfileFromSetup(tx, { accountId: limitOwner.id, cardId: limitCard.id, goal: null, identity: SETUP_IDENTITY })).rejects.toMatchObject({ code: "limit_reached" });
}));

test("Goal changes preserve the chosen layout and scene, validate input, and bump once", () => rollback(db, async tx => {
  const { card, owner } = await ownedUnsetCard(tx);
  const { profileId } = await createProfileFromSetup(tx, { accountId: owner.id, cardId: card.id, goal: null, identity: SETUP_IDENTITY });
  await updateAppearance(tx, { accountId: owner.id, profileId, accentColor: "#1F5FAE", layout: "editorial", colorMode: "dark" });
  const before = (await tx.select().from(profiles).where(eq(profiles.id, profileId)))[0];
  const sceneBefore = (await tx.select().from(scenes).where(eq(scenes.id, before.defaultSceneId!)))[0];
  await setProfileGoal(tx, { accountId: owner.id, profileId, goal: "freelance" });
  expect((await tx.select().from(profiles).where(eq(profiles.id, profileId)))[0]).toMatchObject({ goal: "freelance", layout: "editorial", defaultSceneId: before.defaultSceneId, contentVersion: before.contentVersion + 1 });
  expect((await tx.select().from(scenes).where(eq(scenes.id, before.defaultSceneId!)))[0]).toEqual(sceneBefore);
  await expect(setProfileGoal(tx, { accountId: owner.id, profileId, goal: "invalid" as never })).rejects.toMatchObject({ code: "invalid" });
}));

test("appearance accepts optional layout and mode without changing omitted fields", () => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile } = await insertProfileWithScene(tx, owner.id);
  const profileId = profile.id;
  await updateAppearance(tx, { accountId: owner.id, profileId, accentColor: "#1F5FAE", layout: "showcase", colorMode: "dark" });
  await updateAppearance(tx, { accountId: owner.id, profileId, accentColor: "#0E7C86" });
  expect((await tx.select().from(profiles).where(eq(profiles.id, profileId)))[0]).toMatchObject({ accentColor: "#0E7C86", layout: "showcase", colorMode: "dark", imageIsLogo: false });
}));

test("identity presentation updates atomically without changing appearance or cover", () => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile } = await insertProfileWithScene(tx, owner.id);
  await updateAppearance(tx, { accountId: owner.id, profileId: profile.id, accentColor: "#1F5FAE", layout: "showcase", colorMode: "dark" });
  await tx.update(profiles).set({ coverAssetId: `neffi/profiles/${profile.id}/cover/00000000-0000-4000-8000-000000000000`, coverWidth: 1200, coverHeight: 800, coverCropX: 0, coverCropY: 0, coverCropWidth: 900 }).where(eq(profiles.id, profile.id));
  const before = (await tx.select().from(profiles).where(eq(profiles.id, profile.id)))[0];
  await updateIdentity(tx, { accountId: owner.id, profileId: profile.id, imageIsLogo: true, identity: { fullName: "Ana", headline: null, company: null, bio: null, phone: null, email: "ana@e.test", website: null, location: null } });
  const after = (await tx.select().from(profiles).where(eq(profiles.id, profile.id)))[0];
  expect(after).toMatchObject({ imageIsLogo: true, layout: before.layout, colorMode: before.colorMode, accentColor: before.accentColor, coverAssetId: before.coverAssetId, coverWidth: before.coverWidth, coverHeight: before.coverHeight, coverCropX: before.coverCropX, coverCropY: before.coverCropY, coverCropWidth: before.coverCropWidth, contentVersion: before.contentVersion + 1 });
  await updateIdentity(tx, { accountId: owner.id, profileId: profile.id, identity: { fullName: "Ana B", headline: null, company: null, bio: null, phone: null, email: "ana@e.test", website: null, location: null } });
  expect((await tx.select().from(profiles).where(eq(profiles.id, profile.id)))[0].imageIsLogo).toBe(true);
}));

test.each([
  { layout: "invalid" as never },
  { colorMode: "invalid" as never },
  { accentColor: "#123456" },
])("invalid appearance is refused without changing the profile: %j", input => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile } = await insertProfileWithScene(tx, owner.id);
  const before = (await tx.select().from(profiles).where(eq(profiles.id, profile.id)))[0];
  await expect(updateAppearance(tx, { accountId: owner.id, profileId: profile.id, accentColor: "#1F5FAE", ...input })).rejects.toMatchObject({ code: "invalid" });
  expect((await tx.select().from(profiles).where(eq(profiles.id, profile.id)))[0]).toEqual(before);
}));

test("Goal changes allow NULL and preserve scene names; unauthorized mutations are refused", () => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile, scene } = await insertProfileWithScene(tx, owner.id);
  await setProfileGoal(tx, { accountId: owner.id, profileId: profile.id, goal: null });
  expect((await tx.select().from(scenes).where(eq(scenes.id, scene.id)))[0]).toEqual(scene);
  const other = await insertAccount(tx);
  const before = (await tx.select().from(profiles).where(eq(profiles.id, profile.id)))[0];
  await expect(setProfileGoal(tx, { accountId: other.id, profileId: profile.id, goal: "student" })).rejects.toMatchObject({ code: "not_found" });
  await expect(updateAppearance(tx, { accountId: other.id, profileId: profile.id, layout: "showcase", colorMode: "dark", accentColor: "#1F5FAE" })).rejects.toMatchObject({ code: "not_found" });
  expect((await tx.select().from(profiles).where(eq(profiles.id, profile.id)))[0]).toEqual(before);
}));

test("setup refuses invalid Goals without connecting the card", () => rollback(db, async tx => {
  const { card, owner } = await ownedUnsetCard(tx);
  const before = (await tx.select().from(cards).where(eq(cards.id, card.id)))[0];
  await expect(createProfileFromSetup(tx, { accountId: owner.id, cardId: card.id, goal: "unknown" as never, identity: SETUP_IDENTITY })).rejects.toMatchObject({ code: "invalid" });
  expect((await tx.select().from(cards).where(eq(cards.id, card.id)))[0]).toEqual(before);
}));

test("setup refuses retired cards", () => rollback(db, async tx => {
  const { card, owner } = await ownedUnsetCard(tx);
  await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, card.id));
  await expect(createProfileFromSetup(tx, { accountId: owner.id, cardId: card.id, goal: null, identity: SETUP_IDENTITY })).rejects.toMatchObject({ code: "not_found" });
}));

test("all layouts remain available regardless of Goal", () => rollback(db, async tx => {
  const { card, owner } = await ownedUnsetCard(tx);
  const { profileId } = await createProfileFromSetup(tx, { accountId: owner.id, cardId: card.id, goal: "business", identity: SETUP_IDENTITY });
  for (const layout of ["classic", "editorial", "showcase"] as const) {
    await updateAppearance(tx, { accountId: owner.id, profileId, accentColor: "#1F5FAE", layout, colorMode: "dark" });
    expect((await tx.select().from(profiles).where(eq(profiles.id, profileId)))[0]).toMatchObject({ goal: "business", layout });
  }
}));

test("ownedProfiles lists only the account's profiles, oldest first, with unread counts", () =>
  rollback(db, async (tx) => {
    const { card, owner } = await ownedUnsetCard(tx);
    const { profileId } = await createSetupTestProfile(tx, { accountId: owner.id, cardId: card.id, identity: SETUP_IDENTITY, content: [{ type: "form", content: {}, preset: "contact" }] });
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
    const { profileId } = await createSetupTestProfile(tx, { accountId: owner.id, cardId: card.id, goal: "business", identity: SETUP_IDENTITY, content: [{ type: "contact", content: { saveContact: true } }] });
    const profile = await getOwnedProfile(tx, owner.id, profileId);
    expect(profile).toMatchObject({ gaps: [], unread: 0, cards: [{ id: card.id, suffix: card.publicToken!.slice(-4) }] });
    expect(profile).toMatchObject({ layout: "editorial", colorMode: "light", goal: "business" });
    expect(profile!.scenes).toEqual([{ id: profile!.defaultSceneId, name: "Business", isDefault: true, isShown: true }]);
    const [extra] = await tx.insert(scenes).values({ profileId, name: "Events", createdAt: new Date("2000-01-01") }).returning();
    await tx.update(profiles).set({ activeSceneId: extra.id }).where(eq(profiles.id, profileId));
    expect((await getOwnedProfile(tx, owner.id, profileId))!.scenes).toEqual([
      { id: profile!.defaultSceneId, name: "Business", isDefault: true, isShown: false },
      { id: extra.id, name: "Events", isDefault: false, isShown: true },
    ]);
    expect(await getOwnedProfile(tx, (await insertAccount(tx)).id, profileId)).toBeNull();
  }));

test.each(["published", "unpublished"] as const)("Goal cannot change after setup (%s)", status => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile } = await insertProfileWithScene(tx, owner.id);
  await tx.update(profiles).set({ status, fullName: "Ana", email: "ana@example.test" }).where(eq(profiles.id, profile.id));
  await expect(setProfileGoal(tx, { accountId: owner.id, profileId: profile.id, goal: "business" })).rejects.toMatchObject({ code: "invalid" });
  expect((await tx.select().from(profiles).where(eq(profiles.id, profile.id)))[0].goal).toBeNull();
}));
