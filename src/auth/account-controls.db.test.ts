import { eq } from "drizzle-orm";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { accounts, authIdentities, authSessions } from "@/db/schema";
import { createTestAuth, googleFlow, signInWithEmail, type TestAuth, type TestClient } from "./test-auth";

let t: TestAuth;
beforeAll(async () => { t = await createTestAuth(); });
afterEach(() => vi.unstubAllGlobals());
const headers = (client: TestClient) => new Headers({ cookie: client.cookieHeader() });
async function signedIn(email: string) {
  const client = t.client(); await signInWithEmail(t, client, email);
  const [account] = await t.db.select().from(accounts).where(eq(accounts.email, email));
  return { client, account };
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
