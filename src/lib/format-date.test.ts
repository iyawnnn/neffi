import { expect, test } from "vitest";
import { formatDateTime } from "./format-date";
test("formats an absolute date in Manila time", () => expect(formatDateTime(new Date("2026-10-11T04:05:00Z"))).toBe("Oct 11, 2026, 12:05 PM"));
