import { expect, test } from "vitest";
import { ACCENTS, identitySchema, LIMITS, publishGaps } from "./rules";

test("identity trims, blanks become null, links normalize, bad contacts are rejected", () => {
  const parsed = identitySchema.parse({ fullName: "  Ana  ", headline: "", company: " ", bio: "Hi", phone: "+63 917 123 4567", email: "ANA@Example.test", website: "ana.example", location: "" });
  expect(parsed).toEqual({ fullName: "Ana", headline: null, company: null, bio: "Hi", phone: "+63 917 123 4567", email: "ana@example.test", website: "https://ana.example/", location: null });
  for (const bad of [{ fullName: "" }, { phone: "call me" }, { email: "nope" }, { website: "javascript:alert(1)" }, { bio: "x".repeat(301) }]) {
    expect(identitySchema.safeParse({ fullName: "Ana", headline: "", company: "", bio: "", phone: "", email: "", website: "", location: "", ...bad }).success).toBe(false);
  }
});

test("publishing needs a name, a way to reach you and something to show", () => {
  expect(publishGaps({ fullName: "Ana", phone: null, email: "a@e.test", website: null, visibleDefaultBlocks: 1 })).toEqual([]);
  expect(publishGaps({ fullName: null, phone: null, email: null, website: null, visibleDefaultBlocks: 0 })).toEqual(["name", "contact", "content"]);
});

test("limits and the accent palette are fixed", () => {
  expect(LIMITS).toEqual({ profilesPerAccount: 10, scenesPerProfile: 5, blocksPerScene: 20, formsPerProfile: 5 });
  expect(ACCENTS).toHaveLength(8);
  for (const accent of ACCENTS) expect(accent.hex).toMatch(/^#[0-9A-F]{6}$/);
});
