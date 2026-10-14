import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import type { Email } from "@/integrations/email/resend";
import { initiateRecovery, cancelRecovery } from "./recovery";
import { secureAccount } from "./secure";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
const secret = "synthetic-recovery-secret";
async function fixture(tx: TestTx, role: "customer" | "owner" = "customer") {
  const owner = await insertAccount(tx, "owner"); const account = await insertAccount(tx, role);
  await tx.update(s.accounts).set({ emailVerified: true }).where(eq(s.accounts.id, account.id));
  const [support] = await tx.insert(s.supportCases).values({ type: "account_recovery", summary: "Recovery", accountId: account.id }).returning();
  return { owner, account, support, input: { caseId: support.id, actorId: owner.id, newEmail: "new@example.test", confirmed: true, verificationNote: "Verified purchase evidence", unlinkGoogle: true, secret } };
}
test("initiation stores proof only, defaults Google removal, and sends private notices after persistence", () => rollback(db, async tx => {
  const f = await fixture(tx); const sent: Email[] = [];
  const result = await initiateRecovery(tx, f.input, async email => { expect(await tx.select().from(s.accountRecoveries)).toHaveLength(1); sent.push(email); });
  expect(Object.keys(result)).toEqual(["recoveryId"]);
  const [row] = await tx.select().from(s.accountRecoveries);
  expect(row).toMatchObject({ status: "pending", attempts: 0, unlinkGoogle: true, oldEmail: f.account.email });
  expect(row.codeHmac).toMatch(/^[0-9a-f]{64}$/);
  const code = sent.find(e => e.to === f.input.newEmail)!.text.match(/\b\d{8}\b/)![0];
  expect(JSON.stringify(row)).not.toContain(code);
  expect(sent.find(e => e.to === f.account.email)!.text).not.toMatch(/new@example|\b\d{8}\b/);
  expect(sent[0].idempotencyKey).toBe(`recovery-code-${result.recoveryId}`);
  await expect(initiateRecovery(tx, f.input, async () => {})).rejects.toMatchObject({ code: "recovery_live" });
  await cancelRecovery(tx, { caseId: f.support.id, actorId: f.owner.id, recoveryId: result.recoveryId });
  expect((await tx.select().from(s.accountRecoveries))[0].status).toBe("cancelled");
}));
test("owner targets, occupied email, unverified input and resolved cases refuse without proof", () => rollback(db, async tx => {
  const f = await fixture(tx, "owner");
  await expect(initiateRecovery(tx, f.input, async () => {})).rejects.toMatchObject({ code: "customer_required" });
  await tx.update(s.accounts).set({ role: "customer" }).where(eq(s.accounts.id, f.account.id));
  await expect(initiateRecovery(tx, { ...f.input, newEmail: f.owner.email.toUpperCase() }, async () => {})).rejects.toMatchObject({ code: "email_taken" });
  await expect(initiateRecovery(tx, { ...f.input, confirmed: false }, async () => {})).rejects.toMatchObject({ code: "invalid_input" });
  await tx.update(s.supportCases).set({ status: "resolved", resolvedAt: new Date() }).where(eq(s.supportCases.id, f.support.id));
  await expect(initiateRecovery(tx, f.input, async () => {})).rejects.toMatchObject({ code: "case_resolved" });
  expect(await tx.select().from(s.accountRecoveries)).toHaveLength(0);
}));
test("expired recovery can be replaced and a failed code email requires cancel and fresh initiation", () => rollback(db, async tx => {
  const f = await fixture(tx); const before = new Date("2026-10-01T00:00:00Z");
  const first = await initiateRecovery(tx, { ...f.input, now: before }, async () => { throw new Error("secret provider content"); });
  const next = await initiateRecovery(tx, { ...f.input, now: new Date("2026-10-03T00:00:00Z") }, async () => {});
  expect(next.recoveryId).not.toBe(first.recoveryId);
  expect((await tx.select().from(s.accountRecoveries).where(eq(s.accountRecoveries.id, first.recoveryId)))[0].status).toBe("cancelled");
  expect(JSON.stringify(await tx.select().from(s.activityEvents))).not.toContain("secret provider content");
}));
test("secure account revokes sessions and Google with audited effects, leaving email and data intact", () => rollback(db, async tx => {
  const f = await fixture(tx);
  await tx.insert(s.authSessions).values({ userId: f.account.id, token: "synthetic-session", expiresAt: new Date(Date.now() + 10000) });
  await tx.insert(s.authIdentities).values({ userId: f.account.id, providerId: "google", accountId: "synthetic-google" });
  await secureAccount(tx, f.input, async () => {});
  expect(await tx.select().from(s.authSessions)).toHaveLength(0);
  expect(await tx.select().from(s.authIdentities)).toHaveLength(0);
  expect((await tx.select().from(s.accounts).where(eq(s.accounts.id, f.account.id)))[0].email).toBe(f.account.email);
  expect((await tx.select().from(s.activityEvents)).map(e => e.type)).toEqual(expect.arrayContaining(["account_sessions_revoked", "account_google_removed", "security_notice_sent"]));
}));

test("a live new-email reservation on another Account refuses, while its expired proof is cancelled", () => rollback(db, async tx => {
  const first = await fixture(tx); const second = await fixture(tx);
  await initiateRecovery(tx, first.input, async () => {});
  await expect(initiateRecovery(tx, second.input, async () => {})).rejects.toMatchObject({ code: "recovery_live" });
  await initiateRecovery(tx, { ...second.input, now: new Date(Date.now() + 2 * 86400000) }, async () => {});
  expect((await tx.select().from(s.accountRecoveries)).map(row => row.status).sort()).toEqual(["cancelled", "pending"]);
}));

test("secure refuses owner/resolved targets and preserves the only unverified Google method", () => rollback(db, async tx => {
  const f = await fixture(tx, "owner");
  await expect(secureAccount(tx, f.input, async () => {})).rejects.toMatchObject({ code: "customer_required" });
  await tx.update(s.accounts).set({ role: "customer", emailVerified: false }).where(eq(s.accounts.id, f.account.id));
  await expect(secureAccount(tx, f.input, async () => {})).rejects.toMatchObject({ code: "checks_incomplete" });
  await tx.update(s.supportCases).set({ status: "resolved", resolvedAt: new Date() }).where(eq(s.supportCases.id, f.support.id));
  await expect(secureAccount(tx, { ...f.input, unlinkGoogle: false }, async () => {})).rejects.toMatchObject({ code: "case_resolved" });
}));
