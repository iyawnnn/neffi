import { beforeEach, expect, test, vi } from "vitest";
const { authorize, createOrder, redirect } = vi.hoisted(() => ({ authorize: vi.fn(), createOrder: vi.fn(), redirect: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/orders/create", () => ({ createOrder }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createOrderAction } from "./actions";
const form = (items = '[{"kind":"dbc","quantity":1}]') => { const data = new FormData(); data.set("name", "Ana"); data.set("items", items); data.set("deliveryMethod", "pickup"); return data; };
beforeEach(() => { vi.clearAllMocks(); authorize.mockResolvedValue({ ok: true, viewer: { accountId: "owner" } }); createOrder.mockResolvedValue({ orderId: "created" }); });

test("customer denied before creating an order", async () => {
  authorize.mockResolvedValue({ ok: false, denial: { status: 403, error: "forbidden" } });
  expect(await createOrderAction(undefined, form())).toHaveProperty("error");
  expect(createOrder).not.toHaveBeenCalled();
});

test("rejects malformed or excessive line data", async () => {
  for (const value of ["broken JSON", "x".repeat(60001)]) expect(await createOrderAction(undefined, form(value))).toHaveProperty("error");
  expect(createOrder).not.toHaveBeenCalled();
});

test("ignores client prices, converts negotiated pesos and redirects to the new workspace", async () => {
  await createOrderAction(undefined, form('[{"kind":"dbc","quantity":1,"agreedTotal":"400.50","unitPrice":1}]'));
  expect(createOrder).toHaveBeenCalledWith({}, expect.objectContaining({ actorId: "owner", items: [{ kind: "dbc", quantity: 1, agreedTotal: 40050, label: undefined, reviewUrl: undefined }] }));
  expect(redirect).toHaveBeenCalledWith("/admin/orders/created");
});
