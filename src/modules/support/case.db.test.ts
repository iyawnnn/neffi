import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertOrder, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { openCase, assignCase, setCaseStatus, reopenCase, addCaseNote, fillCaseLink, linkCaseCard, withCase } from "./case";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("case lifecycle is audited, assigned to an owner, and resolved actions are refused", () => rollback(db, async (tx) => {
  const { owner, order, purchaser } = await insertOrder(tx);
  const customer = await insertAccount(tx);
  const { caseId } = await openCase(tx, { actorId: owner.id, type: "other", summary: "  Payment correction  ", orderId: order.id, purchaserId: purchaser.id, accountId: customer.id });
  const base = { caseId, actorId: owner.id };
  expect((await tx.select().from(s.supportCases))[0]).toMatchObject({ summary: "Payment correction", assignedToAccountId: owner.id });
  await expect(assignCase(tx, { ...base, assignedToAccountId: customer.id })).rejects.toMatchObject({ code: "invalid_input" });
  const secondOwner = await insertAccount(tx, "owner");
  await assignCase(tx, { ...base, assignedToAccountId: secondOwner.id });
  await setCaseStatus(tx, { ...base, status: "waiting_on_customer" });
  await setCaseStatus(tx, { ...base, status: "open" });
  await setCaseStatus(tx, { ...base, status: "resolved", note: "Handled" });
  expect((await tx.select().from(s.supportCases))[0].resolvedAt).toBeInstanceOf(Date);
  await expect(withCase(tx, base, async () => undefined)).rejects.toMatchObject({ code: "case_resolved" });
  await expect(setCaseStatus(tx, { ...base, status: "waiting_on_customer" })).rejects.toMatchObject({ code: "case_resolved" });
  await addCaseNote(tx, { ...base, note: "Follow-up while resolved" });
  await reopenCase(tx, base);
  expect((await tx.select().from(s.supportCases))[0]).toMatchObject({ status: "open", resolvedAt: null });
  const events = await tx.select().from(s.activityEvents);
  expect(events.map((event) => event.type)).toEqual(["support_case_opened", "support_case_assigned", "support_case_waiting", "support_case_reopened", "support_case_resolved", "note", "support_case_reopened"]);
  expect(events.every((event) => event.supportCaseId === caseId)).toBe(true);
}));

test("missing links can be filled once; affected card links are append-only", () => rollback(db, async (tx) => {
  const { owner, order } = await insertOrder(tx);
  const { card } = await insertReleasedDbc(tx);
  const { caseId } = await openCase(tx, { actorId: owner.id, type: "activation_issue", summary: "Lost code", cardId: card.id });
  const base = { caseId, actorId: owner.id };
  await fillCaseLink(tx, { ...base, field: "orderId", value: order.id });
  await expect(fillCaseLink(tx, { ...base, field: "orderId", value: order.id })).rejects.toMatchObject({ code: "link_exists" });
  await expect(linkCaseCard(tx, { ...base, cardId: card.id })).rejects.toMatchObject({ code: "link_exists" });
  const { card: next } = await insertReleasedDbc(tx);
  await linkCaseCard(tx, { ...base, cardId: next.id });
  expect(await tx.select().from(s.supportCaseCards)).toHaveLength(2);
  await expect(fillCaseLink(tx, { ...base, field: "accountId", value: crypto.randomUUID() })).rejects.toMatchObject({ code: "not_found" });
  const row = (await tx.select().from(s.supportCases).where(eq(s.supportCases.id, caseId)))[0];
  expect(row.orderId).toBe(order.id);
}));

test("case inputs and unknown ids are rejected without partial writes", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  for (const summary of ["", " ", "x".repeat(501)]) await expect(openCase(tx, { actorId: owner.id, type: "other", summary })).rejects.toMatchObject({ code: "invalid_input" });
  await expect(openCase(tx, { actorId: owner.id, type: "other", summary: "Unknown", orderId: crypto.randomUUID() })).rejects.toMatchObject({ code: "not_found" });
  await expect(addCaseNote(tx, { caseId: crypto.randomUUID(), actorId: owner.id, note: "Note" })).rejects.toMatchObject({ code: "not_found" });
  expect(await tx.select().from(s.supportCases)).toHaveLength(0);
}));
