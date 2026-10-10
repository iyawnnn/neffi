import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { accountRole } from "./enums";

// Better Auth persists into these tables directly; there is no second Account table. Its adapter looks up
// columns by Better Auth's logical field names, so those stay the JS keys (`userId` is the Neffi Account,
// `accountId` the provider's subject id) while the SQL names use Neffi's vocabulary.

// Better Auth model `user`: the permanent Neffi Account. `email` is the primary verified sign-in email.
export const accounts = pgTable("accounts", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: accountRole().notNull().default("customer"),
  ...timestamps(),
});

// Better Auth model `account`: an Authentication Identity (e.g. a linked Google subject).
export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    accountId: text("provider_account_id").notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps(),
  },
  (t) => [
    // A provider identity resolves to exactly one Account; Better Auth itself does not enforce this.
    uniqueIndex("auth_identities_provider_identity_unique").on(t.providerId, t.accountId),
    index("auth_identities_account_id_idx").on(t.userId),
  ],
);

// Better Auth model `session` (not a business object).
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    token: text().notNull().unique(),
    userId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    ...timestamps(),
  },
  (t) => [index("auth_sessions_account_id_idx").on(t.userId)],
);

// Better Auth model `verification`: short-lived challenges such as email OTPs (stored hashed in Milestone 3).
export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [index("auth_verifications_identifier_idx").on(t.identifier)],
);

// Better Auth model `rateLimit`: per-IP/path counters (database storage so limits survive across instances).
// Better Auth prunes rows older than its own longest window, so nothing with a longer window may live here.
export const authRateLimits = pgTable("auth_rate_limits", {
  id: uuid().primaryKey().defaultRandom(),
  key: text().notNull().unique("auth_rate_limits_key_unique"),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
});

// Per-email OTP send quota (3 per 10 minutes). Keyed by an HMAC of the lowercased email, never the email itself,
// and kept apart from `auth_rate_limits` so Better Auth's pruning cannot erase it.
export const authOtpQuotas = pgTable(
  "auth_otp_quotas",
  {
    key: text().primaryKey(),
    count: integer().notNull(),
    windowStartedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    check("auth_otp_quotas_count_positive", sql`${t.count} > 0`),
    check("auth_otp_quotas_key_hash", sql`${t.key} ~ '^[0-9a-f]{64}$'`),
  ],
);
