import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireOwner: vi.fn(), counts: vi.fn(), count: vi.fn(), list: vi.fn(), shortage: vi.fn(), countStock: vi.fn(), listStock: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireOwner: m.requireOwner }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("./forms", () => ({ StockForm: () => null }));
vi.mock("@/modules/inventory/queries", () => ({
  inventoryStatusCounts: m.counts, countInventoryQueue: m.count, listInventoryQueue: m.list, stockShortage: m.shortage,
  queueFilters: ["needs_preparation", "ready", "assigned", "delivered", "activated", "retired", "available"],
  STATUS_LABEL_BY_KEY: { available_blank: "Available blank", needs_preparation: "Needs preparation", ready: "Ready", assigned: "Assigned", shipped: "Shipped", given: "Given to customer", waiting_activation: "Waiting for activation", activated: "Activated", retired: "Retired" },
}));
vi.mock("@/modules/inventory/stock-purchases", () => ({ countStockPurchases: m.countStock, listStockPurchases: m.listStock }));
import InventoryPage from "./page";

const base = { kind: "dbc", state: "ready", publicToken: "T", ownerAccountId: null, createdAt: new Date("2026-10-12T04:00:00Z"), cursor: "x", orderId: null, orderNumber: null, deliveryMethod: null, customer: null, shipped: false, handedOver: false, tracking: null, courier: null, shipmentStatus: null, statusKey: "ready", activation: { usable: true, retrievable: true, revoked: false } };
const card = (index: number, over: Record<string, unknown> = {}) => ({ ...base, id: `c${index}`, inventoryNumber: index + 1, ...over });
beforeEach(() => {
  vi.clearAllMocks();
  m.requireOwner.mockResolvedValue({});
  m.counts.mockResolvedValue([{ kind: "dbc", status: "ready", count: 40 }, { kind: "dbc", status: "available_blank", count: 25 }, { kind: "dbc", status: "needs_preparation", count: 5 }, { kind: "dbc", status: "activated", count: 3 }]);
  m.count.mockResolvedValue(47);
  m.list.mockImplementation(async (_db, { limit }) => ({ cards: Array.from({ length: limit }, (_, index) => card(index)), next: null }));
  m.shortage.mockResolvedValue(0);
  m.countStock.mockResolvedValue(23);
  m.listStock.mockResolvedValue([]);
});
const render = async (params: Record<string, string>) => renderToStaticMarkup(await InventoryPage({ searchParams: Promise.resolve(params), params: Promise.resolve({}) } as never));

test("the queue pages at 20 with the real total and the available blanks collapsed out of it", async () => {
  const html = await render({});
  expect(m.list).toHaveBeenCalledWith({}, { limit: 20, offset: 0, filter: undefined, search: undefined });
  expect(html).toContain("Showing 1–20 of 47 cards");
  expect(html).toContain("Page 1 of 3");
  expect(html).toContain('href="/admin/inventory?page=2"');
  expect(m.counts).toHaveBeenCalledTimes(1);
});

test("available blank stock is one summary with a link, not rows", async () => {
  const html = await render({});
  expect(html).toContain("25 available blank cards");
  expect(html).toContain('href="/admin/inventory?status=available"');
  expect(html).toContain('href="/admin/orders/new"');
});

test("desktop shows the six operational columns and owner words, never raw state names", async () => {
  m.list.mockResolvedValue({ next: null, cards: [
    card(0, { statusKey: "needs_preparation", state: "preparing", orderId: "o1", orderNumber: 1005, customer: "Maria Santos".repeat(12), activation: { usable: true, retrievable: true, revoked: false } }),
    card(1, { statusKey: "shipped", state: "released", orderId: "o2", orderNumber: 1006, customer: "Ana", shipped: true, courier: "J&T", tracking: "JT900123456", deliveryMethod: "courier" }),
    card(2, { statusKey: "activated", state: "released", ownerAccountId: "a1", orderId: "o3", orderNumber: 1007, customer: "Rey", handedOver: true, activation: { usable: false, retrievable: false, revoked: false } }),
    card(3, { statusKey: "ready", activation: { usable: true, retrievable: false, revoked: false } }),
    card(4, { statusKey: "retired", state: "retired", activation: { usable: false, retrievable: false, revoked: true } }),
  ] });
  m.count.mockResolvedValue(5);
  const html = await render({});
  for (const column of ["Card", "Status", "Order / Customer", "Activation", "Delivery", "Next action"]) expect(html).toContain(`>${column}</th>`);
  expect(html).toContain("N-0001");
  for (const word of ["Needs preparation", "Shipped", "Activated", "Ready", "Retired"]) expect(html).toContain(`>${word}<`);
  expect(html).not.toMatch(/>(Preparing|Reserved|Released|Blank)</);
  expect(html).toContain("JT900123456");
  expect(html).toContain("Order 1005");
  expect(html).toContain("Show code");
  expect(html).toContain("Existing package code needed");
  expect(html).toContain("Prepare card");
  expect(html).toContain("[overflow-wrap:anywhere]");
  expect(html).not.toMatch(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/);
});

test("filters and search reach the query, are validated, and survive page links", async () => {
  m.count.mockResolvedValue(47);
  const html = await render({ status: "ready", q: "ana", page: "3" });
  expect(m.list).toHaveBeenLastCalledWith({}, { limit: 20, offset: 40, filter: "ready", search: "ana" });
  expect(html).toContain("Showing 41–47 of 47 cards");
  expect(html).toContain('href="/admin/inventory?status=ready&amp;q=ana&amp;page=2"');
  await render({ status: "nonsense", q: "x".repeat(300) });
  expect(m.list).toHaveBeenLastCalledWith({}, expect.objectContaining({ filter: undefined, search: "x".repeat(100) }));
});

test("the filter tabs show counts from the same status mapping", async () => {
  const html = await render({});
  expect(html).toMatch(/Needs preparation[\s\S]{0,60}5/);
  expect(html).toContain('href="/admin/inventory?status=needs_preparation"');
});

test("a stock shortage is visible and points to Receive stock and the waiting orders", async () => {
  m.shortage.mockResolvedValue(7);
  const html = await render({});
  expect(html).toContain("7 cards short");
  expect(html).toContain("Paid orders are waiting for stock");
});

test("an empty search explains itself", async () => {
  m.count.mockResolvedValue(0);
  m.list.mockResolvedValue({ cards: [], next: null });
  expect(await render({ q: "zzz" })).toContain("No cards match");
});

test("stock purchases page at 20 too, and a non-owner never reaches the queries", async () => {
  const html = await render({ view: "stock" });
  expect(m.listStock).toHaveBeenCalledWith({}, { limit: 20, offset: 0 });
  expect(m.list).not.toHaveBeenCalled();
  expect(html).toContain("Stock purchases");
  m.requireOwner.mockRejectedValue(new Error("denied"));
  m.counts.mockClear();
  await expect(render({})).rejects.toThrow("denied");
  expect(m.counts).not.toHaveBeenCalled();
});
