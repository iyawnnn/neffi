import { encode } from "uqr";
import { expect, test } from "vitest";
import { qrSvgDataUri } from "./qr";

test("the Sharing QR is an SVG picture of exactly the card's permanent URL", () => {
  const url = "https://tap.example.test/c/AAAAAAAAAAAAAAAAAAAAAAAAAA";
  const uri = qrSvgDataUri(url);
  expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
  expect(decodeURIComponent(uri.slice(uri.indexOf(",") + 1))).toContain("<svg");
  // Same input, same symbol: the QR is derived, not stored.
  expect(qrSvgDataUri(url)).toBe(uri);
  expect(encode(url, { ecc: "M" }).size).toBeGreaterThan(20);
});
