import { beforeAll, expect, test } from "vitest";
import { insertAccount } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { activityEvents, supportCases } from "@/db/schema";
import type { Email } from "@/integrations/email/resend";
import { noticeEvents } from "@/integrations/email/support-templates";
import { sendSecurityNotice, resendCaseSecurityNotice } from "./security-notice";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
test("notice attempts are idempotent and provider failures expose no recipient or body", () => rollback(db, async tx => {
  const account = await insertAccount(tx); const sent: Email[] = [];
  const input = { accountId: account.id, actorId: account.id, kind: "email_changed" as const, attemptId: crypto.randomUUID(), at: new Date("2026-10-14T12:00:00Z"), recipients: [{ to: "old@example.test", slot: "old" as const }, { to: "new@example.test", slot: "new" as const }] };
  const sender = async (email: Email) => { sent.push(email); if (email.to === "old@example.test") throw new Error("private-provider-detail"); };
  await sendSecurityNotice(tx, input, sender); await sendSecurityNotice(tx, input, sender);
  expect(sent).toHaveLength(2);
  expect(sent.every(email => !email.text.includes("@"))).toBe(true);
  const events = await tx.select().from(activityEvents);
  expect(events.map(e => e.type).sort()).toEqual(["security_notice_failed", "security_notice_sent"]);
  expect(JSON.stringify(events)).not.toMatch(/private-provider|@example/);
}));
test("every security event uses the restricted fixed-subject template", () => rollback(db, async tx => {
  const account = await insertAccount(tx); const sent: Email[] = [];
  for (const kind of Object.keys(noticeEvents) as (keyof typeof noticeEvents)[]) await sendSecurityNotice(tx, { accountId: account.id, actorId: null, kind, attemptId: crypto.randomUUID(), at: new Date(), recipients: [{ to: account.email, slot: "current" }] }, async email => { sent.push(email); });
  expect(sent).toHaveLength(7);
  expect(sent.every(email => email.subject === "Neffi account security notice" && !email.text.includes("@") && email.text.includes("/support"))).toBe(true);
}));

test("case security retries are scoped to secure notices and target the Account, never public contact", () => rollback(db, async tx => {
  const account = await insertAccount(tx); const owner = await insertAccount(tx, "owner");
  const [support] = await tx.insert(supportCases).values({ type: "other", summary: "Compromise", accountId: account.id, requesterEmail: "unverified@example.test" }).returning();
  await sendSecurityNotice(tx, { accountId: account.id, caseId: support.id, actorId: owner.id, kind: "account_secured", attemptId: crypto.randomUUID(), at: new Date(), recipients: [{ to: account.email, slot: "current" }] }, async () => { throw new Error("opaque"); });
  const [event] = await tx.select().from(activityEvents); const sent: Email[] = [];
  await resendCaseSecurityNotice(tx, { caseId: support.id, actorId: owner.id, eventId: event.id }, async email => { sent.push(email); });
  expect(sent).toHaveLength(1); expect(sent[0].to).toBe(account.email);
  expect(sent[0].idempotencyKey).not.toContain(event.note!.split(" ")[1]);
}));
