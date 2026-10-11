import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CHALLENGE_TTL_MS, signChallenge } from "@/modules/activation/challenge";

const m = vi.hoisted(() => ({ connection: vi.fn(), cookies: vi.fn() }));
vi.mock("next/server", () => ({ connection: m.connection }));
vi.mock("next/headers", () => ({ cookies: m.cookies }));
vi.mock("@/config/env", () => ({ env: { activationCodeSecret: "s".repeat(40) } }));

import { readChallenge } from "./challenge-cookie";

const SECRET = "s".repeat(40);
const ID = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const NOW = new Date("2026-10-11T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

test.each([
  ["valid", signChallenge(SECRET, ID, NOW), ID],
  ["expired", signChallenge(SECRET, ID, new Date(NOW.getTime() - CHALLENGE_TTL_MS)), null],
  ["missing", undefined, null],
  ["tampered", signChallenge("t".repeat(40), ID, NOW), null],
])("waits for request time before verifying a %s cookie", async (_name, value, expected) => {
  const request = Promise.withResolvers<void>();
  m.connection.mockReturnValue(request.promise);
  m.cookies.mockResolvedValue({
    get: (name: string) => name === "neffi_activation" && value ? { value } : undefined,
  });

  let settled = false;
  const result = readChallenge().then((id) => {
    settled = true;
    return id;
  });
  // Cookies are already available in a runtime prerender; request time is not.
  await Promise.resolve();
  await Promise.resolve();
  expect(settled).toBe(false);

  request.resolve();
  expect(await result).toBe(expected);
});
