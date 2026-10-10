import "server-only";
import { count, desc, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";

// Read DTOs for the OWNER inventory screens: only displayed columns, never lookup values.

export async function cardStateCounts(db: Db) {
  const rows = await db
    .select({ kind: schema.cards.kind, state: schema.cards.state, count: count() })
    .from(schema.cards)
    .groupBy(schema.cards.kind, schema.cards.state);
  // "In provisioning" is derived, not a state: a blank DBC that already holds its permanent token.
  const [{ inProvisioning }] = await db
    .select({ inProvisioning: count() })
    .from(schema.cards)
    .where(sql`${schema.cards.kind} = 'dbc' AND ${schema.cards.state} = 'blank' AND ${schema.cards.publicToken} IS NOT NULL`);
  return { rows, inProvisioning };
}

// Keyset pagination on (created_at, id). The cursor carries created_at as the database's own text so microseconds
// survive; a JS Date would truncate them and skip rows that share a millisecond.
const CURSOR = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

// `before` comes from the URL, so anything that is not a cursor this function issued is ignored.
export async function listCards(db: Db, { before, limit }: { before?: string; limit: number }) {
  const cursor = before ? CURSOR.exec(before) : null;
  const [cursorAt, cursorId] = cursor ? [cursor[1], cursor[4]] : [];
  const rows = await db
    .select({
      id: schema.cards.id,
      kind: schema.cards.kind,
      state: schema.cards.state,
      publicToken: schema.cards.publicToken,
      nfcVerifiedAt: schema.cards.nfcVerifiedAt,
      packageMatchedAt: schema.cards.packageMatchedAt,
      createdAt: schema.cards.createdAt,
      cursor: sql<string>`${schema.cards.createdAt}::text || '|' || ${schema.cards.id}::text`,
    })
    .from(schema.cards)
    .where(cursor ? sql`(${schema.cards.createdAt}, ${schema.cards.id}) < (${cursorAt}::timestamptz, ${cursorId}::uuid)` : undefined)
    .orderBy(desc(schema.cards.createdAt), desc(schema.cards.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    cards: page.map((row) => ({
      id: row.id,
      kind: row.kind,
      state: row.state,
      publicToken: row.publicToken,
      nfcVerifiedAt: row.nfcVerifiedAt,
      packageMatchedAt: row.packageMatchedAt,
      createdAt: row.createdAt,
    })),
    next: rows.length > limit ? page[page.length - 1].cursor : null,
  };
}

export async function getCardDetail(db: Db, cardId: string) {
  const [card] = await db
    .select({
      id: schema.cards.id,
      kind: schema.cards.kind,
      state: schema.cards.state,
      publicToken: schema.cards.publicToken,
      nfcVerifiedAt: schema.cards.nfcVerifiedAt,
      packageMatchedAt: schema.cards.packageMatchedAt,
      createdAt: schema.cards.createdAt,
      orderNumber: schema.orders.number,
      label: schema.orderItems.label,
      reviewUrl: schema.orderItems.reviewUrl,
    })
    .from(schema.cards)
    .leftJoin(schema.orderItems, eq(schema.orderItems.id, schema.cards.orderItemId))
    .leftJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(eq(schema.cards.id, cardId));
  if (!card) return null;

  const credentials = await db
    .select({ id: schema.activationCredentials.id, usedAt: schema.activationCredentials.usedAt, revokedAt: schema.activationCredentials.revokedAt })
    .from(schema.activationCredentials)
    .where(eq(schema.activationCredentials.cardId, cardId));
  const activity = await db
    .select({ type: schema.activityEvents.type, note: schema.activityEvents.note, createdAt: schema.activityEvents.createdAt })
    .from(schema.activityEvents)
    .where(eq(schema.activityEvents.cardId, cardId))
    .orderBy(desc(schema.activityEvents.createdAt), desc(schema.activityEvents.id))
    .limit(20);

  const { orderNumber, label, reviewUrl, ...rest } = card;
  return {
    ...rest,
    usableCredentialId: credentials.find((credential) => !credential.usedAt && !credential.revokedAt)?.id ?? null,
    credentialCount: credentials.length,
    orderContext: orderNumber === null ? null : { orderNumber, label, reviewUrl },
    activity,
  };
}
