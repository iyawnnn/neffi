import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertOrderItem } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { loadOrderFacts } from "../orders/order";
import { listOrders } from "../orders/queries";
import { dashboard } from "../orders/dashboard";
import { openCase } from "./case";
import { casesForOrder, openCaseCount, listCases, getCaseDetail } from "./queries";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test.each(["in_progress", "completed", "cancelled"] as const)("money SQL agrees with settlement on %s, including voids", (status) => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc");
  await tx.update(s.orders).set({ status, completedAt: status === "completed" ? new Date() : null, cancelledAt: status === "cancelled" ? new Date() : null }).where(eq(s.orders.id, order.id));
  const { caseId } = await openCase(tx, { actorId: owner.id, type: "other", summary: "Correction", orderId: order.id });
  const money = { orderId: order.id, method: "cash" as const, recordedByAccountId: owner.id };
  const voided = { voidedAt: new Date(), voidedByAccountId: owner.id, voidReason: "Typo" };
  await tx.insert(s.payments).values([{ ...money, paidOn: "2026-10-14", amount: 51000 }, { ...money, paidOn: "2026-10-14", amount: 9000, ...voided }]);
  await tx.insert(s.refunds).values([{ ...money, refundedOn: "2026-10-14", amount: 1000 }, { ...money, refundedOn: "2026-10-14", amount: 4000, ...voided }]);
  if (status === "completed") await tx.insert(s.refunds).values({ ...money, refundedOn: "2026-10-14", amount: 5000, supportCaseId: caseId, reason: "Goodwill" });
  expect((await loadOrderFacts(tx, order.id)).totals).toMatchObject({ settledPaid: 50000, netPaid: status === "completed" ? 45000 : 50000, balance: 0, paymentState: "Paid" });
  expect((await listOrders(tx)).orders[0].balance).toBe(0);
  expect(await dashboard(tx, "2026-10")).toMatchObject({ outstanding: 0, collected: status === "completed" ? 45000 : 50000 });
  if (status === "completed") {
    await tx.insert(s.payments).values({ ...money, paidOn: "2026-10-14", amount: 10000 });
    const [original] = await tx.select().from(s.payments).where(eq(s.payments.amount, 51000));
    await tx.update(s.payments).set(voided).where(eq(s.payments.id, original.id));
    expect((await loadOrderFacts(tx, order.id)).totals.balance).toBe(41000);
    expect((await listOrders(tx)).orders[0].balance).toBe(41000);
    expect(await dashboard(tx, "2026-10")).toMatchObject({ inProgress: 0, outstanding: 41000 });
  }
}));

test("case queue pages tied timestamps, filters status, and counts non-resolved cases", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  for (let n = 0; n < 27; n++) await openCase(tx, { actorId: owner.id, type: "other", summary: `Case ${n}` });
  const first = await listCases(tx, { status: "open" });
  const second = await listCases(tx, { status: "open", before: first.next! });
  expect(first.cases).toHaveLength(25);
  expect(second.cases).toHaveLength(2);
  expect(new Set([...first.cases, ...second.cases].map((row) => row.id)).size).toBe(27);
  expect(await openCaseCount(tx)).toBe(27);
  expect((await listCases(tx, { status: "resolved" })).cases).toHaveLength(0);
  await tx.update(s.supportCases).set({ status: "resolved", resolvedAt: new Date() }).where(eq(s.supportCases.id, first.cases[0].id));
  expect(await openCaseCount(tx)).toBe(26);
}));

test("case detail exposes directory fields only and keeps support rows scoped", () => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc");
  const customer = await insertAccount(tx);
  const { caseId } = await openCase(tx, { actorId: owner.id, type: "other", summary: "Follow-up", accountId: customer.id, orderId: order.id });
  const detail = await getCaseDetail(tx, caseId);
  expect(detail?.order?.id).toBe(order.id);
  expect(Object.keys(detail!.account!).sort()).toEqual(["cards", "createdAt", "email", "methods", "profiles", "role"]);
  expect(detail).toMatchObject({ refunds: [], shipments: [], linkedOrders: [], timeline: [{ type: "support_case_opened" }] });
  expect(await casesForOrder(tx, order.id)).toHaveLength(1);
  expect(await getCaseDetail(tx, crypto.randomUUID())).toBeNull();
}));
