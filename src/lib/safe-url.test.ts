import { expect, test } from "vitest";
import { normalizeLink } from "./safe-url";

test.each([
  ["example.com", "https://example.com/"],
  ["  https://cal.com/ana  ", "https://cal.com/ana"],
  ["www.linkedin.com/in/ana", "https://www.linkedin.com/in/ana"],
])("accepts %j", (raw, expected) => expect(normalizeLink(raw)).toBe(expected));

test.each(["", "http://example.com", "javascript:alert(1)", "data:text/html,x", "mailto:a@b.c", "https://user:pw@example.com", "https://", `https://e.com/${"a".repeat(2050)}`, "ftp://e.com"])(
  "rejects %j",
  (raw) => expect(normalizeLink(raw)).toBeNull(),
);
