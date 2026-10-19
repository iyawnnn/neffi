import { eq } from "drizzle-orm";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { accounts, authIdentities, authSessions } from "@/db/schema";
import { createTestAuth, googleFlow, signInWithEmail, type TestAuth, type TestClient } from "./test-auth";

let t: TestAuth;
beforeAll(async () => { t = await createTestAuth(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const headers = (client: TestClient) => new Headers({ cookie: client.cookieHeader() });
const tokenOf = (client: TestClient) => decodeURIComponent(client.jar.get("better-auth.session_token")!.split(".")[0]);
async function signedIn(email: string) {
  const client = t.client(); await signInWithEmail(t, client, email);
  const [account] = await t.db.select().from(accounts).where(eq(accounts.email, email));
  return { client, account };
}
async function requestEmailChange(client: TestClient, newEmail: string) {
  const before = t.sent.length;
  await t.auth.api.requestEmailChangeEmailOTP({ headers: headers(client), body: { newEmail } });
  const message = t.sent[before];
  expect(message).toMatchObject({ email: newEmail, type: "change-email" });
  return message.code;
}
test("Google can be removed and the email code still signs in", async () => {
  const email = "unlink@example.test"; const { client, account } = await signedIn(email);
  await googleFlow(client, { sub: "m6-unlink-google", email, email_verified: true }, { path: "/link-social", errorCallbackURL: "/app" });
  expect(await t.db.select().from(authIdentities).where(eq(authIdentities.userId, account.id))).toHaveLength(1);
  const linked = (await t.auth.api.listUserAccounts({ headers: headers(client) })).find(identity => identity.providerId === "google")!;
  await t.auth.api.unlinkAccount({ headers: headers(client), body: { accountId: linked.id } });
  expect(await t.db.select().from(authIdentities).where(eq(authIdentities.userId, account.id))).toHaveLength(0);
  const fresh = t.client(); expect((await signInWithEmail(t, fresh, email)).response.status).toBe(200);
  expect((await t.auth.api.getSession({ headers: headers(fresh) }))?.user.id).toBe(account.id);
});
test("changing the sign-in email needs a code sent to the new address", async () => {
  const { client, account } = await signedIn("email-change@example.test");
  const request = { headers: headers(client), body: { newEmail: "new@example.test" } };
  const before = t.sent.length; await t.auth.api.requestEmailChangeEmailOTP(request);
  expect(t.sent.length).toBe(before + 1); expect(t.sent[before].email).toBe("new@example.test");
  expect((t.sent[before] as { type?: string }).type).toBe("change-email");
  const wrong = t.sent[before].code === "000000" ? "111111" : "000000";
  await expect(t.auth.api.changeEmailEmailOTP({ headers: headers(client), body: { newEmail: "new@example.test", otp: wrong } })).rejects.toBeDefined();
  expect((await t.db.select().from(accounts).where(eq(accounts.id, account.id)))[0].email).toBe("email-change@example.test");
  await t.auth.api.changeEmailEmailOTP({ headers: headers(client), body: { newEmail: "new@example.test", otp: t.sent[before].code } });
  expect((await t.db.select().from(accounts).where(eq(accounts.id, account.id)))[0].email).toBe("new@example.test");
});

test("email change keeps the current session, revokes the other session, and keeps the email verified", async () => {
  const oldEmail = "change-sessions@example.test", newEmail = "change-sessions-new@example.test";
  const { client: current, account } = await signedIn(oldEmail);
  const other = t.client(); await signInWithEmail(t, other, oldEmail);
  const code = await requestEmailChange(current, newEmail);

  await t.auth.api.changeEmailEmailOTP({ headers: headers(current), body: { newEmail, otp: code } });
  await t.auth.api.revokeOtherSessions({ headers: headers(current) });

  expect((await t.db.select().from(accounts).where(eq(accounts.id, account.id)))[0]).toMatchObject({ email: newEmail, emailVerified: true });
  expect((await t.auth.api.getSession({ headers: headers(current) }))?.user).toMatchObject({ id: account.id, email: newEmail, emailVerified: true });
  expect(await t.auth.api.getSession({ headers: headers(other) })).toBeNull();
});

test("a failed email-change code leaves every session active", async () => {
  const oldEmail = "change-failure@example.test", newEmail = "change-failure-new@example.test";
  const { client: current, account } = await signedIn(oldEmail);
  const other = t.client(); await signInWithEmail(t, other, oldEmail);
  const code = await requestEmailChange(current, newEmail);
  const wrong = code === "000000" ? "111111" : "000000";

  await expect(t.auth.api.changeEmailEmailOTP({ headers: headers(current), body: { newEmail, otp: wrong } })).rejects.toBeDefined();

  expect((await t.auth.api.getSession({ headers: headers(current) }))?.user.id).toBe(account.id);
  expect((await t.auth.api.getSession({ headers: headers(other) }))?.user.id).toBe(account.id);
  expect(await t.db.select().from(authSessions).where(eq(authSessions.userId, account.id))).toHaveLength(2);
});

test("email-change codes are single-use, expire after five minutes, and lock after three wrong attempts", async () => {
  const replay = await signedIn("change-replay@example.test");
  const replayEmail = "change-replay-new@example.test";
  const replayCode = await requestEmailChange(replay.client, replayEmail);
  await t.auth.api.changeEmailEmailOTP({ headers: headers(replay.client), body: { newEmail: replayEmail, otp: replayCode } });
  await expect(t.auth.api.changeEmailEmailOTP({ headers: headers(replay.client), body: { newEmail: replayEmail, otp: replayCode } })).rejects.toBeDefined();

  const expired = await signedIn("change-expired@example.test");
  const expiredEmail = "change-expired-new@example.test";
  const expiredCode = await requestEmailChange(expired.client, expiredEmail);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + 6 * 60_000);
  await expect(t.auth.api.changeEmailEmailOTP({ headers: headers(expired.client), body: { newEmail: expiredEmail, otp: expiredCode } })).rejects.toMatchObject({ statusCode: 400 });
  vi.useRealTimers();

  const locked = await signedIn("change-locked@example.test");
  const lockedEmail = "change-locked-new@example.test";
  const lockedCode = await requestEmailChange(locked.client, lockedEmail);
  const wrong = lockedCode === "000000" ? "111111" : "000000";
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(t.auth.api.changeEmailEmailOTP({ headers: headers(locked.client), body: { newEmail: lockedEmail, otp: wrong } })).rejects.toMatchObject({ statusCode: 400 });
  }
  await expect(t.auth.api.changeEmailEmailOTP({ headers: headers(locked.client), body: { newEmail: lockedEmail, otp: lockedCode } })).rejects.toMatchObject({ statusCode: 403 });
});

test("a linked Google identity survives an email change and still resolves the same Account", async () => {
  const oldEmail = "change-google@example.test", newEmail = "change-google-new@example.test";
  const { client, account } = await signedIn(oldEmail);
  const profile = { sub: "change-google-subject", email: oldEmail, email_verified: true };
  await googleFlow(client, profile, { path: "/link-social", errorCallbackURL: "/app" });
  const code = await requestEmailChange(client, newEmail);
  await t.auth.api.changeEmailEmailOTP({ headers: headers(client), body: { newEmail, otp: code } });
  expect(await t.db.select().from(authIdentities).where(eq(authIdentities.userId, account.id))).toHaveLength(1);

  const fresh = t.client();
  await googleFlow(fresh, profile);
  expect((await t.auth.api.getSession({ headers: headers(fresh) }))?.user).toMatchObject({ id: account.id, email: newEmail });
});

test("signing in again replaces an old browser cookie with a newly created session", async () => {
  const email = "fresh-session@example.test";
  const { client, account } = await signedIn(email);
  const oldToken = tokenOf(client);
  await t.db.update(authSessions).set({ createdAt: new Date(Date.now() - 16 * 60_000) }).where(eq(authSessions.token, oldToken));

  await signInWithEmail(t, client, email);

  const current = await t.auth.api.getSession({ headers: headers(client), query: { disableRefresh: true } });
  expect(tokenOf(client)).not.toBe(oldToken);
  expect(current?.user.id).toBe(account.id);
  expect(Date.now() - current!.session.createdAt.getTime()).toBeLessThan(60_000);
});

test("two Accounts racing for one target email cannot both change to it", async () => {
  const first = await signedIn("change-race-a@example.test");
  const second = await signedIn("change-race-b@example.test");
  const target = "change-race-target@example.test";
  const [firstCode, secondCode] = await Promise.all([
    requestEmailChange(first.client, target),
    requestEmailChange(second.client, target),
  ]);

  const results = await Promise.allSettled([
    t.auth.api.changeEmailEmailOTP({ headers: headers(first.client), body: { newEmail: target, otp: firstCode } }),
    t.auth.api.changeEmailEmailOTP({ headers: headers(second.client), body: { newEmail: target, otp: secondCode } }),
  ]);

  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  expect(await t.db.select().from(accounts).where(eq(accounts.email, target))).toHaveLength(1);
});

test("unlink rejects a foreign or unknown identity and preserves the linked Google account", async () => {
  const { client } = await signedIn("unlink-other@example.test");
  const { client: owner, account } = await signedIn("unlink-owner@example.test");
  await googleFlow(owner, { sub: "m6-protected-google", email: account.email, email_verified: true }, { path: "/link-social", errorCallbackURL: "/app" });
  const [linked] = await t.auth.api.listUserAccounts({ headers: headers(owner) });
  for (const accountId of [linked.id, "unknown-identity"]) {
    await expect(t.auth.api.unlinkAccount({ headers: headers(client), body: { accountId } })).rejects.toMatchObject({ statusCode: 400 });
  }
  expect(await t.db.select().from(authIdentities).where(eq(authIdentities.userId, account.id))).toHaveLength(1);
});
test("an existing email sends nothing and changes nothing", async () => {
  await signedIn("occupied@example.test"); const { client, account } = await signedIn("unchanged@example.test");
  const before = t.sent.length;
  await t.auth.api.requestEmailChangeEmailOTP({ headers: headers(client), body: { newEmail: "occupied@example.test" } });
  expect(t.sent.length).toBe(before);
  expect((await t.db.select().from(accounts).where(eq(accounts.id, account.id)))[0].email).toBe("unchanged@example.test");
});
test("sign out everywhere ends every session", async () => {
  const { client, account } = await signedIn("revoke@example.test"); await signInWithEmail(t, t.client(), account.email);
  expect(await t.db.select().from(authSessions).where(eq(authSessions.userId, account.id))).toHaveLength(2);
  await t.auth.api.revokeSessions({ headers: headers(client) });
  expect(await t.db.select().from(authSessions).where(eq(authSessions.userId, account.id))).toHaveLength(0);
});
test.each(["/unlink-account", "/revoke-sessions", "/email-otp/request-email-change", "/email-otp/change-email"])("HTTP route %s stays disabled", async path => {
  const response = await t.client().post(path, { body: {} }); expect(response.status).toBe(404);
});
