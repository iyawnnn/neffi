import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAccount: vi.fn(), cardSummaries: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/cards/manage", () => ({ cardSummaries: m.cardSummaries }));

import CardsPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1" });
  m.cardSummaries.mockResolvedValue([]);
});

test("lists owned cards with status, connected profile and manage link", async () => {
  m.cardSummaries.mockResolvedValue([
    { id: "c1", suffix: "WXYZ", profileName: "Ana", profileId: "p1", disabled: true, publicToken: "private-card-token-1" },
    { id: "c2", suffix: "ABCD", profileName: null, profileId: null, disabled: false, publicToken: "private-card-token-2" },
    { id: "c3", suffix: "EFGH", profileName: "Ben", profileId: "p2", disabled: false, publicToken: "private-card-token-3" },
  ]);

  const html = renderToStaticMarkup(await CardsPage());

  for (const text of [
    "Your cards",
    "Manage your Neffi cards and the profiles they connect to.",
    "3 cards",
    "Connected to Ana",
    "Turned off",
    "Not set up yet",
    "Needs setup",
    "Connected to Ben",
    "Connected",
    "Manage card",
  ]) {
    expect(html).toContain(text);
  }

  for (const id of ["c1", "c2", "c3"]) {
    expect(html).toContain(`href="/app/cards/${id}"`);
  }

  const links = [...html.matchAll(/<a\b[^>]*>(.*?)<\/a>/g)];
  for (const [, content] of links) expect(content).not.toContain("<a ");

  for (const [, row] of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)) {
    expect([...row.matchAll(/<a\b/g)]).toHaveLength(1);
    expect(row).toContain('aria-label="Manage card:');
  }

  expect(html).not.toContain("private-card-token");
  expect(m.cardSummaries).toHaveBeenCalledWith({}, "a1");
  expect(m.requireAccount).toHaveBeenCalledWith("/app");
});

test("activation panel has a single primary Vermilion action without duplicate CTA or inner Cards heading", async () => {
  m.cardSummaries.mockResolvedValue([
    { id: "c1", suffix: "WXYZ", profileName: "Ana", profileId: "p1", disabled: false, publicToken: "tok1" },
  ]);

  const html = renderToStaticMarkup(await CardsPage());
  const activateLinks = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter(([, , content]) =>
    /Activate Neffi/.test(content),
  );

  expect(activateLinks).toHaveLength(1);
  expect(activateLinks[0][1]).toContain("bg-action");
  expect(html).toContain("Activate another Neffi");
  expect(html).toContain("Add another Neffi card to your account and connect it to a profile.");
  expect(html).not.toMatch(/<h2\b[^>]*>Cards<\/h2>/);
  expect(html).toContain("1 card");
});

test("an empty account gets an intentional empty state and single activation CTA", async () => {
  const html = renderToStaticMarkup(await CardsPage());

  expect(html).toContain("No cards yet");
  expect(html).toContain("Activate your first Neffi");
  expect(html).toContain("0 cards");
  expect([...html.matchAll(/href="\/activate"/g)]).toHaveLength(1);
  expect(html).toContain("neffi-create-profile-cards.png");
});

test("requires the session before reading customer data", async () => {
  m.requireAccount.mockRejectedValue(new Error("sign-in required"));

  await expect(CardsPage()).rejects.toThrow("sign-in required");
  expect(m.cardSummaries).not.toHaveBeenCalled();
});
