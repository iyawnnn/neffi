import { beforeAll, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { authOtpQuotas } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/testing";
import { consumeQuota, hmacHex, OTP_EMAIL_WINDOW_MS, QUOTA_RETENTION_MS, pruneQuotas } from "./otp-quota";

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

const day = 24 * 60 * 60_000;
test("daily keys retain their count beyond ten minutes and reset after a day", async () => {
  const now = new Date("2026-10-12T00:00:00Z");
  const daily = key("daily");
  expect(await consumeQuota(db, daily, 2, now, { windowMs: day })).toBe(true);
  expect(await consumeQuota(db, daily, 2, new Date(+now + 11 * 60_000), { windowMs: day })).toBe(true);
  expect(await consumeQuota(db, daily, 2, new Date(+now + 12 * 60_000), { windowMs: day })).toBe(false);
  expect(await consumeQuota(db, daily, 2, new Date(+now + day), { windowMs: day })).toBe(true);
});

test("windows longer than retention fail before changing quota state", async () => {
  expect(QUOTA_RETENTION_MS).toBe(day);
  await expect(consumeQuota(db, key("too-long"), 1, new Date(), { windowMs: day + 1 })).rejects.toThrow();
  expect(await db.select().from(authOtpQuotas).where(eq(authOtpQuotas.key, key("too-long")))).toHaveLength(0);
});

test.each(["helper", "default"])("%s cleanup removes rows beyond retention", async (mode) => {
  const now = new Date("2026-10-15T00:00:00Z");
  const expired = key(`expired-${mode}`);
  await db.insert(authOtpQuotas).values({ key: expired, count: 1, windowStartedAt: new Date(+now - day - 1) });
  if (mode === "helper") await pruneQuotas(db, now);
  else await consumeQuota(db, key("default-cleanup"), 1, now);
  expect(await db.select().from(authOtpQuotas).where(eq(authOtpQuotas.key, expired))).toHaveLength(0);
});

test("prune false retains expired rows while the atomic upsert resets its own window", async () => {
  const now = new Date("2026-10-15T01:00:00Z");
  const expired = key("keep-expired"), active = key("reset-without-prune");
  await db.insert(authOtpQuotas).values({ key: expired, count: 1, windowStartedAt: new Date(+now - day - 1) });
  await consumeQuota(db, active, 1, now, { prune: false });
  expect(await consumeQuota(db, active, 1, now, { prune: false })).toBe(false);
  expect(await consumeQuota(db, active, 1, new Date(+now + OTP_EMAIL_WINDOW_MS), { prune: false })).toBe(true);
  expect(await db.select().from(authOtpQuotas).where(eq(authOtpQuotas.key, expired))).toHaveLength(1);
});
