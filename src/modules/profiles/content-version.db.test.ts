import { asc, eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards, formDefinitions, profiles, sceneBlocks } from "@/db/schema";
import { insertAccount, insertReleasedDbc } from "@/db/test-fixtures";
import { createSetupTestProfile } from "@/db/setup-test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { connectCardToProfile, setCardDisabled } from "../cards/manage";
import { PRESETS } from "../forms/config";
import { updateForm } from "../forms/forms";
import { addBlock, deleteBlock, moveBlock, setBlockVisible, updateBlock } from "./blocks";
import { publishProfile, setProfileGoal, setProfileImage, unpublishProfile, updateAppearance, updateIdentity } from "./profiles";
import { createScene, deleteScene, renameScene, showScene } from "./scenes";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

async function setup(tx: TestTx) {
  const account = await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: account.id }).where(eq(cards.id, card.id));
  const { profileId } = await createSetupTestProfile(tx, { accountId: account.id, cardId: card.id, identity: { fullName: "Ana", headline: null, company: null, bio: null, email: "ana@e.test", phone: null, website: null, location: null }, content: [{ type: "booking", content: { label: "", url: "https://cal.com/ana" } }, { type: "form", content: {}, preset: "project_inquiry" }, { type: "contact", content: { saveContact: true } }] });
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, profileId));
  const defaultSceneId = profile.defaultSceneId!;
  const blocks = await tx.select().from(sceneBlocks).where(eq(sceneBlocks.sceneId, defaultSceneId)).orderBy(asc(sceneBlocks.position));
  const [form] = await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, profileId));
  const { sceneId: extraSceneId } = await createScene(tx, { accountId: account.id, profileId, name: "Events", copyFromSceneId: null });
  return { accountId: account.id, cardId: card.id, profileId, defaultSceneId, extraSceneId, firstBlockId: blocks[0].id, formId: form.id };
}
type Ctx = Awaited<ReturnType<typeof setup>>;
const version = async (tx: TestTx, profileId: string) => (await tx.select({ v: profiles.contentVersion }).from(profiles).where(eq(profiles.id, profileId)))[0].v;
const own = (c: Ctx) => ({ accountId: c.accountId, profileId: c.profileId });
const identity = { fullName: "Ana B", headline: null, company: null, bio: null, phone: null, email: "ana@e.test", website: null, location: null };

const changes: [string, (tx: TestTx, c: Ctx) => Promise<unknown>][] = [
  ["identity", (tx, c) => updateIdentity(tx, { ...own(c), identity })],
  ["appearance", (tx, c) => updateAppearance(tx, { ...own(c), accentColor: "#1F5FAE", imageIsLogo: true })],
  ["layout, mode and accent together", (tx, c) => updateAppearance(tx, { ...own(c), layout: "showcase", colorMode: "dark", accentColor: "#0E7C86" })],
  ["Goal", (tx, c) => setProfileGoal(tx, { ...own(c), goal: "freelance" })],
  ["a new image", (tx, c) => setProfileImage(tx, { ...own(c), assetId: `neffi/profiles/${c.profileId}/00000000-0000-4000-8000-000000000000` })],
  ["renaming a scene", (tx, c) => renameScene(tx, { ...own(c), sceneId: c.defaultSceneId, name: "Work" })],
  ["showing another scene", (tx, c) => showScene(tx, { ...own(c), sceneId: c.extraSceneId })],
  ["adding a block", (tx, c) => addBlock(tx, { ...own(c), sceneId: c.defaultSceneId, type: "about", content: { text: "Hi" } })],
  ["editing a block", (tx, c) => updateBlock(tx, { ...own(c), blockId: c.firstBlockId, content: { label: "Book", url: "https://cal.com/ana" } })],
  ["moving a block", (tx, c) => moveBlock(tx, { ...own(c), blockId: c.firstBlockId, direction: "down" })],
  ["hiding a block", (tx, c) => setBlockVisible(tx, { ...own(c), blockId: c.firstBlockId, visible: false })],
  ["deleting a block", (tx, c) => deleteBlock(tx, { ...own(c), blockId: c.firstBlockId })],
  ["form settings", (tx, c) => updateForm(tx, { ...own(c), formId: c.formId, title: "Hello", config: PRESETS.contact.config })],
];
test.each(changes)("%s moves the content version by exactly one", (_name, run) => rollback(db, async tx => {
  const c = await setup(tx);
  const before = await version(tx, c.profileId);
  await run(tx, c);
  expect(await version(tx, c.profileId)).toBe(before + 1);
}));
test("deleting the shown scene moves the version (the Default Scene shows again)", () => rollback(db, async tx => {
  const c = await setup(tx);
  await showScene(tx, { ...own(c), sceneId: c.extraSceneId });
  const before = await version(tx, c.profileId);
  await deleteScene(tx, { ...own(c), sceneId: c.extraSceneId });
  expect(await version(tx, c.profileId)).toBe(before + 1);
}));

const steady: [string, (tx: TestTx, c: Ctx) => Promise<unknown>][] = [
  ["publish and unpublish (status is read fresh)", async (tx, c) => { await publishProfile(tx, own(c)); await unpublishProfile(tx, own(c)); }],
  ["unpublishing a Draft", (tx, c) => unpublishProfile(tx, own(c))],
  ["creating a scene that is not shown", (tx, c) => createScene(tx, { ...own(c), name: "Later", copyFromSceneId: c.defaultSceneId })],
  ["deleting a scene that is not shown", (tx, c) => deleteScene(tx, { ...own(c), sceneId: c.extraSceneId })],
  ["showing the scene already shown", (tx, c) => showScene(tx, { ...own(c), sceneId: c.defaultSceneId })],
  ["moving the first block up", (tx, c) => moveBlock(tx, { ...own(c), blockId: c.firstBlockId, direction: "up" })],
  ["removing an image that is not there", (tx, c) => setProfileImage(tx, { ...own(c), assetId: null })],
  ["connecting a card to the profile it already shows", (tx, c) => connectCardToProfile(tx, { accountId: c.accountId, cardId: c.cardId, profileId: c.profileId })],
  ["turning a card off and on", async (tx, c) => { await setCardDisabled(tx, { accountId: c.accountId, cardId: c.cardId, disabled: true }); await setCardDisabled(tx, { accountId: c.accountId, cardId: c.cardId, disabled: false }); }],
];
test.each(steady)("%s leaves the content version alone", (_name, run) => rollback(db, async tx => {
  const c = await setup(tx);
  const before = await version(tx, c.profileId);
  await run(tx, c);
  expect(await version(tx, c.profileId)).toBe(before);
}));
test("explicit setup content advances the version once per item", () => rollback(db, async tx => {
  expect(await version(tx, (await setup(tx)).profileId)).toBe(3);
}));
