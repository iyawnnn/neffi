import { describe, expect, test } from "vitest";
import { cardUrl, generateCardToken } from "./token";

describe("card token", () => {
  test("is 26 Crockford Base32 characters (130 bits) and effectively unique", () => {
    const tokens = Array.from({ length: 1000 }, generateCardToken);
    for (const token of tokens) expect(token).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(new Set(tokens).size).toBe(1000);
  });

  test("the card URL is the origin plus /c/token", () => {
    expect(cardUrl("https://x.test", "ABC")).toBe("https://x.test/c/ABC");
  });
});
