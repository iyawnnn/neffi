import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards, profiles } from "@/db/schema";
import { insertAccount, insertClaimedCard, insertProvisioningDbc, insertReadyDbc, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { createProfileFromStarter, publishProfile, unpublishProfile } from "../profiles/profiles";
import { createScene, showScene } from "../profiles/scenes";
import { retireCard } from "./card";
import { setCardDisabled } from "./manage";
import { resolveCard } from "./resolve";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

async function publishedCard(tx: TestTx, accountId?: string, fullName = "Ana") {
  const owner = accountId ?? (await insertAccount(tx)).id;
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner }).where(eq(cards.id, card.id));
  const { profileId } = await createProfileFromStarter(tx, { accountId: owner, cardId: card.id, purpose: "get_clients", essentials: { fullName, headline: "Designer", bio: null, email: "ana@e.test", phone: null, link: "https://cal.com/ana" } });
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
  expect(await resolveCard(tx, c.card.publicToken!)).toEqual({ status: "published", cardId: c.card.id, ownerAccountId: c.accountId, profileId: c.profileId, sceneId: c.defaultSceneId, version: 0 });
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
