import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertOrderItem, insertStockPurchase, syntheticToken } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { addOrderNote, assignOrder, updateOrderDetails } from "./order";
import { getOrderDetail, listOrders } from "./queries";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("order list keysets without duplicates and filters by status and assignee", () => rollback(db, async (tx) => {
  const actor = await insertAccount(tx, "owner");
  for (let i = 0; i < 27; i++) {
    const { order } = await insertOrderItem(tx, "dbc");
    await tx.update(s.orders).set({ assignedToAccountId: actor.id }).where(eq(s.orders.id, order.id));
  }
  const first = await listOrders(tx, { assigneeId: actor.id, status: "in_progress" });
  expect(first.orders).toHaveLength(25);
  const second = await listOrders(tx, { before: first.next!, assigneeId: actor.id });
  expect(second.orders).toHaveLength(2);
  expect(new Set([...first.orders, ...second.orders].map((o) => o.id)).size).toBe(27);
  expect(await listOrders(tx, { status: "cancelled" })).toMatchObject({ orders: [], next: null });
  expect(await listOrders(tx, { assigneeId: crypto.randomUUID() })).toMatchObject({ orders: [] });
}));

test("detail includes facts, money including voids, cards, shipments and timeline", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "dbc");
  const stock = await insertStockPurchase(tx);
  await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "released", publicToken: syntheticToken(), orderItemId: item.id });
  await tx.insert(s.payments).values({ orderId: order.id, amount: 100, method: "cash", paidOn: "2026-10-13", recordedByAccountId: owner.id, voidedAt: new Date(), voidedByAccountId: owner.id, voidReason: "Mis-keyed" });
  await tx.insert(s.shipments).values({ orderId: order.id, status: "in_transit", shippedOn: "2026-10-13" });
  await addOrderNote(tx, { orderId: order.id, actorId: owner.id, note: "Preparing package" });
  const detail = await getOrderDetail(tx, order.id);
  expect(detail).toMatchObject({ totals: { balance: 50000, received: 0 }, items: [{ activeCount: 1, releasedCount: 1 }], cards: [{ state: "released" }], payments: [{ voidReason: "Mis-keyed" }], shipments: [{ status: "in_transit" }], timeline: [{ type: "note", note: "Preparing package" }] });
  expect(await getOrderDetail(tx, crypto.randomUUID())).toBeNull();
}));

test.each(["in_progress", "completed", "cancelled"] as const)("assignment and internal notes work on %s; edit details only open", (status) => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc");
  const actor = await insertAccount(tx, "owner");
  await tx.update(s.orders).set({ status, completedAt: status === "completed" ? new Date() : null, cancelledAt: status === "cancelled" ? new Date() : null }).where(eq(s.orders.id, order.id));
  await assignOrder(tx, { orderId: order.id, actorId: actor.id, assignedToAccountId: actor.id });
  await addOrderNote(tx, { orderId: order.id, actorId: owner.id, note: "Follow up" });
  const edit = () => updateOrderDetails(tx, { orderId: order.id, actorId: actor.id, notes: "Updated", deliveryMethod: "pickup", shippingFee: 100 });
  if (status === "in_progress") await edit();
  else await expect(edit()).rejects.toMatchObject({ code: "wrong_status" });
  expect((await getOrderDetail(tx, order.id))?.assignedToAccountId).toBe(actor.id);
}));

test("delivery locks after release and reducing shipping fee re-settles completion", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "dbc");
  await tx.update(s.orders).set({ deliveryMethod: "pickup", shippingFee: 500 }).where(eq(s.orders.id, order.id));
  const stock = await insertStockPurchase(tx);
  await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "released", publicToken: syntheticToken(), orderItemId: item.id });
  await tx.insert(s.payments).values({ orderId: order.id, amount: 50000, method: "cash", paidOn: "2026-10-13", recordedByAccountId: owner.id });
  const base = { orderId: order.id, actorId: owner.id, notes: "", shippingFee: 0 };
  await expect(updateOrderDetails(tx, { ...base, deliveryMethod: "courier" })).rejects.toMatchObject({ code: "delivery_locked" });
  await updateOrderDetails(tx, { ...base, deliveryMethod: "pickup" });
  expect((await getOrderDetail(tx, order.id))?.status).toBe("completed");
}));
