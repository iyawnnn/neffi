import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "../../db/schema";
import { revokeUsableCredential, usableCredential } from "../activation/credentials";
import { recordActivity } from "../activity/record";
import { lockCard } from "../cards/card";
import type { Db } from "../db";
import { lockOrder, loadOrderFacts, settleOrderCompletion } from "../orders/order";
import { withCase, type CaseMutation } from "./case";
import { SupportError } from "./errors";

type CardMutation = CaseMutation & { cardId: string; reason: string };

async function lockItem(tx: Db, orderId: string | null, itemId: string | null) {
  if (!orderId || !itemId) throw new SupportError("wrong_order");
  const order = await lockOrder(tx, orderId);
  if (order.status === "cancelled") throw new SupportError("wrong_status");
  const [item] = await tx.select().from(s.orderItems).where(and(eq(s.orderItems.id, itemId), eq(s.orderItems.orderId, orderId))).for("update");
  if (!item) throw new SupportError("wrong_order");
  if (item.productKind !== "dbc") throw new SupportError("card_unavailable");
  return item;
}

export async function retireAffectedCard(db: Db, input: CardMutation) {
  if (!z.string().trim().min(1).max(200).safeParse(input.reason).success) throw new SupportError("invalid_input");
  return withCase(db, input, async (tx, row) => {
    const [snapshot] = await tx.select({ orderItemId: s.cards.orderItemId }).from(s.cards).where(eq(s.cards.id, input.cardId));
    if (!snapshot) throw new SupportError("not_found");
    const item = await lockItem(tx, row.orderId, snapshot.orderItemId);
    const card = await lockCard(tx, input.cardId);
    if (card.kind !== "dbc" || card.state !== "released") throw new SupportError("card_unavailable");
    if (card.orderItemId !== item.id) throw new SupportError("wrong_order");
    await tx.insert(s.supportCaseCards).values({ supportCaseId: row.id, cardId: card.id, role: "affected" }).onConflictDoNothing();
    const [link] = await tx.select().from(s.supportCaseCards).where(and(eq(s.supportCaseCards.supportCaseId, row.id), eq(s.supportCaseCards.cardId, card.id)));
    if (link.role !== "affected") throw new SupportError("card_unavailable");
    await revokeUsableCredential(tx, card.id);
    await tx.update(s.cards).set({ state: "retired", profileId: null, ownerAccountId: null, disabledAt: null }).where(eq(s.cards.id, card.id));
    await recordActivity(tx, { type: "card_retired", actorAccountId: input.actorId, cardId: card.id, orderId: item.orderId, supportCaseId: row.id, accountId: card.ownerAccountId ?? undefined, note: input.reason.trim() });
  });
}

export async function releaseReplacementCard(db: Db, input: CaseMutation & { orderItemId: string; cardId: string }) {
  return withCase(db, input, async (tx, row) => {
    const item = await lockItem(tx, row.orderId, input.orderItemId);
    const [counts] = await tx.select({
      affected: sql<number>`count(*) filter (where ${s.supportCaseCards.role} = 'affected' and ${s.cards.state} = 'retired' and exists (select 1 from activity_events e where e.card_id = ${s.cards.id} and e.support_case_id = ${row.id} and e.type = 'card_retired'))::int`,
      replacements: sql<number>`count(*) filter (where ${s.supportCaseCards.role} = 'replacement')::int`,
    }).from(s.supportCaseCards).innerJoin(s.cards, eq(s.cards.id, s.supportCaseCards.cardId)).where(and(eq(s.supportCaseCards.supportCaseId, row.id), eq(s.cards.orderItemId, item.id)));
    const facts = await loadOrderFacts(tx, item.orderId);
    if (counts.affected <= counts.replacements || facts.items.find((line) => line.id === item.id)!.activeCount >= item.quantity) throw new SupportError("replacement_unavailable");
    const card = await lockCard(tx, input.cardId);
    if (card.kind !== "dbc" || card.state !== "ready" || card.productId !== item.productId) throw new SupportError("card_unavailable");
    if (!card.packageMatchedAt || !await usableCredential(tx, card.id)) throw new SupportError("checks_incomplete");
    await tx.update(s.cards).set({ state: "released", orderItemId: item.id }).where(eq(s.cards.id, card.id));
    await tx.insert(s.supportCaseCards).values({ supportCaseId: row.id, cardId: card.id, role: "replacement" });
    await recordActivity(tx, { type: "card_released", actorAccountId: input.actorId, cardId: card.id, orderId: item.orderId, supportCaseId: row.id });
    await settleOrderCompletion(tx, item.orderId, input.actorId);
  });
}
