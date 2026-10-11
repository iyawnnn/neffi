import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), profile: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/profiles", () => ({ getOwnedProfile: m.profile }));
vi.mock("./actions", () => ({ publishAction: vi.fn(), unpublishAction: vi.fn(), showSceneAction: vi.fn(), createSceneAction: vi.fn(), deleteProfileAction: vi.fn(), updateIdentityAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import ProfilePage from "./page";
const profile = () => ({ id: "p1", fullName: "Ana", status: "draft", scenes: [{ id: "s1", name: "Main", isDefault: true, isShown: true }, { id: "s2", name: "Events", isDefault: false, isShown: false }], cards: [{ id: "c1", suffix: "WXYZ" }], unread: 2, gaps: [] });
const render = async (query: Record<string, string> = {}) => renderToStaticMarkup(await ProfilePage({ params: Promise.resolve({ profileId: "p1" }), searchParams: Promise.resolve(query) }));
beforeEach(() => { vi.resetAllMocks(); m.requireAccount.mockResolvedValue({ accountId: "a1" }); m.profile.mockResolvedValue(profile()); });
test("overview shows current Scene, Scene links and add form", async () => {
  const html = await render();
  for (const text of ["Now showing", "Main", "Show this", "(Default)", "Add a scene", "Start from", "Empty", "Copy of Events"]) expect(html).toContain(text);
  for (const id of ["s1", "s2"]) expect(html).toContain(`href="/app/profiles/p1/scenes/${id}"`);
  expect(html).toContain('name="name"');
  expect(html).toContain('name="copyFrom"');
});
test("overview links to details, appearance, preview, Inbox and shows Card suffixes", async () => {
  const html = await render();
  for (const route of ["identity", "appearance", "preview"]) expect(html).toContain(`href="/app/profiles/p1/${route}"`);
  expect(html).toContain('href="/app/inbox"');
  expect(html).toContain("Messages");
  expect(html).toContain("2");
  expect(html).toContain("WXYZ");
});
test.each(["draft", "unpublished", "published"])("status %s offers the right publication action", async status => {
  m.profile.mockResolvedValue({ ...profile(), status });
  const html = await render();
  expect(html).toContain(status === "published" ? "Unpublish" : ">Publish<");
});
test("published notice is a visible status", async () => {
  const html = await render({ published: "1" });
  expect(html).toContain('role="status"');
  expect(html).toContain("Your Neffi is live.");
});
test("linked Cards explain moving, never disabling, and prevent a delete button", async () => {
  const html = await render();
  expect(html).toContain("Move the cards showing this profile to another profile before deleting it.");
  expect(html).not.toContain("Move or disable");
  expect(html).not.toMatch(/<button[^>]*>Delete profile<\/button>/);
});
test("unlinked profile requires deletion confirmation", async () => {
  m.profile.mockResolvedValue({ ...profile(), cards: [] });
  const html = await render();
  expect(html).toContain("I understand this deletes this profile, its scenes and its messages");
  expect(html).toContain('name="confirm"');
  expect(html).toMatch(/<button[^>]*>Delete profile<\/button>/);
});
test("unknown profile is not found", async () => {
  m.profile.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
