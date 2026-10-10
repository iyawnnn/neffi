import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { createdAt, timestamps } from "./columns";
import { orderItems, products } from "./commerce";
import { cardState, productKind } from "./enums";
import { profiles } from "./profiles";

// Cards received together, with their source and cost. Quantity is derived from its cards; its costs are
// reported as expenses from here, never copied.
export const stockPurchases = pgTable(
  "stock_purchases",
  {
    id: uuid().primaryKey().defaultRandom(),
    supplier: text(),
    receivedOn: date({ mode: "string" }).notNull(),
    purchaseCost: integer(),
    inboundShippingCost: integer(),
    reference: text(),
    notes: text(),
    createdByAccountId: uuid()
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
  },
  (t) => [
    check("stock_purchases_purchase_cost_nonnegative", sql`${t.purchaseCost} IS NULL OR ${t.purchaseCost} >= 0`),
    check(
      "stock_purchases_inbound_shipping_cost_nonnegative",
      sql`${t.inboundShippingCost} IS NULL OR ${t.inboundShippingCost} >= 0`,
    ),
  ],
);

// The physical card: the inventory unit. Inventory counts are derived from `state`. DBC-only columns
// (token, owner, profile, disabled) are guarded by kind; a GRC's review destination lives on its order item.
// Every CHECK is written NULL-safe: a CHECK that evaluates to NULL passes in Postgres.
export const cards = pgTable(
  "cards",
  {
    id: uuid().primaryKey().defaultRandom(),
    stockPurchaseId: uuid()
      .notNull()
      .references(() => stockPurchases.id),
    // Optional while a blank card is not yet committed to a product.
    productId: uuid(),
    // Copy of the product's kind, kept honest by the composite FK, so card-level guards can see it.
    kind: productKind(),
    state: cardState().notNull().default("blank"),
    orderItemId: uuid(),
    // Permanent public `/c/{token}` identifier. Public, so never proof of ownership.
    publicToken: text().unique("cards_public_token_unique"),
    ownerAccountId: uuid().references(() => accounts.id),
    profileId: uuid(),
    disabledAt: timestamp({ withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    foreignKey({ name: "cards_product_fk", columns: [t.productId, t.kind], foreignColumns: [products.id, products.kind] }),
    foreignKey({
      name: "cards_order_item_fk",
      columns: [t.orderItemId, t.productId],
      foreignColumns: [orderItems.id, orderItems.productId],
    }),
    // Card owner and profile owner must be the same Account.
    foreignKey({
      name: "cards_profile_owner_fk",
      columns: [t.profileId, t.ownerAccountId],
      foreignColumns: [profiles.id, profiles.accountId],
    }),
    check("cards_product_kind_together", sql`(${t.productId} IS NULL) = (${t.kind} IS NULL)`),
    check(
      "cards_dbc_only_fields",
      sql`COALESCE(${t.kind} = 'dbc', false) OR (${t.publicToken} IS NULL AND ${t.ownerAccountId} IS NULL AND ${t.profileId} IS NULL AND ${t.disabledAt} IS NULL)`,
    ),
    check("cards_committed_states_need_product", sql`${t.state} IN ('blank', 'retired') OR ${t.productId} IS NOT NULL`),
    check("cards_grc_never_ready", sql`NOT COALESCE(${t.kind} = 'grc' AND ${t.state} = 'ready', false)`),
    check(
      "cards_dbc_token_when_provisioned",
      sql`${t.kind} IS DISTINCT FROM 'dbc' OR ${t.state} IN ('blank', 'retired') OR ${t.publicToken} IS NOT NULL`,
    ),
    check(
      "cards_fulfillment_needs_order_item",
      sql`${t.state} NOT IN ('reserved', 'released') OR ${t.orderItemId} IS NOT NULL`,
    ),
    check("cards_stock_has_no_order_item", sql`${t.state} NOT IN ('blank', 'ready') OR ${t.orderItemId} IS NULL`),
    // Composite FKs skip their check when any column is NULL (MATCH SIMPLE); these close that gap.
    check("cards_order_item_needs_product", sql`${t.orderItemId} IS NULL OR ${t.productId} IS NOT NULL`),
    check("cards_profile_needs_owner", sql`${t.profileId} IS NULL OR ${t.ownerAccountId} IS NOT NULL`),
    check("cards_disabled_needs_owner", sql`${t.disabledAt} IS NULL OR ${t.ownerAccountId} IS NOT NULL`),
    // Ownership begins at activation of a sold card.
    check("cards_owner_only_after_sale", sql`${t.ownerAccountId} IS NULL OR ${t.state} IN ('released', 'retired')`),
    check("cards_retired_routes_nowhere", sql`${t.state} <> 'retired' OR ${t.profileId} IS NULL`),
    unique("cards_id_kind_unique").on(t.id, t.kind),
    index("cards_owner_account_id_idx").on(t.ownerAccountId).where(sql`${t.ownerAccountId} IS NOT NULL`),
    index("cards_profile_id_idx").on(t.profileId).where(sql`${t.profileId} IS NOT NULL`),
    index("cards_kind_state_idx").on(t.kind, t.state),
    index("cards_order_item_id_idx").on(t.orderItemId).where(sql`${t.orderItemId} IS NOT NULL`),
    index("cards_stock_purchase_id_idx").on(t.stockPurchaseId),
  ],
);

// One-time claim credential for a DBC. Only a keyed-hash lookup value is stored, never the code. State is
// derived: usable while both timestamps are NULL; used and revoked are final (activation_credentials_guard).
export const activationCredentials = pgTable(
  "activation_credentials",
  {
    id: uuid().primaryKey().defaultRandom(),
    cardId: uuid().notNull(),
    cardKind: productKind().notNull().default("dbc"),
    lookupHmac: text().notNull(),
    createdAt: createdAt(),
    usedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    foreignKey({ name: "activation_credentials_card_fk", columns: [t.cardId, t.cardKind], foreignColumns: [cards.id, cards.kind] }),
    check("activation_credentials_dbc_only", sql`${t.cardKind} = 'dbc'`),
    check("activation_credentials_lookup_hmac_format", sql`${t.lookupHmac} ~ '^[0-9a-f]{64}$'`),
    check("activation_credentials_single_outcome", sql`${t.usedAt} IS NULL OR ${t.revokedAt} IS NULL`),
    unique("activation_credentials_lookup_hmac_unique").on(t.lookupHmac),
    uniqueIndex("activation_credentials_one_usable_per_card")
      .on(t.cardId)
      .where(sql`${t.usedAt} IS NULL AND ${t.revokedAt} IS NULL`),
  ],
);
