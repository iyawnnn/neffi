import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ account: vi.fn(), summaries: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/cards/manage", () => ({ cardSummaries: m.summaries }));
import CardsPage from "./page";
test("cards show readable identity, profile connection and disabled state", async () => {
  m.account.mockResolvedValue({ accountId: "a1" }); m.summaries.mockResolvedValue([{ id: "c1", suffix: "WXYZ", profileName: "Ana", profileId: "p1", disabled: true }, { id: "c2", suffix: "ABCD", profileName: null, profileId: null, disabled: false }]);
  const html = renderToStaticMarkup(await CardsPage()); for (const text of ["Neffi ending in WXYZ", "Shows Ana", "Not set up yet", "Turned off"]) expect(html).toContain(text);
  expect(html).toContain('href="/app/cards/c1"'); expect(m.summaries).toHaveBeenCalledWith({}, "a1");
});
