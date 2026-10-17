import { beforeEach, expect, test, vi } from "vitest";
import { ProfileError } from "@/modules/profiles/errors";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
const m = vi.hoisted(() => ({ authorize: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), updateIdentity: vi.fn(), deleteProfile: vi.fn(), showScene: vi.fn(), createScene: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/env", () => ({ env: { cloudinaryCloudName: "demo", cloudinaryApiKey: "synthetic-key", cloudinaryApiSecret: "synthetic-secret" } }));
vi.mock("@/integrations/media/cloudinary", () => ({ destroyImage: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/modules/profiles/profiles", () => ({ publishProfile: m.publish, unpublishProfile: m.unpublish, updateIdentity: m.updateIdentity, deleteProfile: m.deleteProfile }));
vi.mock("@/modules/profiles/scenes", () => ({ showScene: m.showScene, createScene: m.createScene }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import { createSceneAction, deleteProfileAction, publishAction, showSceneAction, unpublishAction, updateIdentityAction } from "./actions";
const PROFILE = "11111111-1111-4111-8111-111111111111";
const form = (profileId = PROFILE) => { const data = new FormData(); data.set("profileId", profileId); return data; };
beforeEach(() => { vi.resetAllMocks(); m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } }); });
test("publish redirects after successful mutation", async () => {
  await expect(publishAction(undefined, form())).rejects.toThrow(`REDIRECT:/app/profiles/${PROFILE}?published=1`);
  expect(m.publish).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE });
});
test("not ready returns actionable gaps", async () => {
  m.publish.mockRejectedValue(new ProfileError("not_ready", ["contact", "content"]));
  expect(await publishAction(undefined, form())).toEqual({ error: "Your Neffi isn't ready to publish yet.", gaps: [PUBLISH_GAP_COPY.contact, PUBLISH_GAP_COPY.content] });
});
test("unowned or malformed profiles are not found", async () => {
  await expect(publishAction(undefined, form("bad"))).rejects.toThrow("NOT_FOUND");
  expect(m.publish).not.toHaveBeenCalled();
  m.publish.mockRejectedValue(new ProfileError("not_found"));
  await expect(publishAction(undefined, form())).rejects.toThrow("NOT_FOUND");
});
test("unpublish redirects to overview", async () => {
  await expect(unpublishAction(form())).rejects.toThrow(`REDIRECT:/app/profiles/${PROFILE}`);
  expect(m.unpublish).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE });
});
test("signed-out actions require authentication", async () => {
  m.authorize.mockResolvedValue({ ok: false });
  await expect(publishAction(undefined, form())).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  await expect(unpublishAction(form())).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  expect(m.publish).not.toHaveBeenCalled();
  expect(m.unpublish).not.toHaveBeenCalled();
});

const dataWith = (values: Record<string, string>) => {
  const data = form();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const identityData = (email = "ANA@E.TEST") => dataWith({ fullName: " Ana ", email });
const SCENE = "22222222-2222-4222-8222-222222222222";
test("identity invalid email highlights the field and does not mutate", async () => {
  expect(await updateIdentityAction(undefined, identityData("bad"))).toEqual({ error: "Check the highlighted fields and try again.", fields: ["email"] });
  expect(m.updateIdentity).not.toHaveBeenCalled();
});
test("identity saves normalized details", async () => {
  const identity = { fullName: "Ana", headline: null, company: null, bio: null, phone: null, email: "ana@e.test", website: null, location: null };
  expect(await updateIdentityAction(undefined, identityData())).toEqual({ ok: "Saved.", identity });
  expect(m.updateIdentity).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, identity });
});
test("identity returns server-normalized email/URL values and rejects invalid fields without mutation", async () => {
  const result = await updateIdentityAction(undefined, dataWith({ fullName: " Ana ", email: "ANA@EXAMPLE.COM", website: "example.com", phone: "+639171234567" }));
  expect(result.identity).toMatchObject({ fullName: "Ana", email: "ana@example.com", website: "https://example.com/", phone: "+639171234567" });
  m.updateIdentity.mockClear();
  const invalid = await updateIdentityAction(undefined, dataWith({ fullName: "", email: "bad", website: "javascript:alert(1)", bio: "x".repeat(301) }));
  expect(invalid.fields?.sort()).toEqual(["bio", "email", "fullName", "website"]);
  expect(invalid.identity).toBeUndefined();
  expect(m.updateIdentity).not.toHaveBeenCalled();
});
test("identity not_ready returns publish gap copy", async () => {
  m.updateIdentity.mockRejectedValue(new ProfileError("not_ready", ["contact"]));
  expect(await updateIdentityAction(undefined, identityData())).toEqual({ error: "Your Neffi isn't ready to publish yet.", gaps: [PUBLISH_GAP_COPY.contact] });
});
test("showScene redirects after the owned mutation", async () => {
  await expect(showSceneAction(dataWith({ sceneId: SCENE }))).rejects.toThrow(`REDIRECT:/app/profiles/${PROFILE}`);
  expect(m.showScene).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, sceneId: SCENE });
});
test.each(["empty", SCENE])("createScene accepts Start from %s", async copyFrom => {
  m.createScene.mockResolvedValue({ sceneId: SCENE });
  await expect(createSceneAction(undefined, dataWith({ name: "Events", copyFrom }))).rejects.toThrow(`REDIRECT:/app/profiles/${PROFILE}/scenes/${SCENE}`);
  expect(m.createScene).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, name: "Events", copyFromSceneId: copyFrom === "empty" ? null : SCENE });
});
test("createScene limit returns customer copy", async () => {
  m.createScene.mockRejectedValue(new ProfileError("limit_reached"));
  expect(await createSceneAction(undefined, dataWith({ name: "Events", copyFrom: "empty" }))).toEqual({ error: "You've reached the limit for this. Remove one first." });
});
test("delete requires explicit confirmation", async () => {
  expect(await deleteProfileAction(undefined, form())).toEqual({ error: "Tick the box to confirm." });
  expect(m.deleteProfile).not.toHaveBeenCalled();
});
test("delete success redirects to profile list", async () => {
  m.deleteProfile.mockResolvedValue({ imageAssetId: null });
  await expect(deleteProfileAction(undefined, dataWith({ confirm: "on" }))).rejects.toThrow("REDIRECT:/app/profiles");
  expect(m.deleteProfile).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE });
});
test("delete linked-Card failure explains moving Cards, never disabling them", async () => {
  m.deleteProfile.mockRejectedValue(new ProfileError("has_cards"));
  expect(await deleteProfileAction(undefined, dataWith({ confirm: "on" }))).toEqual({ error: "Move the cards showing this profile to another profile before deleting it." });
});
