import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertOrderItem } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { loadOrderFacts } from "../orders/order";
import { openCase, setCaseStatus } from "./case";
import { afterSaleRefund, voidAfterSaleRefund, voidCompletedPayment, recordCompletedPayment } from "./money";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("after-sale refund and payment corrections preserve Completed history and audit both subjects", () => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc");
  const completedAt = new Date();
  await tx.update(s.orders).set({ status: "completed", completedAt }).where(eq(s.orders.id, order.id));
  const [payment] = await tx.insert(s.payments).values({ orderId: order.id, amount: 50000, method: "cash", paidOn: "2026-10-14", recordedByAccountId: owner.id }).returning();
  const { caseId } = await openCase(tx, { actorId: owner.id, type: "other", summary: "Money", orderId: order.id });
  const base = { actorId: owner.id, caseId, orderId: order.id, reason: "Verified correction" };
  await expect(afterSaleRefund(tx, { ...base, amount: 50001, method: "cash" })).rejects.toMatchObject({ code: "refund_exceeded" });
  await expect(afterSaleRefund(tx, { ...base, amount: 1000, method: "cash", reason: " " })).rejects.toMatchObject({ code: "invalid_input" });
  await afterSaleRefund(tx, { ...base, amount: 5000, method: "cash" });
  expect((await loadOrderFacts(tx, order.id)).totals).toMatchObject({ balance: 0, netPaid: 45000, paymentState: "Paid" });
  const [refund] = await tx.select().from(s.refunds);
  expect(refund.supportCaseId).toBe(caseId);
  await voidAfterSaleRefund(tx, { ...base, refundId: refund.id });
  await expect(voidAfterSaleRefund(tx, { ...base, refundId: refund.id })).rejects.toMatchObject({ code: "already_voided" });
  const [saleRefund] = await tx.insert(s.refunds).values({ orderId: order.id, amount: 100, method: "cash", refundedOn: "2026-10-14", recordedByAccountId: owner.id }).returning();
  await expect(voidAfterSaleRefund(tx, { ...base, refundId: saleRefund.id })).rejects.toMatchObject({ code: "not_found" });
  await voidCompletedPayment(tx, { ...base, paymentId: payment.id });
  expect((await loadOrderFacts(tx, order.id)).totals.balance).toBe(50100);
  await recordCompletedPayment(tx, { ...base, amount: 50100, method: "cash" });
  await expect(recordCompletedPayment(tx, { ...base, amount: 1, method: "cash" })).rejects.toMatchObject({ code: "balance_exceeded" });
  expect((await tx.select().from(s.orders))[0]).toMatchObject({ status: "completed", completedAt });
  const events = await tx.select().from(s.activityEvents);
  expect(events.filter((event) => /^(payment|refund)_/.test(event.type)).every((event) => event.orderId === order.id && event.supportCaseId === caseId)).toBe(true);
}));

test.each(["in_progress", "cancelled"] as const)("support money refuses %s orders", (status) => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc");
  if (status === "cancelled") await tx.update(s.orders).set({ status, cancelledAt: new Date() }).where(eq(s.orders.id, order.id));
  const { caseId } = await openCase(tx, { actorId: owner.id, type: "other", summary: "Correction", orderId: order.id });
  await expect(afterSaleRefund(tx, { actorId: owner.id, caseId, orderId: order.id, amount: 1, method: "cash", reason: "Test" })).rejects.toMatchObject({ code: "wrong_status" });
}));

test("support money refuses missing/mismatched order links and resolved cases", () => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc");
  const { caseId } = await openCase(tx, { actorId: owner.id, type: "other", summary: "Unlinked" });
  const base = { actorId: owner.id, caseId, orderId: order.id, amount: 1, method: "cash" as const, reason: "Test" };
  await expect(afterSaleRefund(tx, base)).rejects.toMatchObject({ code: "wrong_order" });
  await setCaseStatus(tx, { actorId: owner.id, caseId, status: "resolved" });
  await expect(afterSaleRefund(tx, base)).rejects.toMatchObject({ code: "case_resolved" });
  expect(await tx.select().from(s.refunds)).toHaveLength(0);
}));
