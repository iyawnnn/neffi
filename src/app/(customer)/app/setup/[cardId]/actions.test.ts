import { beforeEach, expect, test, vi } from "vitest";
import { ProfileError } from "@/modules/profiles/errors";

const m = vi.hoisted(() => ({ authorize: vi.fn(), create: vi.fn(), connect: vi.fn(), cards: vi.fn(), setGoal: vi.fn(), getProfile: vi.fn(), lockProfile: vi.fn(), update: vi.fn(), publish: vi.fn(), updateAppearance: vi.fn(), upsertContact: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: { transaction: async (callback: (tx: object) => unknown) => callback({}) } }));
vi.mock("@/modules/profiles/profiles", () => ({ createProfileFromSetup: m.create, setProfileGoal: m.setGoal, getOwnedProfile: m.getProfile, lockOwnedProfile: m.lockProfile, updateIdentity: m.update, publishProfile: m.publish, updateAppearance: m.updateAppearance, upsertContactBlock: m.upsertContact }));
vi.mock("@/modules/cards/manage", () => ({ connectCardToProfile: m.connect }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
vi.mock("@/modules/cards/owned", () => ({ ownedCards: m.cards }));
import { publishSetupAction, chooseProfileAction, continueGoalAction, saveContactAction, saveLookAction, savePhotoAction, saveStyleAction, saveYouAction } from "./actions";

const CARD = "11111111-1111-4111-8111-111111111111";
const PROFILE = "22222222-2222-4222-8222-222222222222";
const form = (overrides: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ cardId: CARD, goal: "business", fullName: " Ana ", email: "ANA@E.TEST", link: "cal.com/ana", ...overrides })) data.set(key, value);
  return data;
};
const draft = (overrides: Record<string, unknown> = {}) => ({
  id: PROFILE, status: "draft", fullName: "Ana", headline: "Designer", company: "Studio", location: "Cebu", bio: "Hello", phone: "+639171234567", email: "ana@e.test", website: "https://ana.test/", imageIsLogo: false, layout: "editorial", colorMode: "dark", accentColor: "#1F5FAE", ...overrides,
});
beforeEach(() => {
  vi.resetAllMocks();
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "owner" } });
  m.create.mockResolvedValue({ profileId: PROFILE, created: true });
  m.cards.mockResolvedValue([{ id: CARD, profileId: PROFILE }]);
  m.getProfile.mockResolvedValue(draft());
  m.lockProfile.mockResolvedValue(draft());
  m.update.mockResolvedValue(undefined);
  m.updateAppearance.mockResolvedValue(undefined);
  m.upsertContact.mockResolvedValue(undefined);
});

test("signed out cannot save setup or choose a profile", async () => {
  m.authorize.mockResolvedValue({ ok: false });
  await expect(saveYouAction(undefined, form())).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  await expect(chooseProfileAction(form({ profileId: PROFILE }))).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  expect(m.create).not.toHaveBeenCalled();
  expect(m.connect).not.toHaveBeenCalled();
});
test("invalid You fields return field errors without creating", async () => {
  expect(await saveYouAction(undefined, form({ fullName: "" }))).toMatchObject({ error: "Check the highlighted fields and try again.", fields: ["fullName"], messages: { fullName: expect.any(String) } });
  expect(m.create).not.toHaveBeenCalled();
});
test.each([["goal", "unknown"], ["cardId", "bad"]])("bad %s is not found", async (key, value) => {
  await expect(saveYouAction(undefined, form({ [key]: value }))).rejects.toThrow("NOT_FOUND");
  expect(m.create).not.toHaveBeenCalled();
});
test.each([true, false])("successful setup redirects to photo (created %s)", async created => {
  m.create.mockResolvedValue({ profileId: PROFILE, created });
  m.cards.mockResolvedValue([{ id: CARD, profileId: null }]);
  await expect(saveYouAction(undefined, form())).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=photo`);
  expect(m.authorize).toHaveBeenCalledWith("account");
  expect(m.create).toHaveBeenCalledWith(expect.any(Object), { accountId: "owner", cardId: CARD, goal: "business", identity: { fullName: "Ana", headline: null, company: null, location: null, bio: null, phone: null, email: null, website: null } });
});
test("profile limit returns customer copy", async () => {
  m.create.mockRejectedValue(new ProfileError("limit_reached"));
  m.cards.mockResolvedValue([{ id: CARD, profileId: null }]);
  expect(await saveYouAction(undefined, form())).toEqual({ error: "You've reached the limit for this. Remove one first." });
});
test("unowned setup is not found", async () => {
  m.create.mockRejectedValue(new ProfileError("not_found"));
  m.cards.mockResolvedValue([{ id: CARD, profileId: null }]);
  await expect(saveYouAction(undefined, form())).rejects.toThrow("NOT_FOUND");
});
test("revisiting You preserves contact, media, and appearance while updating only identity fields", async () => {
  await expect(saveYouAction(undefined, form({ headline: " Founder ", company: " Co ", location: " Manila ", bio: " Hi " }))).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=photo`);
  expect(m.create).not.toHaveBeenCalled();
  expect(m.update).toHaveBeenCalledWith(expect.any(Object), { accountId: "owner", profileId: PROFILE, identity: { fullName: "Ana", headline: "Founder", company: "Co", location: "Manila", bio: "Hi", phone: "+639171234567", email: "ana@e.test", website: "https://ana.test/" } });
});
test.each(["published", "unpublished"])("You direct POST refuses %s routed Profiles", async status => {
  m.lockProfile.mockResolvedValue(draft({ status }));
  await expect(saveYouAction(undefined, form())).rejects.toThrow("NOT_FOUND");
  expect(m.update).not.toHaveBeenCalled();
});
test("Contact normalizes phone, defaults Save Contact, updates identity, then upserts once", async () => {
  await expect(saveContactAction(undefined, form({ phone: "0917 123 4567", email: "ANA@EXAMPLE.COM", website: "ana.test", saveContact: "true" }))).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=links`);
  expect(m.update).toHaveBeenCalledWith({}, { accountId: "owner", profileId: PROFILE, identity: { fullName: "Ana", headline: "Designer", company: "Studio", location: "Cebu", bio: "Hello", phone: "+639171234567", email: "ana@example.com", website: "https://ana.test/" } });
  expect(m.upsertContact).toHaveBeenCalledWith({}, { accountId: "owner", profileId: PROFILE, saveContact: true });
  expect(m.update.mock.calls[0][0]).toBe(m.upsertContact.mock.calls[0][0]);
});
test("Contact requires at least one valid contact method and leaves data untouched", async () => {
  expect(await saveContactAction(undefined, form({ phone: "bad", email: "", website: "", saveContact: "true" }))).toMatchObject({ error: "Check the highlighted fields and try again.", fields: ["phone"] });
  expect(m.update).not.toHaveBeenCalled();
  expect(m.upsertContact).not.toHaveBeenCalled();
});
test("Contact rejects untrusted Save Contact values", async () => {
  expect(await saveContactAction(undefined, form({ email: "ana@example.test", saveContact: "on" }))).toMatchObject({ error: "Check the highlighted fields and try again." });
  expect(m.update).not.toHaveBeenCalled();
});
test("Contact direct POST requires a routed Draft", async () => {
  m.cards.mockResolvedValue([{ id: CARD, profileId: null }]);
  await expect(saveContactAction(undefined, form({ email: "ana@example.test", saveContact: "true" }))).rejects.toThrow("NOT_FOUND");
});
test("Photo mode update preserves identity and sends the user to Contact", async () => {
  await expect(savePhotoAction(undefined, form({ imageIsLogo: "true" }))).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=contact`);
  expect(m.update).toHaveBeenCalledWith(expect.any(Object), { accountId: "owner", profileId: PROFILE, imageIsLogo: true, identity: { fullName: "Ana", headline: "Designer", company: "Studio", location: "Cebu", bio: "Hello", phone: "+639171234567", email: "ana@e.test", website: "https://ana.test/" } });
});
test("Photo mode rejects invalid values and non-Drafts", async () => {
  expect(await savePhotoAction(undefined, form({ imageIsLogo: "on" }))).toMatchObject({ error: "Check the highlighted fields and try again." });
  m.lockProfile.mockResolvedValue(draft({ status: "published" }));
  await expect(savePhotoAction(undefined, form({ imageIsLogo: "false" }))).rejects.toThrow("NOT_FOUND");
});
test("chooseProfile connects then redirects", async () => {
  await expect(chooseProfileAction(form({ profileId: PROFILE }))).rejects.toThrow(`REDIRECT:/app/profiles/${PROFILE}`);
  expect(m.connect).toHaveBeenCalledWith(expect.any(Object), { accountId: "owner", cardId: CARD, profileId: PROFILE });
});
test("chooseProfile rejects invalid or unowned profiles", async () => {
  await expect(chooseProfileAction(form({ profileId: "bad" }))).rejects.toThrow("NOT_FOUND");
  expect(m.connect).not.toHaveBeenCalled();
  m.connect.mockRejectedValue(new ProfileError("not_found"));
  await expect(chooseProfileAction(form({ profileId: PROFILE }))).rejects.toThrow("NOT_FOUND");
});

test.each(["business", ""])("Goal Continue carries %s without creating a Draft", async goal => {
  m.cards.mockResolvedValue([{ id: CARD, profileId: null }]);
  await expect(continueGoalAction(form({ goal }))).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=you&goal=${goal}`);
  expect(m.create).not.toHaveBeenCalled();
  expect(m.setGoal).not.toHaveBeenCalled();
});
test("revisiting Goal updates only the existing Profile goal", async () => {
  m.cards.mockResolvedValue([{ id: CARD, profileId: PROFILE }]);
  await expect(continueGoalAction(form())).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=you&goal=business`);
  expect(m.setGoal).toHaveBeenCalledWith(expect.any(Object), { accountId: "owner", profileId: PROFILE, goal: "business" });
  expect(m.create).not.toHaveBeenCalled();
});
test("Goal Continue rejects unowned card and invalid/missing decisions", async () => {
  m.cards.mockResolvedValue([]);
  await expect(continueGoalAction(form())).rejects.toThrow("NOT_FOUND");
  await expect(continueGoalAction(form({ goal: "invalid" }))).rejects.toThrow("NOT_FOUND");
  const missing = form(); missing.delete("goal");
  await expect(continueGoalAction(missing)).rejects.toThrow("NOT_FOUND");
  expect(m.setGoal).not.toHaveBeenCalled();
});

test.each(["published", "unpublished"])("Goal action refuses %s profiles even on direct POST", async status => {
  m.cards.mockResolvedValue([{ id: CARD, profileId: PROFILE }]);
  m.getProfile.mockResolvedValue({ id: PROFILE, status });
  await expect(continueGoalAction(form())).rejects.toThrow("NOT_FOUND");
  expect(m.setGoal).not.toHaveBeenCalled();
});

test("Look saves only the chosen layout and preserves the saved mode and accent", async () => {
  await expect(saveLookAction(undefined, form({ layout: "showcase" }))).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=style`);
  expect(m.updateAppearance).toHaveBeenCalledWith(expect.any(Object), { accountId: "owner", profileId: PROFILE, layout: "showcase", colorMode: "dark", accentColor: "#1F5FAE" });
});
test("Look resolves a new Draft's unset accent to the Ink default", async () => {
  m.lockProfile.mockResolvedValue(draft({ accentColor: null }));
  await expect(saveLookAction(undefined, form({ layout: "classic" }))).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=style`);
  expect(m.updateAppearance).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ layout: "classic", colorMode: "dark", accentColor: "#0C0C0D" }));
});
test.each([["layout", "unknown"], ["layout", ""]])("Look rejects invalid %s without a write", async (key, value) => {
  expect(await saveLookAction(undefined, form({ [key]: value }))).toMatchObject({ error: "Check the highlighted fields and try again.", fields: ["layout"] });
  expect(m.updateAppearance).not.toHaveBeenCalled();
});
test("Style saves only mode and accent choices while preserving the saved layout", async () => {
  await expect(saveStyleAction(undefined, form({ colorMode: "light", accentColor: "#E64A35" }))).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=review`);
  expect(m.updateAppearance).toHaveBeenCalledWith(expect.any(Object), { accountId: "owner", profileId: PROFILE, layout: "editorial", colorMode: "light", accentColor: "#E64A35" });
});
test.each([["colorMode", "system", "#E64A35", "colorMode"], ["accentColor", "dark", "#123456", "accentColor"]])("Style rejects invalid %s without a write", async (key, colorMode, accentColor, field) => {
  expect(await saveStyleAction(undefined, form({ colorMode, accentColor }))).toMatchObject({ error: "Check the highlighted fields and try again.", fields: [field] });
  expect(m.updateAppearance).not.toHaveBeenCalled();
});
test.each([saveLookAction, saveStyleAction])("appearance setup actions require a routed Draft", async action => {
  m.cards.mockResolvedValue([{ id: CARD, profileId: null }]);
  await expect(action(undefined, form({ layout: "classic", colorMode: "light", accentColor: "#0C0C0D" }))).rejects.toThrow("NOT_FOUND");
  expect(m.updateAppearance).not.toHaveBeenCalled();
});

test("Publish uses the existing domain and redirects to this card's Done", async () => {
 await expect(publishSetupAction(undefined, form())).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=done`);
 expect(m.publish).toHaveBeenCalledWith(expect.anything(),{accountId:"owner",profileId:PROFILE});
});
test("Publish validation returns canonical gaps without completing setup", async () => {
 m.publish.mockRejectedValue(new ProfileError("not_ready",["name","contact"]));
 expect(await publishSetupAction(undefined,form())).toMatchObject({error:expect.stringContaining("ready"),gaps:expect.arrayContaining(["Add your full name."])});
});
test("failed Publish is retryable and never claims success", async () => {
 m.publish.mockRejectedValue(new Error("Synthetic outage"));
 expect(await publishSetupAction(undefined,form())).toMatchObject({error:expect.stringContaining("Try again")});
});
test("repeat Publish on Published profile goes to Done without a second mutation", async () => {
 m.lockProfile.mockResolvedValue(draft({status:"published"}));
 await expect(publishSetupAction(undefined,form())).rejects.toThrow(`REDIRECT:/app/setup/${CARD}?step=done`);expect(m.publish).not.toHaveBeenCalled();
});
test.each(["unpublished","foreign"])("Publish rejects %s route", async status => {
 if(status==="foreign")m.cards.mockResolvedValue([]);else m.lockProfile.mockResolvedValue(draft({status}));
 await expect(publishSetupAction(undefined,form())).rejects.toThrow("NOT_FOUND");expect(m.publish).not.toHaveBeenCalled();
});
