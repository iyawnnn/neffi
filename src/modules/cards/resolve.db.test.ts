import { randomUUID } from "node:crypto";
import { asc, and, eq } from "drizzle-orm";
import { beforeAll, expect, test, vi } from "vitest";
import { cards, profiles, sceneBlocks } from "@/db/schema";
import { insertAccount, insertClaimedCard, insertProvisioningDbc, insertReadyDbc, insertReleasedDbc } from "@/db/test-fixtures";
import { createSetupTestProfile } from "@/db/setup-test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { publishProfile, unpublishProfile, updateIdentity } from "../profiles/profiles";
import { createScene, showScene } from "../profiles/scenes";
import { retireCard } from "./card";
import { connectCardToProfile, setCardDisabled } from "./manage";
import { resolveCard } from "./resolve";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

async function publishedCard(tx: TestTx, accountId?: string, fullName = "Ana") {
  const owner = accountId ?? (await insertAccount(tx)).id;
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner }).where(eq(cards.id, card.id));
  const { profileId } = await createSetupTestProfile(tx, { accountId: owner, cardId: card.id, goal: "business", identity: { fullName, headline: "Designer", company: null, bio: null, email: "ana@e.test", phone: null, website: null, location: null }, content: [{ type: "booking", content: { label: "", url: "https://cal.com/ana" } }, { type: "form", content: {}, preset: "project_inquiry" }, { type: "contact", content: { saveContact: true } }] });
  await publishProfile(tx, { accountId: owner, profileId });
  const [{ defaultSceneId }] = await tx.select({ defaultSceneId: profiles.defaultSceneId }).from(profiles).where(eq(profiles.id, profileId));
  return { accountId: owner, card: { ...card, ownerAccountId: owner }, profileId, defaultSceneId: defaultSceneId! };
}
const nothing = { status: "unavailable", cardId: null, ownerAccountId: null };

test.each(["", "not a token!", "A".repeat(65), "ZZZZZZZZZZZZZZZZZZZZZZZZZZ"])("unknown or malformed token %j is unavailable", token => rollback(db, async tx => {
  expect(await resolveCard(tx, token)).toEqual(nothing);
}));
test("a Published, enabled, claimed card resolves to its profile's Default Scene", () => rollback(db, async tx => {
  const c = await publishedCard(tx);
  expect(await resolveCard(tx, c.card.publicToken!)).toEqual({ status: "published", cardId: c.card.id, ownerAccountId: c.accountId, profileId: c.profileId, sceneId: c.defaultSceneId, version: 3 });
}));
test("the shown scene wins over the Default Scene", () => rollback(db, async tx => {
  const c = await publishedCard(tx);
  const { sceneId } = await createScene(tx, { accountId: c.accountId, profileId: c.profileId, name: "Events", copyFromSceneId: c.defaultSceneId });
  await showScene(tx, { accountId: c.accountId, profileId: c.profileId, sceneId });
  expect(await resolveCard(tx, c.card.publicToken!)).toMatchObject({ status: "published", sceneId });
}));
test.each([
  ["blank (in provisioning)", async (tx: TestTx) => (await insertProvisioningDbc(tx)).card],
  ["ready (unsold)", async (tx: TestTx) => (await insertReadyDbc(tx)).card],
  ["sold but unclaimed", async (tx: TestTx) => (await insertReleasedDbc(tx)).card],
  ["retired", async (tx: TestTx) => { const { card } = await insertProvisioningDbc(tx); await retireCard(tx, { actorId: (await insertAccount(tx, "owner")).id, cardId: card.id, reason: "test" }); return card; }],
])("an ownerless card that is %s is unavailable", (_name, make) => rollback(db, async tx => {
  const card = await make(tx);
  expect(await resolveCard(tx, card.publicToken!)).toEqual({ status: "unavailable", cardId: card.id, ownerAccountId: null });
}));
test.each([
  ["claimed with no profile", async (tx: TestTx) => { const { card, owner } = await insertClaimedCard(tx); await tx.update(cards).set({ profileId: null }).where(eq(cards.id, card.id)); return { card, accountId: owner.id }; }],
  ["showing a Draft profile", async (tx: TestTx) => { const { card, owner } = await insertClaimedCard(tx); return { card, accountId: owner.id }; }],
  ["turned off", async (tx: TestTx) => { const c = await publishedCard(tx); await setCardDisabled(tx, { accountId: c.accountId, cardId: c.card.id, disabled: true }); return c; }],
  ["showing an Unpublished profile", async (tx: TestTx) => { const c = await publishedCard(tx); await unpublishProfile(tx, { accountId: c.accountId, profileId: c.profileId }); return c; }],
])("an owned card %s is unavailable but keeps its owner for the owner shortcut", (_name, make) => rollback(db, async tx => {
  const { card, accountId } = await make(tx);
  expect(await resolveCard(tx, card.publicToken!)).toEqual({ status: "unavailable", cardId: card.id, ownerAccountId: accountId });
}));

vi.mock("@/config/env", () => ({ env: { cloudinaryCloudName: "demo" } }));
import { setBlockVisible } from "../profiles/blocks";
import { submitForm } from "../forms/submissions";
import { loadPublicSceneView } from "../profiles/view";
import type { SceneView } from "../profiles/scene-view";
import { resolvePublicExperience, type ViewLoader } from "./resolve";

// Stands in for "use cache": entries live across "requests" and are only ever looked up by key.
function cache(tx: TestTx) {
  const entries = new Map<string, Promise<SceneView | null>>();
  const misses: string[] = [];
  const load: ViewLoader = key => {
    const id = JSON.stringify(key);
    if (!entries.has(id)) { misses.push(id); entries.set(id, loadPublicSceneView(tx, key)); }
    return entries.get(id)!;
  };
  return { load, misses };
}
const name = async (tx: TestTx, token: string, load: ViewLoader) => {
  const experience = await resolvePublicExperience(tx, token, load);
  return experience.status === "published" ? experience.view.identity.fullName : "unavailable";
};

test("a warm cache never hides turning a card off; turning it on reuses the entry", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load, misses } = cache(tx); const token = c.card.publicToken!;
  expect(await name(tx, token, load)).toBe("Ana");
  expect(await name(tx, token, load)).toBe("Ana");
  expect(misses).toHaveLength(1);
  await setCardDisabled(tx, { accountId: c.accountId, cardId: c.card.id, disabled: true });
  expect(await name(tx, token, load)).toBe("unavailable");
  await setCardDisabled(tx, { accountId: c.accountId, cardId: c.card.id, disabled: false });
  expect(await name(tx, token, load)).toBe("Ana");
  expect(misses).toHaveLength(1);
}));
test("unpublishing hides at once and publishing shows again", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load } = cache(tx); const token = c.card.publicToken!;
  await name(tx, token, load);
  await unpublishProfile(tx, { accountId: c.accountId, profileId: c.profileId });
  expect(await name(tx, token, load)).toBe("unavailable");
  await publishProfile(tx, { accountId: c.accountId, profileId: c.profileId });
  expect(await name(tx, token, load)).toBe("Ana");
}));
test("edits and scene switches show on the next tap despite a warm cache", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load } = cache(tx); const token = c.card.publicToken!;
  await name(tx, token, load);
  await updateIdentity(tx, { accountId: c.accountId, profileId: c.profileId, identity: { fullName: "Ana Cruz", headline: null, company: null, bio: null, phone: null, email: "ana@e.test", website: null, location: null } });
  expect(await name(tx, token, load)).toBe("Ana Cruz");
  const [booking] = await tx.select().from(sceneBlocks).where(eq(sceneBlocks.sceneId, c.defaultSceneId)).orderBy(asc(sceneBlocks.position));
  await setBlockVisible(tx, { accountId: c.accountId, profileId: c.profileId, blockId: booking.id, visible: false });
  const hidden = await resolvePublicExperience(tx, token, load);
  expect(hidden.status === "published" && hidden.view.blocks.map(b => b.type)).toEqual(["form", "contact"]);
  const { sceneId } = await createScene(tx, { accountId: c.accountId, profileId: c.profileId, name: "Events", copyFromSceneId: null });
  await showScene(tx, { accountId: c.accountId, profileId: c.profileId, sceneId });
  const switched = await resolvePublicExperience(tx, token, load);
  expect(switched.status === "published" && switched.view.scene.name).toBe("Events");
}));
test("two cards on one profile share content; turning one off leaves the other", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load } = cache(tx);
  const { card: second } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: c.accountId }).where(eq(cards.id, second.id));
  await connectCardToProfile(tx, { accountId: c.accountId, cardId: second.id, profileId: c.profileId });
  expect(await name(tx, second.publicToken!, load)).toBe("Ana");
  await setCardDisabled(tx, { accountId: c.accountId, cardId: c.card.id, disabled: true });
  expect(await name(tx, c.card.publicToken!, load)).toBe("unavailable");
  expect(await name(tx, second.publicToken!, load)).toBe("Ana");
}));
test("reconnecting a card to another owned profile shows that profile on the next tap", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load } = cache(tx);
  const other = await publishedCard(tx, c.accountId, "Ben");
  expect(await name(tx, c.card.publicToken!, load)).toBe("Ana");
  await connectCardToProfile(tx, { accountId: c.accountId, cardId: c.card.id, profileId: other.profileId });
  expect(await name(tx, c.card.publicToken!, load)).toBe("Ben");
}));
test("a view that cannot be built is unavailable, never a broken page", () => rollback(db, async tx => {
  const c = await publishedCard(tx);
  expect(await resolvePublicExperience(tx, c.card.publicToken!, async () => null)).toEqual({ status: "unavailable", cardId: c.card.id, ownerAccountId: c.accountId });
}));
test("a form shown on the page stops accepting once its block is hidden", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load } = cache(tx);
  const shown = await resolvePublicExperience(tx, c.card.publicToken!, load);
  const form = shown.status === "published" ? shown.view.blocks.find(b => b.type === "form") : undefined;
  expect(form?.type).toBe("form");
  const [block] = await tx.select().from(sceneBlocks).where(and(eq(sceneBlocks.sceneId, c.defaultSceneId), eq(sceneBlocks.type, "form")));
  await setBlockVisible(tx, { accountId: c.accountId, profileId: c.profileId, blockId: block.id, visible: false });
  expect(await submitForm(tx, { formId: block.formId!, clientKey: randomUUID(), answers: { name: "Vic", email: "vic@e.test", message: "Hi" } })).toEqual({ status: "unavailable" });
}));
