import { expect, test } from "vitest";
import { clientIp } from "./client-ip";
test("Vercel's header wins", () => expect(clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "203.0.113.10" }))).toBe("203.0.113.9"));
test("forwarded addresses use the first trimmed value", () => expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9 , 203.0.113.10" }))).toBe("203.0.113.9"));
test("missing headers share the unknown bucket", () => expect(clientIp(new Headers())).toBe("unknown"));
