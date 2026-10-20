import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireOwner: vi.fn(), counts: vi.fn(), countCards: vi.fn(), listCards: vi.fn(), countStock: vi.fn(), listStock: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireOwner: m.requireOwner }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("./forms", () => ({ StockForm: () => null }));
vi.mock("@/modules/inventory/queries", () => ({ cardStateCounts: m.counts, countCards: m.countCards, listCards: m.listCards }));
vi.mock("@/modules/inventory/stock-purchases", () => ({ countStockPurchases: m.countStock, listStockPurchases: m.listStock }));
import InventoryPage from "./page";

const card = (index: number) => ({ id: `c${index}`, kind: "dbc", state: "ready", publicToken: `TOKEN${index}`, createdAt: new Date("2026-10-12T04:00:00Z") });
beforeEach(() => {
  vi.clearAllMocks();
  m.requireOwner.mockResolvedValue({});
  m.counts.mockResolvedValue({ rows: [{ kind: "dbc", state: "ready", count: 47 }], inProvisioning: 0 });
  m.countCards.mockResolvedValue(47);
  m.listCards.mockImplementation(async (_db, { limit }) => ({ cards: Array.from({ length: limit }, (_, index) => card(index)), next: null }));
  m.countStock.mockResolvedValue(23);
  m.listStock.mockResolvedValue([]);
});
const render = async (params: Record<string, string>) => renderToStaticMarkup(await InventoryPage({ searchParams: Promise.resolve(params), params: Promise.resolve({}) } as never));

test("the card list pages at 10 with the real total, while the overview stays unpaged", async () => {
  const html = await render({});
  expect(m.listCards).toHaveBeenCalledWith({}, { limit: 10, offset: 0, kind: undefined, state: undefined });
  expect(html).toContain("Showing 1–10 of 47 cards");
  expect(html).toContain("Page 1 of 5");
  expect(html).toContain('href="/admin/inventory?page=2"');
  expect(html).toContain(">47<");
  expect(html).toContain("cards in total");
  expect(m.counts).toHaveBeenCalledTimes(1);
});

test("later, final and out-of-range pages normalise and keep the filters", async () => {
  m.countCards.mockResolvedValue(47);
  const third = await render({ state: "ready", page: "3" });
  expect(m.listCards).toHaveBeenLastCalledWith({}, { limit: 10, offset: 20, kind: undefined, state: "ready" });
  expect(third).toContain("Showing 21–30 of 47 cards");
  expect(third).toContain('href="/admin/inventory?state=ready&amp;page=4"');
  expect(third).toContain('href="/admin/inventory?state=ready&amp;page=2"');
  const last = await render({ page: "5" });
  expect(last).toContain("Showing 41–47 of 47 cards");
  const beyond = await render({ page: "99" });
  expect(m.listCards).toHaveBeenLastCalledWith({}, { limit: 10, offset: 40, kind: undefined, state: undefined });
  expect(beyond).toContain("Page 5 of 5");
  const junk = await render({ page: "abc" });
  expect(junk).toContain("Showing 1–10");
  expect(m.countCards).toHaveBeenCalledWith({}, { kind: undefined, state: undefined });
});

test("stock purchases page at 10 too, and a non-owner never reaches the queries", async () => {
  const html = await render({ view: "stock" });
  expect(m.listStock).toHaveBeenCalledWith({}, { limit: 10, offset: 0 });
  expect(m.listCards).not.toHaveBeenCalled();
  expect(html).toContain("Stock purchases");
  m.requireOwner.mockRejectedValue(new Error("denied"));
  m.counts.mockClear();
  await expect(render({})).rejects.toThrow("denied");
  expect(m.counts).not.toHaveBeenCalled();
});
