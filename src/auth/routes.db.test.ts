import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { accounts, authIdentities, authRateLimits, authOtpQuotas } from "@/db/schema";
import { createTestAuth, signInWithEmail, type TestAuth } from "./test-auth";

let t: TestAuth;
beforeAll(async () => {
  t = await createTestAuth();
});

// The only HTTP routes M3 exposes. Anything else answers 404, including routes a future Better Auth upgrade adds.
const ALLOWED = [
  "/ok",
  "/sign-in/social",
  "/callback/:id",
  "/link-social",
  "/sign-in/email-otp",
  "/email-otp/send-verification-otp",
  "/sign-out",
];

type Endpoint = { path?: string; options?: { method?: string | string[] } };
const endpoints = (): { path: string; method: string }[] =>
  (Object.values(t.auth.api) as Endpoint[])
    .filter((endpoint) => typeof endpoint.path === "string")
    .map((endpoint) => {
      const method = endpoint.options?.method;
      const first = Array.isArray(method) ? method[0] : method;
      return { path: endpoint.path as string, method: !first || first === "*" ? "POST" : first };
    });

describe("exposed auth routes", () => {
  test("arbitrary unknown auth paths return 404 without creating rate-limit rows", async () => {
    await t.db.insert(authRateLimits).values({ key: "stale-counter-on-denied-request", count: 1, lastRequest: Date.now() - 3_600_000 });
    const before = await t.db.select().from(authRateLimits);
    const client = t.client();
    for (const path of ["/random-one", "/random-two", "/reset-password/random-token", "/ok/extra", "/**", "/", ""]) {
      expect((await client.get(path)).status).toBe(404);
    }
    expect(await t.db.select().from(authRateLimits)).toEqual(before);
  });

  test("a new allowed request removes abandoned stale rate-limit rows", async () => {
    const key = "abandoned-rate-key";
    const activeKey = "active-rate-key";
    const quotaKey = "f".repeat(64);
    await t.db.insert(authRateLimits).values({ key, count: 1, lastRequest: Date.now() - 3_600_000 });
    await t.db.insert(authRateLimits).values({ key: activeKey, count: 9, lastRequest: Date.now() });
    await t.db.insert(authOtpQuotas).values({ key: quotaKey, count: 3, windowStartedAt: new Date() });
    expect((await t.client().get("/ok")).status).toBe(200);
    expect(await t.db.select().from(authRateLimits).where(eq(authRateLimits.key, key))).toHaveLength(0);
    expect(await t.db.select().from(authRateLimits).where(eq(authRateLimits.key, activeKey))).toMatchObject([{ count: 9 }]);
    expect(await t.db.select().from(authOtpQuotas).where(eq(authOtpQuotas.key, quotaKey))).toMatchObject([{ count: 3 }]);
  });

  test("Google sign-in preserves Better Auth's three-per-ten-second IP limit", async () => {
    const client = t.client();
    for (let attempt = 0; attempt < 3; attempt++) {
      expect((await client.post("/sign-in/social", { body: { provider: "google", callbackURL: "/app" } })).status).toBe(200);
    }
    expect((await client.post("/sign-in/social", { body: { provider: "google", callbackURL: "/app" } })).status).toBe(429);
  });

  test("every HTTP route is on the allowlist or answers 404", async () => {
    const found = endpoints();
    expect(found.length).toBeGreaterThan(20);
    const exposed: string[] = [];
    for (const { path, method } of found) {
      const response = await t.client().call(method, path.replace(/:\w+/g, "x"), { body: method === "GET" ? undefined : {} });
      if (response.status !== 404) exposed.push(path);
    }
    expect(exposed.sort()).toEqual([...ALLOWED].sort());
  });

  test("the password-reset flow cannot create a password identity", async () => {
    const email = "reset@example.test";
    await signInWithEmail(t, t.client(), email);
    for (const [path, body] of [
      ["/email-otp/reset-password", { email, otp: "000000", password: "hunter2hunter2" }],
      ["/email-otp/request-password-reset", { email }],
      ["/forget-password/email-otp", { email }],
      ["/request-password-reset", { email }],
      ["/reset-password", { newPassword: "hunter2hunter2", token: "x" }],
    ] as const) {
      expect((await t.client().post(path, { body })).status, path).toBe(404);
    }
    expect((await t.client().get("/reset-password/sometoken?callbackURL=/app")).status).toBe(404);
    const [account] = await t.db.select().from(accounts).where(eq(accounts.email, email));
    const identities = await t.db.select().from(authIdentities).where(eq(authIdentities.userId, account.id));
    expect(identities.filter((i) => i.providerId === "credential")).toHaveLength(0);
  });

  test("a signed-in customer cannot promote themselves", async () => {
    const email = "promote@example.test";
    const client = t.client();
    await signInWithEmail(t, client, email);
    for (const path of ["/update-user", "/change-email"]) {
      expect((await client.post(path, { body: { role: "owner", name: "x", newEmail: "new@example.test" } })).status, path).toBe(404);
    }
    const [account] = await t.db.select().from(accounts).where(eq(accounts.email, email));
    expect(account.role).toBe("customer");
  });
});

describe("origin and callback protections (kept from M1)", () => {
  test("rejects cookie-bearing requests from untrusted origins", async () => {
    const client = t.client();
    await signInWithEmail(t, client, "origin@example.test");
    const response = await client.post("/sign-out", { body: {}, origin: "https://evil.example" });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "INVALID_ORIGIN" });
  });

  test.each([
    ["callbackURL", { callbackURL: "https://evil.example/cb" }],
    ["errorCallbackURL", { callbackURL: "/app", errorCallbackURL: "https://evil.example/e" }],
    ["newUserCallbackURL", { callbackURL: "/app", newUserCallbackURL: "https://evil.example/n" }],
  ])("rejects an untrusted %s", async (_name, extra) => {
    const response = await t.client().post("/sign-in/social", { body: { provider: "google", ...extra } });
    expect(response.status).toBe(403);
  });

  test("an unknown provider is not found", async () => {
    const response = await t.client().post("/sign-in/social", { body: { provider: "github", callbackURL: "/app" } });
    expect(response.status).toBe(404);
  });

  test("email/password sign-up stays off", async () => {
    const response = await t.client().post("/sign-up/email", {
      body: { email: "a@example.test", password: "p".repeat(12), name: "A" },
    });
    expect(response.status).toBe(404);
  });
});

describe("role assignment", () => {
  test("no Account-creation path can choose a role, even a server-side one", async () => {
    const { internalAdapter } = await t.auth.$context;
    const user = await internalAdapter.createUser(
      { name: "Sneaky", email: "sneaky@example.test", emailVerified: true, role: "owner" },
      { method: "admin" },
    );
    const [account] = await t.db.select().from(accounts).where(eq(accounts.id, user.id));
    expect(account.role).toBe("customer");
  });

  test("no Account-creation path accepts an unverified email", async () => {
    const { internalAdapter } = await t.auth.$context;
    const created = await internalAdapter
      .createUser({ name: "Unverified", email: "unverified@example.test", emailVerified: false }, { method: "admin" })
      .catch(() => null);
    expect(created).toBeFalsy();
    expect(await t.db.select().from(accounts).where(eq(accounts.email, "unverified@example.test"))).toHaveLength(0);
  });
});
