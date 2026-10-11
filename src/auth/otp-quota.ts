import { createHmac } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";

// Pure helpers (no server-only, no env): shared by the auth options and the database tests.

// Domain-separated keyed hash: the same secret protects OTP codes and quota keys without one being usable as the other.
export const hmacHex = (secret: string, domain: string, value: string) =>
  createHmac("sha256", secret).update(`${domain}:${value}`).digest("hex");

export const OTP_EMAIL_LIMIT = 3;
export const OTP_EMAIL_WINDOW_MS = 10 * 60_000;

type QuotaDb = { execute: (query: SQL) => Promise<unknown> };

// Counts one hit for an HMAC key and says whether it is still within `limit`. One atomic upsert, so concurrent
// requests cannot both slip under. Shared by every 10-minute counter (OTP email, activation); keys are
// domain-separated HMACs, never raw emails or IPs, and expired rows are removed in the same pass.
export async function consumeQuota(db: QuotaDb, key: string, limit: number, now = new Date()): Promise<boolean> {
  const windowStart = new Date(now.getTime() - OTP_EMAIL_WINDOW_MS);
  await db.execute(sql`delete from auth_otp_quotas where window_started_at <= ${windowStart.toISOString()}::timestamptz`);
  const result = (await db.execute(sql`
    insert into auth_otp_quotas (key, count, window_started_at)
    values (${key}, 1, ${now.toISOString()}::timestamptz)
    on conflict (key) do update set count = auth_otp_quotas.count + 1
    returning count
  `)) as { rows: { count: number }[] };
  return Number(result.rows[0].count) <= limit;
}

export const consumeOtpQuota = (db: QuotaDb, secret: string, email: string, now = new Date()) =>
  consumeQuota(db, hmacHex(secret, "otp-email", email.toLowerCase()), OTP_EMAIL_LIMIT, now);
