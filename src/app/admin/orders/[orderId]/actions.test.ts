import { beforeEach, expect, test, vi } from "vitest";
const { authorize, addOrderNote, assignOrder, updateOrderDetails, addOrderItem, updateOrderItem, removeOrderItem } = vi.hoisted(() => ({ authorize: vi.fn(), addOrderNote: vi.fn(), assignOrder: vi.fn(), updateOrderDetails: vi.fn(), addOrderItem: vi.fn(), updateOrderItem: vi.fn(), removeOrderItem: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/orders/order", () => ({ addOrderNote, assignOrder, updateOrderDetails }));
vi.mock("@/modules/orders/items", () => ({ addOrderItem, updateOrderItem, removeOrderItem }));
const money = vi.hoisted(() => ({ recordPayment: vi.fn(), recordRefund: vi.fn(), voidPayment: vi.fn(), voidRefund: vi.fn() }));
vi.mock("@/modules/payments/record", () => ({ recordPayment: money.recordPayment, recordRefund: money.recordRefund }));
vi.mock("@/modules/payments/void", () => ({ voidPayment: money.voidPayment, voidRefund: money.voidRefund }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { addOrderNoteAction, assignOrderAction, updateOrderDetailsAction, addOrderItemAction, updateOrderItemAction, removeOrderItemAction } from "./actions";
import { recordPaymentAction, recordRefundAction, voidPaymentAction, voidRefundAction } from "./actions";
const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [k, v] of Object.entries(fields)) data.set(k, v); return data; };
beforeEach(() => { vi.clearAllMocks(); authorize.mockResolvedValue({ ok: true, viewer: { accountId: id } }); });

test("each action authorizes before domain calls", async () => {
  authorize.mockResolvedValue({ ok: false, denial: { status: 403, error: "forbidden" } });
  for (const action of [addOrderNoteAction, assignOrderAction, updateOrderDetailsAction, addOrderItemAction, updateOrderItemAction, removeOrderItemAction, recordPaymentAction, recordRefundAction, voidPaymentAction, voidRefundAction]) expect(await action(undefined, form({ orderId: id }))).toHaveProperty("error");
  for (const service of [addOrderNote, assignOrder, updateOrderDetails, addOrderItem, updateOrderItem, removeOrderItem, ...Object.values(money)]) expect(service).not.toHaveBeenCalled();
});

test("item actions validate quantity/confirmation and convert or clear the agreed total", async () => {
  expect(await removeOrderItemAction(undefined, form({ orderId: id, orderItemId: id }))).toHaveProperty("error");
  expect(await addOrderItemAction(undefined, form({ orderId: id, kind: "dbc", quantity: "0", agreedTotal: "" }))).toHaveProperty("error");
  await updateOrderItemAction(undefined, form({ orderId: id, orderItemId: id, quantity: "2", agreedTotal: "1,000.50" }));
  expect(updateOrderItem).toHaveBeenLastCalledWith({}, expect.objectContaining({ quantity: 2, agreedTotal: 100050 }));
  await updateOrderItemAction(undefined, form({ orderId: id, orderItemId: id, quantity: "2", agreedTotal: "" }));
  expect(updateOrderItem).toHaveBeenLastCalledWith({}, expect.objectContaining({ agreedTotal: null }));
});

test("money actions require valid dates/amounts and reasoned confirmed voids", async () => {
  expect(await recordPaymentAction(undefined, form({ orderId: id, amount: "1.001", method: "cash" }))).toHaveProperty("error");
  expect(await recordRefundAction(undefined, form({ orderId: id, amount: "10", method: "cash" }))).toHaveProperty("error");
  expect(await voidPaymentAction(undefined, form({ orderId: id, paymentId: id, reason: " ", confirm: "on" }))).toHaveProperty("error");
  await recordPaymentAction(undefined, form({ orderId: id, amount: "10.50", method: "cash", paidOn: "" }));
  expect(money.recordPayment).toHaveBeenCalledWith({}, expect.objectContaining({ actorId: id, amount: 1050, paidOn: undefined }));
  await voidRefundAction(undefined, form({ orderId: id, refundId: id, reason: " Mis-keyed ", confirm: "on" }));
  expect(money.voidRefund).toHaveBeenCalledWith({}, expect.objectContaining({ actorId: id, reason: "Mis-keyed" }));
});

test("bad ids, blank internal notes and invalid fees rejected; valid fee converted", async () => {
  expect(await assignOrderAction(undefined, form({ orderId: "bad", assignedToAccountId: id }))).toHaveProperty("error");
  expect(await addOrderNoteAction(undefined, form({ orderId: id, note: " " }))).toHaveProperty("error");
  expect(await updateOrderDetailsAction(undefined, form({ orderId: id, deliveryMethod: "pickup", shippingFee: "-1", notes: "" }))).toHaveProperty("error");
  expect(updateOrderDetails).not.toHaveBeenCalled();
  await updateOrderDetailsAction(undefined, form({ orderId: id, deliveryMethod: "courier", shippingFee: "50.50", notes: " Ship " }));
  expect(updateOrderDetails).toHaveBeenCalledWith({}, { orderId: id, actorId: id, deliveryMethod: "courier", shippingFee: 5050, notes: "Ship" });
});
