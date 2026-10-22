import { beforeEach, expect, test, vi } from "vitest";
import { hmacHex } from "@/auth/otp-quota";
const m = vi.hoisted(() => ({ authorize: vi.fn(), owned: vi.fn(), quota: vi.fn(), sign: vi.fn(), prefix: vi.fn(), coverPrefix: vi.fn(), get: vi.fn(), check: vi.fn(), destroy: vi.fn(), set: vi.fn(), appearance: vi.fn(), delete: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/env", () => ({ env: { betterAuthSecret: "synthetic-media-secret", cloudinaryCloudName: "demo", cloudinaryApiKey: "key", cloudinaryApiSecret: "secret" } }));
vi.mock("@/auth/otp-quota", async importOriginal => ({ ...await importOriginal<typeof import("@/auth/otp-quota")>(), consumeQuota: m.quota }));
vi.mock("@/integrations/media/cloudinary", () => ({ signImageUpload: m.sign, isProfileImageId: m.prefix, isProfileCoverId: m.coverPrefix, getImage: m.get, checkImage: m.check, destroyImage: m.destroy }));
vi.mock("@/modules/profiles/profiles", () => ({ getOwnedProfile: m.owned, setProfileImage: m.set, updateAppearance: m.appearance, deleteProfile: m.delete }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import { confirmImageAction, deleteProfileAction, removeImageAction, startImageUploadAction, updateAppearanceAction } from "./actions";
const PROFILE = "11111111-1111-4111-8111-111111111111";
const CONFIG = { cloudName: "demo", apiKey: "key", apiSecret: "secret" };
beforeEach(() => {
  vi.resetAllMocks();
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } });
  m.owned.mockResolvedValue({ id: PROFILE }); m.quota.mockResolvedValue(true);
  m.prefix.mockReturnValue(true); m.coverPrefix.mockReturnValue(true); m.get.mockResolvedValue({ bytes: 1, width: 1, height: 1, format: "png" }); m.check.mockReturnValue(true);
  m.set.mockResolvedValue({ previousAssetId: "previous" }); m.destroy.mockResolvedValue(undefined);
});
test("upload signing requires an owned valid profile", async () => {
  m.owned.mockResolvedValue(null);
  await expect(startImageUploadAction(PROFILE)).rejects.toThrow("NOT_FOUND");
  await expect(startImageUploadAction("bad")).rejects.toThrow("NOT_FOUND");
  expect(m.sign).not.toHaveBeenCalled();
});
test("signed-out media mutations require authentication", async () => {
  m.authorize.mockResolvedValue({ ok: false });
  for (const action of [() => startImageUploadAction(PROFILE), () => confirmImageAction(PROFILE, "image"), () => removeImageAction(PROFILE)]) {
    await expect(action()).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  }
  expect(m.sign).not.toHaveBeenCalled(); expect(m.get).not.toHaveBeenCalled(); expect(m.set).not.toHaveBeenCalled();
});
test("unowned image confirmation never reads or stores media", async () => {
  m.owned.mockResolvedValue(null);
  await expect(confirmImageAction(PROFILE, "image")).rejects.toThrow("NOT_FOUND");
  expect(m.get).not.toHaveBeenCalled(); expect(m.set).not.toHaveBeenCalled();
});
test("upload signing enforces the account quota", async () => {
  m.quota.mockResolvedValue(false);
  expect(await startImageUploadAction(PROFILE)).toEqual({ error: "Too many uploads. Please wait a few minutes and try again." });
  expect(m.quota).toHaveBeenCalledWith({}, hmacHex("synthetic-media-secret", "media-sign", "a1"), 20);
  expect(m.sign).not.toHaveBeenCalled();
});
test("owned upload returns only the signed ticket", async () => {
  const ticket = { url: "https://upload.example.test", fields: {} }; m.sign.mockReturnValue(ticket);
  expect(await startImageUploadAction(PROFILE)).toEqual({ ticket });
  expect(m.sign).toHaveBeenCalledWith(CONFIG, { profileId: PROFILE });
});
test("foreign image ids never reach Cloudinary or the domain", async () => {
  m.prefix.mockReturnValue(false);
  expect(await confirmImageAction(PROFILE, "foreign")).toHaveProperty("error");
  expect(m.get).not.toHaveBeenCalled(); expect(m.set).not.toHaveBeenCalled();
});
test("missing images cannot be saved", async () => {
  m.get.mockResolvedValue(null);
  expect(await confirmImageAction(PROFILE, "image")).toHaveProperty("error"); expect(m.set).not.toHaveBeenCalled();
});
test("invalid media is rejected and deleted", async () => {
  m.check.mockReturnValue(false);
  expect(await confirmImageAction(PROFILE, "image")).toEqual({ error: "Use a JPG, PNG, WebP or HEIC image up to 5 MB." });
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "image"); expect(m.set).not.toHaveBeenCalled();
});
test.each([false, true])("replacement saves before best-effort cleanup (cleanup fails: %s)", async fails => {
  if (fails) m.destroy.mockRejectedValue(new Error("offline"));
  expect(await confirmImageAction(PROFILE, "image")).toEqual({ ok: true });
  expect(m.set).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, assetId: "image" });
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "previous");
  expect(m.set.mock.invocationCallOrder[0]).toBeLessThan(m.destroy.mock.invocationCallOrder[0]);
});
test("remove clears the image before cleanup", async () => {
  await removeImageAction(PROFILE);
  expect(m.set).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, assetId: null });
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "previous");
});
test("profile deletion cleans up its image and valid cover independently", async () => {
  m.delete.mockResolvedValue({ imageAssetId: "image", coverAssetId: "cover" }); m.destroy.mockRejectedValue(new Error("offline"));
  const data = new FormData(); data.set("profileId", PROFILE); data.set("confirm", "on");
  await expect(deleteProfileAction(undefined, data)).rejects.toThrow("REDIRECT:/app/profiles");
  expect(m.destroy).toHaveBeenCalledWith(CONFIG, "image"); expect(m.destroy).toHaveBeenCalledWith(CONFIG, "cover");
});
test("profile deletion never destroys a returned cover outside its namespace", async () => {
  m.delete.mockResolvedValue({ imageAssetId: null, coverAssetId: "foreign" }); m.coverPrefix.mockReturnValue(false);
  const data = new FormData(); data.set("profileId", PROFILE); data.set("confirm", "on");
  await expect(deleteProfileAction(undefined, data)).rejects.toThrow("REDIRECT:/app/profiles");
  expect(m.destroy).not.toHaveBeenCalled();
});

const appearanceData = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ profileId: PROFILE, layout: "showcase", colorMode: "dark", accentColor: "#1F5FAE" })) data.set(key, value);
  return data;
};
test("appearance saves approved fields together without image or cover fields", async () => {
  const data = appearanceData(); data.set("imageIsLogo", "true"); data.set("coverAssetId", "foreign");
  expect(await updateAppearanceAction(undefined, data)).toEqual({ ok: "Saved." });
  expect(m.appearance).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, layout: "showcase", colorMode: "dark", accentColor: "#1F5FAE" });
});
test.each([["layout", "unknown"], ["colorMode", "system"], ["accentColor", "#123456"], ["layout", ""], ["colorMode", ""]])("invalid %s rejected before mutation", async (key, value) => {
  const data = appearanceData(); data.set(key, value);
  expect(await updateAppearanceAction(undefined, data)).toHaveProperty("error");
  expect(m.appearance).not.toHaveBeenCalled();
});
test("appearance requires sign-in and propagates ownership failure", async () => {
  m.authorize.mockResolvedValue({ ok: false });
  await expect(updateAppearanceAction(undefined, appearanceData())).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  expect(m.appearance).not.toHaveBeenCalled();
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } });
  const { ProfileError } = await import("@/modules/profiles/errors");
  m.appearance.mockRejectedValue(new ProfileError("not_found"));
  await expect(updateAppearanceAction(undefined, appearanceData())).rejects.toThrow("NOT_FOUND");
});
