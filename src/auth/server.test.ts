import { beforeAll, describe, expect, test, vi } from "vitest";

// Synthetic, non-secret values: the shell never touches a database.
const BASE_URL = "http://localhost:3000";

let auth: typeof import("./server").auth;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@db.test.invalid/tapcard");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-secret-not-used-anywhere-0123456789");
  vi.stubEnv("BETTER_AUTH_URL", BASE_URL);
  ({ auth } = await import("./server"));
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL, ...headers },
      body: JSON.stringify(body),
    }),
  );

describe("Better Auth foundation shell", () => {
  test("answers the health endpoint", async () => {
    const response = await auth.handler(new Request(`${BASE_URL}/api/auth/ok`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("offers no email/password sign-up", async () => {
    const response = await post("/sign-up/email", { email: "a@example.test", password: "p".repeat(12), name: "A" });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test("offers no social sign-in provider", async () => {
    const response = await post("/sign-in/social", { provider: "google" });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test("rejects cookie-bearing requests from untrusted origins", async () => {
    const response = await post("/sign-out", {}, { origin: "https://evil.example", cookie: "x=1" });
    expect(response.status).toBe(403);
  });

  test("rejects callback URLs outside the trusted origins", async () => {
    const response = await post("/sign-in/social", { provider: "google", callbackURL: "https://evil.example/cb" });
    expect(response.status).toBe(403);
  });
});
