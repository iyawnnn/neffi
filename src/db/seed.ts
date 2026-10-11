// Development-only synthetic seed. Every value is invented (names, @example.test emails, prices, tokens) and
// every id is fixed, so re-running yields the identical dataset. `seed` empties the tables first: it is a
// reset, guarded here as well as in scripts/seed-dev.ts by the explicit development environment.
// Activation credentials carry only synthetic lookup values; no activation code exists for any of them.
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { parseSeedEnv } from "../config/env-schema";
import * as schema from "./schema";

type SeedDb = PgDatabase<PgQueryResultHKT, typeof schema>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const lookup = (n: number) => `5eed${"0".repeat(56)}${n.toString(16).padStart(4, "0")}`;

export const SEED_IDS = {
  ownerOne: id(1),
  ownerTwo: id(2),
  customerAna: id(3),
  customerBen: id(4),
  productDbc: id(10),
  productGrc: id(11),
  purchaserAna: id(20),
  purchaserCafe: id(21),
  purchaserCancelled: id(22),
  openingStock: id(30),
  orderCompleted: id(40),
  orderInProgress: id(41),
  orderCancelled: id(42),
  itemCompletedDbc: id(50),
  itemInProgressDbc: id(51),
  itemInProgressGrc: id(52),
  itemInProgressGrcB: id(54),
  itemCancelledDbc: id(53),
  profileAna: id(60),
  profileBenDraft: id(61),
  cardBlank: id(70),
  cardProvisioningDbc: id(71),
  cardClaimedDbc: id(72),
  cardDisabledDbc: id(73),
  cardRetiredDbc: id(74),
  cardShippedDbc: id(75),
  cardShippedGrcA: id(76),
  cardShippedGrcB: id(77),
  cardBlankGrc: id(78),
  supportCaseDefective: id(90),
} as const;

const S = SEED_IDS;
const SEED_TABLES = [
  "accounts",
  "auth_identities",
  "auth_sessions",
  "auth_verifications",
  "auth_rate_limits",
  "auth_otp_quotas",
  "products",
  "purchasers",
  "orders",
  "order_items",
  "payments",
  "refunds",
  "shipments",
  "stock_purchases",
  "cards",
  "activation_credentials",
  "profiles",
  "profile_links",
  "scenes",
  "form_definitions",
  "scene_blocks",
  "form_submissions",
  "expenses",
  "support_cases",
  "support_case_cards",
  "activity_events",
] as const;

export async function seed(db: SeedDb): Promise<void> {
  parseSeedEnv(process.env);
  await db.transaction(async (tx) => {
    // TRUNCATE bypasses the row-level history guards on purpose: this resets synthetic development data.
    await tx.execute(sql.raw(`TRUNCATE ${SEED_TABLES.map((table) => `ONLY public."${table}"`).join(", ")} RESTART IDENTITY RESTRICT`));

    await tx.insert(schema.accounts).values([
      { id: S.ownerOne, name: "Synthetic Owner One", email: "owner.one@example.test", emailVerified: true, role: "owner" },
      { id: S.ownerTwo, name: "Synthetic Owner Two", email: "owner.two@example.test", emailVerified: true, role: "owner" },
      { id: S.customerAna, name: "Ana Synthetic", email: "ana@example.test", emailVerified: true },
      { id: S.customerBen, name: "Ben Synthetic", email: "ben@example.test", emailVerified: true },
    ]);

    await tx.insert(schema.products).values([
      { id: S.productDbc, kind: "dbc", name: "Digital Business Card", price: 50_000 },
      { id: S.productGrc, kind: "grc", name: "Google Review Card", price: 30_000 },
    ]);

    await tx.insert(schema.purchasers).values([
      { id: S.purchaserAna, name: "Ana Synthetic", contactNumber: "+63 900 000 0001" },
      { id: S.purchaserCafe, name: "Synthetic Café (two branches)" },
      { id: S.purchaserCancelled, name: "Synthetic Cancelled Buyer" },
    ]);

    await tx.insert(schema.stockPurchases).values({
      id: S.openingStock,
      supplier: "Synthetic Card Supplier",
      receivedOn: "2026-10-01",
      purchaseCost: 200_000,
      inboundShippingCost: 15_000,
      reference: "OPENING-STOCK",
      createdByAccountId: S.ownerOne,
    });

    const seller = { createdByAccountId: S.ownerOne, assignedToAccountId: S.ownerOne };
    await tx.insert(schema.orders).values([
      // Pickup, fully paid, handed over: completed (and remains so even after a free replacement).
      { id: S.orderCompleted, purchaserId: S.purchaserAna, deliveryMethod: "pickup", status: "completed", completedAt: new Date("2026-10-05T10:00:00Z"), ...seller },
      // Courier, handed to the courier but only partly paid: still in progress.
      { id: S.orderInProgress, purchaserId: S.purchaserCafe, deliveryMethod: "courier", shippingFee: 15_000, notes: "Two branches, two review links.", ...seller, assignedToAccountId: S.ownerTwo },
      { id: S.orderCancelled, purchaserId: S.purchaserCancelled, status: "cancelled", cancelledAt: new Date("2026-10-06T09:00:00Z"), cancellationReason: "Synthetic: buyer changed their mind", ...seller },
    ]);

    await tx.insert(schema.orderItems).values([
      // Negotiated bundle price: regular 2 x 500 = 1,000, agreed 900.
      { id: S.itemCompletedDbc, orderId: S.orderCompleted, productId: S.productDbc, productKind: "dbc", quantity: 2, unitPrice: 50_000, agreedTotal: 90_000 },
      { id: S.itemInProgressDbc, orderId: S.orderInProgress, productId: S.productDbc, productKind: "dbc", quantity: 1, unitPrice: 50_000 },
      { id: S.itemInProgressGrc, orderId: S.orderInProgress, productId: S.productGrc, productKind: "grc", quantity: 2, unitPrice: 30_000, label: "Branch A", reviewUrl: "https://g.page/r/synthetic-branch-a/review" },
      // Free capacity: lets the M4 GRC reservation capability be exercised against a controlled development item.
      { id: S.itemInProgressGrcB, orderId: S.orderInProgress, productId: S.productGrc, productKind: "grc", quantity: 1, unitPrice: 30_000, label: "Branch B", reviewUrl: "https://g.page/r/synthetic-branch-b/review" },
      { id: S.itemCancelledDbc, orderId: S.orderCancelled, productId: S.productDbc, productKind: "dbc", quantity: 1, unitPrice: 50_000 },
    ]);

    await tx.insert(schema.profiles).values([
      { id: S.profileAna, accountId: S.customerAna, status: "published", fullName: "Ana Synthetic", headline: "Synthetic Designer", email: "hello@example.test", accentColor: "#2f6fed" },
      { id: S.profileBenDraft, accountId: S.customerBen },
    ]);
    await tx.insert(schema.profileLinks).values([
      { profileId: S.profileAna, type: "linkedin", url: "https://example.test/in/ana", position: 0 },
      { profileId: S.profileAna, type: "custom", label: "Portfolio", url: "https://example.test/ana", position: 1 },
    ]);

    const stock = { stockPurchaseId: S.openingStock };
    const dbc = { ...stock, productId: S.productDbc, kind: "dbc" as const };
    const grc = { ...stock, productId: S.productGrc, kind: "grc" as const };
    await tx.insert(schema.cards).values([
      { id: S.cardBlank, ...stock },
      { id: S.cardBlankGrc, ...grc },
      // Mid-provisioning: token and usable credential issued, but no physical NFC check or package match exists.
      // The seed never claims physical evidence, so it holds no Ready DBC.
      { id: S.cardProvisioningDbc, ...dbc, publicToken: "SEEDDBC00001" },
      // Claimed by Ana and routed to her published profile (it replaced the defective card below).
      { id: S.cardClaimedDbc, ...dbc, state: "released", orderItemId: S.itemCompletedDbc, publicToken: "SEEDDBC00002", ownerAccountId: S.customerAna, profileId: S.profileAna },
      // Ana's second card, reported lost and disabled.
      { id: S.cardDisabledDbc, ...dbc, state: "released", orderItemId: S.itemCompletedDbc, publicToken: "SEEDDBC00003", ownerAccountId: S.customerAna, disabledAt: new Date("2026-10-07T08:00:00Z") },
      { id: S.cardRetiredDbc, ...dbc, state: "retired", orderItemId: S.itemCompletedDbc, publicToken: "SEEDDBC00004" },
      // Shipped but not yet activated by its eventual owner.
      { id: S.cardShippedDbc, ...dbc, state: "released", orderItemId: S.itemInProgressDbc, publicToken: "SEEDDBC00005" },
      { id: S.cardShippedGrcA, ...grc, state: "released", orderItemId: S.itemInProgressGrc },
      { id: S.cardShippedGrcB, ...grc, state: "released", orderItemId: S.itemInProgressGrc },
    ]);

    const now = new Date("2026-10-05T09:00:00Z");
    await tx.insert(schema.activationCredentials).values([
      { cardId: S.cardProvisioningDbc, lookupHmac: lookup(1), revokedAt: now },
      { cardId: S.cardProvisioningDbc, lookupHmac: lookup(2) },
      { cardId: S.cardClaimedDbc, lookupHmac: lookup(3), usedAt: now },
      { cardId: S.cardDisabledDbc, lookupHmac: lookup(4), usedAt: now },
      { cardId: S.cardRetiredDbc, lookupHmac: lookup(5), revokedAt: now },
      { cardId: S.cardShippedDbc, lookupHmac: lookup(6) },
    ]);

    await tx.insert(schema.payments).values([
      { orderId: S.orderCompleted, amount: 90_000, method: "cash", paidOn: "2026-10-05", recordedByAccountId: S.ownerOne },
      { orderId: S.orderInProgress, amount: 30_000, method: "gcash", paidOn: "2026-10-08", reference: "SYNTH-GCASH-1", recordedByAccountId: S.ownerTwo },
      { orderId: S.orderCancelled, amount: 50_000, method: "bank_transfer", paidOn: "2026-10-04", recordedByAccountId: S.ownerOne },
    ]);
    await tx.insert(schema.refunds).values({ orderId: S.orderCancelled, amount: 50_000, method: "bank_transfer", refundedOn: "2026-10-06", reason: "Order cancelled", recordedByAccountId: S.ownerOne });

    await tx.insert(schema.shipments).values({
      orderId: S.orderInProgress,
      courier: "Synthetic Courier",
      trackingNumber: "SYNTH-TRACK-0001",
      recipientName: "Synthetic Café",
      address: "Synthetic Street, Synthetic City",
      status: "in_transit",
      shippedOn: "2026-10-08",
      courierCost: 12_000,
    });

    await tx.insert(schema.supportCases).values({
      id: S.supportCaseDefective,
      type: "defective_card",
      status: "resolved",
      summary: "Synthetic: card did not read; replaced free of charge",
      purchaserId: S.purchaserAna,
      accountId: S.customerAna,
      orderId: S.orderCompleted,
      assignedToAccountId: S.ownerOne,
      resolvedAt: new Date("2026-10-05T12:00:00Z"),
    });
    await tx.insert(schema.supportCaseCards).values([
      { supportCaseId: S.supportCaseDefective, cardId: S.cardRetiredDbc, role: "affected" },
      { supportCaseId: S.supportCaseDefective, cardId: S.cardClaimedDbc, role: "replacement" },
    ]);

    await tx.insert(schema.expenses).values({ spentOn: "2026-10-02", amount: 8_000, category: "packaging_printing", payee: "Synthetic Print Shop", createdByAccountId: S.ownerTwo });

    await tx.insert(schema.activityEvents).values([
      { type: "stock_received", actorAccountId: S.ownerOne, stockPurchaseId: S.openingStock },
      { type: "order_created", actorAccountId: S.ownerOne, orderId: S.orderCompleted },
      { type: "card_released", actorAccountId: S.ownerOne, orderId: S.orderCompleted, cardId: S.cardClaimedDbc },
      { type: "card_claimed", actorAccountId: S.customerAna, cardId: S.cardClaimedDbc, accountId: S.customerAna },
      { type: "support_case_resolved", actorAccountId: S.ownerOne, supportCaseId: S.supportCaseDefective, orderId: S.orderCompleted },
      { type: "note", actorAccountId: S.ownerTwo, orderId: S.orderInProgress, note: "Synthetic: confirm the Branch B review link." },
    ]);
  });
}

export async function countRows(db: SeedDb): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of SEED_TABLES) {
    // Both drivers (node-postgres and PGlite) return `{ rows }`; the generic PgDatabase type does not say so.
    const result = (await db.execute(sql.raw(`select count(*)::int as n from public."${table}"`))) as unknown as {
      rows: { n: number }[];
    };
    counts[table] = Number(result.rows[0].n);
  }
  return counts;
}
