import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards } from "@/db/schema";
import { insertAccount, insertProfileWithScene, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { createProfileFromStarter } from "./profiles";
import { loadOwnerSceneView } from "./view";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
async function setup(tx: TestTx) {
  const owner = await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  const { profileId } = await createProfileFromStarter(tx, { accountId: owner.id, cardId: card.id, purpose: "get_clients", essentials: { fullName: "Ana", headline: "Designer", bio: null, email: "ana@e.test", phone: null, link: "https://cal.com/ana" } });
  return { accountId: owner.id, profileId };
}
test("loads the shown Default Scene for an owned starter profile", () => rollback(db, async tx => {
  const input = await setup(tx);
  const view = await loadOwnerSceneView(tx, input);
  expect(view?.scene.name).toBe("Clients");
  expect(view?.blocks.map(b => b.type)).toEqual(["booking", "form", "contact"]);
  expect(view?.identity.image).toBeNull();
}));
test("another profile's scene falls back to the shown Scene", () => rollback(db, async tx => {
  const input = await setup(tx);
  const { scene } = await insertProfileWithScene(tx, input.accountId);
  const normal = await loadOwnerSceneView(tx, input);
  expect(await loadOwnerSceneView(tx, { ...input, sceneId: scene.id })).toEqual(normal);
}));
test("another account receives no view", () => rollback(db, async tx => {
  const input = await setup(tx);
  expect(await loadOwnerSceneView(tx, { ...input, accountId: (await insertAccount(tx)).id })).toBeNull();
}));
