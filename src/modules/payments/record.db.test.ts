import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertOrderItem } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { loadOrderFacts } from "../orders/order";
import { recordPayment, recordRefund } from "./record";
import { voidPayment, voidRefund } from "./void";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("partial then later payment changes Unpaid to Paid, defaults to balance and caps duplicates", () => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc");
  const base = { orderId: order.id, actorId: owner.id, method: "cash" as const };
  await recordPayment(tx, { ...base, amount: 10000 });
  expect((await loadOrderFacts(tx, order.id)).totals).toMatchObject({ paymentState: "Unpaid", balance: 40000 });
  await expect(recordPayment(tx, { ...base, amount: 40001 })).rejects.toMatchObject({ code: "balance_exceeded" });
  await recordPayment(tx, base);
  expect((await loadOrderFacts(tx, order.id)).totals).toMatchObject({ paymentState: "Paid", balance: 0 });
  await expect(recordPayment(tx, base)).rejects.toMatchObject({ code: "balance_exceeded" });
}));

test.each(["in_progress", "cancelled", "completed"] as const)("refund and void status rules on %s preserve original payment", (status) => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc");
  const base = { orderId: order.id, actorId: owner.id, method: "cash" as const };
  await recordPayment(tx, { ...base, amount: 10000 });
  const [payment] = await tx.select().from(s.payments);
  await tx.update(s.orders).set({ status, cancelledAt: status === "cancelled" ? new Date() : null, completedAt: status === "completed" ? new Date() : null }).where(eq(s.orders.id, order.id));
  if (status !== "in_progress") await expect(recordPayment(tx, { ...base, amount: 1 })).rejects.toMatchObject({ code: "wrong_status" });
  if (status === "completed") {
    await expect(recordRefund(tx, { ...base, amount: 1000 })).rejects.toMatchObject({ code: "wrong_status" });
    await expect(voidPayment(tx, { orderId: order.id, actorId: owner.id, paymentId: payment.id, reason: "Mis-keyed" })).rejects.toMatchObject({ code: "wrong_status" });
    const [refund] = await tx.insert(s.refunds).values({ orderId: order.id, amount: 100, method: "cash", refundedOn: "2026-10-13", recordedByAccountId: owner.id }).returning();
    await expect(voidRefund(tx, { orderId: order.id, actorId: owner.id, refundId: refund.id, reason: "Mis-keyed" })).rejects.toMatchObject({ code: "wrong_status" });
    return;
  }
  await expect(recordRefund(tx, { ...base, amount: 10001 })).rejects.toMatchObject({ code: "refund_exceeded" });
  await recordRefund(tx, { ...base, amount: 2000 });
  expect((await tx.select().from(s.payments))[0]).toEqual(payment);
  const [refund] = await tx.select().from(s.refunds);
  await voidRefund(tx, { orderId: order.id, actorId: owner.id, refundId: refund.id, reason: "Mis-keyed refund" });
  expect((await loadOrderFacts(tx, order.id)).totals).toMatchObject({ received: 10000, refunded: 0 });
  await expect(voidRefund(tx, { orderId: order.id, actorId: owner.id, refundId: refund.id, reason: "Twice" })).rejects.toMatchObject({ code: "already_voided" });
  const correction = { orderId: order.id, actorId: owner.id, paymentId: payment.id, reason: "Mis-keyed payment" };
  if (status === "cancelled") await expect(voidPayment(tx, correction)).rejects.toMatchObject({ code: "wrong_status" });
  else {
    await expect(voidPayment(tx, { ...correction, reason: " " })).rejects.toMatchObject({ code: "invalid_input" });
    await voidPayment(tx, correction);
    expect((await loadOrderFacts(tx, order.id)).totals).toMatchObject({ received: 0, refunded: 0 });
    expect((await tx.select().from(s.payments))[0]).toMatchObject({ amount: payment.amount, voidReason: "Mis-keyed payment" });
  }
  expect((await tx.select().from(s.activityEvents)).map((e) => e.type)).toContain("refund_voided");
}));

test("refund settles an overpaid, commercially delivered GRC exactly once", () => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "grc");
  await tx.update(s.orders).set({ deliveryMethod: "pickup" }).where(eq(s.orders.id, order.id));
  await tx.insert(s.payments).values({ orderId: order.id, amount: 60000, method: "cash", paidOn: "2026-10-13", recordedByAccountId: owner.id });
  await tx.insert(s.activityEvents).values({ type: "order_handed_over", orderId: order.id, actorAccountId: owner.id });
  await recordRefund(tx, { orderId: order.id, actorId: owner.id, method: "cash", amount: 10000 });
  expect((await loadOrderFacts(tx, order.id)).status).toBe("completed");
  expect((await tx.select().from(s.activityEvents)).filter((e) => e.type === "order_completed")).toHaveLength(1);
}));
