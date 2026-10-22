import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "./route";

beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", ""); });
afterEach(() => vi.unstubAllEnvs());

test("returns a synthetic image id only during local development", async () => {
  const response = await POST();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ public_id: "synthetic-image" });
});
test.each([["production", ""], ["test", ""], ["development", "preview"], ["development", "production"]])("refuses %s/%s", async (node, vercel) => {
  vi.stubEnv("NODE_ENV", node);
  vi.stubEnv("VERCEL_ENV", vercel);
  expect((await POST()).status).toBe(404);
});
