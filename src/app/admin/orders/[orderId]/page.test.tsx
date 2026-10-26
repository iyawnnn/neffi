import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const { requireOwner, getOrderDetail } = vi.hoisted(() => ({ requireOwner: vi.fn(), getOrderDetail: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireOwner }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/modules/orders/queries", () => ({ getOrderDetail }));
vi.mock("@/modules/support/queries", () => ({ casesForOrder: vi.fn().mockResolvedValue([]) }));
vi.mock("../../inventory/forms", () => ({ ActionForm: ({ children, submit }: { children: React.ReactNode; submit: string }) => <form>{children}<button>{submit}</button></form> }));
vi.mock("./actions", () => ({ assignOrderAction: vi.fn(), addOrderNoteAction: vi.fn(), updateOrderDetailsAction: vi.fn(), addOrderItemAction: vi.fn(), updateOrderItemAction: vi.fn(), removeOrderItemAction: vi.fn(), recordPaymentAction: vi.fn(), recordRefundAction: vi.fn(), voidPaymentAction: vi.fn(), voidRefundAction: vi.fn(), reserveDbcCardsAction: vi.fn(), allocateAvailableStockAction: vi.fn(), returnCardToStockAction: vi.fn(), handOverOrderAction: vi.fn(), shipOrderAction: vi.fn(), updateShipmentAction: vi.fn(), cancelOrderAction: vi.fn(), saveJntDeliveryAction: vi.fn(), markJntShippedAction: vi.fn(), correctShipmentDateAction: vi.fn() }));
import OrderPage from "./page";
const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const detail = { id, number: 1001, status: "in_progress", purchaserId: id, purchaser: { name: "Buyer", contactNumber: null }, deliveryMethod: "pickup", shippingFee: 0, notes: null, assignedToAccountId: id, updatedByAccountId: id, updatedAt: new Date("2026-10-13"), anyReleased: false, hasCommercialDelivery: false, readyDbcCards: [], totals: { orderTotal: 50000, netPaid: 10000, balance: 40000, refundDue: 0, paymentState: "Unpaid" }, items: [{ id, name: "DBC", quantity: 1, unitPrice: 50000, agreedTotal: null, productKind: "dbc", label: null, reviewUrl: null, activeCount: 0, allocatedCount: 0, preparedCount: 0, releasedCount: 0 }], payments: [], refunds: [], cards: [], shipments: [], timeline: [], assignees: [{ id, email: "owner@example.test" }] };
const render = async () => renderToStaticMarkup(await OrderPage({ params: Promise.resolve({ orderId: id }) }));
beforeEach(() => { vi.clearAllMocks(); getOrderDetail.mockResolvedValue(detail); });
test("workspace shows balances, assignment, fulfillment counts and internal note controls", async () => {
  const html = await render();
  expect(html).toContain("Order 1001");
  expect(html).toContain("₱400.00");
  expect(html).toContain("Assigned to");
  expect(html).toContain("Internal note");
  expect(html).toContain("0 allocated · 0 prepared · 0 released");
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

const dest = { id, courier: "J&T", trackingNumber: null, recipientName: "Rey Dela Cruz", recipientContact: "0917 000 0000", address: "1 Long Street, Quezon City", status: "pending", shippedOn: null, courierCost: null };
const productPayment = { id, amount: 79900, method: "gcash", paidOn: "2026-10-26", reference: null, voidedAt: null, voidReason: null, createdAt: new Date("2026-10-26") };
const normal = (over: Record<string, unknown> = {}, item: Record<string, unknown> = {}) => ({
  ...detail, clientKey: id, normalPaymentMethod: "gcash", shippingFeePending: false, createdAt: new Date("2026-10-20T04:00:00Z"), deliveryMethod: "local_handoff",
  totals: { ...detail.totals, productSubtotal: 79900, orderTotal: 79900, netPaid: 79900, balance: 0, paymentState: "Paid" },
  items: [{ ...detail.items[0], name: "Neffi Digital Business Card", unitPrice: 79900, quantity: 1, allocatedCount: 1, preparedCount: 1, releasedCount: 0, ...item }],
  cards: [{ id: "c1", kind: "dbc", state: "reserved", inventoryNumber: 51, ownerAccountId: null }], payments: [productPayment], shipments: [], ...over,
});
const primary = (html: string) => { const start = html.indexOf("data-primary-task"); return start < 0 ? "" : html.slice(start, html.indexOf("</section>", start) + 10); };

test("normal order with a stock shortage waits for stock, names the remaining quantity and offers Receive stock", async () => {
  getOrderDetail.mockResolvedValue(normal({ cards: [], }, { quantity: 3, allocatedCount: 0, preparedCount: 0 }));
  const html = await render();
  expect(html.match(/data-primary-task/g)).toHaveLength(1);
  expect(primary(html)).toContain("Waiting for stock");
  expect(primary(html)).toContain("3 cards still need stock");
  expect(primary(html)).toContain('href="/admin/inventory"');
});

test("a stock shortage with cards now available offers Allocate available stock next to Receive stock", async () => {
  getOrderDetail.mockResolvedValue(normal({ cards: [] }, { quantity: 2, allocatedCount: 0, preparedCount: 0 }));
  const html = await render();
  expect(primary(html)).toContain("Allocate available stock");
  expect(primary(html)).toContain("Receive stock");
});

test("partial preparation leads with Prepare card straight to the next card and shows progress", async () => {
  getOrderDetail.mockResolvedValue(normal({ cards: [{ id: "c1", kind: "dbc", state: "reserved", inventoryNumber: 51, ownerAccountId: null }, { id: "c2", kind: "dbc", state: "preparing", inventoryNumber: 52, ownerAccountId: null }] }, { quantity: 2, allocatedCount: 2, preparedCount: 1 }));
  const html = await render();
  expect(primary(html)).toContain(">Prepare card<");
  expect(primary(html)).toContain('href="/admin/inventory/cards/c2"');
  expect(primary(html)).toContain("1 of 2 prepared");
  expect(html).not.toContain("Give card to customer");
});

test("In person: all prepared offers one Give card to customer action and no legacy handover or reservation controls", async () => {
  getOrderDetail.mockResolvedValue(normal());
  const html = await render();
  expect(primary(html)).toContain("Give card to customer");
  expect(html).toContain("They can activate it afterward");
  for (const gone of ["Record handover", "Reserve selected DBCs", "Record shipping payment", "Record shipment", "Record payment", "Paid now"]) expect(html).not.toContain(gone);
  expect(html).not.toMatch(/Preparing|Released/);
});

test("J&T with a pending fee: To be confirmed, one Mark as shipped form, no payment or method controls", async () => {
  getOrderDetail.mockResolvedValue(normal({ deliveryMethod: "courier", shippingFeePending: true, totals: { ...normal().totals, orderTotal: null, balance: null }, shipments: [dest] }));
  const html = await render();
  expect(html).toContain("J&amp;T Shipping — To be confirmed");
  expect(html).toContain("Product paid");
  expect(html).not.toContain("Unpaid");
  expect(primary(html)).toContain("Mark as shipped");
  expect(primary(html)).toContain('name="shippingFee"');
  expect(primary(html)).toContain('name="trackingNumber"');
  expect(primary(html)).toContain('name="shippedOn"');
  expect(primary(html)).toContain("confirms the J&amp;T shipping fee has been collected");
  expect(html.match(/name="shippingFee"/g)).toHaveLength(1);
  expect(html).not.toMatch(/name="(method|paymentMethod|amount|paid|courier)"/);
  expect(html).not.toContain('type="checkbox"');
  expect(html).not.toContain("Record handover");
});

test("J&T shipped-date input is bounded to the order's creation date and today", async () => {
  getOrderDetail.mockResolvedValue(normal({ deliveryMethod: "courier", shipments: [dest] }));
  const html = await render();
  expect(html).toContain('min="2026-10-20"');
  expect(html).toMatch(/name="shippedOn"[^>]*max="\d{4}-\d{2}-\d{2}"|max="\d{4}-\d{2}-\d{2}"[^>]*name="shippedOn"/);
});

test("J&T with missing destination asks to complete the details first", async () => {
  getOrderDetail.mockResolvedValue(normal({ deliveryMethod: "courier", shippingFeePending: true, shipments: [{ ...dest, address: null }] }));
  const html = await render();
  expect(primary(html)).toContain("Complete J&amp;T details");
  expect(primary(html)).toContain('name="recipientName"');
  expect(primary(html)).not.toContain("Mark as shipped");
});

test("a confirmed fee shows product and shipping separately, and the receipts are labelled", async () => {
  getOrderDetail.mockResolvedValue(normal({ status: "completed", deliveryMethod: "courier", shippingFee: 12000, totals: { ...normal().totals, orderTotal: 91900, netPaid: 91900 }, payments: [{ ...productPayment, id: "p2", amount: 12000, createdAt: new Date("2026-10-27") }, productPayment], shipments: [{ ...dest, status: "in_transit", trackingNumber: "JT-9", shippedOn: "2026-10-27" }], cards: [{ id: "c1", kind: "dbc", state: "released", inventoryNumber: 51, ownerAccountId: null }] }, { releasedCount: 1 }));
  const html = await render();
  expect(html).toContain("Neffi Digital Business Card");
  expect(html).toContain("J&amp;T Shipping");
  expect(html).toContain("₱120.00");
  expect(html).toContain("Product payment");
  expect(html).toContain("Shipping payment");
  expect(primary(html)).toContain("Waiting for activation");
  expect(html).toContain("JT-9");
});

test("activated cards complete the guide", async () => {
  getOrderDetail.mockResolvedValue(normal({ status: "completed", cards: [{ id: "c1", kind: "dbc", state: "released", inventoryNumber: 51, ownerAccountId: id }] }, { releasedCount: 1 }));
  expect(primary(await render())).toContain("Activated · Complete");
});

test("a very long customer name wraps instead of overflowing", async () => {
  getOrderDetail.mockResolvedValue(normal({ purchaser: { name: "Maria ".repeat(40) + "Supercalifragilisticexpialidocious".repeat(4), contactNumber: null } }));
  expect(await render()).toContain("[overflow-wrap:anywhere]");
});

test("legacy orders keep their truthful legacy controls", async () => {
  getOrderDetail.mockResolvedValue({ ...detail, deliveryMethod: "pickup", cards: [{ id: "c1", kind: "dbc", state: "reserved", inventoryNumber: 51 }], items: [{ ...detail.items[0], allocatedCount: 1, preparedCount: 1 }] });
  const html = await render();
  expect(html).not.toContain("data-primary-task");
  expect(html).toContain("Record handover");
});

test("normal orders hide the generic shipment update until shipped, then offer status without a courier field", async () => {
  getOrderDetail.mockResolvedValue(normal({ deliveryMethod: "courier", shipments: [dest] }));
  let html = await render();
  expect(html).not.toContain("Update shipment");
  getOrderDetail.mockResolvedValue(normal({ status: "completed", deliveryMethod: "courier", shippingFee: 12000, shipments: [{ ...dest, status: "in_transit", trackingNumber: "JT-9", shippedOn: "2026-10-27" }], cards: [{ id: "c1", kind: "dbc", state: "released", inventoryNumber: 51, ownerAccountId: null }] }, { releasedCount: 1 }));
  html = await render();
  expect(html).toContain("Update shipment");
});

test("normal orders show friendly method, shipment status and readable activity", async () => {
  getOrderDetail.mockResolvedValue(normal({ normalPaymentMethod: "bank_transfer", payments: [{ ...productPayment, method: "bank_transfer" }], shipments: [{ ...dest, status: "in_transit", trackingNumber: "JT-9", shippedOn: "2026-10-27" }], deliveryMethod: "courier", timeline: [{ id: "e1", type: "payment_recorded", note: "79900 centavos; bank_transfer", createdAt: new Date("2026-10-26") }, { id: "e2", type: "card_provisioned", note: "token ABCDEF123456", createdAt: new Date("2026-10-26") }] }));
  const html = await render();
  expect(html).toContain("Bank transfer");
  expect(html).toContain("In transit");
  expect(html).toContain("Product payment received · ₱799.00 · Bank transfer");
  expect(html).toContain("Card assigned and ready for NFC writing");
  expect(html).not.toMatch(/centavos|ABCDEF123456|in_transit|bank_transfer/);
});

test("legacy orders keep raw, truthful history and method names", async () => {
  getOrderDetail.mockResolvedValue({ ...detail, payments: [{ ...productPayment, method: "cash" }], timeline: [{ id: "e1", type: "payment_recorded", note: "10000 centavos; cash", createdAt: new Date("2026-10-26") }] });
  const html = await render();
  expect(html).toContain("10000 centavos; cash");
});
