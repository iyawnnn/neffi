import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertProduct } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { createOrder } from "./create";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("name-only purchaser, server price snapshot, creator assignment and creation event", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  const product = await insertProduct(tx, "dbc", 50000);
  const result = await createOrder(tx, { actorId: owner.id, purchaser: { name: " Ana " }, items: [{ kind: "dbc", quantity: 2, unitPrice: 1 }], deliveryMethod: "pickup" });
  const [order] = await tx.select().from(s.orders).where(eq(s.orders.id, result.orderId));
  expect(order).toMatchObject({ status: "in_progress", assignedToAccountId: owner.id, updatedByAccountId: owner.id });
  expect((await tx.select().from(s.purchasers))[0]).toMatchObject({ name: "Ana", contactNumber: null });
  expect((await tx.select().from(s.orderItems))[0]).toMatchObject({ productId: product.id, unitPrice: 50000, quantity: 2 });
  expect((await tx.select().from(s.activityEvents))[0]).toMatchObject({ type: "order_created", orderId: order.id });
}));

test("existing purchaser and mixed negotiated lines preserve product snapshots; Paid now is atomic", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  const [purchaser] = await tx.insert(s.purchasers).values({ name: "Buyer" }).returning();
  await insertProduct(tx, "dbc", 50000);
  await insertProduct(tx, "grc", 30000);
  const result = await createOrder(tx, { actorId: owner.id, purchaserId: purchaser.id, items: [{ kind: "dbc", quantity: 1 }, { kind: "grc", quantity: 2, agreedTotal: 55000, label: "Branch", reviewUrl: "https://g.page/r/review" }], shippingFee: 500, deliveryMethod: "courier", paidNow: { amount: 105500, method: "cash", paidOn: "2026-10-13" } });
  expect(await tx.select().from(s.purchasers)).toHaveLength(1);
  expect((await tx.select().from(s.orders))[0].purchaserId).toBe(purchaser.id);
  expect((await tx.select().from(s.orderItems)).map((i) => i.unitPrice)).toEqual([50000, 30000]);
  expect((await tx.select().from(s.payments))[0]).toMatchObject({ orderId: result.orderId, amount: 105500 });
  expect((await tx.select().from(s.activityEvents)).map((e) => e.type)).toEqual(["order_created", "payment_recorded"]);
  await expect(createOrder(tx, { actorId: owner.id, purchaser: { name: "Another" }, items: [{ kind: "dbc", quantity: 1 }], paidNow: { amount: 50001, method: "cash", paidOn: "2026-10-13" } })).rejects.toMatchObject({ code: "balance_exceeded" });
  expect(await tx.select().from(s.orders)).toHaveLength(1);
  expect(await tx.select().from(s.purchasers)).toHaveLength(1);
}));

test("invalid lines and unavailable product refuse the entire order", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const base = { actorId: owner.id, purchaser: { name: "Buyer" } };
  for (const items of [[], [{ kind: "dbc", quantity: 0 }], [{ kind: "dbc", quantity: 1, label: "Wrong" }], [{ kind: "dbc", quantity: 1, reviewUrl: "https://example.test" }], [{ kind: "grc", quantity: 1, reviewUrl: "http://example.test" }]]) {
    await expect(createOrder(tx, { ...base, items })).rejects.toMatchObject({ code: "invalid_input" });
  }
  await expect(createOrder(tx, { ...base, items: [{ kind: "grc", quantity: 1 }] })).rejects.toMatchObject({ code: "no_product" });
  expect(await tx.select().from(s.orders)).toHaveLength(0);
  expect(await tx.select().from(s.purchasers)).toHaveLength(0);
}));
