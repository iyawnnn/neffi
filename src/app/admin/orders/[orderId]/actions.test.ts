import { beforeEach, expect, test, vi } from "vitest";
const { authorize, addOrderNote, assignOrder, updateOrderDetails } = vi.hoisted(() => ({ authorize: vi.fn(), addOrderNote: vi.fn(), assignOrder: vi.fn(), updateOrderDetails: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/orders/order", () => ({ addOrderNote, assignOrder, updateOrderDetails }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { addOrderNoteAction, assignOrderAction, updateOrderDetailsAction } from "./actions";
const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [k, v] of Object.entries(fields)) data.set(k, v); return data; };
beforeEach(() => { vi.clearAllMocks(); authorize.mockResolvedValue({ ok: true, viewer: { accountId: id } }); });

test("each action authorizes before domain calls", async () => {
  authorize.mockResolvedValue({ ok: false, denial: { status: 403, error: "forbidden" } });
  for (const action of [addOrderNoteAction, assignOrderAction, updateOrderDetailsAction]) expect(await action(undefined, form({ orderId: id }))).toHaveProperty("error");
  for (const service of [addOrderNote, assignOrder, updateOrderDetails]) expect(service).not.toHaveBeenCalled();
});

test("bad ids, blank internal notes and invalid fees rejected; valid fee converted", async () => {
  expect(await assignOrderAction(undefined, form({ orderId: "bad", assignedToAccountId: id }))).toHaveProperty("error");
  expect(await addOrderNoteAction(undefined, form({ orderId: id, note: " " }))).toHaveProperty("error");
  expect(await updateOrderDetailsAction(undefined, form({ orderId: id, deliveryMethod: "pickup", shippingFee: "-1", notes: "" }))).toHaveProperty("error");
  expect(updateOrderDetails).not.toHaveBeenCalled();
  await updateOrderDetailsAction(undefined, form({ orderId: id, deliveryMethod: "courier", shippingFee: "50.50", notes: " Ship " }));
  expect(updateOrderDetails).toHaveBeenCalledWith({}, { orderId: id, actorId: id, deliveryMethod: "courier", shippingFee: 5050, notes: "Ship" });
});
