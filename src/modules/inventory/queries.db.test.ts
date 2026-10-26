import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activationCredentials, cards, orderItems } from "@/db/schema";
import { insertAccount, insertOrderItem, insertProvisioningDbc, insertStockPurchase, syntheticLookup } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { recordActivity } from "../activity/record";
import { getCardDetail } from "./queries";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

describe("getCardDetail", () => {
  test("returns the card with its usable credential id, order context and recent activity, but no lookup hash", () =>
    rollback(db, async (tx) => {
      const { card } = await insertProvisioningDbc(tx);
      const owner = await insertAccount(tx, "owner");
      const [usable] = await tx.insert(activationCredentials).values({ cardId: card.id, lookupHmac: syntheticLookup(77) }).returning();
      await recordActivity(tx, { type: "card_provisioned", actorAccountId: owner.id, cardId: card.id, note: "token x" });

      const detail = await getCardDetail(tx, card.id);
      expect(detail).toMatchObject({ id: card.id, state: "blank", usableCredentialId: usable.id, credentialCount: 1, orderContext: null, credentialRetrievable: false });
      expect(detail?.activity).toMatchObject([{ type: "card_provisioned", note: "token x" }]);
      expect(JSON.stringify(detail)).not.toContain(syntheticLookup(77));
    }));

  test("includes the order item destination for a reserved GRC and returns null for an unknown card", () =>
    rollback(db, async (tx) => {
      const { item, order, product } = await insertOrderItem(tx, "grc", 1);
      const stock = await insertStockPurchase(tx);
      await tx.update(orderItems).set({ reviewUrl: "https://g.page/r/x/review", label: "Branch A" }).where(eq(orderItems.id, item.id));
      const [card] = await tx
        .insert(cards)
        .values({ stockPurchaseId: stock.id, productId: product.id, kind: "grc", state: "reserved", orderItemId: item.id })
        .returning();

      const detail = await getCardDetail(tx, card.id);
      expect(detail?.orderContext).toEqual({ orderId: order.id, orderNumber: order.number, label: "Branch A", reviewUrl: "https://g.page/r/x/review", status: "in_progress" });
      expect(detail?.usableCredentialId).toBeNull();
      expect(await getCardDetail(tx, crypto.randomUUID())).toBeNull();
    }));
});
