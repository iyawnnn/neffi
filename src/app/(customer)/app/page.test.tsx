import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAccount: vi.fn(), getLinkedMethods: vi.fn(), ownedCards: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/auth/methods", () => ({ getLinkedMethods: m.getLinkedMethods }));
vi.mock("@/modules/cards/owned", () => ({ ownedCards: m.ownedCards }));
vi.mock("@/db", () => ({ db: {} }));

import CustomerHome from "./page";

const TOKEN = "A".repeat(22) + "WXYZ";
const render = async (search: Record<string, string> = {}) =>
  renderToStaticMarkup(await CustomerHome({ params: Promise.resolve({}), searchParams: Promise.resolve(search) } as Parameters<typeof CustomerHome>[0]));

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1", email: "a@example.test", role: "customer" });
  m.getLinkedMethods.mockResolvedValue({ google: false });
  m.ownedCards.mockResolvedValue([]);
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
