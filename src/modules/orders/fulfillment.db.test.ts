import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertOrderItem, insertProduct, insertStockPurchase, syntheticLookup, syntheticToken } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { claimCard } from "../activation/claim";
import { recordPayment } from "../payments/record";
import { reserveDbcCards, returnCardToStock, handOverOrder, shipOrder, updateShipment } from "./fulfillment";
import { loadOrderFacts } from "./order";

let db: TestDb;
let sequence = 0;
beforeAll(async () => { db = await createTestDb(); });
async function ready(tx: TestTx, productId: string) {
  const stock = await insertStockPurchase(tx);
  const [blank] = await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId, kind: "dbc", publicToken: syntheticToken() }).returning();
  const [credential] = await tx.insert(s.activationCredentials).values({ cardId: blank.id, lookupHmac: syntheticLookup(++sequence) }).returning();
  const [card] = await tx.update(s.cards).set({ state: "ready", nfcVerifiedAt: new Date(), packageMatchedAt: new Date() }).where(eq(s.cards.id, blank.id)).returning();
  return { card, credential };
}

test("DBC reservation is capacity-limited and a stale id rolls back the whole set", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "dbc", 2);
  const a = await ready(tx, product.id);
  const b = await ready(tx, product.id);
  const base = { orderId: order.id, actorId: owner.id, orderItemId: item.id };
  await expect(reserveDbcCards(tx, { ...base, cardIds: [a.card.id, crypto.randomUUID()] })).rejects.toMatchObject({ code: "card_unavailable" });
  expect((await tx.select().from(s.cards).where(eq(s.cards.id, a.card.id)))[0].state).toBe("ready");
  await reserveDbcCards(tx, { ...base, cardIds: [a.card.id, b.card.id] });
  await expect(reserveDbcCards(tx, { ...base, cardIds: [crypto.randomUUID()] })).rejects.toMatchObject({ code: "item_full" });
  await returnCardToStock(tx, { orderId: order.id, actorId: owner.id, cardId: a.card.id });
  expect((await tx.select().from(s.cards).where(eq(s.cards.id, a.card.id)))[0]).toMatchObject({ state: "ready", orderItemId: null, packageMatchedAt: a.card.packageMatchedAt, nfcVerifiedAt: a.card.nfcVerifiedAt });
}));

test("wrong product/kind reservation and GRC return refused, preserving manual inventory", () => rollback(db, async (tx) => {
  const { order, owner, item } = await insertOrderItem(tx, "dbc");
  const [historical] = await tx.insert(s.products).values({ kind: "dbc", name: "Historical", price: 100, active: false }).returning();
  const wrong = await ready(tx, historical.id);
  const grcProduct = await insertProduct(tx, "grc");
  const stock = await insertStockPurchase(tx);
  const [grc] = await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: grcProduct.id, kind: "grc" }).returning();
  const base = { orderId: order.id, actorId: owner.id, orderItemId: item.id };
  for (const cardId of [wrong.card.id, grc.id]) await expect(reserveDbcCards(tx, { ...base, cardIds: [cardId] })).rejects.toMatchObject({ code: "card_unavailable" });
  await expect(returnCardToStock(tx, { orderId: order.id, actorId: owner.id, cardId: grc.id })).rejects.toMatchObject({ code: "card_unavailable" });
  expect((await tx.select().from(s.cards).where(eq(s.cards.id, grc.id)))[0]).toEqual(grc);
}));

test("DBC release requires pickup/local, package match and usable credential", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "dbc");
  const { card, credential } = await ready(tx, product.id);
  const base = { orderId: order.id, actorId: owner.id };
  await reserveDbcCards(tx, { ...base, orderItemId: item.id, cardIds: [card.id] });
  await expect(handOverOrder(tx, base)).rejects.toMatchObject({ code: "wrong_delivery" });
  await tx.update(s.orders).set({ deliveryMethod: "pickup" }).where(eq(s.orders.id, order.id));
  await tx.update(s.cards).set({ packageMatchedAt: null }).where(eq(s.cards.id, card.id));
  await expect(handOverOrder(tx, base)).rejects.toMatchObject({ code: "checks_incomplete" });
  await tx.update(s.cards).set({ packageMatchedAt: new Date() }).where(eq(s.cards.id, card.id));
  await tx.update(s.activationCredentials).set({ revokedAt: new Date() }).where(eq(s.activationCredentials.id, credential.id));
  await expect(handOverOrder(tx, base)).rejects.toMatchObject({ code: "checks_incomplete" });
}));

test.each(["dbc", "grc", "mixed"] as const)("%s completes through pickup/local/courier with only DBC Card releases", (kind) => rollback(db, async (tx) => {
  for (const deliveryMethod of ["pickup", "local_handoff", "courier"] as const) {
    const primary = kind === "grc" ? "grc" : "dbc";
    const { order, owner, item, product } = await insertOrderItem(tx, primary);
    const base = { orderId: order.id, actorId: owner.id };
    await tx.update(s.orders).set({ deliveryMethod }).where(eq(s.orders.id, order.id));
    if (kind === "mixed") {
      const [existing] = await tx.select().from(s.products).where(eq(s.products.kind, "grc"));
      const grc = existing ?? await insertProduct(tx, "grc");
      await tx.insert(s.orderItems).values({ orderId: order.id, productId: grc.id, productKind: "grc", quantity: 2, unitPrice: grc.price });
    }
    if (primary === "dbc") {
      const { card } = await ready(tx, product.id);
      await reserveDbcCards(tx, { ...base, orderItemId: item.id, cardIds: [card.id] });
    }
    await recordPayment(tx, { ...base, method: "cash" });
    expect((await loadOrderFacts(tx, order.id)).status).toBe("in_progress");
    if (deliveryMethod === "courier") {
      await shipOrder(tx, { ...base, trackingNumber: "Synthetic tracking", courierCost: 1000 });
      const [shipment] = await tx.select().from(s.shipments).where(eq(s.shipments.orderId, order.id));
      expect(shipment).toMatchObject({ status: "in_transit", courierCost: 1000 });
      expect(shipment.shippedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      await updateShipment(tx, { ...base, shipmentId: shipment.id, status: "delivered", courierCost: 1500 });
      await updateShipment(tx, { ...base, shipmentId: shipment.id, status: "delivered", courierCost: null });
      expect((await tx.select().from(s.shipments).where(eq(s.shipments.id, shipment.id)))[0].courierCost).toBeNull();
    } else await handOverOrder(tx, base);
    expect((await loadOrderFacts(tx, order.id)).status).toBe("completed");
    expect((await tx.select().from(s.cards)).filter((card) => card.kind === "grc")).toHaveLength(0);
    expect((await tx.select().from(s.activityEvents).where(eq(s.activityEvents.orderId, order.id))).filter((event) => event.type === "order_completed")).toHaveLength(1);
  }
}));

test("M8-released DBC can be claimed through existing M5 claimCard", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "dbc");
  const { card, credential } = await ready(tx, product.id);
  const base = { orderId: order.id, actorId: owner.id };
  await tx.update(s.orders).set({ deliveryMethod: "pickup" }).where(eq(s.orders.id, order.id));
  await reserveDbcCards(tx, { ...base, orderItemId: item.id, cardIds: [card.id] });
  await handOverOrder(tx, base);
  expect((await loadOrderFacts(tx, order.id)).status).toBe("in_progress");
  const customer = await insertAccount(tx);
  expect(await claimCard(tx, { accountId: customer.id, credentialId: credential.id })).toEqual({ status: "claimed", cardId: card.id });
}));

test("partial DBC handovers settle only after every quantity is released and record handover once", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "dbc", 2);
  const a = await ready(tx, product.id);
  const b = await ready(tx, product.id);
  const base = { orderId: order.id, actorId: owner.id };
  await tx.update(s.orders).set({ deliveryMethod: "pickup" }).where(eq(s.orders.id, order.id));
  await recordPayment(tx, { ...base, method: "cash" });
  await reserveDbcCards(tx, { ...base, orderItemId: item.id, cardIds: [a.card.id] });
  await handOverOrder(tx, base);
  expect((await loadOrderFacts(tx, order.id)).status).toBe("in_progress");
  await reserveDbcCards(tx, { ...base, orderItemId: item.id, cardIds: [b.card.id] });
  await handOverOrder(tx, base);
  expect((await loadOrderFacts(tx, order.id)).status).toBe("completed");
  expect((await tx.select().from(s.activityEvents)).filter((event) => event.type === "order_handed_over")).toHaveLength(1);
}));
