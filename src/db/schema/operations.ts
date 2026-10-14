import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { createdAt, timestamps } from "./columns";
import { orders, purchasers } from "./commerce";
import { expenseCategory, supportCaseCardRole, supportCaseSource, supportCaseStatus, supportCaseType } from "./enums";
import { cards, stockPurchases } from "./inventory";

// Manually entered costs only. Stock-purchase and courier costs stay on their source rows and are combined
// in expense reporting, so the same amount is never stored twice.
export const expenses = pgTable(
  "expenses",
  {
    id: uuid().primaryKey().defaultRandom(),
    spentOn: date({ mode: "string" }).notNull(),
    amount: integer().notNull(),
    category: expenseCategory().notNull(),
    payee: text(),
    note: text(),
    orderId: uuid().references(() => orders.id),
    createdByAccountId: uuid()
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
  },
  (t) => [
    check("expenses_amount_positive", sql`${t.amount} > 0`),
    index("expenses_spent_on_idx").on(t.spentOn),
    index("expenses_order_id_idx").on(t.orderId).where(sql`${t.orderId} IS NOT NULL`),
  ],
);

// The single exception layer (replacement, shipping issue, recovery, ownership correction, ...).
export const supportCases = pgTable(
  "support_cases",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: supportCaseType().notNull(),
    status: supportCaseStatus().notNull().default("open"),
    summary: text().notNull(),
    source: supportCaseSource().notNull().default("owner"),
    requesterEmail: text(),
    requesterName: text(),
    requesterMessage: text(),
    clientKey: uuid(),
    purchaserId: uuid().references(() => purchasers.id),
    accountId: uuid().references(() => accounts.id),
    orderId: uuid().references(() => orders.id),
    assignedToAccountId: uuid().references(() => accounts.id),
    // Empty for public submissions from someone who cannot sign in.
    openedByAccountId: uuid().references(() => accounts.id),
    ...timestamps(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check("support_cases_resolved_at_matches_status", sql`(${t.status} = 'resolved') = (${t.resolvedAt} IS NOT NULL)`),
    check("support_cases_public_contact", sql`${t.source} <> 'public' OR (${t.requesterEmail} IS NOT NULL AND ${t.openedByAccountId} IS NULL)`),
    check("support_cases_requester_email", sql`${t.requesterEmail} = lower(${t.requesterEmail}) AND length(${t.requesterEmail}) <= 254`),
    check("support_cases_requester_name", sql`length(${t.requesterName}) <= 100`),
    check("support_cases_requester_message", sql`length(${t.requesterMessage}) <= 2000`),
    uniqueIndex("support_cases_client_key_unique").on(t.clientKey).where(sql`${t.clientKey} IS NOT NULL`),
    index("support_cases_source_status_idx").on(t.source, t.status),
    index("support_cases_public_ack_idx").on(t.requesterEmail, t.createdAt).where(sql`${t.source} = 'public'`),
    index("support_cases_open_idx").on(t.status, t.createdAt).where(sql`${t.status} <> 'resolved'`),
    index("support_cases_order_id_idx").on(t.orderId).where(sql`${t.orderId} IS NOT NULL`),
    index("support_cases_account_id_idx").on(t.accountId).where(sql`${t.accountId} IS NOT NULL`),
    index("support_cases_purchaser_id_idx").on(t.purchaserId).where(sql`${t.purchaserId} IS NOT NULL`),
  ],
);

export const accountRecoveries = pgTable("account_recoveries", {
  id: uuid().primaryKey().defaultRandom(),
  supportCaseId: uuid().notNull().references(() => supportCases.id),
  accountId: uuid().notNull().references(() => accounts.id),
  oldEmail: text().notNull(),
  newEmail: text().notNull(),
  codeHmac: text().notNull(),
  attempts: integer().notNull().default(0),
  status: text().$type<"pending" | "completed" | "cancelled">().notNull().default("pending"),
  unlinkGoogle: boolean().notNull().default(true),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdByAccountId: uuid().notNull().references(() => accounts.id),
  ...timestamps(),
  completedAt: timestamp({ withTimezone: true }),
  cancelledAt: timestamp({ withTimezone: true }),
}, t => [
  check("account_recoveries_new_email", sql`${t.newEmail} = lower(${t.newEmail}) AND length(${t.newEmail}) <= 254`),
  check("account_recoveries_code_hmac", sql`${t.codeHmac} ~ '^[0-9a-f]{64}$'`),
  check("account_recoveries_attempts", sql`${t.attempts} BETWEEN 0 AND 3`),
  check("account_recoveries_status", sql`${t.status} IN ('pending', 'completed', 'cancelled')`),
  uniqueIndex("account_recoveries_pending_account_unique").on(t.accountId).where(sql`${t.status} = 'pending'`),
  uniqueIndex("account_recoveries_pending_email_unique").on(t.newEmail).where(sql`${t.status} = 'pending'`),
]);

export const supportCaseCards = pgTable(
  "support_case_cards",
  {
    supportCaseId: uuid()
      .notNull()
      .references(() => supportCases.id),
    cardId: uuid()
      .notNull()
      .references(() => cards.id),
    role: supportCaseCardRole().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.supportCaseId, t.cardId] }), index("support_case_cards_card_id_idx").on(t.cardId)],
);

// Meaningful history (not UI noise), with explicit subject links rather than a polymorphic reference.
// Owner internal notes are events of type `note`. Types are validated in the activity module.
export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: text().notNull(),
    actorAccountId: uuid().references(() => accounts.id),
    orderId: uuid().references(() => orders.id),
    cardId: uuid().references(() => cards.id),
    accountId: uuid().references(() => accounts.id),
    supportCaseId: uuid().references(() => supportCases.id),
    stockPurchaseId: uuid().references(() => stockPurchases.id),
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "activity_events_has_subject",
      sql`num_nonnulls(${t.orderId}, ${t.cardId}, ${t.accountId}, ${t.supportCaseId}, ${t.stockPurchaseId}) >= 1`,
    ),
    index("activity_events_order_id_idx").on(t.orderId, t.createdAt).where(sql`${t.orderId} IS NOT NULL`),
    index("activity_events_card_id_idx").on(t.cardId, t.createdAt).where(sql`${t.cardId} IS NOT NULL`),
    index("activity_events_account_id_idx").on(t.accountId, t.createdAt).where(sql`${t.accountId} IS NOT NULL`),
    index("activity_events_support_case_id_idx")
      .on(t.supportCaseId, t.createdAt)
      .where(sql`${t.supportCaseId} IS NOT NULL`),
    index("activity_events_created_at_idx").on(t.createdAt.desc()),
  ],
);
