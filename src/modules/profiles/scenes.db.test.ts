import { asc, eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards, formDefinitions, profiles, sceneBlocks, scenes } from "@/db/schema";
import { insertAccount, insertProfileWithScene, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { createProfileFromStarter } from "./profiles";
import { createScene, deleteScene, renameScene, showScene } from "./scenes";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
async function setup(tx: TestTx) {
  const owner = await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  const { profileId } = await createProfileFromStarter(tx, { accountId: owner.id, cardId: card.id, purpose: "network", essentials: { fullName: "Ana", headline: null, bio: "Hi", email: "ana@e.test", phone: null, link: "https://ana.example/" } });
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, profileId));
  return { input: { accountId: owner.id, profileId }, defaultSceneId: profile.defaultSceneId! };
}
const blocks = (tx: TestTx, sceneId: string) => tx.select({ type: sceneBlocks.type, position: sceneBlocks.position, visible: sceneBlocks.visible, content: sceneBlocks.content, formId: sceneBlocks.formId }).from(sceneBlocks).where(eq(sceneBlocks.sceneId, sceneId)).orderBy(asc(sceneBlocks.position));
const profileRow = async (tx: TestTx, id: string) => (await tx.select().from(profiles).where(eq(profiles.id, id)))[0];

test("creates an empty scene or a copy that shares the same forms", () => rollback(db, async tx => {
  const { input, defaultSceneId } = await setup(tx);
  const empty = await createScene(tx, { ...input, name: "Events", copyFromSceneId: null });
  expect(await blocks(tx, empty.sceneId)).toHaveLength(0);
  const beforeForms = await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, input.profileId));
  const copied = await createScene(tx, { ...input, name: "Copy", copyFromSceneId: defaultSceneId });
  expect(await blocks(tx, copied.sceneId)).toEqual(await blocks(tx, defaultSceneId));
  expect(await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, input.profileId))).toEqual(beforeForms);
}));
test("names are trimmed and 1–40 characters", () => rollback(db, async tx => {
  const { input, defaultSceneId } = await setup(tx);
  for (const name of [" ", "x".repeat(41)]) {
    await expect(createScene(tx, { ...input, name, copyFromSceneId: null })).rejects.toMatchObject({ code: "invalid" });
    await expect(renameScene(tx, { ...input, sceneId: defaultSceneId, name })).rejects.toMatchObject({ code: "invalid" });
  }
  const { sceneId } = await createScene(tx, { ...input, name: " Events ", copyFromSceneId: null });
  expect((await tx.select().from(scenes).where(eq(scenes.id, sceneId)))[0].name).toBe("Events");
}));
test("a sixth scene is refused", () => rollback(db, async tx => {
  const { input } = await setup(tx);
  for (let i = 0; i < 4; i++) await createScene(tx, { ...input, name: `Scene ${i}`, copyFromSceneId: null });
  await expect(createScene(tx, { ...input, name: "Sixth", copyFromSceneId: null })).rejects.toMatchObject({ code: "limit_reached" });
  expect(await tx.select().from(scenes).where(eq(scenes.profileId, input.profileId))).toHaveLength(5);
}));
test("rename and show", () => rollback(db, async tx => {
  const { input, defaultSceneId } = await setup(tx);
  const { sceneId } = await createScene(tx, { ...input, name: "Events", copyFromSceneId: null });
  await renameScene(tx, { ...input, sceneId, name: " Meetups " });
  expect((await tx.select().from(scenes).where(eq(scenes.id, sceneId)))[0].name).toBe("Meetups");
  await showScene(tx, { ...input, sceneId });
  expect((await profileRow(tx, input.profileId)).activeSceneId).toBe(sceneId);
  await showScene(tx, { ...input, sceneId: defaultSceneId });
  expect((await profileRow(tx, input.profileId)).activeSceneId).toBeNull();
}));
test("the Default Scene cannot be deleted; deleting the shown scene falls back to Default", () => rollback(db, async tx => {
  const { input, defaultSceneId } = await setup(tx);
  await expect(deleteScene(tx, { ...input, sceneId: defaultSceneId })).rejects.toMatchObject({ code: "default_scene" });
  const { sceneId } = await createScene(tx, { ...input, name: "Events", copyFromSceneId: defaultSceneId });
  await showScene(tx, { ...input, sceneId });
  await deleteScene(tx, { ...input, sceneId });
  expect((await profileRow(tx, input.profileId)).activeSceneId).toBeNull();
  expect(await blocks(tx, sceneId)).toHaveLength(0);
  expect(await tx.select().from(scenes).where(eq(scenes.id, sceneId))).toHaveLength(0);
}));
test("another profile's scene is not found", () => rollback(db, async tx => {
  const { input } = await setup(tx);
  const { scene } = await insertProfileWithScene(tx, input.accountId);
  const before = await tx.select().from(scenes);
  for (const call of [
    () => createScene(tx, { ...input, name: "Copy", copyFromSceneId: scene.id }),
    () => renameScene(tx, { ...input, sceneId: scene.id, name: "Other" }),
    () => showScene(tx, { ...input, sceneId: scene.id }),
    () => deleteScene(tx, { ...input, sceneId: scene.id }),
  ]) await expect(call()).rejects.toMatchObject({ code: "not_found" });
  expect(await tx.select().from(scenes)).toEqual(before);
}));
