import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAccount: vi.fn(), ownedCards: vi.fn(), ownedProfiles: vi.fn(), unreadCount: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/modules/profiles/profiles", () => ({ ownedProfiles: m.ownedProfiles }));
vi.mock("@/modules/forms/submissions", () => ({ unreadCount: m.unreadCount }));
vi.mock("@/modules/cards/owned", () => ({ ownedCards: m.ownedCards }));
vi.mock("@/db", () => ({ db: {} }));

import CustomerHome from "./page";

const TOKEN = "A".repeat(22) + "WXYZ";
const render = async (search: Record<string, string> = {}) =>
  renderToStaticMarkup(await CustomerHome({ params: Promise.resolve({}), searchParams: Promise.resolve(search) } as Parameters<typeof CustomerHome>[0]));

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1", email: "a@example.test", role: "customer" });
  m.ownedProfiles.mockResolvedValue([]);
  m.unreadCount.mockResolvedValue(0);
  m.ownedCards.mockResolvedValue([]);
});

test("lists profiles and resumes publishing a draft", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p1", fullName: "Ana", status: "draft", unread: 0 }, { id: "p2", fullName: "Lee", status: "published", unread: 0 }]);
  const html = await render();
  expect(html).toContain("Your profiles");
  expect(html).toContain('href="/app/profiles/p1"');
  expect(html).toContain("Ana");
  expect(html).toContain("Draft");
  expect(html).toContain("Published");
  expect(html).toContain("Preview and publish Ana");
  expect(html).toContain('href="/app/profiles/p1/publish"');
  expect(html).not.toContain('href="/app/profiles/p2/publish"');
});

test.each([0, 1, 3])("shows the unread message summary only when nonzero (%s)", async unread => {
  m.unreadCount.mockResolvedValue(unread);
  const html = await render();
  if (unread) {
    expect(html).toContain(`${unread} new message${unread === 1 ? "" : "s"}`);
    expect(html).toContain('href="/app/inbox"');
  } else expect(html).not.toContain('href="/app/inbox"');
});

test("after a claim, confirms the Neffi was added", async () => {
  const html = await render({ added: "1" });
  expect(html).toMatch(/role="status"/);
  expect(html).toContain("Your Neffi has been added to your account. Next, you&#x27;ll set it up.");
});

test("lists owned cards waiting for setup without exposing the full card address", async () => {
  m.ownedCards.mockResolvedValue([
    { id: "c1", publicToken: TOKEN, profileId: null },
    { id: "c2", publicToken: "B".repeat(26), profileId: "p1" },
  ]);
  const html = await render();
  expect(html).toContain("Ready to set up");
  expect(html).toContain("Set up Neffi ending in WXYZ");
  expect(html).toContain('href="/app/setup/c1"');
  expect(html).toContain("Activate another Neffi");
  expect(html).not.toContain(TOKEN);
  expect(html).not.toContain("BBBB");
  expect(m.ownedCards).toHaveBeenCalledWith({}, "a1");
});

test("with no cards keeps the empty-state line and offers activation", async () => {
  const html = await render();
  expect(html).not.toContain("Signed in as");
  expect(html).not.toContain("Sign-in methods");
  expect(html).toContain("Your cards and profiles will appear here.");
  expect(html).not.toContain("Ready to set up");
  expect(html).toContain('href="/activate"');
  expect(html).toContain("Activate a Neffi");
});

test.each([false, true])("activation navigation has a 44px touch target (owns cards: %s)", async (ownsCards) => {
  m.ownedCards.mockResolvedValue(ownsCards ? [{ id: "c1", publicToken: TOKEN, profileId: null }] : []);
  const html = await render();
  const link = [...html.matchAll(/<a\b[^>]*>/g)]
    .map(([tag]) => tag)
    .find((tag) => tag.includes('href="/activate"'));
  expect(link).toBeDefined();
  expect(link).toContain("inline-flex");
  expect(link).toContain("min-h-11");
});
