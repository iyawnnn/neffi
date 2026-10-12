import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAccount: vi.fn(), ownedCards: vi.fn(), ownedProfiles: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/cards/owned", () => ({ ownedCards: m.ownedCards }));
vi.mock("@/modules/profiles/profiles", () => ({ ownedProfiles: m.ownedProfiles }));
vi.mock("./actions", () => ({ createProfileAction: vi.fn(), chooseProfileAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
import SetupPage from "./page";

const render = async (query: Record<string, string | string[]> = {}) => renderToStaticMarkup(await SetupPage({ params: Promise.resolve({ cardId: "c1" }), searchParams: Promise.resolve(query) }));
beforeEach(() => {
  vi.resetAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1", email: "ana@example.test" });
  m.ownedCards.mockResolvedValue([{ id: "c1", publicToken: "A".repeat(22) + "WXYZ", profileId: null }]);
  m.ownedProfiles.mockResolvedValue([]);
});
test("unknown card is not found", async () => {
  m.ownedCards.mockResolvedValue([]);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
test("already set-up card redirects to its profile", async () => {
  m.ownedCards.mockResolvedValue([{ id: "c1", profileId: "p1" }]);
  await expect(render()).rejects.toThrow("REDIRECT:/app/profiles/p1");
});
test("no profiles shows the three purposes", async () => {
  const html = await render();
  expect(html).toContain("What do you want your Neffi to help you do?");
  for (const [key, label] of [["network", "Network"], ["get_clients", "Get Clients"], ["show_my_work", "Show My Work"]]) {
    expect(html).toContain(`href="?purpose=${key}"`);
    expect(html).toContain(label);
  }
  expect(html).toContain("your Neffi ending in WXYZ");
  expect(html).not.toContain("A".repeat(22));
  expect(m.requireAccount).toHaveBeenCalledWith("/app");
  expect(m.ownedCards).toHaveBeenCalledWith({}, "a1");
});
test("existing profiles offer selection or a new profile", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p1", fullName: "Ana" }]);
  const html = await render();
  expect(html).toContain("Show one of your profiles on this card");
  expect(html).toContain("Use Ana");
  expect(html).toContain('href="?step=purpose"');
  expect(html).toContain("Create a new profile");
  expect(await render({ step: "purpose" })).toContain("What do you want your Neffi to help you do?");
});
test("purpose shows ordered essentials and signed-in email", async () => {
  const html = await render({ purpose: "get_clients" });
  expect(html).toContain("Your essentials");
  let previous = -1;
  for (const label of ["Full name", "What you do", "Short intro", "Email", "Phone", "Booking link"]) {
    const index = html.indexOf(label);
    expect(index).toBeGreaterThan(previous);
    previous = index;
  }
  expect(html).toContain('name="email"');
  expect(html).toContain('value="ana@example.test"');
  expect(html).toContain("Create my Neffi");
  expect(html).toContain("You can change all of this later.");
});
test("invalid purpose shows purpose selection", async () => {
  expect(await render({ purpose: "x" })).toContain("What do you want your Neffi to help you do?");
});
