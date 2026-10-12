import { beforeEach, expect, test, vi } from "vitest";
import { ProfileError } from "@/modules/profiles/errors";

const m = vi.hoisted(() => ({ authorize: vi.fn(), create: vi.fn(), connect: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/profiles", () => ({ createProfileFromStarter: m.create }));
vi.mock("@/modules/cards/manage", () => ({ connectCardToProfile: m.connect }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
import { chooseProfileAction, createProfileAction } from "./actions";

const CARD = "11111111-1111-4111-8111-111111111111";
const PROFILE = "22222222-2222-4222-8222-222222222222";
const form = (overrides: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ cardId: CARD, purpose: "get_clients", fullName: " Ana ", email: "ANA@E.TEST", link: "cal.com/ana", ...overrides })) data.set(key, value);
  return data;
};
beforeEach(() => {
  vi.resetAllMocks();
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "owner" } });
  m.create.mockResolvedValue({ profileId: PROFILE, created: true });
});

test("signed out cannot create or choose a profile", async () => {
  m.authorize.mockResolvedValue({ ok: false });
  await expect(createProfileAction(undefined, form())).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  await expect(chooseProfileAction(form({ profileId: PROFILE }))).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  expect(m.create).not.toHaveBeenCalled();
  expect(m.connect).not.toHaveBeenCalled();
});
test("invalid essentials return field errors without creating", async () => {
  expect(await createProfileAction(undefined, form({ fullName: "" }))).toEqual({ error: "Check the highlighted fields and try again.", fields: ["fullName"] });
  expect(m.create).not.toHaveBeenCalled();
});
test.each([["purpose", "unknown"], ["cardId", "bad"]])("bad %s is not found", async (key, value) => {
  await expect(createProfileAction(undefined, form({ [key]: value }))).rejects.toThrow("NOT_FOUND");
  expect(m.create).not.toHaveBeenCalled();
});
test.each([true, false])("successful setup redirects to publish (created %s)", async created => {
  m.create.mockResolvedValue({ profileId: PROFILE, created });
  await expect(createProfileAction(undefined, form())).rejects.toThrow(`REDIRECT:/app/profiles/${PROFILE}/publish`);
  expect(m.authorize).toHaveBeenCalledWith("account");
  expect(m.create).toHaveBeenCalledWith({}, { accountId: "owner", cardId: CARD, purpose: "get_clients", essentials: { fullName: "Ana", headline: null, bio: null, email: "ana@e.test", phone: null, link: "https://cal.com/ana" } });
});
test("profile limit returns customer copy", async () => {
  m.create.mockRejectedValue(new ProfileError("limit_reached"));
  expect(await createProfileAction(undefined, form())).toEqual({ error: "You've reached the limit for this. Remove one first." });
});
test("unowned setup is not found", async () => {
  m.create.mockRejectedValue(new ProfileError("not_found"));
  await expect(createProfileAction(undefined, form())).rejects.toThrow("NOT_FOUND");
});
test("chooseProfile connects then redirects", async () => {
  await expect(chooseProfileAction(form({ profileId: PROFILE }))).rejects.toThrow(`REDIRECT:/app/profiles/${PROFILE}`);
  expect(m.connect).toHaveBeenCalledWith({}, { accountId: "owner", cardId: CARD, profileId: PROFILE });
});
test("chooseProfile rejects invalid or unowned profiles", async () => {
  await expect(chooseProfileAction(form({ profileId: "bad" }))).rejects.toThrow("NOT_FOUND");
  expect(m.connect).not.toHaveBeenCalled();
  m.connect.mockRejectedValue(new ProfileError("not_found"));
  await expect(chooseProfileAction(form({ profileId: PROFILE }))).rejects.toThrow("NOT_FOUND");
});
