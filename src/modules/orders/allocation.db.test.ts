import { eq } from "drizzle-orm";
import { beforeAll, expect, test, vi } from "vitest";
const audit = vi.hoisted(() => ({ fail: false }));
vi.mock("../activity/record", async (importOriginal) => {
  const original = await importOriginal<typeof import("../activity/record")>();
  return { ...original, recordActivity: (...args: Parameters<typeof original.recordActivity>) => audit.fail ? Promise.reject(new Error("Synthetic audit failure")) : original.recordActivity(...args) };
});
import * as s from "@/db/schema";
import { insertAccount, insertProduct, insertStockPurchase } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { allocateDbcCards } from "./allocation";
import { createPaidDbcOrder } from "./normal-dbc";
import { loadOrderFacts } from "./order";
import { getOrderDetail } from "./queries";
import { cardById, normalOrderInput, preparedStock, syntheticCredentialSecrets, virginStock } from "./operations-test-fixtures";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("Ready stock wins before virgin Blank, with distinct allocated and prepared counts", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const ready = await preparedStock(tx, owner.id, secrets);
  const [virgin] = await virginStock(tx, 1);
  const { orderId, allocation } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  expect(allocation).toEqual({ allocatedCardIds: [ready.cardId], missingQuantity: 0 });
  expect(await cardById(tx, ready.cardId)).toMatchObject({ state: "reserved" });
  expect(await cardById(tx, virgin)).toMatchObject({ state: "blank" });
  expect((await loadOrderFacts(tx, orderId)).items[0]).toMatchObject({ allocatedCount: 1, preparedCount: 1, releasedCount: 0 });
  expect(await allocateDbcCards(tx, { actorId: owner.id, orderId, secrets })).toEqual({ allocatedCardIds: [], missingQuantity: 0 });
}));

test("virgin Blank is atomically linked and issued a recoverable credential as Preparing", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  const product = await insertProduct(tx, "dbc");
  const [blank] = await virginStock(tx, 1);
  const { orderId, allocation } = await createPaidDbcOrder(tx, normalOrderInput(owner.id));
  expect(allocation).toEqual({ allocatedCardIds: [blank], missingQuantity: 0 });
  const card = await cardById(tx, blank);
  expect(card).toMatchObject({ state: "preparing", kind: "dbc", productId: product.id });
  expect(card.publicToken).toBeTruthy();
  expect(card.orderItemId).toBeTruthy();
  expect((await tx.select().from(s.activationCredentials).where(eq(s.activationCredentials.cardId, blank)))[0].encryptedCode).toBeTruthy();
  expect((await loadOrderFacts(tx, orderId)).items[0]).toMatchObject({ allocatedCount: 1, preparedCount: 0, releasedCount: 0 });
  expect((await getOrderDetail(tx, orderId))?.items[0]).toMatchObject({ allocatedCount: 1, preparedCount: 0, releasedCount: 0 });
}));

test("token-bearing Blank, GRC stock and wrong-product stock are skipped, with exact replay deficit", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  const dbc = await insertProduct(tx, "dbc");
  const grc = await insertProduct(tx, "grc");
  const [inactive] = await tx.insert(s.products).values({ kind: "dbc", name: "Inactive DBC", price: 1, active: false }).returning();
  const stock = await insertStockPurchase(tx);
  await tx.insert(s.cards).values([
    { stockPurchaseId: stock.id, productId: dbc.id, kind: "dbc", publicToken: "ABCDEFGHIJKLMNOPQRSTUVWX12" },
    { stockPurchaseId: stock.id, productId: grc.id, kind: "grc" },
    { stockPurchaseId: stock.id, productId: inactive.id, kind: "dbc" },
    { stockPurchaseId: stock.id, productId: dbc.id, kind: "dbc", state: "retired" },
  ]);
  const input = normalOrderInput(owner.id, { quantity: 2 });
  const first = await createPaidDbcOrder(tx, input);
  expect(first.allocation).toEqual({ allocatedCardIds: [], missingQuantity: 2 });
  const [virgin] = await virginStock(tx, 1);
  const retried = await allocateDbcCards(tx, { actorId: owner.id, orderId: first.orderId, secrets: input.secrets });
  expect(retried).toEqual({ allocatedCardIds: [virgin], missingQuantity: 1 });
  expect((await createPaidDbcOrder(tx, input)).allocation).toEqual({ allocatedCardIds: [], missingQuantity: 1 });
}));

test("a non-owner cannot allocate a Ready card", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  const { cardId } = await preparedStock(tx, owner.id, secrets);
  const customer = await insertAccount(tx, "customer");
  await expect(allocateDbcCards(tx, { actorId: customer.id, orderId, secrets })).rejects.toMatchObject({ code: "invalid_input" });
  expect(await cardById(tx, cardId)).toMatchObject({ state: "ready", orderItemId: null });
}));

test("audit failure rolls token, credential and Preparing state back together", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  const [cardId] = await virginStock(tx, 1);
  audit.fail = true;
  try {
    await expect(allocateDbcCards(tx, { actorId: owner.id, orderId, secrets })).rejects.toThrow("Synthetic audit failure");
  } finally { audit.fail = false; }
  expect(await cardById(tx, cardId)).toMatchObject({ state: "blank", publicToken: null, orderItemId: null });
  expect(await tx.select().from(s.activationCredentials).where(eq(s.activationCredentials.cardId, cardId))).toHaveLength(0);
}));
