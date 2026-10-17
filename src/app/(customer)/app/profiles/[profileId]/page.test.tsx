import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAccount: vi.fn(), profile: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/profiles", () => ({ getOwnedProfile: m.profile }));
vi.mock("./actions", () => ({ publishAction: vi.fn(), unpublishAction: vi.fn(), showSceneAction: vi.fn(), createSceneAction: vi.fn(), deleteProfileAction: vi.fn(), updateIdentityAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

import ProfilePage from "./page";

const profile = () => ({
  id: "p1",
  fullName: "Ana",
  status: "draft",
  scenes: [
    { id: "s1", name: "Main", isDefault: true, isShown: true },
    { id: "s2", name: "Events", isDefault: false, isShown: false },
  ],
  cards: [{ id: "c1", suffix: "WXYZ" }],
  unread: 2,
  gaps: [],
});

const render = async (query: Record<string, string> = {}) =>
  renderToStaticMarkup(await ProfilePage({ params: Promise.resolve({ profileId: "p1" }), searchParams: Promise.resolve(query) }));

beforeEach(() => {
  vi.resetAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1" });
  m.profile.mockResolvedValue(profile());
});

test("overview shows active profile mode summary, multi-mode count, and manage action", async () => {
  const html = await render();
  for (const text of [
    "Profile mode",
    "Choose what visitors see.",
    "Choose what visitors see when they tap your Neffi.",
    "Main",
    "Currently showing",
    ">Edit<",
    "Manage modes",
  ]) {
    expect(html).toContain(text);
  }
  expect(html).toContain('href="/app/profiles/p1/scenes/s1"');
  expect(html).not.toContain('name="name"');
  expect(html).not.toContain('name="copyFrom"');
});

test("overview links to details, appearance, preview, Inbox and shows connected cards", async () => {
  const html = await render();
  for (const text of [
    "Your details",
    "Shared across all profile modes.",
    "Edit profile",
    "Messages",
    "2",
    "1 connected card",
  ]) {
    expect(html).toContain(text);
  }
  for (const route of ["identity", "appearance", "preview"]) expect(html).toContain(`href="/app/profiles/p1/${route}"`);
  expect(html).toContain('href="/app/inbox"');
});

test.each(["draft", "unpublished", "published"])("status %s offers the right publication action", async (status) => {
  m.profile.mockResolvedValue({ ...profile(), status });
  const html = await render();
  expect(html).toContain(status === "published" ? "Unpublish" : ">Publish<");
});

test("published notice is a visible status", async () => {
  const html = await render({ published: "1" });
  expect(html).toContain('role="status"');
  expect(html).toContain("Your Neffi is live.");
});

test("linked cards explain moving and offer a dialog trigger instead of an inline delete form", async () => {
  const html = await render();
  expect(html).toContain("Move the cards showing this profile to another profile before deleting it.");
  expect(html).not.toContain("Move or disable");
  expect(html).not.toContain('name="confirm"');
  expect(html).toContain("Delete profile");
});

test("unlinked profile exposes a delete dialog trigger without an inline confirmation form", async () => {
  m.profile.mockResolvedValue({ ...profile(), cards: [] });
  const html = await render();
  expect(html).not.toContain('name="confirm"');
  expect(html).toContain('aria-haspopup="dialog"');
  expect(html).toContain("No connected cards");
});

test("uses real details, appearance and card destinations with safe identifiers", async () => {
  m.profile.mockResolvedValue({
    ...profile(),
    headline: "Designer",
    phone: "+639171234567",
    website: "https://example.com",
    accentColor: "#0C0C0D",
    imageAssetId: "image",
    imageIsLogo: true,
  });
  const html = await render();
  for (const text of ["Designer", "+639171234567", "https://example.com", "Ink accent", "Logo image", 'href="/app/cards"', "Danger zone"]) {
    expect(html).toContain(text);
  }
  for (const [, content] of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
    expect(content).not.toMatch(/<a\b|<button\b/);
  }
});

test("publish requirements provide direct recovery links and do not claim drafts are public", async () => {
  m.profile.mockResolvedValue({ ...profile(), defaultSceneId: "s1", gaps: ["name", "contact", "content"] });
  const html = await render();
  for (const text of ["Before you publish", "Add your full name.", "Edit details", "Edit main scene"]) {
    expect(html).toContain(text);
  }
});

test("unknown profile is not found", async () => {
  m.profile.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
