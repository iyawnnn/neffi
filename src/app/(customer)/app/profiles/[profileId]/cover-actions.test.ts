import { beforeEach, expect, test, vi } from "vitest";
import { hmacHex } from "@/auth/otp-quota";
import { ProfileError } from "@/modules/profiles/errors";

const m = vi.hoisted(() => ({ authorize: vi.fn(), owned: vi.fn(), lock: vi.fn(), transaction: vi.fn(), quota: vi.fn(), sign: vi.fn(), imageId: vi.fn(), coverId: vi.fn(), get: vi.fn(), check: vi.fn(), destroy: vi.fn(), setCover: vi.fn(), setCrop: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/config/env", () => ({ env: { betterAuthSecret: "synthetic-media-secret", cloudinaryCloudName: "demo", cloudinaryApiKey: "key", cloudinaryApiSecret: "secret" } }));
vi.mock("@/auth/otp-quota", async importOriginal => ({ ...await importOriginal<typeof import("@/auth/otp-quota")>(), consumeQuota: m.quota }));
vi.mock("@/integrations/media/cloudinary", () => ({ signImageUpload: m.sign, isProfileImageId: m.imageId, isProfileCoverId: m.coverId, getImage: m.get, checkImage: m.check, destroyImage: m.destroy }));
vi.mock("@/modules/profiles/profiles", () => ({ getOwnedProfile: m.owned, lockOwnedProfile: m.lock, setProfileCover: m.setCover, setProfileCoverCrop: m.setCrop }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));

import { confirmCoverAction, discardCoverUploadAction, removeCoverAction, startImageUploadAction, updateCoverCropAction } from "./actions";

const PROFILE = "11111111-1111-4111-8111-111111111111";
const CONFIG = { cloudName: "demo", apiKey: "key", apiSecret: "secret" };
const CROP = { x: 10, y: 20, width: 1200 };
beforeEach(() => {
  vi.resetAllMocks();
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } });
  m.owned.mockResolvedValue({ id: PROFILE, coverAssetId: null }); m.quota.mockResolvedValue(true);
  m.lock.mockResolvedValue({ id: PROFILE, coverAssetId: null }); m.transaction.mockImplementation(async callback => callback({}));
  m.coverId.mockReturnValue(true); m.get.mockResolvedValue({ bytes: 1, width: 1600, height: 900, format: "png" }); m.check.mockReturnValue(true);
  m.setCover.mockResolvedValue({ previousAssetId: "previous" }); m.setCrop.mockResolvedValue(undefined); m.destroy.mockResolvedValue(undefined);
});

test("cover signing uses the shared quota and the cover ticket", async () => {
  const ticket = { url: "https://upload.example.test", fields: {} }; m.sign.mockReturnValue(ticket);
  expect(await startImageUploadAction(PROFILE, "cover")).toEqual({ ticket });
  expect(m.quota.mock.calls[0]?.slice(1)).toEqual([hmacHex("synthetic-media-secret", "media-sign", "a1"), 20]);
  expect(m.sign).toHaveBeenCalledWith(CONFIG, { profileId: PROFILE, kind: "cover" });
});

test("invalid upload kinds never consume quota or sign", async () => {
  expect(await startImageUploadAction(PROFILE, "video")).toHaveProperty("error");
  expect(m.quota).not.toHaveBeenCalled(); expect(m.sign).not.toHaveBeenCalled();
});

test("cover signing refuses the shared quota before signing", async () => {
  m.quota.mockResolvedValue(false);
  expect(await startImageUploadAction(PROFILE, "cover")).toHaveProperty("error");
  expect(m.sign).not.toHaveBeenCalled();
});

test("foreign or photo ids never reach the cover provider path", async () => {
  m.coverId.mockReturnValue(false);
  expect(await confirmCoverAction(PROFILE, "photo", CROP)).toHaveProperty("error");
  expect(m.get).not.toHaveBeenCalled(); expect(m.destroy).not.toHaveBeenCalled(); expect(m.setCover).not.toHaveBeenCalled();
});

test("cover mutations authenticate and confirmation requires ownership", async () => {
  m.authorize.mockResolvedValue({ ok: false });
  for (const action of [() => confirmCoverAction(PROFILE, "cover", CROP), () => updateCoverCropAction(PROFILE, CROP), () => removeCoverAction(PROFILE), () => discardCoverUploadAction(PROFILE, "cover")]) {
    await expect(action()).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  }
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } });
  m.lock.mockRejectedValue(new ProfileError("not_found"));
  await expect(confirmCoverAction(PROFILE, "cover", CROP)).rejects.toThrow("NOT_FOUND");
  expect(m.get).not.toHaveBeenCalled(); expect(m.setCover).not.toHaveBeenCalled();
});

test("an invalid crop deletes only the rejected new cover", async () => {
  expect(await confirmCoverAction(PROFILE, "new-cover", { x: 1000, y: 0, width: 1200 })).toHaveProperty("error");
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "new-cover"); expect(m.setCover).not.toHaveBeenCalled();
});

test("missing media is never saved", async () => {
  m.get.mockResolvedValue(null);
  expect(await confirmCoverAction(PROFILE, "missing-cover", CROP)).toHaveProperty("error");
  expect(m.setCover).not.toHaveBeenCalled(); expect(m.destroy).not.toHaveBeenCalled();
});

test("invalid media is deleted without changing the stored cover", async () => {
  m.check.mockReturnValue(false);
  expect(await confirmCoverAction(PROFILE, "small-cover", CROP)).toHaveProperty("error");
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "small-cover"); expect(m.setCover).not.toHaveBeenCalled();
});

test("small source media gets the size error and candidate cleanup", async () => {
  m.get.mockResolvedValue({ bytes: 1, width: 599, height: 900, format: "png" });
  expect(await confirmCoverAction(PROFILE, "small-cover", CROP)).toEqual({ error: "Use a JPG, PNG, WebP or HEIC image up to 5 MB and at least 600 pixels wide." });
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "small-cover"); expect(m.setCover).not.toHaveBeenCalled();
});

test("schema-rejected dimensions delete the candidate without saving", async () => {
  m.get.mockResolvedValue({ bytes: 1, width: 0, height: 900, format: "png" });
  expect(await confirmCoverAction(PROFILE, "malformed-cover", CROP)).toHaveProperty("error");
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "malformed-cover"); expect(m.setCover).not.toHaveBeenCalled();
});

test("a replacement commits before old-cover cleanup", async () => {
  expect(await confirmCoverAction(PROFILE, "new-cover", CROP)).toEqual({ ok: true });
  expect(m.setCover).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, cover: { assetId: "new-cover", width: 1600, height: 900, crop: CROP } });
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "previous");
  expect(m.setCover.mock.invocationCallOrder[0]).toBeLessThan(m.destroy.mock.invocationCallOrder[0]);
});

test("cleanup failures do not undo successful replacement or removal", async () => {
  m.destroy.mockRejectedValue(new Error("offline"));
  expect(await confirmCoverAction(PROFILE, "new-cover", CROP)).toEqual({ ok: true });
  await expect(removeCoverAction(PROFILE)).resolves.toBeUndefined();
  expect(m.setCover).toHaveBeenNthCalledWith(1, {}, { accountId: "a1", profileId: PROFILE, cover: { assetId: "new-cover", width: 1600, height: 900, crop: CROP } });
  expect(m.setCover).toHaveBeenNthCalledWith(2, expect.objectContaining({ transaction: expect.any(Function) }), { accountId: "a1", profileId: PROFILE, cover: null });
});

test("locked cleanup preserves an asset made current after removal commits", async () => {
  m.lock.mockResolvedValue({ id: PROFILE, coverAssetId: "previous" });
  await removeCoverAction(PROFILE);
  expect(m.destroy).not.toHaveBeenCalled();
  expect(m.transaction).toHaveBeenCalled();
});

test("a failed cover save never deletes the active old cover", async () => {
  m.setCover.mockRejectedValue(new ProfileError("not_found"));
  await expect(confirmCoverAction(PROFILE, "new-cover", CROP)).rejects.toThrow("NOT_FOUND");
  expect(m.destroy).not.toHaveBeenCalled();
});

test("the current cover is never rechecked, replaced, or discarded", async () => {
  m.lock.mockResolvedValue({ id: PROFILE, coverAssetId: "current-cover" });
  expect(await confirmCoverAction(PROFILE, "current-cover", CROP)).toHaveProperty("error");
  expect(m.get).not.toHaveBeenCalled(); expect(m.setCover).not.toHaveBeenCalled(); expect(m.destroy).not.toHaveBeenCalled();
});

test("re-crop and remove delegate only after authentication", async () => {
  await updateCoverCropAction(PROFILE, CROP); await removeCoverAction(PROFILE);
  expect(m.setCrop).toHaveBeenCalledWith(expect.objectContaining({ transaction: expect.any(Function) }), { accountId: "a1", profileId: PROFILE, crop: CROP });
  expect(m.setCover).toHaveBeenLastCalledWith(expect.objectContaining({ transaction: expect.any(Function) }), { accountId: "a1", profileId: PROFILE, cover: null });
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "previous");
  expect(m.setCover.mock.invocationCallOrder[0]).toBeLessThan(m.destroy.mock.invocationCallOrder[0]);
});

test("re-crop and remove leave ownership to the domain service", async () => {
  m.setCrop.mockRejectedValue(new ProfileError("not_found"));
  await expect(updateCoverCropAction(PROFILE, CROP)).rejects.toThrow("NOT_FOUND");
  expect(m.destroy).not.toHaveBeenCalled();
  m.setCover.mockRejectedValue(new ProfileError("not_found"));
  await expect(removeCoverAction(PROFILE)).rejects.toThrow("not_found");
  expect(m.destroy).not.toHaveBeenCalled();
});

test("discard never deletes the stored cover", async () => {
  m.lock.mockResolvedValue({ id: PROFILE, coverAssetId: "current-cover" });
  await discardCoverUploadAction(PROFILE, "current-cover");
  expect(m.destroy).not.toHaveBeenCalled();
  await discardCoverUploadAction(PROFILE, "abandoned-cover");
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "abandoned-cover");
});

test("discard refuses foreign, photo, and unowned candidates", async () => {
  m.coverId.mockReturnValue(false);
  await discardCoverUploadAction(PROFILE, "foreign-cover"); await discardCoverUploadAction(PROFILE, "photo");
  expect(m.destroy).not.toHaveBeenCalled();
  m.coverId.mockReturnValue(true); m.lock.mockRejectedValue(new ProfileError("not_found"));
  await expect(discardCoverUploadAction(PROFILE, "unowned-cover")).rejects.toThrow("NOT_FOUND");
  expect(m.destroy).not.toHaveBeenCalled();
});
