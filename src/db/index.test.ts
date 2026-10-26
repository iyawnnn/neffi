import { afterAll, beforeAll, expect, test, vi } from "vitest";

let db: typeof import("./index").db;

beforeAll(async () => {
  // Synthetic, non-secret values; the pool is never asked for a connection.
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@db.test.invalid/tapcard");
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
  ({ db } = await import("./index"));
});

afterAll(() => db.$client.end());

test("an idle-connection error (e.g. Neon scaling to zero) does not crash the process", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => db.$client.emit("error", new Error("Connection terminated unexpectedly"))).not.toThrow();
});
