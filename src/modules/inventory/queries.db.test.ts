import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activationCredentials, cards, orderItems } from "@/db/schema";
import { insertAccount, insertOrderItem, insertProduct, insertProvisioningDbc, insertStockPurchase, syntheticLookup } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { recordActivity } from "../activity/record";
import { cardStateCounts, getCardDetail, listCards } from "./queries";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

async function blankCards(tx: TestTx, quantity: number) {
  const stock = await insertStockPurchase(tx);
  return tx.insert(cards).values(Array.from({ length: quantity }, () => ({ stockPurchaseId: stock.id }))).returning();
}

describe("cardStateCounts", () => {
  test("counts by kind and state, and reports blank DBCs that already have a token as in provisioning", () =>
    rollback(db, async (tx) => {
      await blankCards(tx, 3);
      await insertProvisioningDbc(tx);
      const grc = await insertProduct(tx, "grc");
      const stock = await insertStockPurchase(tx);
      await tx.insert(cards).values({ stockPurchaseId: stock.id, productId: grc.id, kind: "grc", state: "retired" });

      const counts = await cardStateCounts(tx);
      const find = (kind: string | null, state: string) => counts.rows.find((row) => row.kind === kind && row.state === state)?.count;
      expect(find(null, "blank")).toBe(3);
      expect(find("dbc", "blank")).toBe(1);
      expect(find("grc", "retired")).toBe(1);
      expect(counts.inProvisioning).toBe(1);
    }));
});

describe("listCards", () => {
  test("pages newest first without gaps or repeats, even when many rows share a created_at", () =>
    rollback(db, async (tx) => {
      const created = await blankCards(tx, 7); // one statement: identical created_at, ordered by id
      const seen: string[] = [];
      let before: string | undefined;
      let pages = 0;
      do {
        const page = await listCards(tx, { before, limit: 3 });
        seen.push(...page.cards.map((card) => card.id));
        before = page.next ?? undefined;
        pages++;
      } while (before && pages < 10);

      expect(pages).toBe(3);
      expect(seen).toHaveLength(7);
      expect(new Set(seen)).toEqual(new Set(created.map((card) => card.id)));
    }));

  test("exposes only display fields, never lookup values", () =>
    rollback(db, async (tx) => {
      await insertProvisioningDbc(tx);
      const page = await listCards(tx, { limit: 5 });
      expect(Object.keys(page.cards[0]).sort()).toEqual(["createdAt", "id", "kind", "nfcVerifiedAt", "packageMatchedAt", "publicToken", "state"]);
    }));
});

describe("getCardDetail", () => {
  test("returns the card with its usable credential id, order context and recent activity, but no lookup hash", () =>
    rollback(db, async (tx) => {
      const { card } = await insertProvisioningDbc(tx);
      const owner = await insertAccount(tx, "owner");
      const [usable] = await tx.insert(activationCredentials).values({ cardId: card.id, lookupHmac: syntheticLookup(77) }).returning();
      await recordActivity(tx, { type: "card_provisioned", actorAccountId: owner.id, cardId: card.id, note: "token x" });

      const detail = await getCardDetail(tx, card.id);
      expect(detail).toMatchObject({ id: card.id, state: "blank", usableCredentialId: usable.id, credentialCount: 1, orderContext: null });
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
      expect(detail?.orderContext).toEqual({ orderNumber: order.number, label: "Branch A", reviewUrl: "https://g.page/r/x/review" });
      expect(detail?.usableCredentialId).toBeNull();
      expect(await getCardDetail(tx, crypto.randomUUID())).toBeNull();
    }));
});
