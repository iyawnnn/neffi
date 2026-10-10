import { eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { accounts, authIdentities } from "@/db/schema";
import { googleFlow, signInWithEmail, type GoogleProfile, type TestAuth } from "./test-auth";
import { createTestAuth } from "./test-auth";

let t: TestAuth;
beforeAll(async () => {
  t = await createTestAuth();
});
afterEach(() => vi.unstubAllGlobals());

let n = 0;
const profile = (overrides: Partial<GoogleProfile> = {}): GoogleProfile => {
  n += 1;
  return { sub: `google-sub-${n}`, email: `g${n}@example.test`, email_verified: true, name: `Google Person ${n}`, ...overrides };
};
const accountsWithEmail = (email: string) => t.db.select().from(accounts).where(eq(accounts.email, email));
const identitiesFor = (sub: string) => t.db.select().from(authIdentities).where(eq(authIdentities.accountId, sub));
const location = (response: Response) => new URL(response.headers.get("location") ?? "", "http://localhost:3000");

describe("Google sign-in", () => {
  test("starts the Google code flow with the exact callback and no client secret in the URL", async () => {
    const client = t.client();
    const response = await client.post("/sign-in/social", { body: { provider: "google", callbackURL: "/app" } });
    const { url } = (await response.json()) as { url: string };
    const authorize = new URL(url);
    expect(authorize.origin + authorize.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(authorize.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callback/google");
    expect(authorize.searchParams.get("client_id")).toBe("test-google-client-id");
    expect(authorize.searchParams.get("scope")).toEqual(expect.stringContaining("email"));
    expect(url).not.toContain("test-google-client-secret");
  });

  test("a new verified Google user gets a customer Account and identity, and no Google tokens are stored", async () => {
    const p = profile();
    const client = t.client();
    const { callback } = await googleFlow(client, p);
    expect(location(callback).pathname).toBe("/app");
    expect(client.hasSession()).toBe(true);

    const [account] = await accountsWithEmail(p.email);
    expect(account).toMatchObject({ emailVerified: true, role: "customer" });
    const [identity] = await identitiesFor(p.sub);
    expect(identity).toMatchObject({ providerId: "google", userId: account.id });
    expect(identity.accessToken).toBeNull();
    expect(identity.refreshToken).toBeNull();
    expect(identity.idToken).toBeNull();
  });

  test("an unverified Google email is refused and creates nothing", async () => {
    const p = profile({ email_verified: false });
    const client = t.client();
    const { callback } = await googleFlow(client, p);
    expect(location(callback).pathname).toBe("/sign-in");
    expect(location(callback).searchParams.get("error")).toBeTruthy();
    expect(client.hasSession()).toBe(false);
    expect(await accountsWithEmail(p.email)).toHaveLength(0);
    expect(await identitiesFor(p.sub)).toHaveLength(0);
  });

  test("a new Google identity with an existing Account's email is never linked silently", async () => {
    const p = profile();
    await signInWithEmail(t, t.client(), p.email);
    const client = t.client();
    const { callback } = await googleFlow(client, p);

    expect(location(callback).pathname).toBe("/sign-in");
    expect(location(callback).searchParams.get("error")).toBe("account_not_linked");
    expect(client.hasSession()).toBe(false);
    expect(await identitiesFor(p.sub)).toHaveLength(0);
    expect(await accountsWithEmail(p.email)).toHaveLength(1);
  });

  test("a linked Google identity keeps resolving to its Account after Google reports a new email", async () => {
    const p = profile();
    await googleFlow(t.client(), p);
    const [original] = await accountsWithEmail(p.email);

    const client = t.client();
    const { callback } = await googleFlow(client, { ...p, email: `changed-${p.email}`, name: "Renamed" });
    expect(location(callback).pathname).toBe("/app");
    expect(client.hasSession()).toBe(true);
    const [after] = await t.db.select().from(accounts).where(eq(accounts.id, original.id));
    expect(after.email).toBe(p.email);
    expect(after.name).toBe(original.name);
    expect(await accountsWithEmail(`changed-${p.email}`)).toHaveLength(0);
  });

  test("a failure while saving the identity leaves no orphan Account", async () => {
    const p = profile();
    await t.db.execute(sql`create function fail_identity() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$`);
    await t.db.execute(sql`create trigger fail_identity before insert on auth_identities for each row execute function fail_identity()`);
    try {
      const { callback } = await googleFlow(t.client(), p);
      expect(location(callback).searchParams.get("error")).toBeTruthy();
    } finally {
      await t.db.execute(sql`drop trigger fail_identity on auth_identities`);
      await t.db.execute(sql`drop function fail_identity()`);
    }
    expect(await accountsWithEmail(p.email)).toHaveLength(0);
  });
});

describe("Connect Google (deliberate linking)", () => {
  async function signedInWithEmail() {
    const p = profile();
    const client = t.client();
    await signInWithEmail(t, client, p.email);
    return { p, client };
  }
  const link = (client: ReturnType<typeof t.client>, p: GoogleProfile) =>
    googleFlow(client, p, { path: "/link-social", errorCallbackURL: "/app" });

  test("links Google when its verified email matches the signed-in Account", async () => {
    const { p, client } = await signedInWithEmail();
    const { callback } = await link(client, p);
    expect(location(callback).pathname).toBe("/app");
    expect(location(callback).searchParams.get("error")).toBeNull();
    const [account] = await accountsWithEmail(p.email);
    expect((await identitiesFor(p.sub))[0].userId).toBe(account.id);
  });

  test("refuses a Google account with a different email", async () => {
    const { p, client } = await signedInWithEmail();
    const { callback } = await link(client, { ...p, email: `other-${p.email}` });
    expect(location(callback).pathname).toBe("/app");
    expect(location(callback).searchParams.get("error")).toBeTruthy();
    expect(await identitiesFor(p.sub)).toHaveLength(0);
  });

  test("refuses a Google identity that already belongs to another Account", async () => {
    const owner = profile();
    await googleFlow(t.client(), owner);
    const { p: other, client } = await signedInWithEmail();
    const { callback } = await link(client, { ...owner, email: other.email });
    expect(location(callback).searchParams.get("error")).toBeTruthy();
    const [ownerAccount] = await accountsWithEmail(owner.email);
    const identities = await identitiesFor(owner.sub);
    expect(identities).toHaveLength(1);
    expect(identities[0].userId).toBe(ownerAccount.id);
  });

  test("linking requires a session", async () => {
    const response = await t.client().post("/link-social", { body: { provider: "google", callbackURL: "/app" } });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });
});
