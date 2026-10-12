import { eq } from "drizzle-orm";
import { beforeAll, expect, test, vi } from "vitest";
import { cards, profiles } from "@/db/schema";
vi.mock("@/config/env", () => ({ env: { cloudinaryCloudName: "demo" } }));
import { insertAccount, insertProfileWithScene, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { createProfileFromStarter, publishProfile, unpublishProfile, updateIdentity } from "./profiles";
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

test.each([false, true])("owned preview uses the fixed image transformation (logo: %s)", isLogo => rollback(db, async tx => {
  const input = await setup(tx);
  await tx.update(profiles).set({ imageAssetId: "a/b", imageIsLogo: isLogo }).where(eq(profiles.id, input.profileId));
  const view = await loadOwnerSceneView(tx, input);
  expect(view?.identity.image).toEqual({ url: `https://res.cloudinary.com/demo/image/upload/${isLogo ? "c_fit" : "c_fill,g_face"},w_256,h_256,f_auto,q_auto/a/b`, isLogo });
}));

import { randomUUID } from "node:crypto";
import { accounts } from "@/db/schema";
import { createScene } from "./scenes";
import { loadPublicSceneView } from "./view";
import { loadCurrentPublicSceneView, loadVersionedPublicSceneView } from "./view";
import { deleteScene, showScene } from "./scenes";

test("a changed revision cannot populate an old public cache key", () => rollback(db, async tx => {
  const input = await setup(tx);
  await publishProfile(tx, input);
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, input.profileId));
  const key = { profileId: input.profileId, sceneId: profile.defaultSceneId!, version: profile.contentVersion };
  expect(await loadVersionedPublicSceneView(tx, key)).not.toBeNull();
  await updateIdentity(tx, { ...input, identity: { fullName: "Changed", headline: "Designer", bio: null, phone: null, email: "ana@e.test", website: null, company: null, location: null } });
  expect(await loadVersionedPublicSceneView(tx, key)).toBeNull();
}));
test.each(["unpublish", "delete shown scene"])("%s during cached resolution never returns a stale DTO", change => rollback(db, async tx => {
  const input = await setup(tx);
  const { sceneId } = await createScene(tx, { ...input, name: "Private later", copyFromSceneId: null });
  await showScene(tx, { ...input, sceneId });
  await publishProfile(tx, input);
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, input.profileId));
  const key = { profileId: input.profileId, sceneId, version: profile.contentVersion };
  const cached = await loadVersionedPublicSceneView(tx, key);
  expect(cached).not.toBeNull();
  const view = await loadCurrentPublicSceneView(tx, key, async () => {
    if (change === "unpublish") await unpublishProfile(tx, input);
    else await deleteScene(tx, { ...input, sceneId });
    return cached;
  });
  expect(view).toBeNull();
}));
test("unpublishing cannot poison a content cache key reused on republish", () => rollback(db, async tx => {
  const input = await setup(tx);
  await publishProfile(tx, input);
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, input.profileId));
  const key = { profileId: input.profileId, sceneId: profile.defaultSceneId!, version: profile.contentVersion };
  await unpublishProfile(tx, input);
  const content = await loadVersionedPublicSceneView(tx, key);
  expect(content).not.toBeNull();
  expect(await loadCurrentPublicSceneView(tx, key, async () => content)).toBeNull();
  await publishProfile(tx, input);
  expect(await loadCurrentPublicSceneView(tx, key, async () => content)).not.toBeNull();
}));

test("public view shows the requested scene and falls back to the Default Scene", () => rollback(db, async tx => {
  const input = await setup(tx);
  const { sceneId } = await createScene(tx, { ...input, name: "Events", copyFromSceneId: null });
  expect((await loadPublicSceneView(tx, { profileId: input.profileId, sceneId }))?.scene.name).toBe("Events");
  expect((await loadPublicSceneView(tx, { profileId: input.profileId, sceneId: randomUUID() }))?.scene.name).toBe("Clients");
}));
test("public view of a missing profile is null", () => rollback(db, async tx => {
  expect(await loadPublicSceneView(tx, { profileId: randomUUID(), sceneId: randomUUID() })).toBeNull();
}));
test("public view carries no account, card or sign-in data", () => rollback(db, async tx => {
  const input = await setup(tx);
  const [account] = await tx.select().from(accounts).where(eq(accounts.id, input.accountId));
  const [card] = await tx.select().from(cards).where(eq(cards.profileId, input.profileId));
  const json = JSON.stringify(await loadPublicSceneView(tx, { profileId: input.profileId, sceneId: randomUUID() }));
  for (const secret of [input.accountId, input.profileId, account.email, card.id, card.publicToken!]) expect(json).not.toContain(secret);
}));
