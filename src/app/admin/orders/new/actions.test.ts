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

test("validates and forwards the optional support case link for GRC", async () => {
  const data = form('[{"kind":"grc","quantity":1}]');
  data.set("supportCaseId", "invalid");
  expect(await createOrderAction(undefined, data)).toHaveProperty("error");
  expect(createOrder).not.toHaveBeenCalled();
  const caseId = crypto.randomUUID();
  data.set("supportCaseId", caseId);
  await createOrderAction(undefined, data);
  expect(createOrder).toHaveBeenCalledWith({}, expect.objectContaining({ supportCaseId: caseId }));
});

test("rejects legacy DBC creation and keeps GRC negotiated totals", async () => {
  expect(await createOrderAction(undefined, form('[{"kind":"dbc","quantity":1,"agreedTotal":"400.50"}]'))).toHaveProperty("error");
  expect(createOrder).not.toHaveBeenCalled();
  await createOrderAction(undefined, form('[{"kind":"grc","quantity":1,"agreedTotal":"400.50","unitPrice":1}]'));
  expect(createOrder).toHaveBeenCalledWith({}, expect.objectContaining({ actorId: "owner", items: [{ kind: "grc", quantity: 1, agreedTotal: 40050, label: undefined, reviewUrl: undefined }] }));
  expect(redirect).toHaveBeenCalledWith("/admin/orders/created");
});
