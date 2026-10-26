import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const { requireOwner, getStockPurchase, listStockPurchaseCards } = vi.hoisted(() => ({ requireOwner: vi.fn(), getStockPurchase: vi.fn(), listStockPurchaseCards: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireOwner }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/modules/inventory/stock-purchases", () => ({ getStockPurchase, listStockPurchaseCards }));
vi.mock("../../forms", () => ({ StockPurchaseForm: () => <form><button>Save stock purchase</button></form> }));
import StockPurchasePage from "./page";

const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const purchase = { id, receivedOn: "2026-10-13", supplier: "Shenzhen NFC", reference: "INV-77", notes: "Batch A", purchaseCost: 150000, inboundShippingCost: null, quantity: 3, states: { blank: 2, released: 1 } };
const cards = [{ id: "c1", inventoryNumber: 2, state: "released", orderId: id, orderNumber: 1001 }, { id: "c2", inventoryNumber: 3, state: "blank", orderId: null, orderNumber: null }, { id: "c3", inventoryNumber: 4, state: "blank", orderId: null, orderNumber: null }];
const render = async () => renderToStaticMarkup(await StockPurchasePage({ params: Promise.resolve({ stockPurchaseId: id }) }));
beforeEach(() => { vi.clearAllMocks(); getStockPurchase.mockResolvedValue(purchase); listStockPurchaseCards.mockResolvedValue(cards); });

test("stock receipt shows its identity, costs, allocation counts and linked cards and orders", async () => {
  const html = await render();
  expect(html).toContain("Stock receipt");
  expect(html).toContain("INV-77");
  expect(html).toContain("Received Oct 13, 2026 from Shenzhen NFC");
  expect(html).toContain("₱1,500.00");
  expect(html).toContain("Not recorded");
  expect(html).toContain("1 of 3 cards allocated");
  expect(html).toContain("N-0002");
  expect(html).toContain('href="/admin/inventory/cards/c1"');
  expect(html).toContain('href="/admin/orders/' + id + '"');
  expect(html).toContain("Order 1001");
  expect(html).not.toMatch(/landed/i);
});

test("a receipt with no cards shows an empty state and no primary Create order action", async () => {
  getStockPurchase.mockResolvedValue({ ...purchase, quantity: 0, states: {} });
  listStockPurchaseCards.mockResolvedValue([]);
  const html = await render();
  expect(html).toContain("No cards on this receipt");
  expect(html).not.toContain("Create order");
});

test("customer denied before stock data is read", async () => {
  requireOwner.mockRejectedValueOnce(new Error("denied"));
  await expect(render()).rejects.toThrow("denied");
  expect(getStockPurchase).not.toHaveBeenCalled();
});
