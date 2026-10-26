import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { escapeLike } from "../orders/purchasers";
import { STATUS_LABEL_BY_KEY, type StatusKey } from "./operations-view";

// Read DTOs for the OWNER inventory screens: only displayed columns, never lookup values.

// Keyset pagination on (created_at, id). The cursor carries created_at as the database's own text so microseconds
// survive; a JS Date would truncate them and skip rows that share a millisecond.
const CURSOR = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export async function getCardDetail(db: Db, cardId: string) {
  const [card] = await db
    .select({
      id: schema.cards.id,
      inventoryNumber: schema.cards.inventoryNumber,
      kind: schema.cards.kind,
      state: schema.cards.state,
      publicToken: schema.cards.publicToken,
      nfcVerifiedAt: schema.cards.nfcVerifiedAt,
      packageMatchedAt: schema.cards.packageMatchedAt,
      createdAt: schema.cards.createdAt,
      orderNumber: schema.orders.number,
      orderId: schema.orders.id,
      orderStatus: schema.orders.status,
      label: schema.orderItems.label,
      reviewUrl: schema.orderItems.reviewUrl,
      purchaserId: schema.purchasers.id,
      purchaserName: schema.purchasers.name,
      ownerAccountId: schema.cards.ownerAccountId,
    })
    .from(schema.cards)
    .leftJoin(schema.orderItems, eq(schema.orderItems.id, schema.cards.orderItemId))
    .leftJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .leftJoin(schema.purchasers, eq(schema.purchasers.id, schema.orders.purchaserId))
    .where(eq(schema.cards.id, cardId));
  if (!card) return null;

  const credentials = await db
    .select({ id: schema.activationCredentials.id, usedAt: schema.activationCredentials.usedAt, revokedAt: schema.activationCredentials.revokedAt, retrievable: sql<boolean>`${schema.activationCredentials.encryptedCode} is not null` })
    .from(schema.activationCredentials)
    .where(eq(schema.activationCredentials.cardId, cardId));
  const activity = await db
    .select({ type: schema.activityEvents.type, note: schema.activityEvents.note, createdAt: schema.activityEvents.createdAt })
    .from(schema.activityEvents)
    .where(eq(schema.activityEvents.cardId, cardId))
    .orderBy(desc(schema.activityEvents.createdAt), desc(schema.activityEvents.id))
    .limit(20);

  const { orderNumber, orderId, orderStatus, label, reviewUrl, purchaserId, purchaserName, ownerAccountId, ...rest } = card;
  const [owningAccount] = ownerAccountId ? await db.select({ email: schema.accounts.email, role: schema.accounts.role, createdAt: schema.accounts.createdAt }).from(schema.accounts).where(eq(schema.accounts.id, ownerAccountId)) : [];
  return {
    ...rest,
    owningAccount: owningAccount ?? null,
    owningAccountId: ownerAccountId,
    purchaser: purchaserId ? { id: purchaserId, name: purchaserName } : null,
    usableCredentialId: credentials.find((credential) => !credential.usedAt && !credential.revokedAt)?.id ?? null,
    credentialRetrievable: credentials.find((credential) => !credential.usedAt && !credential.revokedAt)?.retrievable ?? false,
    credentialCount: credentials.length,
    orderContext: orderNumber === null ? null : { orderId, orderNumber, label, reviewUrl, status: orderStatus },
    activity,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Owner operations queue. One statement per page: card facts are joined, never loaded per row, and no credential
// code, envelope or HMAC is ever selected, only booleans about the credential history.

export type QueueFilter = "needs_preparation" | "ready" | "assigned" | "delivered" | "activated" | "retired" | "available";
export const queueFilters: readonly QueueFilter[] = ["needs_preparation", "ready", "assigned", "delivered", "activated", "retired", "available"];
export { STATUS_LABEL_BY_KEY, type StatusKey };
const FILTER_KEYS: Record<QueueFilter, StatusKey[]> = {
  needs_preparation: ["needs_preparation"], ready: ["ready"], assigned: ["assigned"], delivered: ["shipped", "given", "waiting_activation"],
  activated: ["activated"], retired: ["retired"], available: ["available_blank"],
};

// Evidence of delivery comes from real rows, never from the intended method. Requires `o` (the card's order).
const SHIPPED_SQL = sql`EXISTS (SELECT 1 FROM shipments sh WHERE sh.order_id = o.id AND sh.shipped_on IS NOT NULL AND sh.support_case_id IS NULL)`;
const HANDED_SQL = sql`EXISTS (SELECT 1 FROM activity_events ae WHERE ae.order_id = o.id AND ae.type = 'order_handed_over')`;
// Same priority as toInventoryOperation (operations-view.ts); queue.db.test.ts checks them against each other.
export const CARD_STATUS_KEY_SQL = sql`CASE
  WHEN c.state = 'retired' THEN 'retired'
  WHEN c.state = 'released' AND c.owner_account_id IS NOT NULL AND c.kind = 'dbc' THEN 'activated'
  WHEN c.state = 'released' AND ${SHIPPED_SQL} THEN 'shipped'
  WHEN c.state = 'released' AND ${HANDED_SQL} THEN 'given'
  WHEN c.state = 'released' AND c.kind = 'grc' THEN 'delivery_unconfirmed'
  WHEN c.state = 'released' THEN 'waiting_activation'
  WHEN c.state = 'reserved' THEN 'assigned'
  WHEN c.state = 'preparing' OR (c.state = 'blank' AND c.public_token IS NOT NULL) THEN 'needs_preparation'
  WHEN c.state = 'ready' THEN 'ready'
  ELSE 'available_blank' END`;
export const CARD_STATUS_LABEL_SQL = sql`CASE ${CARD_STATUS_KEY_SQL}
  WHEN 'retired' THEN 'Retired' WHEN 'activated' THEN 'Activated' WHEN 'shipped' THEN 'Shipped' WHEN 'given' THEN 'Given to customer'
  WHEN 'delivery_unconfirmed' THEN 'Delivery to verify'
  WHEN 'waiting_activation' THEN 'Waiting for activation' WHEN 'assigned' THEN 'Assigned' WHEN 'needs_preparation' THEN 'Needs preparation'
  WHEN 'ready' THEN 'Ready' ELSE 'Available blank' END`;
export const CARD_ORDER_JOIN_SQL = sql`LEFT JOIN order_items i ON i.id = c.order_item_id LEFT JOIN orders o ON o.id = i.order_id`;

const FACTS_SQL = sql`
  SELECT c.id, c.inventory_number AS "inventoryNumber", c.kind::text AS kind, c.state::text AS state, c.public_token AS "publicToken",
    c.owner_account_id AS "ownerAccountId", c.created_at AS "createdAt", c.created_at::text || '|' || c.id::text AS cursor,
    o.id AS "orderId", o.number AS "orderNumber", o.delivery_method::text AS "deliveryMethod", p.name AS customer,
    ${SHIPPED_SQL} AS shipped, ${HANDED_SQL} AS "handedOver",
    (SELECT sh.tracking_number FROM shipments sh WHERE sh.order_id = o.id AND sh.support_case_id IS NULL ORDER BY sh.created_at DESC, sh.id DESC LIMIT 1) AS tracking,
    (SELECT sh.courier FROM shipments sh WHERE sh.order_id = o.id AND sh.support_case_id IS NULL ORDER BY sh.created_at DESC, sh.id DESC LIMIT 1) AS courier,
    (SELECT sh.status::text FROM shipments sh WHERE sh.order_id = o.id AND sh.support_case_id IS NULL ORDER BY sh.created_at DESC, sh.id DESC LIMIT 1) AS "shipmentStatus",
    EXISTS (SELECT 1 FROM activation_credentials ac WHERE ac.card_id = c.id AND ac.used_at IS NULL AND ac.revoked_at IS NULL) AS "credentialUsable",
    EXISTS (SELECT 1 FROM activation_credentials ac WHERE ac.card_id = c.id AND ac.used_at IS NULL AND ac.revoked_at IS NULL AND ac.encrypted_code IS NOT NULL) AS "credentialRetrievable",
    EXISTS (SELECT 1 FROM activation_credentials ac WHERE ac.card_id = c.id AND ac.revoked_at IS NOT NULL) AS "credentialRevoked",
    ${CARD_STATUS_KEY_SQL} AS "statusKey"
  FROM cards c ${CARD_ORDER_JOIN_SQL} LEFT JOIN purchasers p ON p.id = o.purchaser_id`;

type QueueOptions = { filter?: QueueFilter; search?: string; includeAvailable?: boolean };

function queueWhere({ filter, search, includeAvailable }: QueueOptions) {
  const term = search?.trim().slice(0, 100) ?? "";
  const clauses = [sql`true`];
  if (filter) clauses.push(sql`q."statusKey" IN (${sql.join(FILTER_KEYS[filter].map((key) => sql`${key}`), sql`, `)})`);
  else if (!term && !includeAvailable) clauses.push(sql`q."statusKey" <> 'available_blank'`);
  if (term) {
    const pat = `%${escapeLike(term)}%`;
    const reference = /^n-?0*(\d+)$/i.exec(term);
    const number = reference ? Number(reference[1]) : /^\d{1,9}$/.test(term) ? Number(term) : null;
    const matches = [sql`q.customer ILIKE ${pat}`, sql`q.tracking ILIKE ${pat}`];
    if (number !== null) matches.push(sql`q."inventoryNumber" = ${number}`);
    if (number !== null && !reference) matches.push(sql`q."orderNumber"::text LIKE ${`${number}%`}`);
    clauses.push(sql`(${sql.join(matches, sql` OR `)})`);
  }
  return sql.join(clauses, sql` AND `);
}

export async function countInventoryQueue(db: Db, options: QueueOptions) {
  const result = await db.execute(sql`SELECT count(*)::int AS total FROM (${FACTS_SQL}) q WHERE ${queueWhere(options)}`);
  return (result as { rows: { total: number }[] }).rows[0].total;
}

export async function inventoryStatusCounts(db: Db) {
  const result = await db.execute(sql`SELECT c.kind::text AS kind, ${CARD_STATUS_KEY_SQL} AS status, count(*)::int AS count FROM cards c ${CARD_ORDER_JOIN_SQL} GROUP BY 1, 2`);
  return (result as { rows: { kind: "dbc" | "grc" | null; status: StatusKey; count: number }[] }).rows;
}

export type QueueCard = {
  id: string; inventoryNumber: number; kind: "dbc" | "grc" | null; state: "blank" | "preparing" | "ready" | "reserved" | "released" | "retired";
  publicToken: string | null; ownerAccountId: string | null; createdAt: Date; cursor: string; orderId: string | null; orderNumber: number | null;
  deliveryMethod: "pickup" | "local_handoff" | "courier" | null; customer: string | null; shipped: boolean; handedOver: boolean;
  tracking: string | null; courier: string | null; shipmentStatus: string | null; statusKey: StatusKey;
  activation: { usable: boolean; retrievable: boolean; revoked: boolean };
};

// `before` (a cursor this function issued) and `offset` both work: numbered pages for the UI, exact continuation for callers.
export async function listInventoryQueue(db: Db, { before, offset = 0, limit, ...options }: QueueOptions & { before?: string; offset?: number; limit: number }) {
  const cursor = before ? CURSOR.exec(before) : null;
  const after = cursor ? sql` AND (q."createdAt", q.id) < (${cursor[1]}::timestamptz, ${cursor[4]}::uuid)` : sql``;
  const result = await db.execute(sql`SELECT * FROM (${FACTS_SQL}) q WHERE ${queueWhere(options)}${after} ORDER BY q."createdAt" DESC, q.id DESC LIMIT ${limit + 1} OFFSET ${offset}`);
  const rows = (result as { rows: (Omit<QueueCard, "activation" | "createdAt"> & { createdAt: string | Date; credentialUsable: boolean; credentialRetrievable: boolean; credentialRevoked: boolean })[] }).rows;
  const page = rows.slice(0, limit);
  return {
    cards: page.map(({ credentialUsable, credentialRetrievable, credentialRevoked, createdAt, ...card }): QueueCard => ({
      ...card, createdAt: new Date(createdAt), activation: { usable: credentialUsable, retrievable: credentialRetrievable, revoked: credentialRevoked },
    })),
    next: rows.length > limit ? page[page.length - 1].cursor : null,
  };
}

// Paid normal orders that still wait for cards: the quantity short across every in-progress order.
export async function stockShortage(db: Db): Promise<number> {
  const result = await db.execute(sql`
    SELECT coalesce(sum(greatest(i.quantity - (SELECT count(*) FROM cards c WHERE c.order_item_id = i.id AND c.state IN ('preparing', 'reserved', 'released')), 0)), 0)::int AS short
    FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE o.status = 'in_progress' AND o.client_key IS NOT NULL AND i.product_kind = 'dbc'`);
  return (result as { rows: { short: number }[] }).rows[0].short;
}
