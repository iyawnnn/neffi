import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activationCredentials, activityEvents, cards, orderItems, orders } from "@/db/schema";
import { insertOrderItem, insertProduct, insertStockPurchase, syntheticCredentialSecrets, syntheticLookup } from "@/db/test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb, type TestTx } from "@/db/testing";
import { recordNfcCheck } from "./card";
import { provisionDbc } from "./dbc";
import { eligibleGrcItems, reserveGrc } from "./grc";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const REVIEW_URL = "https://g.page/r/synthetic-review/review";

async function setup(tx: TestTx, quantity = 2) {
  const { item, order, owner } = await insertOrderItem(tx, "grc", quantity);
  await tx.update(orderItems).set({ reviewUrl: REVIEW_URL, label: "Branch A" }).where(eq(orderItems.id, item.id));
  const stock = await insertStockPurchase(tx);
  const blank = async () => (await tx.insert(cards).values({ stockPurchaseId: stock.id }).returning())[0];
  return { item, order, owner, stock, blank, actorId: owner.id };
}
const reload = async (tx: TestTx, cardId: string) => (await tx.select().from(cards).where(eq(cards.id, cardId)))[0];
const events = (tx: TestTx, cardId: string) => tx.select().from(activityEvents).where(eq(activityEvents.cardId, cardId));
const nfc = (tx: TestTx, actorId: string, cardId: string, readBackUri: string, overrides = {}) =>
  recordNfcCheck(tx, { actorId, cardId, cardUrlOrigin: "https://tap.example.test", readBackUri, readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true, ...overrides });

describe("reserveGrc", () => {
  test("reserves a blank card against an eligible item and logs it against the order", () =>
    rollback(db, async (tx) => {
      const { item, order, blank, actorId } = await setup(tx);
      const card = await blank();
      await reserveGrc(tx, { actorId, cardId: card.id, orderItemId: item.id });

      expect(await reload(tx, card.id)).toMatchObject({ state: "reserved", kind: "grc", productId: item.productId, orderItemId: item.id, publicToken: null, nfcVerifiedAt: null });
      expect(await events(tx, card.id)).toMatchObject([{ type: "card_reserved", actorAccountId: actorId, orderId: order.id }]);
    }));

  test("a GRC never gets Account, Profile or activation behavior", () =>
    rollback(db, async (tx) => {
      const { item, blank, actorId } = await setup(tx);
      const card = await blank();
      await reserveGrc(tx, { actorId, cardId: card.id, orderItemId: item.id });
      await expectPgError(tx, (s) => s.insert(activationCredentials).values({ cardId: card.id, lookupHmac: syntheticLookup(1) }), "23503");
      await expectPgError(tx, (s) => s.update(cards).set({ publicToken: "SYNTH-GRC" }).where(eq(cards.id, card.id)), "23514", "cards_dbc_only_fields");
    }));

  test("refuses ineligible items without writing", () =>
    rollback(db, async (tx) => {
      const { item, order, blank, actorId } = await setup(tx);
      const card = await blank();
      const reserve = (orderItemId: string) => reserveGrc(tx, { actorId, cardId: card.id, orderItemId });

      await expect(reserve(crypto.randomUUID())).rejects.toMatchObject({ code: "item_ineligible" });
      const dbcItem = await insertOrderItem(tx, "dbc");
      await expect(reserve(dbcItem.item.id)).rejects.toMatchObject({ code: "item_ineligible" });
      await tx.update(orderItems).set({ reviewUrl: null }).where(eq(orderItems.id, item.id));
      await expect(reserve(item.id)).rejects.toMatchObject({ code: "item_ineligible" });
      await tx.update(orderItems).set({ reviewUrl: REVIEW_URL }).where(eq(orderItems.id, item.id));
      await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, order.id));
      await expect(reserve(item.id)).rejects.toMatchObject({ code: "item_ineligible" });

      expect(await reload(tx, card.id)).toMatchObject({ state: "blank", orderItemId: null, kind: null });
    }));

  test("never exceeds the item quantity", () =>
    rollback(db, async (tx) => {
      const { item, blank, actorId } = await setup(tx, 1);
      const [first, second] = [await blank(), await blank()];
      await reserveGrc(tx, { actorId, cardId: first.id, orderItemId: item.id });
      await expect(reserveGrc(tx, { actorId, cardId: second.id, orderItemId: item.id })).rejects.toMatchObject({ code: "item_full" });
      expect(await reload(tx, second.id)).toMatchObject({ state: "blank", orderItemId: null });
    }));

  test("only an uncommitted or GRC blank card can be reserved", () =>
    rollback(db, async (tx) => {
      const { item, blank, actorId, stock } = await setup(tx);
      const dbc = await insertProduct(tx, "dbc");
      const [dbcCard] = await tx.insert(cards).values({ stockPurchaseId: stock.id, productId: dbc.id, kind: "dbc" }).returning();
      await expect(reserveGrc(tx, { actorId, cardId: dbcCard.id, orderItemId: item.id })).rejects.toMatchObject({ code: "wrong_state" });

      const provisioning = await blank();
      await tx.update(cards).set({ productId: dbc.id, kind: "dbc" }).where(eq(cards.id, provisioning.id));
      const provisioned = await provisionDbc(tx, { actorId, cardId: provisioning.id, secrets: syntheticCredentialSecrets("s".repeat(40)) });
      expect(provisioned.publicToken).toBeTruthy();
      await expect(reserveGrc(tx, { actorId, cardId: provisioning.id, orderItemId: item.id })).rejects.toMatchObject({ code: "wrong_state" });

      const retired = await blank();
      await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, retired.id));
      await expect(reserveGrc(tx, { actorId, cardId: retired.id, orderItemId: item.id })).rejects.toMatchObject({ code: "wrong_state" });
      await expect(reserveGrc(tx, { actorId, cardId: crypto.randomUUID(), orderItemId: item.id })).rejects.toMatchObject({ code: "not_found" });
    }));
});

describe("eligibleGrcItems", () => {
  test("lists only open GRC items that still have capacity, with the remaining count", () =>
    rollback(db, async (tx) => {
      const open = await setup(tx, 2);
      const full = await setup(tx, 1);
      const noUrl = await insertOrderItem(tx, "grc");
      const dbcItem = await insertOrderItem(tx, "dbc");
      await reserveGrc(tx, { actorId: open.actorId, cardId: (await open.blank()).id, orderItemId: open.item.id });
      await reserveGrc(tx, { actorId: full.actorId, cardId: (await full.blank()).id, orderItemId: full.item.id });

      const ids = new Map((await eligibleGrcItems(tx)).map((row) => [row.orderItemId, row]));
      expect(ids.get(open.item.id)).toMatchObject({ remaining: 1, label: "Branch A", reviewUrl: REVIEW_URL });
      for (const excluded of [full.item.id, noUrl.item.id, dbcItem.item.id]) expect(ids.has(excluded)).toBe(false);
    }));
});

describe("recordNfcCheck (GRC encode test)", () => {
  async function reserved(tx: TestTx) {
    const s = await setup(tx);
    const card = await s.blank();
    await reserveGrc(tx, { actorId: s.actorId, cardId: card.id, orderItemId: s.item.id });
    return { ...s, card };
  }

  test("verifies the exact current review URL and logs it against the order", () =>
    rollback(db, async (tx) => {
      const { card, actorId, order } = await reserved(tx);
      await nfc(tx, actorId, card.id, ` ${REVIEW_URL} `);
      expect((await reload(tx, card.id)).nfcVerifiedAt).toBeInstanceOf(Date);
      expect((await events(tx, card.id)).find((event) => event.type === "card_nfc_verified")).toMatchObject({ orderId: order.id });
    }));

  test("compares against the item's current URL, not the one at reservation", () =>
    rollback(db, async (tx) => {
      const { card, actorId, item } = await reserved(tx);
      await tx.update(orderItems).set({ reviewUrl: "https://g.page/r/changed/review" }).where(eq(orderItems.id, item.id));
      await expect(nfc(tx, actorId, card.id, REVIEW_URL)).rejects.toMatchObject({ code: "uri_mismatch" });
      await nfc(tx, actorId, card.id, "https://g.page/r/changed/review");
    }));

  test("is refused once the order is no longer in progress, and needs every confirmation", () =>
    rollback(db, async (tx) => {
      const { card, actorId, order } = await reserved(tx);
      await expect(nfc(tx, actorId, card.id, REVIEW_URL, { tagLeftWritable: false })).rejects.toMatchObject({ code: "checks_incomplete" });
      await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, order.id));
      await expect(nfc(tx, actorId, card.id, REVIEW_URL)).rejects.toMatchObject({ code: "item_ineligible" });
      expect((await reload(tx, card.id)).nfcVerifiedAt).toBeNull();
    }));

  test("a blank GRC has nothing to encode yet", () =>
    rollback(db, async (tx) => {
      const { blank, actorId } = await setup(tx);
      const card = await blank();
      await expect(nfc(tx, actorId, card.id, REVIEW_URL)).rejects.toMatchObject({ code: "wrong_state" });
    }));
});
