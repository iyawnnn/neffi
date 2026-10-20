import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards, stockPurchases } from "@/db/schema";
import { insertAccount, insertClaimedCard, insertProvisioningDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { receiveStock } from "./stock-intake";
import { getCardDetail, listCards } from "./queries";
import { getStockPurchase, listStockPurchases, updateStockPurchase } from "./stock-purchases";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("costs stay on their source; quantity and states derive only from Cards", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  const { stockPurchaseId } = await receiveStock(tx, { actorId: owner.id, receivedOn: "2026-10-13", quantity: 3, purchaseCost: 12345, inboundShippingCost: 500 });
  await updateStockPurchase(tx, { stockPurchaseId, receivedOn: "2026-10-12", supplier: "Updated", purchaseCost: 15000, inboundShippingCost: null, reference: "Invoice", notes: "Batch" });
  const [card] = await tx.select().from(cards).where(eq(cards.stockPurchaseId, stockPurchaseId));
  await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, card.id));
  expect(await getStockPurchase(tx, stockPurchaseId)).toMatchObject({ quantity: 3, purchaseCost: 15000, inboundShippingCost: null, supplier: "Updated", states: { blank: 2, retired: 1 } });
  expect(await listStockPurchases(tx, { limit: 20 })).toMatchObject([{ id: stockPurchaseId, quantity: 3 }]);
  expect(await getStockPurchase(tx, crypto.randomUUID())).toBeNull();
  expect((await tx.select().from(stockPurchases))).toHaveLength(1);
}));

test("filters kind/state without changing keyset pagination", () => rollback(db, async (tx) => {
  await insertProvisioningDbc(tx);
  const { card } = await insertClaimedCard(tx);
  expect((await listCards(tx, { limit: 5, kind: "dbc", state: "released" })).cards.map((c) => c.id)).toEqual([card.id]);
  expect((await listCards(tx, { limit: 5, kind: "grc" })).cards).toEqual([]);
}));

test("Card detail links purchaser and exposes only approved owning Account fields", () => rollback(db, async (tx) => {
  const { card, owner } = await insertClaimedCard(tx);
  const detail = await getCardDetail(tx, card.id);
  expect(detail?.purchaser?.name).toContain("Synthetic Purchaser");
  expect(detail?.owningAccount).toEqual({ email: owner.email, role: owner.role, createdAt: owner.createdAt });
  expect(Object.keys(detail!.owningAccount!).sort()).toEqual(["createdAt", "email", "role"]);
}));
