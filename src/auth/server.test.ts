import { beforeAll, expect, test, vi } from "vitest";

// Synthetic, non-secret values. The HTTP behavior of the auth instance is covered against PGlite in the
// *.db.test.ts files; this only proves the production wiring (env -> options) assembles.
beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@db.test.invalid/neffi");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-secret-not-used-anywhere-0123456789");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("GOOGLE_CLIENT_ID", "synthetic-google-client-id.apps.example.test");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "synthetic-google-client-secret");
  vi.stubEnv("RESEND_API_KEY", "re_synthetic_key_not_real");
  vi.stubEnv("AUTH_EMAIL_FROM", "Neffi <auth@example.test>");
  vi.stubEnv("ACTIVATION_CODE_SECRET", "a".repeat(40));
  vi.stubEnv("ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID", "test-v1");
  vi.stubEnv("ACTIVATION_CODE_ENCRYPTION_KEYS", JSON.stringify({ "test-v1": Buffer.alloc(32, 7).toString("base64") }));
  vi.stubEnv("CARD_URL_ORIGIN", "http://localhost:3000");
});

test("the production auth instance assembles from validated environment", async () => {
  const { auth } = await import("./server");
  expect(auth.handler).toBeTypeOf("function");
  expect(auth.api.getSession).toBeTypeOf("function");
  const context = await auth.$context;
  expect(context.options.trustedOrigins).toEqual(["http://localhost:3000"]);
  expect(context.options.emailAndPassword?.enabled).toBe(false);
  expect(context.options.account?.accountLinking?.disableImplicitLinking).toBe(true);
  expect(context.options.telemetry?.enabled).toBe(false);
});
