import { afterAll, beforeAll, expect, test, vi } from "vitest";

let db: typeof import("./index").db;

beforeAll(async () => {
  // Synthetic, non-secret values; the pool is never asked for a connection.
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@db.test.invalid/tapcard");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-secret-not-used-anywhere-0123456789");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  ({ db } = await import("./index"));
});

afterAll(() => db.$client.end());

test("an idle-connection error (e.g. Neon scaling to zero) does not crash the process", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => db.$client.emit("error", new Error("Connection terminated unexpectedly"))).not.toThrow();
});
