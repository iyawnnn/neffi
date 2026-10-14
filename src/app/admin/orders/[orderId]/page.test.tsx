import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const { requireOwner, getOrderDetail } = vi.hoisted(() => ({ requireOwner: vi.fn(), getOrderDetail: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireOwner }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/modules/orders/queries", () => ({ getOrderDetail }));
vi.mock("@/modules/support/queries", () => ({ casesForOrder: vi.fn().mockResolvedValue([]) }));
vi.mock("../../inventory/forms", () => ({ ActionForm: ({ children }: { children: React.ReactNode }) => <form>{children}</form> }));
vi.mock("./actions", () => ({ assignOrderAction: vi.fn(), addOrderNoteAction: vi.fn(), updateOrderDetailsAction: vi.fn(), addOrderItemAction: vi.fn(), updateOrderItemAction: vi.fn(), removeOrderItemAction: vi.fn(), recordPaymentAction: vi.fn(), recordRefundAction: vi.fn(), voidPaymentAction: vi.fn(), voidRefundAction: vi.fn(), reserveDbcCardsAction: vi.fn(), returnCardToStockAction: vi.fn(), handOverOrderAction: vi.fn(), shipOrderAction: vi.fn(), updateShipmentAction: vi.fn(), cancelOrderAction: vi.fn() }));
import OrderPage from "./page";
const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const detail = { id, number: 1001, status: "in_progress", purchaserId: id, purchaser: { name: "Buyer", contactNumber: null }, deliveryMethod: "pickup", shippingFee: 0, notes: null, assignedToAccountId: id, updatedByAccountId: id, updatedAt: new Date("2026-10-13"), anyReleased: false, hasCommercialDelivery: false, readyDbcCards: [], totals: { orderTotal: 50000, netPaid: 10000, balance: 40000, refundDue: 0, paymentState: "Unpaid" }, items: [{ id, name: "DBC", quantity: 1, unitPrice: 50000, agreedTotal: null, productKind: "dbc", label: null, reviewUrl: null, activeCount: 0, releasedCount: 0 }], payments: [], refunds: [], cards: [], shipments: [], timeline: [], assignees: [{ id, email: "owner@example.test" }] };
const render = async () => renderToStaticMarkup(await OrderPage({ params: Promise.resolve({ orderId: id }) }));
beforeEach(() => { vi.clearAllMocks(); getOrderDetail.mockResolvedValue(detail); });
test("workspace shows balances, assignment, fulfillment counts and internal note controls", async () => {
  const html = await render();
  expect(html).toContain("Order 1001");
  expect(html).toContain("₱400.00");
  expect(html).toContain("Assigned to");
  expect(html).toContain("Internal note");
  expect(html).toContain("0 reserved or released");
});
test("terminal order retains notes and assignment but hides detail edits", async () => {
  getOrderDetail.mockResolvedValue({ ...detail, status: "completed" });
  const html = await render();
  expect(html).toContain("Internal note");
  expect(html).not.toContain('name="shippingFee"');
  expect(html).toContain("Open support case");
  expect(html).not.toContain(">Record payment<");
  expect(html).not.toContain(">Record refund<");
});

test("after-sale refunds link to Support and Completed correction balances are explicit", async () => {
  getOrderDetail.mockResolvedValue({ ...detail, status: "completed", totals: { ...detail.totals, afterSaleRefunded: 5000 }, refunds: [{ id, supportCaseId: id, amount: 5000, method: "cash", refundedOn: "2026-10-14", voidedAt: null }] });
  const html = await render();
  expect(html).toContain("Balance due after correction");
  expect(html).toContain("After-sale refund");
  expect(html).toContain(`/admin/support/${id}`);
  expect(html).not.toContain(">Void refund<");
});
test("customer denied before order data is read", async () => {
  requireOwner.mockRejectedValueOnce(new Error("denied"));
  await expect(render()).rejects.toThrow("denied");
  expect(getOrderDetail).not.toHaveBeenCalled();
});

test("GRC line shows its commercial reference without Card fulfillment counts", async () => {
  getOrderDetail.mockResolvedValue({ ...detail, hasCommercialDelivery: true, items: [{ ...detail.items[0], name: "GRC", productKind: "grc", activeCount: 999, releasedCount: 999, label: "Branch A" }] });
  const html = await render();
  expect(html).toContain("Branch A");
  expect(html).toContain("Manual programming");
  expect(html).not.toContain("999 reserved");
  expect(html).toContain('name="deliveryMethod" class=');
  expect(html).toContain("disabled");
});
