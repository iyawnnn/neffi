import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { createdAt, timestamps } from "./columns";
import { deliveryMethod, orderStatus, paymentMethod, productKind, shipmentStatus } from "./enums";
import { supportCases } from "./operations";

// Money is integer centavos (PHP). Totals, amounts paid, balances and payment state are derived, never stored.

export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: productKind().notNull(),
    name: text().notNull(),
    // Current catalog price; Order Items keep their own snapshot.
    price: integer().notNull(),
    active: boolean().notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    check("products_price_nonnegative", sql`${t.price} >= 0`),
    unique("products_id_kind_unique").on(t.id, t.kind),
  ],
);

// The commercial buyer. Deliberately unrelated to `accounts`: buying never grants digital ownership.
export const purchasers = pgTable("purchasers", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  contactNumber: text(),
  ...timestamps(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Human order reference.
    number: integer().notNull().unique().generatedAlwaysAsIdentity({ startWith: 1001 }),
    purchaserId: uuid()
      .notNull()
      .references(() => purchasers.id),
    // Stored lifecycle state. `completed` is written only by the system after deriving eligibility from
    // fulfillment + zero balance, and is final (orders_guard trigger).
    status: orderStatus().notNull().default("in_progress"),
    deliveryMethod: deliveryMethod(),
    // Shipping fee charged to the customer; the courier's actual cost lives on the shipment.
    shippingFee: integer().notNull().default(0),
    // The optional order Notes captured at creation. Owner internal notes are `note` activity events.
    notes: text(),
    cancellationReason: text(),
    completedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    createdByAccountId: uuid()
      .notNull()
      .references(() => accounts.id),
    assignedToAccountId: uuid()
      .notNull()
      .references(() => accounts.id),
    updatedByAccountId: uuid().references(() => accounts.id),
    ...timestamps(),
  },
  (t) => [
    check("orders_shipping_fee_nonnegative", sql`${t.shippingFee} >= 0`),
    check("orders_completed_at_matches_status", sql`(${t.status} = 'completed') = (${t.completedAt} IS NOT NULL)`),
    check("orders_cancelled_at_matches_status", sql`(${t.status} = 'cancelled') = (${t.cancelledAt} IS NOT NULL)`),
    index("orders_purchaser_id_idx").on(t.purchaserId),
    index("orders_status_created_at_idx").on(t.status, t.createdAt.desc()),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    productId: uuid().notNull(),
    // Copy of the product's kind, kept honest by the composite FK, so item-level rules can see it.
    productKind: productKind().notNull(),
    quantity: integer().notNull(),
    // Regular price per unit at the time of sale.
    unitPrice: integer().notNull(),
    // Optional negotiated total; the effective total is coalesce(agreed_total, quantity * unit_price).
    agreedTotal: integer(),
    // Google Review Card branch/location group and its direct review destination.
    label: text(),
    reviewUrl: text(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "order_items_product_fk",
      columns: [t.productId, t.productKind],
      foreignColumns: [products.id, products.kind],
    }),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
    check("order_items_unit_price_nonnegative", sql`${t.unitPrice} >= 0`),
    check("order_items_agreed_total_nonnegative", sql`${t.agreedTotal} IS NULL OR ${t.agreedTotal} >= 0`),
    check(
      "order_items_review_url_grc_https",
      sql`${t.reviewUrl} IS NULL OR (${t.productKind} = 'grc' AND ${t.reviewUrl} ~ '^https://')`,
    ),
    // Target for cards: a card must be fulfilled against an item of its own product.
    unique("order_items_id_product_unique").on(t.id, t.productId),
    index("order_items_order_id_idx").on(t.orderId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    amount: integer().notNull(),
    method: paymentMethod().notNull(),
    paidOn: date({ mode: "string" }).notNull(),
    reference: text(),
    recordedByAccountId: uuid()
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
  },
  (t) => [check("payments_amount_positive", sql`${t.amount} > 0`), index("payments_order_id_idx").on(t.orderId)],
);

// Money returned; never an edit of the original Payment.
export const refunds = pgTable(
  "refunds",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    amount: integer().notNull(),
    method: paymentMethod().notNull(),
    refundedOn: date({ mode: "string" }).notNull(),
    reason: text(),
    // Set when the refund came out of a Support Case.
    supportCaseId: uuid().references(() => supportCases.id),
    recordedByAccountId: uuid()
      .notNull()
      .references(() => accounts.id),
    createdAt: createdAt(),
  },
  (t) => [check("refunds_amount_positive", sql`${t.amount} > 0`), index("refunds_order_id_idx").on(t.orderId)],
);

// Courier fulfillment. Pickup and local handoff need no shipment row.
export const shipments = pgTable(
  "shipments",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    // Set for a replacement shipment sent from a Support Case.
    supportCaseId: uuid().references(() => supportCases.id),
    courier: text(),
    trackingNumber: text(),
    recipientName: text(),
    recipientContact: text(),
    address: text(),
    status: shipmentStatus().notNull().default("pending"),
    // Date the package was handed to the courier (seller-side fulfillment for courier orders).
    shippedOn: date({ mode: "string" }),
    // Actual cost paid by Neffi; reported as a shipping expense from here, never copied.
    courierCost: integer(),
    notes: text(),
    ...timestamps(),
  },
  (t) => [
    check("shipments_pending_not_shipped", sql`${t.status} <> 'pending' OR ${t.shippedOn} IS NULL`),
    check("shipments_shipped_on_after_pending", sql`${t.status} IN ('pending', 'failed') OR ${t.shippedOn} IS NOT NULL`),
    check("shipments_courier_cost_requires_shipped_on", sql`${t.courierCost} IS NULL OR ${t.shippedOn} IS NOT NULL`),
    check("shipments_courier_cost_nonnegative", sql`${t.courierCost} IS NULL OR ${t.courierCost} >= 0`),
    index("shipments_order_id_idx").on(t.orderId),
  ],
);
