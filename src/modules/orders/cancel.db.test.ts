import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertOrderItem, insertStockPurchase, syntheticToken } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { recordPayment, recordRefund } from "../payments/record";
import { voidRefund } from "../payments/void";
import { cancelOrder } from "./cancel";
import { handOverOrder, shipOrder } from "./fulfillment";
import { loadOrderFacts } from "./order";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("cancel returns Reserved DBCs, preserves money and permits refund then refund void", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "dbc");
  const stock = await insertStockPurchase(tx);
  const [card] = await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "reserved", publicToken: syntheticToken(), orderItemId: item.id, nfcVerifiedAt: new Date(), packageMatchedAt: new Date() }).returning();
  const base = { orderId: order.id, actorId: owner.id };
  await recordPayment(tx, { ...base, method: "cash", amount: 10000 });
  const [payment] = await tx.select().from(s.payments);
  await cancelOrder(tx, base);
  expect((await tx.select().from(s.cards))[0]).toMatchObject({ state: "ready", orderItemId: null, nfcVerifiedAt: card.nfcVerifiedAt, packageMatchedAt: card.packageMatchedAt });
  expect(await loadOrderFacts(tx, order.id)).toMatchObject({ status: "cancelled", totals: { refundDue: 10000 } });
  expect((await tx.select().from(s.payments))[0]).toEqual(payment);
  await recordRefund(tx, { ...base, amount: 10000, method: "cash" });
  const [refund] = await tx.select().from(s.refunds);
  await voidRefund(tx, { ...base, refundId: refund.id, reason: "Mis-keyed refund" });
  expect((await loadOrderFacts(tx, order.id)).totals.refundDue).toBe(10000);
  await expect(cancelOrder(tx, { ...base, reason: "Again" })).rejects.toMatchObject({ code: "wrong_status" });
}));

test.each([false, true])("GRC cancellation needs no Card state; existing manual inventory preserved (%s)", (legacy) => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "grc");
  if (legacy) {
    const stock = await insertStockPurchase(tx);
    await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "grc", state: "reserved", orderItemId: item.id, nfcVerifiedAt: new Date() });
  }
  const before = await tx.select().from(s.cards);
  await cancelOrder(tx, { orderId: order.id, actorId: owner.id, reason: "Changed plans" });
  expect(await tx.select().from(s.cards)).toEqual(before);
  expect((await tx.select().from(s.orders).where(eq(s.orders.id, order.id)))[0]).toMatchObject({ status: "cancelled", cancellationReason: "Changed plans" });
}));

test.each(["hand_over", "ship", "dbc_release"] as const)("cancel after %s refused", (delivery) => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, delivery === "dbc_release" ? "dbc" : "grc");
  const base = { orderId: order.id, actorId: owner.id };
  await tx.update(s.orders).set({ deliveryMethod: delivery === "ship" ? "courier" : "pickup" }).where(eq(s.orders.id, order.id));
  if (delivery === "dbc_release") {
    const stock = await insertStockPurchase(tx);
    await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "released", publicToken: syntheticToken(), orderItemId: item.id });
  } else if (delivery === "ship") await shipOrder(tx, base);
  else await handOverOrder(tx, base);
  await expect(cancelOrder(tx, base)).rejects.toMatchObject({ code: "already_released" });
  expect((await loadOrderFacts(tx, order.id)).status).toBe("in_progress");
}));
