import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import type { Email } from "@/integrations/email/resend";
import { dispatchCaseEmail, caseRecipient } from "./email";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
test("public requester wins over a linked account and one attempt produces one email event", () => rollback(db, async tx => {
  const account = await insertAccount(tx);
  const [support] = await tx.insert(s.supportCases).values({ type: "other", summary: "Other", source: "public", requesterEmail: "requester@example.test", accountId: account.id }).returning();
  expect(await caseRecipient(tx, support)).toBe("requester@example.test");
  const sent: Email[] = [];
  const input = { caseId: support.id, actorId: null, kind: "reply" as const, body: "Please provide purchase evidence.", attemptId: crypto.randomUUID() };
  await dispatchCaseEmail(tx, input, async email => { sent.push(email); });
  await dispatchCaseEmail(tx, { ...input, body: "Changed body" }, async email => { sent.push(email); });
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ to: "requester@example.test", idempotencyKey: `case-${support.id}-reply-${input.attemptId}` });
  expect(await tx.select().from(s.activityEvents)).toMatchObject([{ type: "support_email_sent", actorAccountId: null, note: `reply ${input.attemptId}` }]);
}));

test("fallback uses current account email, missing recipient refuses and failures record no payload", () => rollback(db, async tx => {
  const account = await insertAccount(tx);
  const [support] = await tx.insert(s.supportCases).values({ type: "other", summary: "Other", accountId: account.id }).returning();
  await tx.update(s.accounts).set({ email: "current@example.test" }).where(eq(s.accounts.id, account.id));
  expect(await caseRecipient(tx, support)).toBe("current@example.test");
  const input = { caseId: support.id, actorId: null, kind: "reply" as const, body: "Please reply.", attemptId: crypto.randomUUID() };
  expect(await dispatchCaseEmail(tx, input, async () => { throw new Error("secret provider payload"); })).toBe("failed");
  expect(JSON.stringify(await tx.select().from(s.activityEvents))).not.toMatch(/secret provider|Please reply|current@example/);
  expect(await dispatchCaseEmail(tx, { ...input, attemptId: crypto.randomUUID() }, async () => {})).toBe("sent");
  const [unlinked] = await tx.insert(s.supportCases).values({ type: "other", summary: "Other" }).returning();
  await expect(dispatchCaseEmail(tx, { ...input, caseId: unlinked.id }, async () => {})).rejects.toMatchObject({ code: "recipient_missing" });
}));

test("server blocks bearer activation codes before sending or recording a result", () => rollback(db, async tx => {
  const [support] = await tx.insert(s.supportCases).values({ type: "other", summary: "Other", requesterEmail: "requester@example.test" }).returning();
  for (const kind of ["reply", "resolution"] as const) await expect(dispatchCaseEmail(tx, { caseId: support.id, actorId: null, kind, body: "Use N8KF-42PQ", attemptId: crypto.randomUUID() }, async () => { throw new Error("must not send"); })).rejects.toMatchObject({ code: "activation_code_in_email" });
  expect(await tx.select().from(s.activityEvents)).toHaveLength(0);
}));
