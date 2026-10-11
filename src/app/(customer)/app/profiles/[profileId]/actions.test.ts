import { beforeEach, expect, test, vi } from "vitest";
import { ProfileError } from "@/modules/profiles/errors";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
const m = vi.hoisted(() => ({ authorize: vi.fn(), publish: vi.fn(), unpublish: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/profiles", () => ({ publishProfile: m.publish, unpublishProfile: m.unpublish }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import { publishAction, unpublishAction } from "./actions";
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
