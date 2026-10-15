import { createHmac } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";

// Pure helpers (no server-only, no env): shared by the auth options and the database tests.

// Domain-separated keyed hash: the same secret protects OTP codes and quota keys without one being usable as the other.
export const hmacHex = (secret: string, domain: string, value: string) =>
  createHmac("sha256", secret).update(`${domain}:${value}`).digest("hex");

export const OTP_EMAIL_LIMIT = 3;
export const OTP_EMAIL_WINDOW_MS = 10 * 60_000;
export const QUOTA_RETENTION_MS = 24 * 60 * 60_000;

type QuotaDb = { execute: (query: SQL) => Promise<unknown> };

// shortcut: cleanup scans the quota table; add a window_started_at index above about 10k rows.
export async function pruneQuotas(db: QuotaDb, now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - QUOTA_RETENTION_MS);
  await db.execute(sql`delete from auth_otp_quotas where key in (
    select key from auth_otp_quotas where window_started_at <= ${cutoff.toISOString()}::timestamptz
    for update skip locked
  )`);
}

// Keys are domain-separated HMACs with one window per key. The atomic upsert resets expired windows.
export async function consumeQuota(db: QuotaDb, key: string, limit: number, now = new Date(), { windowMs = OTP_EMAIL_WINDOW_MS, prune = true } = {}): Promise<boolean> {
  if (windowMs > QUOTA_RETENTION_MS) throw new Error("Quota window exceeds retention");
  if (prune) await pruneQuotas(db, now);
  const windowStart = new Date(now.getTime() - windowMs);
  const result = (await db.execute(sql`
    insert into auth_otp_quotas (key, count, window_started_at)
    values (${key}, 1, ${now.toISOString()}::timestamptz)
    on conflict (key) do update set
      count = case when auth_otp_quotas.window_started_at <= ${windowStart.toISOString()}::timestamptz then 1 else auth_otp_quotas.count + 1 end,
      window_started_at = case when auth_otp_quotas.window_started_at <= ${windowStart.toISOString()}::timestamptz then excluded.window_started_at else auth_otp_quotas.window_started_at end
    returning count
  `)) as { rows: { count: number }[] };
  return Number(result.rows[0].count) <= limit;
}

export const consumeOtpQuota = (db: QuotaDb, secret: string, email: string, now = new Date()) =>
  consumeQuota(db, hmacHex(secret, "otp-email", email.toLowerCase()), OTP_EMAIL_LIMIT, now);
