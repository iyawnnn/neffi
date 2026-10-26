import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertProduct } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { createPaidDbcOrder } from "./normal-dbc";
import { normalOrderInput } from "./operations-test-fixtures";
import { NEW_PAYMENT_METHODS } from "./policy";
import { loadOrderFacts } from "./order";
import { updateOrderDetails } from "./order";
import { addOrderItem, removeOrderItem, updateOrderItem } from "./items";
import { recordPayment } from "../payments/record";
import { listOrders } from "./queries";
import { dashboard } from "./dashboard";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("normal sale snapshots 799 pesos and records exactly one product receipt", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc", 50_000);
  const result = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { quantity: 2 }));
  const [order] = await tx.select().from(s.orders).where(eq(s.orders.id, result.orderId));
  expect(order).toMatchObject({ createdByAccountId: owner.id, normalPaymentMethod: "gcash", shippingFee: 0, shippingFeePending: false, deliveryMethod: "local_handoff" });
  expect(await tx.select().from(s.orderItems)).toMatchObject([{ orderId: order.id, quantity: 2, unitPrice: 79_900, agreedTotal: null }]);
  expect(await tx.select().from(s.payments)).toMatchObject([{ orderId: order.id, amount: 159_800, method: "gcash", recordedByAccountId: owner.id }]);
  expect((await loadOrderFacts(tx, order.id)).totals).toMatchObject({ orderTotal: 159_800, balance: 0, paymentState: "Paid" });
  expect(result.allocation).toEqual({ allocatedCardIds: [], missingQuantity: 2 });
}));

test.each(NEW_PAYMENT_METHODS)("%s is accepted for a normal sale", (paymentMethod) => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  await createPaidDbcOrder(tx, normalOrderInput(owner.id, { paymentMethod }));
  expect((await tx.select().from(s.payments))[0].method).toBe(paymentMethod);
}));

test("known courier fee leaves an outstanding shipping balance without a shipping receipt", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const result = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { delivery: { method: "jnt", shippingFee: 12_000 } }));
  const [order] = await tx.select().from(s.orders);
  expect(order).toMatchObject({ deliveryMethod: "courier", shippingFee: 12_000, shippingFeePending: false });
  expect(await tx.select().from(s.payments)).toMatchObject([{ amount: 79_900 }]);
  expect((await loadOrderFacts(tx, result.orderId)).totals).toMatchObject({ orderTotal: 91_900, balance: 12_000, paymentState: "Unpaid" });
}));

test("unknown courier fee marks the total pending and keeps the product receipt", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const result = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { delivery: { method: "jnt" } }));
  const facts = await loadOrderFacts(tx, result.orderId);
  expect(facts).toMatchObject({ shippingFeePending: true });
  expect(facts.totals).toMatchObject({ productSubtotal: 79_900, shippingFeePending: true, orderTotal: null, balance: null });
  expect((await listOrders(tx)).orders[0]).toMatchObject({ orderTotal: null, balance: null });
  expect(await dashboard(tx, "2026-10")).toMatchObject({ inProgress: 1, outstanding: 0 });
  expect(await tx.select().from(s.payments)).toMatchObject([{ amount: 79_900 }]);
}));

test("same client key replays the original receipt without new child rows, even with changed valid fields", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  const other = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const input = normalOrderInput(owner.id);
  const first = await createPaidDbcOrder(tx, input);
  const second = await createPaidDbcOrder(tx, { ...input, quantity: 3, paymentMethod: "maya", purchaser: { name: "Different buyer" } });
  expect(second.orderId).toBe(first.orderId);
  expect(await tx.select().from(s.orders)).toHaveLength(1);
  expect(await tx.select().from(s.purchasers)).toHaveLength(1);
  expect(await tx.select().from(s.orderItems)).toHaveLength(1);
  expect(await tx.select().from(s.payments)).toHaveLength(1);
  await expect(createPaidDbcOrder(tx, { ...input, actorId: other.id })).rejects.toMatchObject({ code: "invalid_input" });
}));

test.each(["unitPrice", "agreedTotal", "paidNow", "paid", "arbitraryCourier", "extra"])("rejects forbidden %s override", (key) => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const input = { ...normalOrderInput(owner.id), [key]: key === "arbitraryCourier" ? "Other" : 1 };
  await expect(createPaidDbcOrder(tx, input)).rejects.toMatchObject({ code: "invalid_input" });
  expect(await tx.select().from(s.orders)).toHaveLength(0);
}));

test.each(["cash", "cod"])("rejects %s as a new sale method", (paymentMethod) => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  await expect(createPaidDbcOrder(tx, { ...normalOrderInput(owner.id), paymentMethod: paymentMethod as "gcash" })).rejects.toMatchObject({ code: "invalid_input" });
}));

test("normal receipt cannot be repriced, resized, or manually collected before delivery", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { delivery: { method: "jnt", shippingFee: 500 } }));
  const [item] = await tx.select().from(s.orderItems);
  const base = { actorId: owner.id, orderId };
  await expect(addOrderItem(tx, { ...base, kind: "dbc", quantity: 1 })).rejects.toMatchObject({ code: "wrong_status" });
  await expect(updateOrderItem(tx, { ...base, orderItemId: item.id, quantity: 2 })).rejects.toMatchObject({ code: "wrong_status" });
  await expect(removeOrderItem(tx, { ...base, orderItemId: item.id })).rejects.toMatchObject({ code: "wrong_status" });
  await expect(updateOrderDetails(tx, { ...base, deliveryMethod: "pickup", shippingFee: 0, notes: "" })).rejects.toMatchObject({ code: "wrong_status" });
  await expect(recordPayment(tx, { ...base, amount: 500, method: "gcash" })).rejects.toMatchObject({ code: "wrong_status" });
  expect(await tx.select().from(s.payments)).toMatchObject([{ amount: 79_900 }]);
}));
