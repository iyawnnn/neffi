import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards, formDefinitions, formSubmissions, profiles, sceneBlocks, scenes } from "@/db/schema";
import { insertAccount, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { createProfileFromStarter, deleteProfile, publishProfile, setProfileImage, unpublishProfile, updateAppearance, updateIdentity } from "./profiles";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
const identity = { fullName: "Ana", headline: "Designer", company: null, bio: null, email: "ana@e.test", phone: null, website: null, location: null };
async function setup(tx: TestTx) {
  const owner = await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  const { profileId } = await createProfileFromStarter(tx, { accountId: owner.id, cardId: card.id, purpose: "get_clients", essentials: { fullName: "Ana", headline: "Designer", bio: null, email: "ana@e.test", phone: null, link: null } });
  return { card, input: { accountId: owner.id, profileId } };
}
const row = async (tx: TestTx, id: string) => (await tx.select().from(profiles).where(eq(profiles.id, id)))[0];

test("publishing a ready profile makes it Published", () => rollback(db, async tx => {
  const { input } = await setup(tx);
  await publishProfile(tx, input);
  expect((await row(tx, input.profileId)).status).toBe("published");
}));

test("publishing reports exactly what is missing", () => rollback(db, async tx => {
  const { input } = await setup(tx);
  const profile = await row(tx, input.profileId);
  await tx.update(profiles).set({ fullName: null, email: null }).where(eq(profiles.id, profile.id));
  await tx.update(sceneBlocks).set({ visible: false }).where(eq(sceneBlocks.sceneId, profile.defaultSceneId!));
  await expect(publishProfile(tx, input)).rejects.toMatchObject({ name: "ProfileError", code: "not_ready", gaps: ["name", "contact", "content"] });
  expect((await row(tx, profile.id)).status).toBe("draft");
}));

test("unpublish hides a Published profile; unpublishing a Draft changes nothing", () => rollback(db, async tx => {
  const { input } = await setup(tx);
  await unpublishProfile(tx, input);
  expect((await row(tx, input.profileId)).status).toBe("draft");
  await publishProfile(tx, input);
  await unpublishProfile(tx, input);
  expect((await row(tx, input.profileId)).status).toBe("unpublished");
}));

test("updateIdentity saves normalized identity; while Published it cannot remove every way to reach you", () => rollback(db, async tx => {
  const { input } = await setup(tx);
  await publishProfile(tx, input);
  const before = await row(tx, input.profileId);
  await expect(updateIdentity(tx, { ...input, identity: { ...identity, email: null } })).rejects.toMatchObject({ code: "not_ready", gaps: ["contact"] });
  expect(await row(tx, input.profileId)).toEqual(before);
  await updateIdentity(tx, { ...input, identity: { ...identity, email: null, phone: "+63 917 123 4567" } });
  expect(await row(tx, input.profileId)).toMatchObject({ email: null, phone: "+63 917 123 4567", status: "published" });
}));

test("appearance accepts only palette colours", () => rollback(db, async tx => {
  const { input } = await setup(tx);
  await updateAppearance(tx, { ...input, accentColor: "#1F5FAE", imageIsLogo: true });
  expect(await row(tx, input.profileId)).toMatchObject({ accentColor: "#1F5FAE", imageIsLogo: true });
  await expect(updateAppearance(tx, { ...input, accentColor: "#123456", imageIsLogo: false })).rejects.toMatchObject({ code: "invalid" });
  expect(await row(tx, input.profileId)).toMatchObject({ accentColor: "#1F5FAE", imageIsLogo: true });
}));

test("setProfileImage returns the replaced asset for cleanup", () => rollback(db, async tx => {
  const { input } = await setup(tx);
  const assetId = `neffi/profiles/${input.profileId}/a`;
  expect(await setProfileImage(tx, { ...input, assetId })).toEqual({ previousAssetId: null });
  expect(await setProfileImage(tx, { ...input, assetId })).toEqual({ previousAssetId: null });
  expect(await setProfileImage(tx, { ...input, assetId: null })).toEqual({ previousAssetId: assetId });
}));

test("deleteProfile refuses while a card shows it, then deletes everything and returns the image for cleanup", () => rollback(db, async tx => {
  const { card, input } = await setup(tx);
  await expect(deleteProfile(tx, input)).rejects.toMatchObject({ code: "has_cards" });
  const [form] = await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, input.profileId));
  await tx.insert(formSubmissions).values({ profileId: input.profileId, formId: form.id, clientKey: randomUUID(), answers: [] });
  await tx.update(cards).set({ profileId: null }).where(eq(cards.id, card.id));
  await tx.update(profiles).set({ imageAssetId: "img" }).where(eq(profiles.id, input.profileId));
  expect(await deleteProfile(tx, input)).toEqual({ imageAssetId: "img", coverAssetId: null });
  expect(await row(tx, input.profileId)).toBeUndefined();
  expect(await tx.select().from(scenes).where(eq(scenes.profileId, input.profileId))).toHaveLength(0);
  expect(await tx.select().from(sceneBlocks)).toHaveLength(0);
  expect(await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, input.profileId))).toHaveLength(0);
  expect(await tx.select().from(formSubmissions).where(eq(formSubmissions.profileId, input.profileId))).toHaveLength(0);
}));

test("every mutation is not_found for another account", () => rollback(db, async tx => {
  const { input } = await setup(tx);
  const foreign = { ...input, accountId: (await insertAccount(tx)).id };
  const calls = [
    () => publishProfile(tx, foreign),
    () => unpublishProfile(tx, foreign),
    () => updateIdentity(tx, { ...foreign, identity }),
    () => updateAppearance(tx, { ...foreign, accentColor: "#1F5FAE", imageIsLogo: false }),
    () => setProfileImage(tx, { ...foreign, assetId: null }),
    () => deleteProfile(tx, foreign),
  ];
  for (const call of calls) await expect(call()).rejects.toMatchObject({ code: "not_found" });
}));
