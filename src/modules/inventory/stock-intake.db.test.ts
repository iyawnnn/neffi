import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activityEvents, cards, stockPurchases } from "@/db/schema";
import { insertAccount, insertProduct } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { CardError } from "../cards/card";
import { receiveStock } from "./stock-intake";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const input = { receivedOn: "2026-10-10" };

describe("receiveStock", () => {
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

  test("no active product, or two, of the intended kind writes nothing", async () => {
    await rollback(db, async (tx) => {
      const owner = await insertAccount(tx, "owner");
      await expect(receiveStock(tx, { actorId: owner.id, quantity: 1, intendedKind: "grc", ...input })).rejects.toMatchObject({ code: "no_product" });
      await insertProduct(tx, "grc");
      await insertProduct(tx, "grc");
      await expect(receiveStock(tx, { actorId: owner.id, quantity: 1, intendedKind: "grc", ...input })).rejects.toBeInstanceOf(CardError);
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
