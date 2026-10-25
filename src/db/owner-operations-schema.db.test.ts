import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { activityEvents, activationCredentials, cards, orders } from "./schema";
import { insertOrder, insertOrderItem, insertProvisioningDbc, insertStockPurchase, syntheticLookup, syntheticToken } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
afterAll(async () => { await db.$client.close(); });

test("inventory numbers are unique, positive and immutable", () => rollback(db, async tx => {
  const stock = await insertStockPurchase(tx);
  const [first, second] = await tx.insert(cards).values([{ stockPurchaseId: stock.id }, { stockPurchaseId: stock.id }]).returning();
  expect(first.inventoryNumber).toBeGreaterThan(0);
  expect(second.inventoryNumber).toBeGreaterThan(first.inventoryNumber);
  await expectPgError(tx, s => s.update(cards).set({ inventoryNumber: second.inventoryNumber }).where(eq(cards.id, first.id)), "P0001");
}));

test("Preparing requires an allocated DBC and usable credential", () => rollback(db, async tx => {
  const { item, product } = await insertOrderItem(tx, "dbc");
  const stock = await insertStockPurchase(tx);
  await expectPgError(tx, s => s.insert(cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "preparing", publicToken: syntheticToken() }), "P0001");
  await expectPgError(tx, s => s.insert(cards).values({ stockPurchaseId: stock.id, state: "preparing", orderItemId: item.id, productId: product.id, kind: "dbc", publicToken: syntheticToken() }), "P0001");
  const { card } = await insertProvisioningDbc(tx);
  await expectPgError(tx, s => s.update(cards).set({ state: "preparing", orderItemId: item.id, productId: product.id }).where(eq(cards.id, card.id)), "P0001");
  await tx.insert(activationCredentials).values({ cardId: card.id, lookupHmac: syntheticLookup(951) });
  await expectPgError(tx, s => s.update(cards).set({ state: "preparing" }).where(eq(cards.id, card.id)), "23514", "cards_fulfillment_needs_order_item");
  await tx.update(cards).set({ state: "preparing", orderItemId: item.id, productId: product.id }).where(eq(cards.id, card.id));
  await expectPgError(tx, s => s.update(cards).set({ state: "reserved" }).where(eq(cards.id, card.id)), "P0001");
  await tx.update(cards).set({ nfcVerifiedAt: new Date(), packageMatchedAt: new Date(), state: "reserved" }).where(eq(cards.id, card.id));
}));

test("normal orders require a fixed approved payment method and preserve their choice", () => rollback(db, async tx => {
  const { order, owner, purchaser } = await insertOrder(tx);
  const key = "00000000-0000-4000-8000-000000000123";
  const base = { purchaserId: purchaser.id, createdByAccountId: owner.id, assignedToAccountId: owner.id, clientKey: key };
  await expectPgError(tx, s => s.insert(orders).values(base), "23514", "orders_normal_payment_method_required");
  await expectPgError(tx, s => s.insert(orders).values({ ...base, normalPaymentMethod: "cash" }), "23514", "orders_normal_payment_method_required");
  const [normal] = await tx.insert(orders).values({ ...base, normalPaymentMethod: "maya" }).returning();
  await expectPgError(tx, s => s.update(orders).set({ normalPaymentMethod: "gcash" }).where(eq(orders.id, normal.id)), "P0001");
  await expectPgError(tx, s => s.update(orders).set({ clientKey: "00000000-0000-4000-8000-000000000124" }).where(eq(orders.id, normal.id)), "P0001");
  await expectPgError(tx, s => s.update(orders).set({ shippingFeePending: true }).where(eq(orders.id, order.id)), "23514", "orders_shipping_fee_pending_valid");
  await tx.update(orders).set({ deliveryMethod: "courier", shippingFeePending: true }).where(eq(orders.id, normal.id));
  await expectPgError(tx, s => s.update(orders).set({ status: "completed", completedAt: new Date() }).where(eq(orders.id, normal.id)), "23514", "orders_completed_fee_confirmed");
}));

test("credential envelopes clear on use and terminal history stays frozen", () => rollback(db, async tx => {
  const { card } = await insertProvisioningDbc(tx);
  const [credential] = await tx.insert(activationCredentials).values({ cardId: card.id, lookupHmac: syntheticLookup(952) }).returning();
  await tx.update(activationCredentials).set({ encryptedCode: "synthetic-envelope" }).where(eq(activationCredentials.id, credential.id));
  await expectPgError(tx, s => s.update(activationCredentials).set({ encryptedCode: "replacement" }).where(eq(activationCredentials.id, credential.id)), "P0001");
  await tx.update(activationCredentials).set({ usedAt: new Date() }).where(eq(activationCredentials.id, credential.id));
  const [after] = await tx.select().from(activationCredentials).where(eq(activationCredentials.id, credential.id));
  expect(after.encryptedCode).toBeNull();
  await expectPgError(tx, s => s.update(activationCredentials).set({ encryptedCode: "restored" }).where(eq(activationCredentials.id, credential.id)), "P0001");
  await expectPgError(tx, s => s.update(activationCredentials).set({ cardKind: "grc" }).where(eq(activationCredentials.id, credential.id)), "P0001");
  await expectPgError(tx, s => s.update(activationCredentials).set({ createdAt: new Date(0) }).where(eq(activationCredentials.id, credential.id)), "P0001");
  const { card: other } = await insertProvisioningDbc(tx);
  const [revoked] = await tx.insert(activationCredentials).values({ cardId: other.id, lookupHmac: syntheticLookup(954), encryptedCode: "synthetic-envelope", revokedAt: new Date() }).returning();
  expect(revoked.encryptedCode).toBeNull();
  await expectPgError(tx, s => s.update(activationCredentials).set({ encryptedCode: "restored" }).where(eq(activationCredentials.id, revoked.id)), "P0001");
  await expectPgError(tx, s => s.update(activationCredentials).set({ createdAt: new Date(0) }).where(eq(activationCredentials.id, revoked.id)), "P0001");
}));

test("activity credential references use a real FK and remain append-only", () => rollback(db, async tx => {
  const { card } = await insertProvisioningDbc(tx);
  await expectPgError(tx, s => s.insert(activityEvents).values({ type: "card_provisioned", cardId: card.id, activationCredentialId: "00000000-0000-4000-8000-000000000456" }), "23503");
  const [credential] = await tx.insert(activationCredentials).values({ cardId: card.id, lookupHmac: syntheticLookup(953) }).returning();
  const [event] = await tx.insert(activityEvents).values({ type: "card_provisioned", cardId: card.id, activationCredentialId: credential.id }).returning();
  await expectPgError(tx, s => s.update(activityEvents).set({ activationCredentialId: null }).where(eq(activityEvents.id, event.id)), "P0001");
  await expectPgError(tx, s => s.insert(activityEvents).values({ type: "card_provisioned", activationCredentialId: credential.id }), "23514", "activity_events_has_subject");
}));
