import "server-only";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import * as s from "../../db/schema";
import { accountDirectoryDetail } from "../accounts/directory";
import type { Db } from "../db";
import { getOrderDetail, orderAssignees } from "../orders/queries";
import { escapeLike, listPurchasers } from "../orders/purchasers";
import { listAccounts } from "../accounts/directory";

export async function caseLinkOptions(db: Db, query = "") {
  const pattern = `%${escapeLike(query.slice(0, 100))}%`;
  const [orders, purchasers, accounts, cards] = await Promise.all([
    db.select({ id: s.orders.id, number: s.orders.number, purchaserName: s.purchasers.name }).from(s.orders).innerJoin(s.purchasers, eq(s.purchasers.id, s.orders.purchaserId)).where(or(ilike(sql`${s.orders.number}::text`, pattern), ilike(s.purchasers.name, pattern))).orderBy(desc(s.orders.createdAt), desc(s.orders.id)).limit(50),
    listPurchasers(db, query.slice(0, 100)), listAccounts(db, query.slice(0, 100)),
    db.select({ id: s.cards.id, kind: s.cards.kind, state: s.cards.state, suffix: sql<string>`right(coalesce(${s.cards.publicToken}, ${s.cards.id}::text), 4)` }).from(s.cards).where(ilike(sql`right(coalesce(${s.cards.publicToken}, ${s.cards.id}::text), 4)`, pattern)).orderBy(desc(s.cards.createdAt), desc(s.cards.id)).limit(50),
  ]);
  return { orders, purchasers, accounts, cards };
}

const CURSOR = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

type CaseFilters = { status?: typeof s.supportCaseStatus.enumValues[number]; source?: typeof s.supportCaseSource.enumValues[number] };
const caseFilters = ({ status, source }: CaseFilters) => [status ? eq(s.supportCases.status, status) : undefined, source ? eq(s.supportCases.source, source) : undefined];

export async function countCases(db: Db, filters: CaseFilters = {}) {
  const [row] = await db.select({ total: count() }).from(s.supportCases).where(and(...caseFilters(filters)));
  return row.total;
}

// `offset` + `limit` select a numbered page; without `limit` the list is cursor-based (`before`) at 25 rows.
export async function listCases(db: Db, { before, offset = 0, limit, ...filters }: CaseFilters & { before?: string; offset?: number; limit?: number } = {}) {
  const cursor = before ? CURSOR.exec(before) : null;
  const rows = await db.select({ id: s.supportCases.id, type: s.supportCases.type, summary: s.supportCases.summary, status: s.supportCases.status, source: s.supportCases.source, assignedToAccountId: s.supportCases.assignedToAccountId, createdAt: s.supportCases.createdAt,
    cursor: sql<string>`${s.supportCases.createdAt}::text || '|' || ${s.supportCases.id}::text`,
  }).from(s.supportCases).where(and(...caseFilters(filters), cursor ? sql`(${s.supportCases.createdAt}, ${s.supportCases.id}) < (${cursor[1]}::timestamptz, ${cursor[4]}::uuid)` : undefined)).orderBy(desc(s.supportCases.createdAt), desc(s.supportCases.id)).limit(limit ?? 26).offset(offset);
  const page = rows.slice(0, limit ?? 25);
  return { cases: page, next: !limit && rows.length > 25 ? page[24].cursor : null };
}

export function casesForOrder(db: Db, orderId: string) {
  return db.select({ id: s.supportCases.id, summary: s.supportCases.summary, status: s.supportCases.status }).from(s.supportCases).where(eq(s.supportCases.orderId, orderId)).orderBy(desc(s.supportCases.createdAt), desc(s.supportCases.id));
}

export async function openCaseCount(db: Db) {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(s.supportCases).where(sql`${s.supportCases.status} <> 'resolved'`);
  return row.count;
}

export async function getCaseDetail(db: Db, id: string) {
  const [support] = await db.select().from(s.supportCases).where(eq(s.supportCases.id, id));
  if (!support) return null;
  const [order, account, purchaser, cards, refunds, shipments, linkedOrders, timeline, assignees, recoveries] = await Promise.all([
    support.orderId ? getOrderDetail(db, support.orderId) : null,
    support.accountId ? accountDirectoryDetail(db, support.accountId) : null,
    support.purchaserId ? db.select({ id: s.purchasers.id, name: s.purchasers.name, contactNumber: s.purchasers.contactNumber }).from(s.purchasers).where(eq(s.purchasers.id, support.purchaserId)).then((rows) => rows[0]) : null,
    db.select({ id: s.cards.id, role: s.supportCaseCards.role, kind: s.cards.kind, state: s.cards.state, orderItemId: s.cards.orderItemId, ownerAccountId: s.cards.ownerAccountId, retiredByCase: sql<boolean>`exists(select 1 from activity_events e where e.card_id = ${s.cards.id} and e.support_case_id = ${id} and e.type = 'card_retired')`, suffix: sql<string | null>`right(${s.cards.publicToken}, 4)` }).from(s.supportCaseCards).innerJoin(s.cards, eq(s.cards.id, s.supportCaseCards.cardId)).where(eq(s.supportCaseCards.supportCaseId, id)).orderBy(asc(s.supportCaseCards.createdAt), asc(s.cards.id)),
    db.select().from(s.refunds).where(eq(s.refunds.supportCaseId, id)).orderBy(desc(s.refunds.createdAt), desc(s.refunds.id)),
    db.select().from(s.shipments).where(eq(s.shipments.supportCaseId, id)).orderBy(desc(s.shipments.createdAt), desc(s.shipments.id)),
    db.selectDistinct({ id: s.orders.id, number: s.orders.number, status: s.orders.status }).from(s.activityEvents).innerJoin(s.orders, eq(s.orders.id, s.activityEvents.orderId)).where(and(eq(s.activityEvents.supportCaseId, id), eq(s.activityEvents.type, "support_order_linked"))),
    db.select({ id: s.activityEvents.id, type: s.activityEvents.type, actorAccountId: s.activityEvents.actorAccountId, note: s.activityEvents.note, createdAt: s.activityEvents.createdAt }).from(s.activityEvents).where(eq(s.activityEvents.supportCaseId, id)).orderBy(desc(s.activityEvents.createdAt), desc(s.activityEvents.id)),
    orderAssignees(db),
    db.select({ id: s.accountRecoveries.id, newEmail: s.accountRecoveries.newEmail, status: s.accountRecoveries.status, attempts: s.accountRecoveries.attempts, expiresAt: s.accountRecoveries.expiresAt, createdAt: s.accountRecoveries.createdAt }).from(s.accountRecoveries).where(eq(s.accountRecoveries.supportCaseId, id)).orderBy(desc(s.accountRecoveries.createdAt), desc(s.accountRecoveries.id)),
  ]);
  return { ...support, order, account, purchaser, cards, refunds, shipments, linkedOrders, timeline, assignees, recoveries };
}
