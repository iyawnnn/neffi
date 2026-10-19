import { describe, expect, test } from "vitest";
import { hmacHex } from "@/auth/otp-quota";
import { activationLookup, formatActivationCode, generateActivationCode, normalizeActivationCode, sameLookup } from "./code";

const ALPHABET = /^[0-9A-HJKMNP-TV-Z]+$/;

describe("activation code", () => {
  test("is 8 Crockford Base32 characters with a digit and non-hex letter", () => {
    const codes = Array.from({ length: 1000 }, generateActivationCode);
    for (const code of codes) {
      expect(code).toHaveLength(8);
      expect(code).toMatch(ALPHABET);
      expect(code).toMatch(/\d/);
      expect(code).toMatch(/[G-HJ-KM-NP-TV-Z]/);
    }
    expect(new Set(codes).size).toBe(1000);
  });

  test("formats as two groups and normalizes case, spaces and hyphens back to the same code", () => {
    const code = generateActivationCode();
    const formatted = formatActivationCode(code);
    expect(formatted).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(normalizeActivationCode(formatted)).toBe(code);
    expect(normalizeActivationCode(` ${formatted.toLowerCase().replaceAll("-", " ")} `)).toBe(code);
  });

  test("maps look-alike characters and rejects anything else", () => {
    expect(normalizeActivationCode("n8kf-42pq")).toBe("N8KF42PQ");
    expect(normalizeActivationCode("OOOO-LLLL")).toBe("00001111");
    expect(normalizeActivationCode("N8KF42P")).toBeNull();
    expect(normalizeActivationCode("N8KF42PQQ")).toBeNull();
    expect(normalizeActivationCode("N8KF-42PQ-7XYZ-ABCD")).toBeNull();
    expect(normalizeActivationCode("TOO-SHOR")).toBeNull();
    expect(normalizeActivationCode("N8KF-42P!")).toBeNull();
    expect(normalizeActivationCode("N8KF-42PU")).toBeNull();
    expect(normalizeActivationCode("")).toBeNull();
  });

  test("lookup is a deterministic 64-hex keyed hash that differs per secret", () => {
    const code = "N8KF42PQ";
    const lookup = activationLookup("s".repeat(40), code);
    expect(lookup).toMatch(/^[0-9a-f]{64}$/);
    expect(lookup).toBe(activationLookup("s".repeat(40), code));
    expect(lookup).toBe(hmacHex("s".repeat(40), "activation", code));
    expect(lookup).not.toBe(activationLookup("t".repeat(40), code));
    expect(lookup).not.toContain(code);
  });
});

test("sameLookup compares in constant time and tolerates length mismatch", () => {
  expect(sameLookup("a".repeat(64), "a".repeat(64))).toBe(true);
  expect(sameLookup("a".repeat(64), "b".repeat(64))).toBe(false);
  expect(sameLookup("a".repeat(64), "a".repeat(63))).toBe(false);
});
