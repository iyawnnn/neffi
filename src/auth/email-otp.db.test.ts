import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { accounts, authIdentities, authVerifications } from "@/db/schema";
import { createClient, createTestAuth, signInWithEmail, TEST_SECRET, type TestAuth } from "./test-auth";

let test_: TestAuth;
beforeAll(async () => {
  test_ = await createTestAuth();
});
afterEach(() => vi.useRealTimers());

let n = 0;
const freshEmail = () => `person${++n}@example.test`;
const client = () => test_.client();
const send = (c: ReturnType<typeof createClient>, email: string, extra: object = {}) =>
  c.post("/email-otp/send-verification-otp", { body: { email, type: "sign-in", ...extra } });
const attempt = (c: ReturnType<typeof createClient>, email: string, otp: string) =>
  c.post("/sign-in/email-otp", { body: { email, otp } });

describe("email OTP sign-in", () => {
  test("stores only a keyed hash of the code, under an identifier that is not the email", async () => {
    const email = freshEmail();
    await send(client(), email);
    const code = test_.sent.at(-1)!.code;
    expect(code).toMatch(/^\d{6}$/);

    const rows = await test_.db.select().from(authVerifications);
    const stored = rows.map((row) => `${row.identifier} ${row.value}`).join("\n");
    expect(stored).not.toContain(code);
    expect(stored).not.toContain(email);
    const expectedHash = createHmac("sha256", TEST_SECRET).update(`otp:${code}`).digest("hex");
    expect(rows.some((row) => row.value.startsWith(`${expectedHash}:`))).toBe(true);
  });

  test("a new email becomes a verified customer Account with a session and no identity row", async () => {
    const email = freshEmail();
    const c = client();
    const { response } = await signInWithEmail(test_, c, email);
    expect(response.status).toBe(200);
    expect(c.hasSession()).toBe(true);

    const [account] = await test_.db.select().from(accounts).where(eq(accounts.email, email));
    expect(account.emailVerified).toBe(true);
    expect(account.role).toBe("customer");
    expect(await test_.db.select().from(authIdentities).where(eq(authIdentities.userId, account.id))).toHaveLength(0);
  });

  test("an existing verified email resolves to the same Account instead of creating a duplicate", async () => {
    const email = freshEmail();
    const [existing] = await test_.db
      .insert(accounts)
      .values({ name: "Existing", email, emailVerified: true, role: "owner" })
      .returning();
    const { response } = await signInWithEmail(test_, client(), email);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { user: { id: string } }).user.id).toBe(existing.id);
    expect(await test_.db.select().from(accounts).where(eq(accounts.email, email))).toHaveLength(1);
  });

  test("a code works once", async () => {
    const email = freshEmail();
    const { code } = await signInWithEmail(test_, client(), email);
    const replay = await attempt(client(), email, code);
    expect(replay.status).toBe(400);
  });

  test("after three wrong guesses even the right code is refused", async () => {
    const email = freshEmail();
    const c = client();
    await send(c, email);
    const code = test_.sent.at(-1)!.code;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 3; i++) expect((await attempt(c, email, wrong)).status).toBe(400);
    const locked = await attempt(c, email, code);
    expect(locked.status).toBe(403);
    expect(await locked.json()).toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
  });

  test("a code expires after five minutes", async () => {
    const email = freshEmail();
    const c = client();
    await send(c, email);
    const code = test_.sent.at(-1)!.code;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 6 * 60_000);
    const late = await attempt(c, email, code);
    expect(late.status).toBe(400);
    expect(await late.json()).toMatchObject({ code: "OTP_EXPIRED" });
  });

  test("a client-supplied role is ignored", async () => {
    const email = freshEmail();
    const c = client();
    await send(c, email);
    const response = await c.post("/sign-in/email-otp", { body: { email, otp: test_.sent.at(-1)!.code, role: "owner" } });
    expect(response.status).toBe(200);
    const [account] = await test_.db.select().from(accounts).where(eq(accounts.email, email));
    expect(account.role).toBe("customer");
  });
});

describe("email OTP abuse limits", () => {
  test("known and unknown emails get identical send responses", async () => {
    const known = freshEmail();
    await test_.db.insert(accounts).values({ name: "Known", email: known, emailVerified: true });
    const before = test_.sent.length;
    const a = await send(client(), known);
    const b = await send(client(), freshEmail());
    expect([a.status, await a.text()]).toEqual([b.status, await b.text()]);
    // Both really mailed a code: an unknown address is not silently skipped, which would reveal who has an account.
    expect(test_.sent.length - before).toBe(2);
  });

  test("only sign-in codes can be requested, and nothing is mailed otherwise", async () => {
    const before = test_.sent.length;
    for (const type of ["forget-password", "email-verification", "change-email"]) {
      const response = await send(client(), freshEmail(), { type });
      expect(response.status).toBe(400);
    }
    expect(test_.sent.length).toBe(before);
  });

  test("an email gets three codes per ten minutes, however the address is written or requested", async () => {
    const email = freshEmail();
    const before = test_.sent.length;
    // A different client (IP) each time: the per-email quota must hold on its own.
    expect((await send(client(), email)).status).toBe(200);
    expect((await send(client(), email.toUpperCase())).status).toBe(200);
    expect((await send(client(), email)).status).toBe(200);
    const blocked = await send(client(), email);
    expect(blocked.status).toBe(429);
    expect(test_.sent.length - before).toBe(3);
    // The refusal says nothing about the address or whether it has an Account.
    expect(JSON.stringify(await blocked.json())).not.toContain(email);
  });

  test("Better Auth pruning its rate-limit table does not reset the per-email quota", async () => {
    const email = freshEmail();
    for (let i = 0; i < 3; i++) await send(client(), email);
    await test_.db.execute(sql`delete from auth_rate_limits`);
    expect((await send(client(), email)).status).toBe(429);
  });

  test("the per-email quota stores a hash, not the address, and frees up after ten minutes", async () => {
    const email = freshEmail();
    for (let i = 0; i < 3; i++) await send(client(), email);
    const keys = (await test_.db.execute<{ key: string }>(sql`select key from auth_otp_quotas`)).rows.map((r) => r.key);
    expect(keys.join()).not.toContain(email);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    expect((await send(client(), email)).status).toBe(200);
  });

  test("a burst of parallel requests cannot slip past the per-email quota", async () => {
    const email = freshEmail();
    const before = test_.sent.length;
    const responses = await Promise.all(Array.from({ length: 6 }, () => send(client(), email)));
    expect(responses.filter((r) => r.status === 200)).toHaveLength(3);
    expect(responses.filter((r) => r.status === 429)).toHaveLength(3);
    expect(test_.sent.length - before).toBe(3);
  });

  test("the client IP comes from the platform header, so rotating x-forwarded-for does not dodge the limit", async () => {
    const c = client();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const response = await c.post("/email-otp/send-verification-otp", {
        body: { email: freshEmail(), type: "sign-in" },
        headers: { "x-vercel-forwarded-for": "198.51.100.77", "x-forwarded-for": "203.0.113." + (i + 1) },
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  test("one IP is limited to ten code requests a minute", async () => {
    const c = client();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await send(c, freshEmail())).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
