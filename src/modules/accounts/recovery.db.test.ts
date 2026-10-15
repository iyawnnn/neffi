import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, test, vi } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertProfile, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import type { Email } from "@/integrations/email/resend";
import { initiateRecovery, cancelRecovery, completeRecovery, resendRecoveryNotice } from "./recovery";
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

test("recovery and secure verification notes cannot persist recovery-code-shaped credentials", () => rollback(db, async tx => {
  const f = await fixture(tx);
  for (const action of [initiateRecovery, secureAccount]) await expect(action(tx, { ...f.input, verificationNote: "Recovery code 12345678" }, async () => {})).rejects.toMatchObject({ code: "invalid_input" });
  expect(await tx.select().from(s.activityEvents)).toHaveLength(0);
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

async function pending(tx: TestTx) {
  const f = await fixture(tx); let code = "";
  const result = await initiateRecovery(tx, f.input, async email => { if (email.idempotencyKey?.startsWith("recovery-code-")) code = email.text.match(/\b\d{8}\b/)![0]; });
  return { ...f, ...result, code };
}
test("three wrong attempts commit and cancel the proof, so the right code subsequently fails", () => rollback(db, async tx => {
  const f = await pending(tx); const wrong = f.code === "00000000" ? "11111111" : "00000000";
  for (let n = 1; n <= 3; n++) {
    expect(await completeRecovery(tx, { email: f.input.newEmail, code: wrong, secret }, async () => {})).toEqual({ ok: false });
    expect((await tx.select().from(s.accountRecoveries))[0]).toMatchObject({ attempts: n, status: n === 3 ? "cancelled" : "pending" });
  }
  expect(await completeRecovery(tx, { email: f.input.newEmail, code: f.code, secret }, async () => {})).toEqual({ ok: false });
  expect((await tx.select().from(s.activityEvents)).some(e => e.type === "account_recovery_cancelled" && e.note === "attempts exhausted")).toBe(true);
}));

test("completion preserves Account id and business data, verifies email, revokes sessions and Google once", () => rollback(db, async tx => {
  const f = await pending(tx);
  const { card } = await insertReleasedDbc(tx); const profile = await insertProfile(tx, f.account.id);
  await tx.update(s.cards).set({ ownerAccountId: f.account.id, profileId: profile.id }).where(eq(s.cards.id, card.id));
  await tx.insert(s.authSessions).values({ userId: f.account.id, token: "synthetic-session", expiresAt: new Date(Date.now() + 10000) });
  await tx.insert(s.authIdentities).values({ userId: f.account.id, providerId: "google", accountId: "synthetic-google" });
  const before = { cards: await tx.select().from(s.cards), profiles: await tx.select().from(s.profiles), orders: await tx.select().from(s.orders) };
  const sent: Email[] = [];
  expect(await completeRecovery(tx, { email: f.input.newEmail, code: f.code, secret }, async email => { sent.push(email); })).toEqual({ ok: true });
  expect((await tx.select().from(s.accounts).where(eq(s.accounts.id, f.account.id)))[0]).toMatchObject({ id: f.account.id, email: f.input.newEmail, emailVerified: true });
  expect(await tx.select().from(s.authSessions)).toHaveLength(0); expect(await tx.select().from(s.authIdentities)).toHaveLength(0);
  expect({ cards: await tx.select().from(s.cards), profiles: await tx.select().from(s.profiles), orders: await tx.select().from(s.orders) }).toEqual(before);
  expect(sent.map(e => e.to)).toEqual([f.account.email, f.input.newEmail]);
  expect(sent.every(e => !e.text.includes(f.account.email) && !e.text.includes(f.input.newEmail) && !e.text.includes(f.code))).toBe(true);
  expect(await completeRecovery(tx, { email: f.input.newEmail, code: f.code, secret }, async () => {})).toEqual({ ok: false });
}));

test.each(["expired", "resolved", "snapshot", "role", "occupied"])("completion rechecks %s with the identical public failure", reason => rollback(db, async tx => {
  const f = await pending(tx);
  if (reason === "resolved") await tx.update(s.supportCases).set({ status: "resolved", resolvedAt: new Date() }).where(eq(s.supportCases.id, f.support.id));
  if (reason === "snapshot") await tx.update(s.accounts).set({ email: "changed@example.test" }).where(eq(s.accounts.id, f.account.id));
  if (reason === "role") await tx.update(s.accounts).set({ role: "owner" }).where(eq(s.accounts.id, f.account.id));
  if (reason === "occupied") await tx.insert(s.accounts).values({ name: "Other", email: f.input.newEmail.toUpperCase() });
  const now = reason === "expired" ? new Date(Date.now() + 2 * 86400000) : new Date();
  expect(await completeRecovery(tx, { email: f.input.newEmail, code: f.code, secret, now }, async () => {})).toEqual({ ok: false });
  expect((await tx.select().from(s.accountRecoveries))[0].status).toBe("pending");
}));

test("manual notice retry uses the old snapshot and never regenerates or resends the code", () => rollback(db, async tx => {
  const f = await pending(tx); const sent: Email[] = [];
  await tx.update(s.accounts).set({ email: "changed@example.test" }).where(eq(s.accounts.id, f.account.id));
  await resendRecoveryNotice(tx, { caseId: f.support.id, actorId: f.owner.id, recoveryId: f.recoveryId, kind: "recovery_started" }, async email => { sent.push(email); });
  expect(sent).toHaveLength(1); expect(sent[0].to).toBe(f.account.email);
  expect(sent[0].text).not.toContain(f.code);
  expect(sent[0].idempotencyKey).not.toContain("recovery-code");
}));

test("post-commit code delivery audit failure still returns initiation and attempts the old-address notice", () => rollback(db, async tx => {
  const f = await fixture(tx); const sent: Email[] = [];
  const insert = vi.spyOn(tx, "insert").mockImplementationOnce(() => { throw new Error("synthetic delivery audit failure"); });
  try {
    await expect(initiateRecovery(tx, f.input, async email => { sent.push(email); })).resolves.toHaveProperty("recoveryId");
    expect(sent.some(email => email.to === f.account.email && email.subject === "Neffi account security notice")).toBe(true);
    expect(await tx.select().from(s.accountRecoveries)).toHaveLength(1);
  } finally { insert.mockRestore(); }
}));

test("a unique violation during email update rolls completion back to the same generic failure", () => rollback(db, async tx => {
  const f = await pending(tx);
  await tx.execute(sql`CREATE FUNCTION recovery_test_conflict() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic concurrent signup' USING ERRCODE='23505'; END $$`);
  await tx.execute(sql`CREATE TRIGGER recovery_test_conflict BEFORE UPDATE OF email ON accounts FOR EACH ROW EXECUTE FUNCTION recovery_test_conflict()`);
  expect(await completeRecovery(tx, { email: f.input.newEmail, code: f.code, secret }, async () => { throw new Error("must not send"); })).toEqual({ ok: false });
  expect((await tx.select().from(s.accounts).where(eq(s.accounts.id, f.account.id)))[0].email).toBe(f.account.email);
  expect((await tx.select().from(s.accountRecoveries))[0].status).toBe("pending");
}));
