import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { orderItems, orders, payments, products, refunds, shipments } from "./schema";
import { insertOrder, insertOrderItem, insertProduct } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const today = "2026-10-10";

describe("Orders", () => {
  test("an Order must belong to an existing Purchaser", () =>
    rollback(db, async (tx) => {
      const { order } = await insertOrder(tx);
      await expectPgError(
        tx,
        (s) => s.update(orders).set({ purchaserId: "00000000-0000-4000-8000-000000000000" }).where(eq(orders.id, order.id)),
        "23503",
        "orders_purchaser_id_purchasers_id_fk",
      );
      await expectPgError(tx, (s) => s.execute(sql`update orders set purchaser_id = null where id = ${order.id}`), "23502");
    }));

  test("lifecycle status and its timestamp cannot disagree", () =>
    rollback(db, async (tx) => {
      const { order } = await insertOrder(tx);
      await expectPgError(
        tx,
        (s) => s.update(orders).set({ status: "completed" }).where(eq(orders.id, order.id)),
        "23514",
        "orders_completed_at_matches_status",
      );
      await expectPgError(
        tx,
        (s) => s.update(orders).set({ cancelledAt: new Date() }).where(eq(orders.id, order.id)),
        "23514",
        "orders_cancelled_at_matches_status",
      );
    }));

  test("an Order with recorded payments cannot be deleted", () =>
    rollback(db, async (tx) => {
      const { order, owner } = await insertOrder(tx);
      await tx.insert(payments).values({ orderId: order.id, amount: 100, method: "cash", paidOn: today, recordedByAccountId: owner.id });
      await expectPgError(tx, (s) => s.delete(orders).where(eq(orders.id, order.id)), "23503", "payments_order_id_orders_id_fk");
    }));
});

describe("Order Items", () => {
  test("quantity must be positive", () =>
    rollback(db, async (tx) => {
      const { item } = await insertOrderItem(tx, "dbc");
      await expectPgError(
        tx,
        (s) => s.update(orderItems).set({ quantity: 0 }).where(eq(orderItems.id, item.id)),
        "23514",
        "order_items_quantity_positive",
      );
    }));

  test("the item's product kind must be the product's real kind", () =>
    rollback(db, async (tx) => {
      const { order } = await insertOrder(tx);
      const grc = await insertProduct(tx, "grc");
      await expectPgError(
        tx,
        (s) => s.insert(orderItems).values({ orderId: order.id, productId: grc.id, productKind: "dbc", quantity: 1, unitPrice: 1 }),
        "23503",
        "order_items_product_fk",
      );
    }));

  test("only Google Review Card items carry a review URL, and it must be https", () =>
    rollback(db, async (tx) => {
      const { item: dbcItem } = await insertOrderItem(tx, "dbc");
      await expectPgError(
        tx,
        (s) => s.update(orderItems).set({ reviewUrl: "https://g.page/r/synthetic" }).where(eq(orderItems.id, dbcItem.id)),
        "23514",
        "order_items_review_url_grc_https",
      );
      const { item: grcItem } = await insertOrderItem(tx, "grc");
      await expectPgError(
        tx,
        (s) => s.update(orderItems).set({ reviewUrl: "javascript:alert(1)" }).where(eq(orderItems.id, grcItem.id)),
        "23514",
        "order_items_review_url_grc_https",
      );
      await tx.update(orderItems).set({ reviewUrl: "https://g.page/r/synthetic" }).where(eq(orderItems.id, grcItem.id));
    }));

  test("catalog price changes never rewrite the historical item price", () =>
    rollback(db, async (tx) => {
      const { item, product } = await insertOrderItem(tx, "dbc");
      await tx.update(products).set({ price: product.price + 10_000 }).where(eq(products.id, product.id));
      const [after] = await tx.select().from(orderItems).where(eq(orderItems.id, item.id));
      expect(after.unitPrice).toBe(product.price);
    }));
});

describe("Payments, Refunds and Shipments", () => {
  test("payment and refund amounts must be positive", () =>
    rollback(db, async (tx) => {
      const { order, owner } = await insertOrder(tx);
      const money = { orderId: order.id, method: "gcash" as const, recordedByAccountId: owner.id };
      await expectPgError(tx, (s) => s.insert(payments).values({ ...money, amount: 0, paidOn: today }), "23514", "payments_amount_positive");
      await expectPgError(tx, (s) => s.insert(refunds).values({ ...money, amount: -1, refundedOn: today }), "23514", "refunds_amount_positive");
    }));

  test("a shipment is pending until handed to the courier, and its cost is dated by that handoff", () =>
    rollback(db, async (tx) => {
      const { order } = await insertOrder(tx);
      await expectPgError(
        tx,
        (s) => s.insert(shipments).values({ orderId: order.id, shippedOn: today }),
        "23514",
        "shipments_pending_not_shipped",
      );
      await expectPgError(
        tx,
        (s) => s.insert(shipments).values({ orderId: order.id, status: "in_transit" }),
        "23514",
        "shipments_shipped_on_after_pending",
      );
      await expectPgError(
        tx,
        (s) => s.insert(shipments).values({ orderId: order.id, courierCost: 12_000 }),
        "23514",
        "shipments_courier_cost_requires_shipped_on",
      );
      // A courier refusal before pickup is a failure that never shipped.
      await tx.insert(shipments).values({ orderId: order.id, status: "failed" });
    }));
});
