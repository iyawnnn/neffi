import { expect, test } from "vitest";
import { clientIp } from "./client-ip";
test("Vercel's header wins", () => expect(clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "203.0.113.10" }))).toBe("203.0.113.9"));
test("forwarded addresses use the first trimmed value", () => expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9 , 203.0.113.10" }))).toBe("203.0.113.9"));
test("missing headers share the unknown bucket", () => expect(clientIp(new Headers())).toBe("unknown"));

const forwarded = (ip: string) => clientIp(new Headers({ "x-forwarded-for": ip }));

test("IPv6 addresses in one /64 share a canonical quota key", () => {
  expect(forwarded("2001:db8:1234:5678::1")).toBe("2001:db8:1234:5678::");
  expect(forwarded("2001:0db8:1234:5678:abcd:1234:5678:ffff")).toBe(forwarded("2001:db8:1234:5678::1"));
  expect(forwarded("2001:db8:1234:5679::1")).not.toBe(forwarded("2001:db8:1234:5678::1"));
});

test("compressed and expanded IPv6 forms share the same /64 key", () => {
  expect(forwarded("2001:db8::1")).toBe(forwarded("2001:0DB8:0000:0000:0000:0000:0000:0002"));
});

test.each(["::ffff:192.0.2.128", "::ffff:c000:0280", "0:0:0:0:0:ffff:c000:280"])("mapped IPv4 %s shares its plain IPv4 key", (ip) => {
  expect(forwarded(ip)).toBe(forwarded("192.0.2.128"));
});
