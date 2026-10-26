import { beforeEach, describe, expect, test, vi } from "vitest";
const { authorize, createOrder, createPaidDbcOrder, redirect } = vi.hoisted(() => ({ authorize: vi.fn(), createOrder: vi.fn(), createPaidDbcOrder: vi.fn(), redirect: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/orders/create", () => ({ createOrder }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/config/env", () => ({ env: { activationCodeSecret: "s".repeat(40), activationCodeEncryptionActiveKeyId: "k1", activationCodeEncryptionKeys: new Map() } }));
vi.mock("@/modules/orders/normal-dbc", () => ({ createPaidDbcOrder }));
import { createOrderAction, createPaidOrderAction } from "./actions";
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

describe("createPaidOrderAction", () => {
  const key = crypto.randomUUID();
  const paid = (extra: Record<string, string> = {}) => { const data = new FormData(); for (const [k, v] of Object.entries({ clientKey: key, name: "Ana Buyer", contactNumber: "0917", quantity: "2", paymentMethod: "maya", delivery: "in_person", ...extra })) data.set(k, v); return data; };
  beforeEach(() => createPaidDbcOrder.mockResolvedValue({ orderId: "paid-order", allocation: { allocatedCardIds: [], missingQuantity: 2 } }));

  test("denies a customer before creating", async () => {
    authorize.mockResolvedValue({ ok: false, denial: { status: 403, error: "forbidden" } });
    expect(await createPaidOrderAction(undefined, paid())).toHaveProperty("error");
    expect(createPaidDbcOrder).not.toHaveBeenCalled();
  });

  test("creates through the fixed-price facade with server-owned actor and secrets, then opens the order", async () => {
    await createPaidOrderAction(undefined, paid());
    expect(createPaidDbcOrder).toHaveBeenCalledWith({}, expect.objectContaining({ actorId: "owner", clientKey: key, quantity: 2, paymentMethod: "maya", purchaser: { name: "Ana Buyer", contactNumber: "0917" }, delivery: { method: "in_person" } }));
    expect(createPaidDbcOrder.mock.calls[0][1].secrets.lookupSecret).toBe("s".repeat(40));
    expect(redirect).toHaveBeenCalledWith("/admin/orders/paid-order");
  });

  test("J&T carries destination details but never a fee", async () => {
    await createPaidOrderAction(undefined, paid({ delivery: "jnt", recipientName: "Rey", recipientPhone: "0999", address: "1 Long Street" }));
    expect(createPaidDbcOrder).toHaveBeenCalledWith({}, expect.objectContaining({ delivery: { method: "jnt", recipientName: "Rey", recipientPhone: "0999", address: "1 Long Street" } }));
  });

  test.each([
    ["Cash", { paymentMethod: "cash" }], ["Pickup", { delivery: "pickup" }], ["Local handoff", { delivery: "local_handoff" }], ["arbitrary courier", { delivery: "jnt", courier: "LBC" }],
    ["unit price", { unitPrice: "1" }], ["agreed total", { agreedTotal: "100" }], ["paid flag", { paidNow: "on" }], ["payment amount", { paymentAmount: "1" }], ["shipping fee at creation", { delivery: "jnt", shippingFee: "100" }], ["items payload", { items: "[]" }], ["zero quantity", { quantity: "0" }], ["501 quantity", { quantity: "501" }], ["non-uuid key", { clientKey: "nope" }],
  ])("rejects %s without touching the service", async (_name, extra) => {
    expect(await createPaidOrderAction(undefined, paid(extra))).toHaveProperty("error");
    expect(createPaidDbcOrder).not.toHaveBeenCalled();
  });
});
