import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activationCredentials, activityEvents, cards, orderItems, orders, purchasers, shipments } from "@/db/schema";
import { insertAccount, insertOrder, insertOrderItem, insertProduct, insertStockPurchase, syntheticLookup, syntheticToken } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { inventoryStatusCounts, listInventoryQueue, countInventoryQueue, stockShortage, type QueueFilter } from "./queries";
import { toInventoryOperation, type InventoryOperationFacts } from "./operations-view";
import { searchRecords } from "../search";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
let lookup = 5000;

type Seeded = { byStatus: Record<string, string[]>; order: { courier: { id: string; number: number }; handed: { id: string }; ana: { id: string } } };

// 58 cards in every state, with long customer names and real shipment/handover evidence.
async function seed(tx: TestTx): Promise<Seeded> {
  const stock = await insertStockPurchase(tx);
  const product = await insertProduct(tx, "dbc");
  const byStatus: Record<string, string[]> = {};
  const add = (status: string, id: string) => { (byStatus[status] ??= []).push(id); };
  const credential = (cardId: string, over: Partial<typeof activationCredentials.$inferInsert> = {}) => tx.insert(activationCredentials).values({ cardId, lookupHmac: syntheticLookup(++lookup), ...over });
  const dbc = (state: "blank" | "ready" | "retired", extra: Partial<typeof cards.$inferInsert> = {}) => tx.insert(cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state, publicToken: syntheticToken(), ...extra }).returning().then(([c]) => c);
  const makeOrder = async (name: string, delivery: "pickup" | "courier", quantity: number) => {
    const { order, item } = await insertOrderItem(tx, "dbc", quantity);
    await tx.update(orders).set({ deliveryMethod: delivery }).where(eq(orders.id, order.id));
    await tx.update(purchasers).set({ name }).where(eq(purchasers.id, order.purchaserId));
    return { order, item };
  };

  for (let n = 0; n < 20; n++) add("available_blank", (await tx.insert(cards).values({ stockPurchaseId: stock.id }).returning())[0].id);
  for (let n = 0; n < 6; n++) { const c = await dbc("blank"); await credential(c.id); add("needs_preparation", c.id); }
  const ana = await makeOrder("Ana Buyer", "pickup", 4);
  for (let n = 0; n < 4; n++) {
    const c = await dbc("blank"); await credential(c.id);
    await tx.update(cards).set({ state: "preparing", orderItemId: ana.item.id }).where(eq(cards.id, c.id));
    add("needs_preparation", c.id);
  }
  for (let n = 0; n < 8; n++) { const c = await dbc("blank"); await credential(c.id); await tx.update(cards).set({ state: "ready", nfcVerifiedAt: new Date(), packageMatchedAt: new Date() }).where(eq(cards.id, c.id)); add("ready", c.id); }
  const long = "Maria Cristina Dela Cruz-Santos y Villanueva ".repeat(2).trim();
  const courier = await makeOrder(long, "courier", 5);
  for (let n = 0; n < 5; n++) { const c = await dbc("blank", { nfcVerifiedAt: new Date(), packageMatchedAt: new Date() }); await tx.update(cards).set({ state: "reserved", orderItemId: courier.item.id }).where(eq(cards.id, c.id)); add("assigned", c.id); }
  const shippedOrder = await makeOrder("Shipped Buyer", "courier", 3);
  await tx.insert(shipments).values({ orderId: shippedOrder.order.id, courier: "J&T", trackingNumber: "JT900123456", status: "in_transit", shippedOn: "2026-10-20" });
  for (let n = 0; n < 3; n++) { const c = await dbc("blank"); await tx.update(cards).set({ state: "released", orderItemId: shippedOrder.item.id }).where(eq(cards.id, c.id)); add("shipped", c.id); }
  const handed = await makeOrder("Handed Buyer", "pickup", 3);
  await tx.insert(activityEvents).values({ type: "order_handed_over", orderId: handed.order.id });
  for (let n = 0; n < 3; n++) { const c = await dbc("blank"); await tx.update(cards).set({ state: "released", orderItemId: handed.item.id }).where(eq(cards.id, c.id)); add("given", c.id); }
  const bare = await makeOrder("Legacy Buyer", "courier", 2);
  for (let n = 0; n < 2; n++) { const c = await dbc("blank"); await tx.update(cards).set({ state: "released", orderItemId: bare.item.id }).where(eq(cards.id, c.id)); add("waiting_activation", c.id); }
  const claimedOrder = await makeOrder("Claimed Buyer", "pickup", 4);
  for (let n = 0; n < 4; n++) {
    const owner = await insertAccount(tx);
    const c = await dbc("blank"); await credential(c.id, { usedAt: new Date() });
    await tx.update(cards).set({ state: "released", orderItemId: claimedOrder.item.id, ownerAccountId: owner.id }).where(eq(cards.id, c.id)); add("activated", c.id);
  }
  for (let n = 0; n < 3; n++) { const c = await dbc("blank"); await credential(c.id, { revokedAt: new Date() }); await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, c.id)); add("retired", c.id); }
  return { byStatus, order: { courier: { id: courier.order.id, number: courier.order.number }, handed: { id: handed.order.id }, ana: { id: ana.order.id } } };
}

const FILTERS: [QueueFilter, string[]][] = [
  ["needs_preparation", ["needs_preparation"]], ["ready", ["ready"]], ["assigned", ["assigned"]],
  ["delivered", ["shipped", "given", "waiting_activation"]], ["activated", ["activated"]], ["retired", ["retired"]], ["available", ["available_blank"]],
];

describe("stock shortage", () => {
  test("sums the unallocated quantity of paid normal orders only", () => rollback(db, async (tx) => {
    expect(await stockShortage(tx)).toBe(0);
    const product = await insertProduct(tx, "dbc");
    const { owner, purchaser } = await insertOrder(tx);
    const [order] = await tx.insert(orders).values({ purchaserId: purchaser.id, createdByAccountId: owner.id, assignedToAccountId: owner.id, clientKey: crypto.randomUUID(), normalPaymentMethod: "gcash", deliveryMethod: "local_handoff" }).returning();
    const [item] = await tx.insert(orderItems).values({ orderId: order.id, productId: product.id, productKind: "dbc", quantity: 5, unitPrice: 79900 }).returning();
    expect(await stockShortage(tx)).toBe(5);
    const stock = await insertStockPurchase(tx);
    const [card] = await tx.insert(cards).values({ stockPurchaseId: stock.id, productId: item.productId, kind: "dbc", publicToken: syntheticToken(), state: "blank" }).returning();
    await tx.update(cards).set({ state: "reserved", orderItemId: item.id, nfcVerifiedAt: new Date(), packageMatchedAt: new Date() }).where(eq(cards.id, card.id));
    expect(await stockShortage(tx)).toBe(4);
    await insertOrderItem(tx, "dbc", 3); // a legacy order (no client key) is not a paid stock wait
    expect(await stockShortage(tx)).toBe(4);
  }));
});

describe("inventory queue", () => {
  test("49 untouched blanks collapse out of the default queue without losing their records", () => rollback(db, async (tx) => {
    const stock = await insertStockPurchase(tx);
    await tx.insert(cards).values(Array.from({ length: 50 }, () => ({ stockPurchaseId: stock.id })));
    const [allocated] = await tx.select({ id: cards.id }).from(cards).limit(1);
    const product = await insertProduct(tx, "dbc");
    await tx.update(cards).set({ kind: "dbc", productId: product.id, publicToken: syntheticToken() }).where(eq(cards.id, allocated.id));
    expect(await countInventoryQueue(tx, {})).toBe(1);
    expect(await countInventoryQueue(tx, { filter: "available" })).toBe(49);
    expect((await listInventoryQueue(tx, { filter: "available", limit: 50 })).cards).toHaveLength(49);
    expect((await tx.select({ id: cards.id }).from(cards))).toHaveLength(50);
  }));

  test("a released legacy GRC without a receipt needs delivery verification, never activation", () => rollback(db, async (tx) => {
    const stock = await insertStockPurchase(tx);
    const product = await insertProduct(tx, "grc");
    const { item } = await insertOrderItem(tx, "grc", 1);
    const [card] = await tx.insert(cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "grc", state: "reserved", orderItemId: item.id }).returning();
    await tx.update(cards).set({ state: "released" }).where(eq(cards.id, card.id));
    const [row] = (await listInventoryQueue(tx, { limit: 20 })).cards;
    expect(row.statusKey).toBe("delivery_unconfirmed");
    expect((await inventoryStatusCounts(tx)).find((count) => count.status === "delivery_unconfirmed")?.count).toBe(1);
  }));
  test("every card is classified once, the list excludes available blanks by default, and counts agree with the lists", () => rollback(db, async (tx) => {
    const seeded = await seed(tx);
    const counts = await inventoryStatusCounts(tx);
    const total = (key: string) => counts.filter((row) => row.status === key).reduce((sum, row) => sum + row.count, 0);
    for (const [status, ids] of Object.entries(seeded.byStatus)) expect(total(status), status).toBe(ids.length);
    expect(counts.reduce((sum, row) => sum + row.count, 0)).toBe(58);

    expect(await countInventoryQueue(tx, {})).toBe(38);
    for (const [filter, keys] of FILTERS) {
      const expected = keys.reduce((sum, key) => sum + seeded.byStatus[key].length, 0);
      expect(await countInventoryQueue(tx, { filter }), filter).toBe(expected);
      const listed = await listInventoryQueue(tx, { filter, limit: 100 });
      expect(listed.cards.map((card) => card.id).sort(), filter).toEqual(keys.flatMap((key) => seeded.byStatus[key]).sort());
    }
  }));

  test("SQL status keys match the pure owner mapping for every card", () => rollback(db, async (tx) => {
    await seed(tx);
    const all = await listInventoryQueue(tx, { filter: undefined, search: undefined, includeAvailable: true, limit: 100 });
    expect(all.cards).toHaveLength(58);
    const label: Record<string, string> = { available_blank: "Available blank", needs_preparation: "Needs preparation", ready: "Ready", assigned: "Assigned", shipped: "Shipped", given: "Given to customer", waiting_activation: "Waiting for activation", delivery_unconfirmed: "Delivery to verify", activated: "Activated", retired: "Retired" };
    for (const card of all.cards) {
      const facts: InventoryOperationFacts = { id: card.id, kind: card.kind, state: card.state, publicToken: card.publicToken, ownerAccountId: card.ownerAccountId, orderId: card.orderId, deliveryMethod: card.deliveryMethod, hasShippedShipment: card.shipped, hasHandedOver: card.handedOver };
      expect(label[card.statusKey], card.id).toBe(toInventoryOperation(facts).status);
    }
  }));

  test("pages 58 cards by number without gaps or repeats, preserving filters, with exact boundaries", () => rollback(db, async (tx) => {
    await seed(tx);
    const total = await countInventoryQueue(tx, { includeAvailable: true });
    expect(total).toBe(58);
    const seen: string[] = [];
    for (let page = 0; page < 3; page++) seen.push(...(await listInventoryQueue(tx, { includeAvailable: true, limit: 20, offset: page * 20 })).cards.map((c) => c.id));
    expect(seen).toHaveLength(58);
    expect(new Set(seen).size).toBe(58);
    expect((await listInventoryQueue(tx, { includeAvailable: true, limit: 20, offset: 60 })).cards).toHaveLength(0);
    // cursor continuation (precise created_at) agrees with offset paging
    const cursorSeen: string[] = [];
    let before: string | undefined; let pages = 0;
    do { const page = await listInventoryQueue(tx, { includeAvailable: true, limit: 20, before }); cursorSeen.push(...page.cards.map((c) => c.id)); before = page.next ?? undefined; pages++; } while (before && pages < 10);
    expect(cursorSeen).toEqual(seen);
    const filtered = await listInventoryQueue(tx, { filter: "assigned", search: "Villanueva", limit: 2 });
    const continued = await listInventoryQueue(tx, { filter: "assigned", search: "Villanueva", limit: 2, before: filtered.next! });
    expect(filtered.cards).toHaveLength(2);
    expect(continued.cards).toHaveLength(2);
    expect(new Set([...filtered.cards, ...continued.cards].map((card) => card.id)).size).toBe(4);
    expect([...filtered.cards, ...continued.cards].every((card) => card.statusKey === "assigned" && card.customer?.includes("Villanueva"))).toBe(true);
  }));

  test("search finds the card reference, order number, customer name and tracking number, and nothing else", () => rollback(db, async (tx) => {
    const seeded = await seed(tx);
    const [any] = (await listInventoryQueue(tx, { filter: "ready", limit: 1 })).cards;
    const byReference = await listInventoryQueue(tx, { search: `N-${String(any.inventoryNumber).padStart(4, "0")}`, limit: 20 });
    expect(byReference.cards.map((card) => card.id)).toEqual([any.id]);
    expect((await listInventoryQueue(tx, { search: String(any.inventoryNumber), limit: 100 })).cards.map((c) => c.id)).toContain(any.id);
    expect((await listInventoryQueue(tx, { search: String(seeded.order.courier.number), limit: 100 })).cards.map((c) => c.id).sort()).toEqual(seeded.byStatus.assigned.sort());
    expect((await listInventoryQueue(tx, { search: "villanueva", limit: 100 })).cards.map((c) => c.id).sort()).toEqual(seeded.byStatus.assigned.sort());
    expect((await listInventoryQueue(tx, { search: "jt9001", limit: 100 })).cards.map((c) => c.id).sort()).toEqual(seeded.byStatus.shipped.sort());
    expect(await countInventoryQueue(tx, { search: "villanueva" })).toBe(5);
    expect(await countInventoryQueue(tx, { search: "%" })).toBe(0);
  }));

  test("an activation code or its HMAC is never searchable, and rows carry no code, envelope or HMAC", () => rollback(db, async (tx) => {
    await seed(tx);
    const [row] = await tx.select().from(activationCredentials).limit(1);
    const hmac = row.lookupHmac;
    await tx.update(activationCredentials).set({ encryptedCode: null }).where(eq(activationCredentials.id, row.id));
    expect(await countInventoryQueue(tx, { search: hmac })).toBe(0);
    expect(await countInventoryQueue(tx, { search: hmac.slice(0, 16) })).toBe(0);
    expect(await countInventoryQueue(tx, { search: "ABCD-EFGH" })).toBe(0);
    const { cards: rows } = await listInventoryQueue(tx, { includeAvailable: true, limit: 100 });
    const json = JSON.stringify(rows);
    expect(json).not.toContain(hmac);
    for (const key of ["encryptedCode", "encrypted_code", "lookupHmac", "lookup_hmac"]) expect(json).not.toContain(key);
  }));

  test("activation facts distinguish usable, legacy, revoked and claimed credentials without exposing a code", () => rollback(db, async (tx) => {
    const seeded = await seed(tx);
    const rows = (await listInventoryQueue(tx, { includeAvailable: true, limit: 100 })).cards;
    const get = (id: string) => rows.find((row) => row.id === id)!;
    expect(get(seeded.byStatus.ready[0]).activation).toEqual({ usable: true, retrievable: false, revoked: false });
    expect(get(seeded.byStatus.retired[0]).activation).toMatchObject({ usable: false, revoked: true });
    expect(get(seeded.byStatus.available_blank[0]).activation).toEqual({ usable: false, retrievable: false, revoked: false });
    expect(get(seeded.byStatus.shipped[0])).toMatchObject({ tracking: "JT900123456", courier: "J&T", shipped: true });
  }));

  test("global search uses the same status words and finds cards by their N-reference", () => rollback(db, async (tx) => {
    const seeded = await seed(tx);
    const id = seeded.byStatus.shipped[0];
    const [card] = await tx.select({ n: cards.inventoryNumber }).from(cards).where(eq(cards.id, id));
    const { hits } = await searchRecords(tx, `N-${String(card.n).padStart(4, "0")}`, { limit: 10 });
    const hit = hits.find((h) => h.type === "card" && h.id === id);
    expect(hit).toMatchObject({ title: `N-${String(card.n).padStart(4, "0")}`, status: "Shipped" });
  }));
});
