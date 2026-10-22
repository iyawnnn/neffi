import { asc, eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards, formDefinitions, profiles, sceneBlocks } from "@/db/schema";
import { insertAccount, insertProfileWithScene, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { addBlock, deleteBlock, moveBlock, setBlockVisible, updateBlock } from "./blocks";
import { createProfileFromStarter, publishProfile, upsertContactBlock } from "./profiles";
import { createScene } from "./scenes";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
async function setup(tx: TestTx) {
  const owner = await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  const { profileId } = await createProfileFromStarter(tx, { accountId: owner.id, cardId: card.id, purpose: "show_my_work", essentials: { fullName: "Ana", headline: null, bio: "Hi", email: "ana@e.test", phone: null, link: "https://ana.example/" } });
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, profileId));
  return { accountId: owner.id, profileId, sceneId: profile.defaultSceneId! };
}
const rows = (tx: TestTx, sceneId: string) => tx.select().from(sceneBlocks).where(eq(sceneBlocks.sceneId, sceneId)).orderBy(asc(sceneBlocks.position));

test("adds validated blocks at the end", () => rollback(db, async tx => {
  const input = await setup(tx);
  const { blockId } = await addBlock(tx, { ...input, type: "project", content: { title: "Site", url: "site.test" } });
  expect((await rows(tx, input.sceneId))[3]).toMatchObject({ id: blockId, position: 3, content: { title: "Site", description: null, url: "https://site.test/" } });
  await expect(addBlock(tx, { ...input, type: "project", content: { title: "" } })).rejects.toMatchObject({ code: "invalid" });
  await expect(addBlock(tx, { ...input, type: "about", content: { text: "Hi", unexpected: true } })).rejects.toMatchObject({ code: "invalid" });
  expect(await rows(tx, input.sceneId)).toHaveLength(4);
}));
test("a form block creates its form from the preset; a sixth form is refused", () => rollback(db, async tx => {
  const input = await setup(tx);
  await expect(addBlock(tx, { ...input, type: "form", content: {} })).rejects.toMatchObject({ code: "invalid" });
  const { blockId } = await addBlock(tx, { ...input, type: "form", content: {}, preset: "contact" });
  const [block] = await tx.select().from(sceneBlocks).where(eq(sceneBlocks.id, blockId));
  expect((await tx.select().from(formDefinitions).where(eq(formDefinitions.id, block.formId!)))[0]).toMatchObject({ profileId: input.profileId, title: "Send me a message", preset: "contact" });
  for (let i = 0; i < 4; i++) await addBlock(tx, { ...input, type: "form", content: {}, preset: "connect" });
  await expect(addBlock(tx, { ...input, type: "form", content: {}, preset: "contact" })).rejects.toMatchObject({ code: "limit_reached" });
  expect(await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, input.profileId))).toHaveLength(5);
}));
test("the 21st block in a scene is refused", () => rollback(db, async tx => {
  const input = await setup(tx);
  for (let i = 3; i < 20; i++) await addBlock(tx, { ...input, type: "about", content: { text: `About ${i}` } });
  await expect(addBlock(tx, { ...input, type: "about", content: { text: "Extra" } })).rejects.toMatchObject({ code: "limit_reached" });
  expect(await rows(tx, input.sceneId)).toHaveLength(20);
}));
test("move keeps positions dense", () => rollback(db, async tx => {
  const input = await setup(tx);
  const { blockId } = await addBlock(tx, { ...input, type: "project", content: { title: "Site" } });
  await moveBlock(tx, { ...input, blockId, direction: "up" });
  const reordered = await rows(tx, input.sceneId);
  expect(reordered.map(b => b.type)).toEqual(["about", "link", "project", "contact"]);
  expect(reordered.map(b => b.position)).toEqual([0, 1, 2, 3]);
  await moveBlock(tx, { ...input, blockId: reordered[0].id, direction: "up" });
  await moveBlock(tx, { ...input, blockId: reordered[3].id, direction: "down" });
  expect(await rows(tx, input.sceneId)).toEqual(reordered);
}));
test("moving within a section swaps with the nearest block of that section", () => rollback(db, async tx => {
  const input = await setup(tx);
  const { blockId } = await addBlock(tx, { ...input, type: "project", content: { title: "Site" } });
  await moveBlock(tx, { ...input, blockId, direction: "up", among: ["about", "project"] });
  const reordered = await rows(tx, input.sceneId);
  expect(reordered.map(b => b.type)).toEqual(["project", "link", "contact", "about"]);
  await moveBlock(tx, { ...input, blockId, direction: "up", among: ["about", "project"] });
  expect(await rows(tx, input.sceneId)).toEqual(reordered);
}));
test("delete renumbers", () => rollback(db, async tx => {
  const input = await setup(tx);
  await addBlock(tx, { ...input, type: "project", content: { title: "Site" } });
  const before = await rows(tx, input.sceneId);
  await deleteBlock(tx, { ...input, blockId: before[1].id });
  const after = await rows(tx, input.sceneId);
  expect(after.map(b => b.id)).toEqual([before[0].id, before[2].id, before[3].id]);
  expect(after.map(b => b.position)).toEqual([0, 1, 2]);
}));
test("updateBlock revalidates; a form block's content cannot be edited here", () => rollback(db, async tx => {
  const input = await setup(tx);
  const link = (await rows(tx, input.sceneId))[1];
  await expect(updateBlock(tx, { ...input, blockId: link.id, content: { kind: "custom", url: "javascript:alert(1)" } })).rejects.toMatchObject({ code: "invalid" });
  await updateBlock(tx, { ...input, blockId: link.id, content: { kind: "custom", url: "ana.example", label: "Portfolio" } });
  expect((await rows(tx, input.sceneId))[1].content).toEqual({ kind: "custom", label: "Portfolio", url: "https://ana.example/" });
  const { blockId } = await addBlock(tx, { ...input, type: "form", content: {}, preset: "contact" });
  await expect(updateBlock(tx, { ...input, blockId, content: {} })).rejects.toMatchObject({ code: "invalid" });
}));
test("a Published profile keeps at least one visible block in its Default Scene", () => rollback(db, async tx => {
  const input = await setup(tx);
  await publishProfile(tx, input);
  const blocks = await rows(tx, input.sceneId);
  for (const block of blocks.slice(0, 2)) await setBlockVisible(tx, { ...input, blockId: block.id, visible: false });
  const last = { ...input, blockId: blocks[2].id };
  await expect(setBlockVisible(tx, { ...last, visible: false })).rejects.toMatchObject({ code: "not_ready", gaps: ["content"] });
  await expect(deleteBlock(tx, last)).rejects.toMatchObject({ code: "not_ready", gaps: ["content"] });
  const { sceneId } = await createScene(tx, { ...input, name: "Extra", copyFromSceneId: null });
  const { blockId } = await addBlock(tx, { ...input, sceneId, type: "about", content: { text: "Hi" } });
  await setBlockVisible(tx, { ...input, blockId, visible: false });
  expect((await rows(tx, sceneId))[0].visible).toBe(false);
}));
test("a block of another profile is not found", () => rollback(db, async tx => {
  const input = await setup(tx);
  const { scene } = await insertProfileWithScene(tx, input.accountId);
  const [block] = await tx.insert(sceneBlocks).values({ sceneId: scene.id, type: "about", position: 0, content: { text: "Other" } }).returning();
  const before = await tx.select().from(sceneBlocks);
  for (const call of [
    () => addBlock(tx, { ...input, sceneId: scene.id, type: "about", content: { text: "Hi" } }),
    () => updateBlock(tx, { ...input, blockId: block.id, content: { text: "New" } }),
    () => moveBlock(tx, { ...input, blockId: block.id, direction: "up" }),
    () => setBlockVisible(tx, { ...input, blockId: block.id, visible: false }),
    () => deleteBlock(tx, { ...input, blockId: block.id }),
  ]) await expect(call()).rejects.toMatchObject({ code: "not_found" });
  expect(await tx.select().from(sceneBlocks)).toEqual(before);
}));

test("upsertContactBlock uses the Default Scene once, preserves an existing block, and bumps once", () => rollback(db, async tx => {
  const input = await setup(tx);
  const before = (await tx.select().from(profiles).where(eq(profiles.id, input.profileId)))[0];
  const original = (await rows(tx, input.sceneId)).find(block => block.type === "contact")!;
  await upsertContactBlock(tx, { accountId: input.accountId, profileId: input.profileId, saveContact: false });
  const contacts = (await rows(tx, input.sceneId)).filter(block => block.type === "contact");
  const after = (await tx.select().from(profiles).where(eq(profiles.id, input.profileId)))[0];
  expect(contacts).toEqual([expect.objectContaining({ id: original.id, visible: original.visible, content: { saveContact: false } })]);
  expect(after.contentVersion).toBe(before.contentVersion + 1);
}));

test("upsertContactBlock inserts once when absent and repeated calls update the same item", () => rollback(db, async tx => {
  const input = await setup(tx);
  await tx.delete(sceneBlocks).where(eq(sceneBlocks.sceneId, input.sceneId));
  await addBlock(tx, { ...input, type: "about", content: { text: "Keep me" } });
  const { sceneId } = await createScene(tx, { ...input, name: "Other", copyFromSceneId: null });
  const before = (await tx.select().from(profiles).where(eq(profiles.id, input.profileId)))[0];
  await upsertContactBlock(tx, { ...input, saveContact: true });
  const contact = (await rows(tx, input.sceneId)).find(block => block.type === "contact")!;
  expect(contact).toMatchObject({ position: 1, visible: true, content: { saveContact: true } });
  await upsertContactBlock(tx, { ...input, saveContact: false });
  expect((await rows(tx, input.sceneId)).filter(block => block.type === "contact")).toEqual([expect.objectContaining({ id: contact.id, position: 1, content: { saveContact: false } })]);
  expect(await rows(tx, sceneId)).toEqual([]);
  expect((await tx.select().from(profiles).where(eq(profiles.id, input.profileId)))[0].contentVersion).toBe(before.contentVersion + 2);
}));

test("upsertContactBlock allows updating at the block limit and rejects another account", () => rollback(db, async tx => {
  const input = await setup(tx);
  await tx.delete(sceneBlocks).where(eq(sceneBlocks.sceneId, input.sceneId));
  for (let i = 0; i < 20; i++) await tx.insert(sceneBlocks).values({ sceneId: input.sceneId, type: "about", position: i, content: { text: `About ${i}` } });
  const before = (await tx.select().from(profiles).where(eq(profiles.id, input.profileId)))[0];
  await expect(upsertContactBlock(tx, { ...input, saveContact: true })).rejects.toMatchObject({ code: "limit_reached" });
  expect((await tx.select().from(profiles).where(eq(profiles.id, input.profileId)))[0]).toEqual(before);
  await tx.update(sceneBlocks).set({ type: "contact", content: { saveContact: false } }).where(eq(sceneBlocks.position, 0));
  await upsertContactBlock(tx, { ...input, saveContact: true });
  expect((await rows(tx, input.sceneId)).filter(block => block.type === "contact")).toHaveLength(1);
  await expect(upsertContactBlock(tx, { ...input, accountId: (await insertAccount(tx)).id, saveContact: true })).rejects.toMatchObject({ code: "not_found" });
}));

test("Contact upsert preserves hidden items and keeps a published profile publishable", () => rollback(db, async tx => {
  const input = await setup(tx);
  const original = (await rows(tx, input.sceneId)).find(block => block.type === "contact")!;
  await setBlockVisible(tx, { ...input, blockId: original.id, visible: false });
  await publishProfile(tx, input);
  await upsertContactBlock(tx, { ...input, saveContact: false });
  expect((await rows(tx, input.sceneId)).find(block => block.id === original.id)).toMatchObject({ visible: false, content: { saveContact: false } });
  await setBlockVisible(tx, { ...input, blockId: original.id, visible: true });
  for (const block of await rows(tx, input.sceneId)) {
    if (block.id !== original.id) await deleteBlock(tx, { ...input, blockId: block.id });
  }
  await upsertContactBlock(tx, { ...input, saveContact: false });
  await publishProfile(tx, input);
  expect(await rows(tx, input.sceneId)).toEqual([expect.objectContaining({ id: original.id, visible: true, content: { saveContact: false } })]);
}));
