import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
