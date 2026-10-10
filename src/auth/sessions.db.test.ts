import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { authSessions } from "@/db/schema";
import { createTestAuth, signInWithEmail, type TestAuth, type TestClient } from "./test-auth";

let t: TestAuth;
beforeAll(async () => {
  t = await createTestAuth();
});
afterEach(() => vi.useRealTimers());

let n = 0;
const freshEmail = () => `session${++n}@example.test`;
const sessionRows = () => t.db.select().from(authSessions);
const read = (client: TestClient, query?: Record<string, string | boolean>) =>
  t.auth.api.getSession({ headers: new Headers({ cookie: client.cookieHeader() }), query, returnHeaders: true });
const tokenOf = (client: TestClient) =>
  decodeURIComponent(client.jar.get("better-auth.session_token")!.split(".")[0]);

async function signedIn() {
  const client = t.client();
  const { response } = await signInWithEmail(t, client, freshEmail());
  expect(response.status).toBe(200);
  return client;
}

async function signInResponse(test: TestAuth) {
  const client = test.client();
  const email = freshEmail();
  await client.post("/email-otp/send-verification-otp", { body: { email, type: "sign-in" } });
  return client.post("/sign-in/email-otp", { body: { email, otp: test.sent.at(-1)!.code } });
}

describe("sessions", () => {
  test("the cookie is HttpOnly and SameSite=Lax; on http it is not Secure", async () => {
    const cookie = (await signInResponse(t)).headers.getSetCookie().find((c) => c.includes("session_token"))!;
    expect(cookie).toMatch(/^better-auth\.session_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Secure/i);
  });

  test("on https the cookie is Secure and __Secure- prefixed", async () => {
    const secure = await createTestAuth({ baseURL: "https://neffi.example.test" });
    const cookie = (await signInResponse(secure)).headers.getSetCookie().find((c) => c.includes("session_token"))!;
    expect(cookie).toMatch(/^__Secure-better-auth\.session_token=/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  test("a session is read from the database on every request and carries the role", async () => {
    const client = await signedIn();
    const result = await read(client);
    expect(result.response?.user).toMatchObject({ role: "customer", emailVerified: true });
  });

  test("every sign-in issues a new token", async () => {
    const email = freshEmail();
    const first = t.client();
    const second = t.client();
    await signInWithEmail(t, first, email);
    await signInWithEmail(t, second, email);
    expect(tokenOf(first)).not.toBe(tokenOf(second));
  });

  test("sign-out deletes the session row and the session stops working", async () => {
    const client = await signedIn();
    const stale = client.cookieHeader();
    const before = (await sessionRows()).length;
    const response = await client.post("/sign-out", { body: {} });
    expect(response.status).toBe(200);
    expect((await sessionRows()).length).toBe(before - 1);
    expect(await t.auth.api.getSession({ headers: new Headers({ cookie: stale }) })).toBeNull();
  });

  test("an expired session grants nothing", async () => {
    const client = await signedIn();
    await t.db.update(authSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(authSessions.token, tokenOf(client)));
    expect(await t.auth.api.getSession({ headers: new Headers({ cookie: client.cookieHeader() }) })).toBeNull();
  });

  test("a read that must not refresh leaves the session untouched", async () => {
    const client = await signedIn();
    const [row] = await t.db.select().from(authSessions).where(eq(authSessions.token, tokenOf(client)));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60_000);
    const result = await read(client, { disableRefresh: true });
    expect(result.response).not.toBeNull();
    expect(result.headers.get("set-cookie")).toBeNull();
    const [after] = await t.db.select().from(authSessions).where(eq(authSessions.id, row.id));
    expect(after.expiresAt.getTime()).toBe(row.expiresAt.getTime());
  });

  test("the session rolls for thirty days and the cookie lifetime is renewed with it", async () => {
    const client = await signedIn();
    const [row] = await t.db.select().from(authSessions).where(eq(authSessions.token, tokenOf(client)));
    const thirtyDays = 30 * 24 * 60 * 60_000;
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(thirtyDays - 60_000);
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(thirtyDays);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60_000);
    const refreshed = await read(client);
    expect(refreshed.headers.get("set-cookie") ?? "").toMatch(/Max-Age=2592000/i);
    const [after] = await t.db.select().from(authSessions).where(eq(authSessions.id, row.id));
    expect(after.expiresAt.getTime()).toBeGreaterThan(row.expiresAt.getTime());
  });
});
