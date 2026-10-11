import { beforeAll, expect, test } from "vitest";
import { createTestDb, type TestDb } from "@/db/testing";
import { consumeQuota, hmacHex, OTP_EMAIL_WINDOW_MS } from "./otp-quota";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const key = (value: string) => hmacHex("k".repeat(40), "activation-ip", value);

test("allows exactly `limit` hits per key within one window", async () => {
  const now = new Date("2026-10-11T00:00:00Z");
  const results = await Promise.all(Array.from({ length: 5 }, () => consumeQuota(db, key("198.51.100.1"), 3, now)));
  expect(results.filter(Boolean)).toHaveLength(3);
});

test("keys are independent", async () => {
  const now = new Date("2026-10-11T01:00:00Z");
  for (let i = 0; i < 3; i++) await consumeQuota(db, key("198.51.100.2"), 3, now);
  expect(await consumeQuota(db, key("198.51.100.2"), 3, now)).toBe(false);
  expect(await consumeQuota(db, key("198.51.100.3"), 3, now)).toBe(true);
});

test("a new window starts after the old one expires", async () => {
  const now = new Date("2026-10-11T02:00:00Z");
  for (let i = 0; i < 4; i++) await consumeQuota(db, key("198.51.100.4"), 3, now);
  expect(await consumeQuota(db, key("198.51.100.4"), 3, new Date(now.getTime() + OTP_EMAIL_WINDOW_MS + 1))).toBe(true);
});
