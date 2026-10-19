import { eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { hmacHex } from "@/auth/otp-quota";
import { beforeAll, expect, test, vi } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { submitSupportRequest } from "./intake";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
const data = () => ({ email: "CONTACT@example.test", name: "Contact", category: "activation", message: "Package lost", clientKey: crypto.randomUUID(), website: "" });
const options = { ip: "127.0.0.1", secret: "synthetic-intake-secret", now: new Date("2026-10-14T12:00:00Z") };

test("public intake is unassigned, anonymous, unlinked and never queries Accounts", () => rollback(db, async tx => {
  const query = vi.spyOn(db.$client, "query");
  try {
    const result = await submitSupportRequest(tx, data(), options);
    expect(result.acknowledge).toBe(true);
    expect(query.mock.calls.map(([sql]) => String(sql)).join("\n")).not.toMatch(/(?:from|join)\s+"?accounts"?/i);
    const [row] = await tx.select().from(s.supportCases);
    expect(row).toMatchObject({ source: "public", summary: "Lost activation code", requesterMessage: "Package lost", requesterEmail: "contact@example.test", assignedToAccountId: null, openedByAccountId: null, accountId: null, purchaserId: null, orderId: null });
    expect(await tx.select().from(s.activityEvents)).toMatchObject([{ actorAccountId: null, type: "support_case_opened", note: "public request" }]);
  } finally { query.mockRestore(); }
}));

test("credential-shaped free text is refused before persistence", () => rollback(db, async tx => {
  for (const change of [{ message: "My code is N8KF-42PQ" }, { message: "My recovery code is 12345678" }, { name: "N8KF42PQ" }]) await expect(submitSupportRequest(tx, { ...data(), ...change }, options)).rejects.toMatchObject({ code: "invalid_input" });
  expect(await tx.select().from(s.supportCases)).toHaveLength(0);
}));

test("client key dedupes and a prior case throttles acknowledgement for 24 hours", () => rollback(db, async tx => {
  const input = data();
  const first = await submitSupportRequest(tx, input, options);
  expect(await submitSupportRequest(tx, input, options)).toMatchObject({ caseId: first.caseId, acknowledge: false });
  expect((await submitSupportRequest(tx, data(), options)).acknowledge).toBe(false);
  expect((await submitSupportRequest(tx, data(), { ...options, now: new Date(options.now.getTime() + 24 * 60 * 60_000) })).acknowledge).toBe(true);
  expect(await tx.select().from(s.supportCases)).toHaveLength(3);
}));

test("honeypots and exhausted email quotas return no case", () => rollback(db, async tx => {
  expect(await submitSupportRequest(tx, { ...data(), website: "bot" }, options)).toEqual({ acknowledge: false });
  for (let n = 0; n < 4; n++) await submitSupportRequest(tx, data(), options);
  expect(await tx.select().from(s.supportCases)).toHaveLength(3);
  const keys = await tx.select().from(s.authOtpQuotas);
  expect(keys.every(row => /^[0-9a-f]{64}$/.test(row.key))).toBe(true);
}));

test("signed-in intake derives identity from the viewer and links only their Card", () => rollback(db, async tx => {
  const account = await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  const viewer = { accountId: account.id, email: account.email, role: "customer" as const };
  const foreign = await submitSupportRequest(tx, { ...data(), cardId: card.id }, { ...options, viewer });
  expect(await tx.select().from(s.supportCaseCards)).toHaveLength(0);
  await tx.update(s.cards).set({ ownerAccountId: account.id }).where(eq(s.cards.id, card.id));
  const own = await submitSupportRequest(tx, { ...data(), cardId: card.id }, { ...options, viewer });
  expect(own.acknowledge).toBe(false);
  expect(await tx.select().from(s.supportCaseCards)).toMatchObject([{ supportCaseId: own.caseId, cardId: card.id, role: "affected" }]);
  const [row] = await tx.select().from(s.supportCases).where(eq(s.supportCases.id, foreign.caseId!));
  expect(row).toMatchObject({ source: "account", accountId: account.id, openedByAccountId: account.id, requesterEmail: null, assignedToAccountId: null });
  expect((await tx.select().from(s.activityEvents)).every(e => e.actorAccountId === account.id)).toBe(true);
}));

test("IP and global quotas bound intake across distinct contact addresses", () => rollback(db, async tx => {
  for (let n = 0; n < 6; n++) await submitSupportRequest(tx, { ...data(), email: `ip${n}@example.test` }, options);
  expect(await tx.select().from(s.supportCases)).toHaveLength(5);
  const later = new Date(options.now.getTime() + 600001);
  for (let n = 0; n < 101; n++) await submitSupportRequest(tx, { ...data(), email: `global${n}@example.test` }, { ...options, now: later, ip: `synthetic-ip-${n}` });
  expect(await tx.select().from(s.supportCases)).toHaveLength(105);
}));

test("one refused source cannot consume the global allowance for other requesters", () => rollback(db, async tx => {
  for (let n = 0; n < 101; n++) await submitSupportRequest(tx, { ...data(), email: `blocked${n}@example.test` }, options);
  const result = await submitSupportRequest(tx, { ...data(), email: "genuine@example.test" }, { ...options, ip: "synthetic-other-source" });
  expect(result.caseId).toBeDefined();
  expect(await tx.select().from(s.supportCases)).toHaveLength(6);
}));

test("the twenty-first daily request from one source is not stored", () => rollback(db, async tx => {
  for (let n = 0; n < 21; n++) {
    const now = new Date(+options.now + Math.floor(n / 5) * 11 * 60_000);
    const result = await submitSupportRequest(tx, { ...data(), email: `daily${n}@example.test` }, { ...options, now });
    expect(Boolean(result.caseId)).toBe(n < 20);
  }
  expect(await tx.select().from(s.supportCases)).toHaveLength(20);
}));

test("quota pruning finishes before the intake transaction and no cleanup DELETE occurs inside it", async () => {
  const expired = hmacHex(options.secret, "test", "expired");
  await db.insert(s.authOtpQuotas).values({ key: expired, count: 1, windowStartedAt: new Date(+options.now - 25 * 60 * 60_000) });
  const transaction = db.transaction.bind(db);
  const statements: string[] = [];
  const spy = vi.spyOn(db, "transaction").mockImplementation(async (run, config) => {
    expect(await db.select().from(s.authOtpQuotas).where(eq(s.authOtpQuotas.key, expired))).toHaveLength(0);
    return transaction(async tx => {
      const execute = tx.execute.bind(tx);
      vi.spyOn(tx, "execute").mockImplementation((query) => {
        statements.push(typeof query === "string" ? query : new PgDialect().sqlToQuery(query.getSQL()).sql);
        return execute(query);
      });
      return run(tx);
    }, config);
  });
  try {
    expect((await submitSupportRequest(db, { ...data(), email: "pruning@example.test" }, options)).caseId).toBeDefined();
    expect(statements.some(query => /insert into auth_otp_quotas/i.test(query))).toBe(true);
    expect(statements.join("\n")).not.toMatch(/delete from auth_otp_quotas/i);
  } finally { spy.mockRestore(); }
});
