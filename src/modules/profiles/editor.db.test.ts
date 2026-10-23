import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards, profiles } from "@/db/schema";
import { insertAccount, insertProfileWithScene, insertReleasedDbc } from "@/db/test-fixtures";
import { createSetupTestProfile } from "@/db/setup-test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { addBlock } from "./blocks";
import { blockForEditing, sceneForEditing } from "./editor";
import { createScene } from "./scenes";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
async function setup(tx: TestTx) {
  const owner = await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  const { profileId } = await createSetupTestProfile(tx, { accountId: owner.id, cardId: card.id, goal: "networking", identity: { fullName: "Ana", headline: null, company: null, bio: "A".repeat(80), email: "ana@e.test", phone: null, website: null, location: null }, content: [{ type: "contact", content: { saveContact: true } }, { type: "link", content: { kind: "custom", label: "", url: "https://github.com/ana" } }, { type: "about", content: { text: "A".repeat(80) } }, { type: "form", content: {}, preset: "connect" }] });
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, profileId));
  return { accountId: owner.id, profileId, sceneId: profile.defaultSceneId! };
}
test("blocks return in position order with every type's friendly summary", () => rollback(db, async tx => {
  const input = await setup(tx);
  await addBlock(tx, { ...input, type: "project", content: { title: "Site" } });
  await addBlock(tx, { ...input, type: "booking", content: { url: "cal.com/ana" } });
  const edit = await sceneForEditing(tx, input.accountId, input.profileId, input.sceneId);
  expect(edit?.scene).toEqual({ id: input.sceneId, name: "Networking", isDefault: true, isShown: true });
  expect(edit?.blocks.map(b => b.summary)).toEqual(["Save Contact on", "Other", "A".repeat(60), "Let's connect", "Site", "Book a time"]);
  const block = edit!.blocks[1];
  expect(await blockForEditing(tx, input.accountId, input.profileId, block.id)).toMatchObject({ id: block.id, sceneId: input.sceneId, type: "link", content: block.content });
}));
test("another account receives no editing data", () => rollback(db, async tx => {
  const input = await setup(tx);
  const edit = await sceneForEditing(tx, input.accountId, input.profileId, input.sceneId);
  const other = await insertAccount(tx);
  expect(await sceneForEditing(tx, other.id, input.profileId, input.sceneId)).toBeNull();
  expect(await blockForEditing(tx, other.id, input.profileId, edit!.blocks[0].id)).toBeNull();
}));
test("a scene of another profile is not returned", () => rollback(db, async tx => {
  const input = await setup(tx);
  const { scene } = await insertProfileWithScene(tx, input.accountId);
  expect(await sceneForEditing(tx, input.accountId, input.profileId, scene.id)).toBeNull();
}));

 test("form editing data includes its shared form title and configuration", () => rollback(db, async tx => {
  const input = await setup(tx);
  const edit = await sceneForEditing(tx, input.accountId, input.profileId, input.sceneId);
  const block = edit!.blocks.find(b => b.type === "form")!;
  const row = await blockForEditing(tx, input.accountId, input.profileId, block.id);
  expect(row).toMatchObject({ form: { id: row!.formId, title: "Let's connect", config: { fields: { name: "required", email: "required" }, questions: [] } } });
}));

test("form editing data reports how many profile modes share a form", () => rollback(db, async tx => {
  const input = await setup(tx);
  const edit = await sceneForEditing(tx, input.accountId, input.profileId, input.sceneId);
  const form = edit!.blocks.find(block => block.type === "form")!;
  await createScene(tx, { ...input, name: "Copied", copyFromSceneId: input.sceneId });
  const row = await blockForEditing(tx, input.accountId, input.profileId, form.id, input.sceneId);
  expect(row?.form?.useCount).toBe(2);
}));

test("a route-scoped item read does not return an item from another mode", () => rollback(db, async tx => {
  const input = await setup(tx);
  const { sceneId } = await createScene(tx, { ...input, name: "Other", copyFromSceneId: null });
  const edit = await sceneForEditing(tx, input.accountId, input.profileId, input.sceneId);
  expect(await blockForEditing(tx, input.accountId, input.profileId, edit!.blocks[0].id, sceneId)).toBeNull();
}));
