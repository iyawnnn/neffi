import { expect, test } from "vitest";
import { formatInboxDate } from "./inbox-date";

test.each([
  { date: "2026-10-18T04:16:00Z", now: "2026-10-18T05:00:00Z", expected: "12:16 PM" },
  { date: "2026-10-17T16:05:00Z", now: "2026-10-18T05:00:00Z", expected: "12:05 AM" },
  { date: "2026-10-17T04:00:00Z", now: "2026-10-18T05:00:00Z", expected: "Yesterday" },
  { date: "2026-10-16T04:00:00Z", now: "2026-10-18T05:00:00Z", expected: "Oct 16" },
  { date: "2025-10-16T04:00:00Z", now: "2026-10-18T05:00:00Z", expected: "Oct 16, 2025" },
  { date: "2025-12-31T04:00:00Z", now: "2026-01-01T05:00:00Z", expected: "Yesterday" },
])("$date relative to $now uses Manila list formatting", ({ date, now, expected }) => {
  expect(formatInboxDate(new Date(date), new Date(now))).toBe(expected);
});
