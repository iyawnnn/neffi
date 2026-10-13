import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertOrderItem, insertStockPurchase, syntheticToken } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { loadOrderFacts, lockOrder, mutateOrder, settleOrderCompletion } from "./order";
import { orderTotals } from "./totals";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("mutateOrder enforces allow and records the actor; unknown order refused", () => rollback(db, async (tx) => {
  const { order } = await insertOrderItem(tx, "dbc");
  const actor = await insertAccount(tx, "owner");
  await mutateOrder(tx, { orderId: order.id, actorId: actor.id }, async () => "result");
  expect((await lockOrder(tx, order.id)).updatedByAccountId).toBe(actor.id);
  await tx.update(s.orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(s.orders.id, order.id));
  let ran = false;
  await expect(mutateOrder(tx, { orderId: order.id, actorId: actor.id }, async () => { ran = true; })).rejects.toMatchObject({ code: "wrong_status" });
  expect(ran).toBe(false);
  expect(await mutateOrder(tx, { orderId: order.id, actorId: actor.id, allow: ["cancelled"] }, async () => "allowed")).toBe("allowed");
  await expect(lockOrder(tx, crypto.randomUUID())).rejects.toMatchObject({ code: "not_found" });
}));

test("facts agree with pure money and exclude voided payments and refunds without multiplying sums", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "dbc", 2);
  await tx.update(s.orders).set({ shippingFee: 500, deliveryMethod: "courier" }).where(eq(s.orders.id, order.id));
  await tx.insert(s.orderItems).values({ orderId: order.id, productId: product.id, productKind: "dbc", quantity: 3, unitPrice: 300, agreedTotal: 700 });
  const money = { orderId: order.id, method: "cash" as const, recordedByAccountId: owner.id };
  const voided = { voidedAt: new Date(), voidedByAccountId: owner.id, voidReason: "Mis-keyed" };
  await tx.insert(s.payments).values([{ ...money, paidOn: "2026-10-13", amount: 10000 }, { ...money, paidOn: "2026-10-13", amount: 2000 }, { ...money, paidOn: "2026-10-13", amount: 3000, ...voided }]);
  await tx.insert(s.refunds).values([{ ...money, refundedOn: "2026-10-13", amount: 1000 }, { ...money, refundedOn: "2026-10-13", amount: 500, ...voided }]);
  const stock = await insertStockPurchase(tx);
  await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "released", publicToken: syntheticToken(), orderItemId: item.id });
  await tx.insert(s.shipments).values({ orderId: order.id, status: "in_transit", shippedOn: "2026-10-13" });
  const facts = await loadOrderFacts(tx, order.id);
  expect(facts).toMatchObject({ received: 12000, refunded: 1000, hasShippedShipment: true, anyReleased: true });
  expect(facts.items.find((i) => i.id === item.id)).toMatchObject({ activeCount: 1, releasedCount: 1 });
  expect(facts.totals).toEqual(orderTotals(facts));
  expect(facts.totals).toMatchObject({ orderTotal: 101200, netPaid: 11000, balance: 90200 });
}));

test("system completion is exactly once and ineligible orders never complete", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "dbc");
  await settleOrderCompletion(tx, order.id, owner.id);
  expect((await lockOrder(tx, order.id)).status).toBe("in_progress");
  const stock = await insertStockPurchase(tx);
  await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "released", publicToken: syntheticToken(), orderItemId: item.id });
  await tx.insert(s.payments).values({ orderId: order.id, amount: product.price, method: "cash", paidOn: "2026-10-13", recordedByAccountId: owner.id });
  await mutateOrder(tx, { orderId: order.id, actorId: owner.id }, async (inner) => {
    await inner.update(s.orders).set({ deliveryMethod: "pickup" }).where(eq(s.orders.id, order.id));
  });
  const completed = await lockOrder(tx, order.id);
  expect(completed.status).toBe("completed");
  await settleOrderCompletion(tx, order.id, owner.id);
  expect((await lockOrder(tx, order.id)).completedAt).toEqual(completed.completedAt);
  expect((await tx.select().from(s.activityEvents).where(eq(s.activityEvents.orderId, order.id))).filter((e) => e.type === "order_completed")).toHaveLength(1);
}));
