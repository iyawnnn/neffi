import { describe, expect, test } from "vitest";
import { hmacHex } from "@/auth/otp-quota";
import { activationLookup, formatActivationCode, generateActivationCode, normalizeActivationCode } from "./code";

const ALPHABET = /^[0-9A-HJKMNP-TV-Z]+$/;

describe("activation code", () => {
  test("is 16 Crockford Base32 characters and effectively unique", () => {
    const codes = Array.from({ length: 1000 }, generateActivationCode);
    for (const code of codes) {
      expect(code).toHaveLength(16);
      expect(code).toMatch(ALPHABET);
    }
    expect(new Set(codes).size).toBe(1000);
  });

  test("formats as four groups and normalizes case, spaces and hyphens back to the same code", () => {
    const code = generateActivationCode();
    const formatted = formatActivationCode(code);
    expect(formatted).toMatch(/^\w{4}-\w{4}-\w{4}-\w{4}$/);
    expect(normalizeActivationCode(formatted)).toBe(code);
    expect(normalizeActivationCode(` ${formatted.toLowerCase().replaceAll("-", " ")} `)).toBe(code);
  });

  test("maps look-alike characters and rejects anything else", () => {
    expect(normalizeActivationCode("abcd-efgh ijkm-np0q")).toBe("ABCDEFGH1JKMNP0Q");
    expect(normalizeActivationCode("OOOO-LLLL-IIII-1111")).toBe("0000111111111111");
    expect(normalizeActivationCode("TOO-SHORT")).toBeNull();
    expect(normalizeActivationCode("ABCD-EFGH-JKMN-PQR!")).toBeNull();
    expect(normalizeActivationCode("ABCD-EFGH-JKMN-PQRSU")).toBeNull();
    expect(normalizeActivationCode("")).toBeNull();
  });

  test("lookup is a deterministic 64-hex keyed hash that differs per secret", () => {
    const code = "ABCDEFGH1JKMNP0Q";
    const lookup = activationLookup("s".repeat(40), code);
    expect(lookup).toMatch(/^[0-9a-f]{64}$/);
    expect(lookup).toBe(activationLookup("s".repeat(40), code));
    expect(lookup).toBe(hmacHex("s".repeat(40), "activation", code));
    expect(lookup).not.toBe(activationLookup("t".repeat(40), code));
    expect(lookup).not.toContain(code);
  });
});
