import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { createdAt, timestamps } from "./columns";
import { orders, purchasers } from "./commerce";
import { expenseCategory, supportCaseCardRole, supportCaseStatus, supportCaseType } from "./enums";
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
    index("support_cases_open_idx").on(t.status, t.createdAt).where(sql`${t.status} <> 'resolved'`),
    index("support_cases_order_id_idx").on(t.orderId).where(sql`${t.orderId} IS NOT NULL`),
    index("support_cases_account_id_idx").on(t.accountId).where(sql`${t.accountId} IS NOT NULL`),
    index("support_cases_purchaser_id_idx").on(t.purchaserId).where(sql`${t.purchaserId} IS NOT NULL`),
  ],
);

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
