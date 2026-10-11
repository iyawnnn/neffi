import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activationCredentials, activityEvents, cards, orderItems } from "@/db/schema";
import { insertAccount, insertClaimedCard, insertOrderItem, insertStockPurchase } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { matchPackage, provisionDbc } from "./dbc";
import { recordNfcCheck, retireCard } from "./card";
import { eligibleGrcItems, reserveGrc } from "./grc";
import { cardUrl } from "./token";
import { insertProduct } from "@/db/test-fixtures";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const SECRET = "s".repeat(40);
const ORIGIN = "https://tap.example.test";
const events = (tx: TestTx, cardId: string) => tx.select().from(activityEvents).where(eq(activityEvents.cardId, cardId));
const reload = async (tx: TestTx, cardId: string) => (await tx.select().from(cards).where(eq(cards.id, cardId)))[0];

async function blankCard(tx: TestTx) {
  const owner = await insertAccount(tx, "owner");
  const stock = await insertStockPurchase(tx);
  const [card] = await tx.insert(cards).values({ stockPurchaseId: stock.id }).returning();
  return { owner, card, stock, base: { actorId: owner.id, cardId: card.id } };
}

describe("retireCard", () => {
  test("retires a blank card and records why", () =>
    rollback(db, async (tx) => {
      const { base, card } = await blankCard(tx);
      await retireCard(tx, { ...base, reason: "tag failed to write" });
      expect((await reload(tx, card.id)).state).toBe("retired");
      expect((await events(tx, card.id)).find((e) => e.type === "card_retired")?.note).toContain("tag failed to write");
    }));

  test("revokes a DBC's usable credential in the same transaction, keeping the history", () =>
    rollback(db, async (tx) => {
      const { base, card } = await blankCard(tx);
      await insertProduct(tx, "dbc");
      const provisioned = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      await recordNfcCheck(tx, { ...base, cardUrlOrigin: ORIGIN, readBackUri: cardUrl(ORIGIN, provisioned.publicToken), readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true });
      await matchPackage(tx, { ...base, activationCode: provisioned.activationCode, activationSecret: SECRET });

      await retireCard(tx, { ...base, reason: "damaged in packaging" });

      const credentials = await tx.select().from(activationCredentials).where(eq(activationCredentials.cardId, card.id));
      expect(credentials).toHaveLength(1);
      expect(credentials[0].revokedAt).toBeInstanceOf(Date);
      expect(await reload(tx, card.id)).toMatchObject({ state: "retired", publicToken: provisioned.publicToken });
    }));

  test("retiring a reserved GRC keeps its order link as history and frees the slot", () =>
    rollback(db, async (tx) => {
      const { item, order, owner } = await insertOrderItem(tx, "grc", 1);
      await tx.update(orderItems).set({ reviewUrl: "https://g.page/r/synthetic/review" }).where(eq(orderItems.id, item.id));
      const stock = await insertStockPurchase(tx);
      const [first, second] = await tx.insert(cards).values([{ stockPurchaseId: stock.id }, { stockPurchaseId: stock.id }]).returning();
      const actorId = owner.id;
      await reserveGrc(tx, { actorId, cardId: first.id, orderItemId: item.id });
      await expect(reserveGrc(tx, { actorId, cardId: second.id, orderItemId: item.id })).rejects.toMatchObject({ code: "item_full" });

      await retireCard(tx, { actorId, cardId: first.id, reason: "encode failed" });

      expect(await reload(tx, first.id)).toMatchObject({ state: "retired", orderItemId: item.id });
      expect((await events(tx, first.id)).find((e) => e.type === "card_retired")).toMatchObject({ orderId: order.id });
      expect((await eligibleGrcItems(tx)).find((row) => row.orderItemId === item.id)?.remaining).toBe(1);
      await reserveGrc(tx, { actorId, cardId: second.id, orderItemId: item.id });
      expect((await reload(tx, second.id)).state).toBe("reserved");
    }));

  test("released and already retired cards are not touched", () =>
    rollback(db, async (tx) => {
      const { card } = await insertClaimedCard(tx);
      const owner = await insertAccount(tx, "owner");
      await expect(retireCard(tx, { actorId: owner.id, cardId: card.id, reason: "x" })).rejects.toMatchObject({ code: "wrong_state" });
      const { base } = await blankCard(tx);
      await retireCard(tx, { ...base, reason: "first" });
      await expect(retireCard(tx, { ...base, reason: "second" })).rejects.toMatchObject({ code: "wrong_state" });
      await expect(retireCard(tx, { ...base, cardId: crypto.randomUUID(), reason: "x" })).rejects.toMatchObject({ code: "not_found" });
    }));
});
