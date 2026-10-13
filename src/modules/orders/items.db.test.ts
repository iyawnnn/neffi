import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertOrderItem, insertProduct, insertStockPurchase, syntheticToken } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { addOrderItem, removeOrderItem, updateOrderItem } from "./items";
import { loadOrderFacts } from "./order";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("add/remove lines snapshot active price, protect the last item and record activity", () => rollback(db, async (tx) => {
  const { order, owner, item } = await insertOrderItem(tx, "dbc");
  await insertProduct(tx, "grc", 30000);
  const base = { orderId: order.id, actorId: owner.id };
  const added = await addOrderItem(tx, { ...base, kind: "grc", quantity: 2, label: "Branch" });
  expect((await tx.select().from(s.orderItems).where(eq(s.orderItems.id, added)))[0]).toMatchObject({ unitPrice: 30000, quantity: 2, label: "Branch" });
  await removeOrderItem(tx, { ...base, orderItemId: added });
  await expect(removeOrderItem(tx, { ...base, orderItemId: item.id })).rejects.toMatchObject({ code: "last_item" });
  expect((await tx.select().from(s.activityEvents)).map((e) => e.type)).toEqual(["order_items_changed", "order_items_changed"]);
}));

test("DBC quantity cannot fall below active cards; linked history cannot be deleted", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "dbc", 2);
  const stock = await insertStockPurchase(tx);
  await tx.insert(s.cards).values([1, 2].map(() => ({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc" as const, state: "reserved" as const, publicToken: syntheticToken(), orderItemId: item.id })));
  const base = { orderId: order.id, actorId: owner.id, orderItemId: item.id };
  await expect(updateOrderItem(tx, { ...base, quantity: 1 })).rejects.toMatchObject({ code: "item_full" });
  await addOrderItem(tx, { orderId: order.id, actorId: owner.id, kind: "dbc", quantity: 1 });
  await expect(removeOrderItem(tx, base)).rejects.toMatchObject({ code: "item_has_cards" });
}));

test("GRC references are optional and leave manually tracked Card/NFC history unchanged", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "grc", 2);
  const stock = await insertStockPurchase(tx);
  const [card] = await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "grc", state: "reserved", orderItemId: item.id, nfcVerifiedAt: new Date() }).returning();
  const base = { orderId: order.id, actorId: owner.id, orderItemId: item.id };
  await updateOrderItem(tx, { ...base, quantity: 3, agreedTotal: 90000, label: "Branch B", reviewUrl: "https://g.page/r/changed/review" });
  expect((await tx.select().from(s.cards).where(eq(s.cards.id, card.id)))[0]).toEqual(card);
  await tx.insert(s.activityEvents).values({ type: "order_handed_over", orderId: order.id, actorAccountId: owner.id });
  await expect(updateOrderItem(tx, { ...base, quantity: 4 })).rejects.toMatchObject({ code: "items_delivered" });
  await expect(addOrderItem(tx, { orderId: order.id, actorId: owner.id, kind: "grc", quantity: 1 })).rejects.toMatchObject({ code: "items_delivered" });
  await updateOrderItem(tx, { ...base, quantity: 3, agreedTotal: null });
  expect((await tx.select().from(s.orderItems).where(eq(s.orderItems.id, item.id)))[0]).toMatchObject({ agreedTotal: null, reviewUrl: null, label: null });
}));

test("lower negotiated total exposes refundDue and blocks completion until a refund", () => rollback(db, async (tx) => {
  const { order, owner, item } = await insertOrderItem(tx, "dbc");
  await tx.insert(s.payments).values({ orderId: order.id, amount: 50000, method: "cash", paidOn: "2026-10-13", recordedByAccountId: owner.id });
  await updateOrderItem(tx, { orderId: order.id, actorId: owner.id, orderItemId: item.id, quantity: 1, agreedTotal: 40000 });
  const facts = await loadOrderFacts(tx, order.id);
  expect(facts.totals).toMatchObject({ refundDue: 10000, balance: 0 });
  expect(facts.status).toBe("in_progress");
}));
