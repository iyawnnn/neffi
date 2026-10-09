import { describe, expect, test, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/db", () => ({ db: { execute } }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const { GET } = await import("./route");

// Per-call `*Once` mocks: with mockReset() in beforeEach, Vitest 5.0.3 failed the 503 test with the
// mocked error even though GET returned 503 (observed while writing this; mechanism not confirmed).
describe("GET /api/health", () => {
  test("reports ok when the database answers", async () => {
    execute.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", db: "ok" });
  });

  test("reports 503 without leaking the database error", async () => {
    execute.mockImplementationOnce(async () => {
      throw new Error("connect ECONNREFUSED ep-secret-host.neon.tech user=leaky");
    });
    const response = await GET();
    const body = await response.text();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(body)).toEqual({ status: "degraded", db: "unavailable" });
    expect(body).not.toContain("ep-secret-host");
  });
});
