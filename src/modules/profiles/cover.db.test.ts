import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { profiles, sceneBlocks } from "@/db/schema";
import { insertAccount, insertProfileWithScene } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { deleteProfile, getOwnedProfile, publishProfile, setProfileCover, setProfileCoverCrop, updateAppearance } from "./profiles";
import { loadCurrentPublicSceneView, loadOwnerSceneView, loadPublicSceneView, loadVersionedPublicSceneView } from "./view";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
afterAll(async () => { await db.$client.close(); });
const crop = { x: 10, y: 20, width: 1200 };
const cover = (profileId: string) => ({ assetId: `neffi/profiles/${profileId}/cover/${randomUUID()}`, width: 1600, height: 900, crop });

test("set, replace, recrop and remove are owned, atomic, bump once, and preserve identity/layout", () => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile } = await insertProfileWithScene(tx, owner.id);
  const input = { accountId: owner.id, profileId: profile.id };
  const row = async () => (await tx.select().from(profiles).where(eq(profiles.id, profile.id)))[0];
  const first = cover(profile.id), second = cover(profile.id);
  expect(await setProfileCover(tx, { ...input, cover: first })).toEqual({ previousAssetId: null });
  expect(await row()).toMatchObject({ coverAssetId: first.assetId, coverWidth: 1600, coverHeight: 900, coverCropX: 10, coverCropY: 20, coverCropWidth: 1200, contentVersion: 1, imageAssetId: null });
  expect(await setProfileCover(tx, { ...input, cover: second })).toEqual({ previousAssetId: first.assetId });
  expect((await row()).contentVersion).toBe(2);
  await setProfileCoverCrop(tx, { ...input, crop: { x: 1000, y: 700, width: 600 } });
  expect(await row()).toMatchObject({ coverCropX: 1000, coverCropY: 700, coverCropWidth: 600, contentVersion: 3 });
  await updateAppearance(tx, { ...input, layout: "editorial", accentColor: "#0C0C0D" });
  expect((await row()).coverAssetId).toBe(second.assetId);
  expect(await getOwnedProfile(tx, owner.id, profile.id)).toMatchObject({ coverAssetId: second.assetId, coverWidth: 1600, coverHeight: 900 });
  expect(await setProfileCover(tx, { ...input, cover: null })).toEqual({ previousAssetId: second.assetId });
  expect(await row()).toMatchObject({ coverAssetId: null, coverWidth: null, coverHeight: null, coverCropX: null, coverCropY: null, coverCropWidth: null, contentVersion: 5 });
  await expect(setProfileCoverCrop(tx, { ...input, crop })).rejects.toMatchObject({ code: "invalid" });
  expect((await row()).contentVersion).toBe(5);
}));

test("invalid cover metadata never mutates active state or version", () => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile } = await insertProfileWithScene(tx, owner.id);
  const input = { accountId: owner.id, profileId: profile.id };
  const valid = cover(profile.id);
  await setProfileCover(tx, { ...input, cover: valid });
  const read = async () => (await tx.select().from(profiles).where(eq(profiles.id, profile.id)))[0];
  const before = await read();
  for (const bad of [
    { ...valid, assetId: `neffi/profiles/${profile.id}/${randomUUID()}` },
    { ...valid, assetId: cover(randomUUID()).assetId },
    { ...valid, width: 0 }, { ...valid, height: 2049 }, { ...valid, width: 1200.5 },
    { ...valid, crop: { ...crop, x: -1 } }, { ...valid, crop: { ...crop, y: 800 } },
    { ...valid, crop: { ...crop, width: 599 } }, { ...valid, crop: { ...crop, width: NaN } },
    { ...valid, crop: { ...crop, x: 600 } },
  ]) {
    await expect(setProfileCover(tx, { ...input, cover: bad })).rejects.toMatchObject({ code: "invalid" });
    expect(await read()).toEqual(before);
  }
  await expect(setProfileCoverCrop(tx, { ...input, crop: { x: 1001, y: 0, width: 600 } })).rejects.toMatchObject({ code: "invalid" });
  expect(await read()).toEqual(before);
  for (const mutate of [
    () => setProfileCover(tx, { ...input, accountId: randomUUID(), cover: valid }),
    () => setProfileCoverCrop(tx, { ...input, accountId: randomUUID(), crop }),
    () => setProfileCover(tx, { ...input, accountId: randomUUID(), cover: null }),
  ]) await expect(mutate()).rejects.toMatchObject({ code: "not_found" });
  expect(await read()).toEqual(before);
}));

test("cover lives on appearance for owner/public views and invalidates old public versions", () => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile, scene } = await insertProfileWithScene(tx, owner.id);
  const input = { accountId: owner.id, profileId: profile.id };
  await tx.update(profiles).set({ fullName: "Synthetic", email: "cover@example.invalid" }).where(eq(profiles.id, profile.id));
  await tx.insert(sceneBlocks).values({ sceneId: scene.id, type: "contact", position: 0, content: { saveContact: true } });
  await publishProfile(tx, input);
  const key = { profileId: profile.id, sceneId: scene.id, version: 0 };
  const before = await loadVersionedPublicSceneView(tx, key);
  expect(before?.appearance.cover).toBeNull();
  await setProfileCover(tx, { ...input, cover: cover(profile.id) });
  expect(await loadVersionedPublicSceneView(tx, key)).toBeNull();
  expect(await loadCurrentPublicSceneView(tx, key, async () => before)).toBeNull();
  const current = { ...key, version: 1 };
  const ownerView = await loadOwnerSceneView(tx, input);
  const publicView = await loadPublicSceneView(tx, current);
  expect(ownerView?.appearance.cover?.src).toContain("c_crop,x_10,y_20,w_1200,h_400/c_limit,w_1080/f_auto,q_auto");
  expect(ownerView?.appearance.cover?.srcSet).toContain("1600w");
  expect(publicView).toEqual(ownerView);
  expect(await loadVersionedPublicSceneView(tx, current)).toEqual(ownerView);
  expect(ownerView?.identity).toEqual(before?.identity);
  expect(ownerView?.blocks).toEqual(before?.blocks);
  await setProfileCoverCrop(tx, { ...input, crop: { x: 0, y: 0, width: 601 } });
  expect(await loadVersionedPublicSceneView(tx, current)).toBeNull();
  expect((await loadOwnerSceneView(tx, input))?.appearance.cover?.src).toContain("w_601,h_200");
  await setProfileCover(tx, { ...input, cover: null });
  expect((await loadOwnerSceneView(tx, input))?.appearance.cover).toBeNull();
}));

test("deletion returns photo and cover independently after removing the profile", () => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const { profile } = await insertProfileWithScene(tx, owner.id);
  const asset = cover(profile.id);
  await tx.update(profiles).set({ imageAssetId: `neffi/profiles/${profile.id}/${randomUUID()}` }).where(eq(profiles.id, profile.id));
  await setProfileCover(tx, { accountId: owner.id, profileId: profile.id, cover: asset });
  expect(await deleteProfile(tx, { accountId: owner.id, profileId: profile.id })).toMatchObject({ imageAssetId: expect.any(String), coverAssetId: asset.assetId });
  expect(await tx.select().from(profiles).where(eq(profiles.id, profile.id))).toEqual([]);
}));
