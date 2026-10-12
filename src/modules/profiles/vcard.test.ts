import { expect, test } from "vitest";
import type { ViewIdentity } from "./scene-view";
import { buildVCard, vCardFilename } from "./vcard";

const identity: ViewIdentity = { fullName: "Ana Cruz", initials: "AC", headline: "Designer", company: "Studio", bio: "private bio", phone: "+63 917 123 4567", email: "ana@e.test", website: "https://ana.example/", location: "Manila", accent: "#0C0C0D", onAccent: "#FFFFFF", image: null };
const unfold = (text: string) => text.replace(/\r\n /g, "");

test("vCard 3.0 with CRLF lines and only the public contact fields", () => {
  const card = buildVCard(identity);
  expect(card.endsWith("\r\n")).toBe(true);
  expect(card.replace(/\r\n/g, "")).not.toContain("\n");
  expect(card.split("\r\n").filter(Boolean)).toEqual([
    "BEGIN:VCARD", "VERSION:3.0", "FN:Ana Cruz", "N:;Ana Cruz;;;", "ORG:Studio", "TITLE:Designer",
    "TEL;TYPE=CELL:+63 917 123 4567", "EMAIL;TYPE=INTERNET:ana@e.test", "URL:https://ana.example/", "END:VCARD",
  ]);
  expect(card).not.toContain("private bio");
  expect(card).not.toContain("Manila");
});
test("absent fields are omitted, not left empty", () => {
  const lines = buildVCard({ ...identity, headline: null, company: null, phone: null, email: null, website: null }).split("\r\n").filter(Boolean);
  expect(lines).toEqual(["BEGIN:VCARD", "VERSION:3.0", "FN:Ana Cruz", "N:;Ana Cruz;;;", "END:VCARD"]);
});
test("text values are escaped so they cannot add properties", () => {
  const card = buildVCard({ ...identity, fullName: "Cruz, Ana; \\x", company: "A\r\nEND:VCARD\nBEGIN:VCARD" });
  expect(card).toContain("FN:Cruz\\, Ana\\; \\\\x");
  expect(card).toContain("ORG:A\\nEND:VCARD\\nBEGIN:VCARD");
  expect(card.split("\r\n").filter(line => line === "END:VCARD")).toHaveLength(1);
});
test("long lines fold at 75 octets without splitting a character", () => {
  const website = `https://ana.example/${"é".repeat(60)}`;
  const card = buildVCard({ ...identity, fullName: "名".repeat(40), website });
  for (const line of card.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(unfold(card)).toContain(`FN:${"名".repeat(40)}`);
  expect(unfold(card)).toContain(`URL:${website}`);
});
test.each([["Ana Cruz", "Ana-Cruz.vcf"], ["José Ñúñez", "Jose-Nunez.vcf"], ["名前", "contact.vcf"], ['a"b/c\\d', "abcd.vcf"]])("filename for %j is %j", (name, file) => {
  expect(vCardFilename(name)).toBe(file);
});
