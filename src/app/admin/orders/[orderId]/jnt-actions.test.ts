import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ allocate: vi.fn(), authorize: vi.fn(), saveJntDelivery: vi.fn(), markJntShipped: vi.fn(), correctShipmentDate: vi.fn(), handOverOrder: vi.fn(), shipOrder: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/orders/jnt-fulfillment", () => ({ saveJntDelivery: m.saveJntDelivery, markJntShipped: m.markJntShipped, correctShipmentDate: m.correctShipmentDate }));
vi.mock("@/modules/orders/fulfillment", () => ({ reserveDbcCards: vi.fn(), returnCardToStock: vi.fn(), handOverOrder: m.handOverOrder, shipOrder: m.shipOrder, updateShipment: vi.fn() }));
vi.mock("@/modules/orders/order", () => ({ addOrderNote: vi.fn(), assignOrder: vi.fn(), updateOrderDetails: vi.fn() }));
vi.mock("@/modules/orders/items", () => ({ addOrderItem: vi.fn(), updateOrderItem: vi.fn(), removeOrderItem: vi.fn() }));
vi.mock("@/modules/payments/record", () => ({ recordPayment: vi.fn(), recordRefund: vi.fn() }));
vi.mock("@/modules/payments/void", () => ({ voidPayment: vi.fn(), voidRefund: vi.fn() }));
vi.mock("@/modules/orders/cancel", () => ({ cancelOrder: vi.fn() }));
vi.mock("@/modules/orders/allocation", () => ({ allocateDbcCards: m.allocate }));
vi.mock("@/config/env", () => ({ env: { activationCodeSecret: "s".repeat(40), activationCodeEncryptionActiveKeyId: "k1", activationCodeEncryptionKeys: new Map() } }));
import { OrderError } from "@/modules/orders/errors";
import { allocateAvailableStockAction, correctShipmentDateAction, handOverOrderAction, markJntShippedAction, saveJntDeliveryAction } from "./actions";

const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [k, v] of Object.entries(fields)) data.set(k, v); return data; };
beforeEach(() => { vi.clearAllMocks(); m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "owner" } }); });

test("J&T actions authorize before any domain call", async () => {
  m.authorize.mockResolvedValue({ ok: false, denial: { status: 403, error: "forbidden" } });
  for (const action of [saveJntDeliveryAction, markJntShippedAction, correctShipmentDateAction]) expect(await action(undefined, form({ orderId: id }))).toHaveProperty("error");
  for (const service of [m.saveJntDelivery, m.markJntShipped, m.correctShipmentDate]) expect(service).not.toHaveBeenCalled();
});

test("saving J&T details forwards recipient fields and converts an optional fee to centavos", async () => {
  await saveJntDeliveryAction(undefined, form({ orderId: id, recipientName: "Rey", recipientPhone: "0999", address: "1 Long Street", shippingFee: "120.50" }));
  expect(m.saveJntDelivery).toHaveBeenLastCalledWith({}, { orderId: id, actorId: "owner", recipientName: "Rey", recipientPhone: "0999", address: "1 Long Street", shippingFee: 12050 });
  await saveJntDeliveryAction(undefined, form({ orderId: id, recipientName: "Rey", recipientPhone: "0999", address: "1 Long Street", shippingFee: "" }));
  expect(m.saveJntDelivery).toHaveBeenLastCalledWith({}, expect.objectContaining({ shippingFee: undefined }));
  await saveJntDeliveryAction(undefined, form({ orderId: id, recipientName: "Rey", recipientPhone: "0999", address: "1 Long Street", shippingFee: "0" }));
  expect(m.saveJntDelivery).toHaveBeenLastCalledWith({}, expect.objectContaining({ shippingFee: 0 }));
});

test("Mark as shipped sends only tracking, date and an optional fee; the method and courier are server-owned", async () => {
  await markJntShippedAction(undefined, form({ orderId: id, trackingNumber: " JT123 ", shippedOn: "2026-10-26", shippingFee: "100" }));
  expect(m.markJntShipped).toHaveBeenCalledWith({}, { orderId: id, actorId: "owner", trackingNumber: "JT123", shippedOn: "2026-10-26", shippingFee: 10000 });
  await markJntShippedAction(undefined, form({ orderId: id, trackingNumber: "JT123", shippedOn: "", shippingFee: "" }));
  expect(m.markJntShipped).toHaveBeenLastCalledWith({}, { orderId: id, actorId: "owner", trackingNumber: "JT123", shippedOn: undefined, shippingFee: undefined });
});

test.each([["method", "gcash"], ["paymentMethod", "cash"], ["amount", "1"], ["paid", "on"], ["courier", "LBC"]])("Mark as shipped rejects a %s override", async (field, value) => {
  const result = await markJntShippedAction(undefined, form({ orderId: id, trackingNumber: "JT123", [field]: value }));
  expect(result).toHaveProperty("error");
  expect(m.markJntShipped).not.toHaveBeenCalled();
});

test.each([
  ["settlement_mismatch", /correct/i], ["delivery_locked", /J&T details/i], ["checks_incomplete", /preparing every card/i], ["invalid_input", /future/i], ["wrong_status", /Reload/i],
] as const)("%s gets plain owner copy", async (code, copy) => {
  m.markJntShipped.mockRejectedValueOnce(new OrderError(code));
  const result = await markJntShippedAction(undefined, form({ orderId: id, trackingNumber: "JT123" }));
  expect(result.error).toMatch(copy);
});

test("giving the card reports unprepared cards in plain words", async () => {
  m.handOverOrder.mockRejectedValueOnce(new OrderError("checks_incomplete"));
  expect((await handOverOrderAction(undefined, form({ orderId: id, confirm: "on" }))).error).toMatch(/preparing every card/i);
});

test("shipped date correction needs a date and a reason", async () => {
  expect(await correctShipmentDateAction(undefined, form({ orderId: id, shipmentId: id, shippedOn: "2026-10-20", reason: " " }))).toHaveProperty("error");
  await correctShipmentDateAction(undefined, form({ orderId: id, shipmentId: id, shippedOn: "2026-10-20", reason: "Courier receipt" }));
  expect(m.correctShipmentDate).toHaveBeenCalledWith({}, { orderId: id, shipmentId: id, shippedOn: "2026-10-20", reason: "Courier receipt", actorId: "owner" });
});

test.each(["0x0", "0y00", "00x", "0,0", "-0"])("a look-alike zero fee (%s) is not read as zero", async (fee) => {
  expect(await markJntShippedAction(undefined, form({ orderId: id, trackingNumber: "JT123", shippingFee: fee }))).toHaveProperty("error");
  expect(await saveJntDeliveryAction(undefined, form({ orderId: id, recipientName: "Rey", recipientPhone: "0999", address: "1 Street", shippingFee: fee }))).toHaveProperty("error");
  expect(m.markJntShipped).not.toHaveBeenCalled();
  expect(m.saveJntDelivery).not.toHaveBeenCalled();
});

test.each(["0", "0.0", "0.00", "00"])("a genuine zero fee (%s) is zero", async (fee) => {
  await markJntShippedAction(undefined, form({ orderId: id, trackingNumber: "JT123", shippingFee: fee }));
  expect(m.markJntShipped).toHaveBeenLastCalledWith({}, expect.objectContaining({ shippingFee: 0 }));
});

test("Allocate available stock is owner-only, uses server secrets, and reports the outcome in plain words", async () => {
  m.allocate.mockResolvedValue({ allocatedCardIds: ["a", "b"], missingQuantity: 1 });
  m.authorize.mockResolvedValueOnce({ ok: false, denial: { status: 403, error: "forbidden" } });
  expect(await allocateAvailableStockAction(undefined, form({ orderId: id }))).toHaveProperty("error");
  expect(m.allocate).not.toHaveBeenCalled();
  const result = await allocateAvailableStockAction(undefined, form({ orderId: id }));
  expect(m.allocate).toHaveBeenCalledWith({}, expect.objectContaining({ orderId: id, actorId: "owner" }));
  expect(m.allocate.mock.calls[0][1].secrets.lookupSecret).toBe("s".repeat(40));
  expect(result.ok).toMatch(/2 cards assigned/i);
  m.allocate.mockResolvedValue({ allocatedCardIds: [], missingQuantity: 3 });
  expect((await allocateAvailableStockAction(undefined, form({ orderId: id }))).ok).toMatch(/no stock available yet/i);
});
