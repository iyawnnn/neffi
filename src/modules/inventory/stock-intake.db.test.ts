import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activityEvents, cards, orderItems, orders, payments, stockPurchases } from "@/db/schema";
import { insertAccount, insertProduct } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { receiveStock } from "./stock-intake";
import { createPaidDbcOrder } from "../orders/normal-dbc";
import { allocateDbcCards } from "../orders/allocation";
import { normalOrderInput, syntheticCredentialSecrets } from "../orders/operations-test-fixtures";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const input = { receivedOn: "2026-10-10" };

describe("receiveStock", () => {
  test("committed stock retries the oldest waiting paid order without another receipt", () => rollback(db, async (tx) => {
    const owner = await insertAccount(tx, "owner");
    await insertProduct(tx, "dbc");
    const secrets = syntheticCredentialSecrets();
    const input = normalOrderInput(owner.id, { secrets });
    const first = await createPaidDbcOrder(tx, input);
    expect(first.allocation.missingQuantity).toBe(1);
    expect(await receiveStock(tx, { actorId: owner.id, quantity: 1, receivedOn: "2026-10-10", secrets })).toMatchObject({ retryFailed: false });
    expect((await tx.select().from(cards))[0]).toMatchObject({ state: "preparing" });
    expect((await createPaidDbcOrder(tx, input)).allocation.missingQuantity).toBe(0);
    expect(await tx.select().from(payments)).toHaveLength(1);
  }));

  test("one new card goes to the oldest waiting order", () => rollback(db, async (tx) => {
    const owner = await insertAccount(tx, "owner");
    await insertProduct(tx, "dbc");
    const secrets = syntheticCredentialSecrets();
    const first = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
    const second = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
    await tx.update(orders).set({ createdAt: new Date("2026-10-01") }).where(eq(orders.id, first.orderId));
    await receiveStock(tx, { actorId: owner.id, quantity: 1, receivedOn: "2026-10-10", secrets });
    expect((await tx.select().from(cards))[0].orderItemId).toBe((await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, first.orderId)))[0].id);
    expect((await allocateDbcCards(tx, { actorId: owner.id, orderId: second.orderId, secrets })).missingQuantity).toBe(1);
  }));

  test("failed allocation retry keeps received stock available for manual retry", () => rollback(db, async (tx) => {
    const owner = await insertAccount(tx, "owner");
    await insertProduct(tx, "dbc");
    const secrets = syntheticCredentialSecrets();
    const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
    const invalidSecrets = { ...secrets, activeKeyId: "missing" };
    expect(await receiveStock(tx, { actorId: owner.id, quantity: 1, receivedOn: "2026-10-10", secrets: invalidSecrets })).toMatchObject({ retryFailed: true });
    expect((await tx.select().from(cards))[0]).toMatchObject({ state: "blank", publicToken: null });
    expect(await allocateDbcCards(tx, { actorId: owner.id, orderId, secrets })).toMatchObject({ missingQuantity: 0 });
  }));

  test("creates one stock purchase, N tracked blank cards and a stock_received event", () =>
    rollback(db, async (tx) => {
      const owner = await insertAccount(tx, "owner");
      const { stockPurchaseId } = await receiveStock(tx, { actorId: owner.id, quantity: 3, supplier: "Synthetic Supplier", ...input });

      const [purchase] = await tx.select().from(stockPurchases).where(eq(stockPurchases.id, stockPurchaseId));
      expect(purchase).toMatchObject({ supplier: "Synthetic Supplier", receivedOn: "2026-10-10", purchaseCost: null, inboundShippingCost: null, createdByAccountId: owner.id });
      const rows = await tx.select().from(cards).where(eq(cards.stockPurchaseId, stockPurchaseId));
      expect(rows).toHaveLength(3);
      for (const card of rows) expect(card).toMatchObject({ state: "blank", productId: null, kind: null, publicToken: null });
      const events = await tx.select().from(activityEvents).where(eq(activityEvents.stockPurchaseId, stockPurchaseId));
      expect(events).toMatchObject([{ type: "stock_received", actorAccountId: owner.id, note: "3 cards" }]);
    }));

  test("an intended kind commits the cards to the single active product of that kind", () =>
    rollback(db, async (tx) => {
      const owner = await insertAccount(tx, "owner");
      const product = await insertProduct(tx, "dbc");
      const { stockPurchaseId } = await receiveStock(tx, { actorId: owner.id, quantity: 2, intendedKind: "dbc", ...input });
      const rows = await tx.select().from(cards).where(eq(cards.stockPurchaseId, stockPurchaseId));
      expect(rows.map((card) => [card.productId, card.kind, card.state])).toEqual([
        [product.id, "dbc", "blank"],
        [product.id, "dbc", "blank"],
      ]);
    }));

  test("no active product of the intended kind writes nothing", async () => {
    await rollback(db, async (tx) => {
      const owner = await insertAccount(tx, "owner");
      await expect(receiveStock(tx, { actorId: owner.id, quantity: 1, intendedKind: "grc", ...input })).rejects.toMatchObject({ code: "no_product" });
      expect(await tx.select().from(stockPurchases)).toHaveLength(0);
      expect(await tx.select().from(cards)).toHaveLength(0);
    });
  });

  test.each([0, 501, 1.5, -1, Number.NaN])("quantity %s is rejected before any write", (quantity) =>
    rollback(db, async (tx) => {
      const owner = await insertAccount(tx, "owner");
      await expect(receiveStock(tx, { actorId: owner.id, quantity, ...input })).rejects.toThrow(RangeError);
      expect(await tx.select().from(stockPurchases)).toHaveLength(0);
    }));
});
