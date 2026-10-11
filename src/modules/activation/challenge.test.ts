import { expect, test } from "vitest";
import { CHALLENGE_TTL_MS, signChallenge, verifyChallenge } from "./challenge";

const SECRET = "s".repeat(40);
const ID = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const OTHER = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const T0 = new Date("2026-10-11T00:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

test("returns the credential id until it expires", () => {
  const value = signChallenge(SECRET, ID, T0);
  expect(CHALLENGE_TTL_MS).toBe(15 * 60_000);
  expect(verifyChallenge(SECRET, value, T0)).toBe(ID);
  expect(verifyChallenge(SECRET, value, at(CHALLENGE_TTL_MS - 1))).toBe(ID);
  expect(verifyChallenge(SECRET, value, at(CHALLENGE_TTL_MS))).toBeNull();
});

test.each([
  ["missing", () => undefined],
  ["empty", () => ""],
  ["garbage", () => "not-a-challenge"],
  ["extended expiry", () => {
    const [id, , signature] = signChallenge(SECRET, ID, T0).split(".");
    return `${id}.${T0.getTime() + 10 * CHALLENGE_TTL_MS}.${signature}`;
  }],
  ["swapped id", () => signChallenge(SECRET, ID, T0).replace(ID, OTHER)],
  ["other secret", () => signChallenge("t".repeat(40), ID, T0)],
  ["non-numeric expiry", () => `${ID}.soon.${"0".repeat(64)}`],
])("rejects %s", (_name, value) => {
  expect(verifyChallenge(SECRET, value(), T0)).toBeNull();
});

test("carries only the opaque id, an expiry and a signature", () => {
  expect(signChallenge(SECRET, ID, T0)).toMatch(/^[0-9a-f-]{36}\.\d+\.[0-9a-f]{64}$/);
});

test("a malformed multibyte signature is rejected without throwing", () => {
  const [id, expiry] = signChallenge(SECRET, ID, T0).split(".");
  expect(verifyChallenge(SECRET, `${id}.${expiry}.${"é".repeat(64)}`, T0)).toBeNull();
});
