import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertOrderItem, insertProduct, insertReleasedDbc, insertStockPurchase } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { cancelOrder } from "../orders/cancel";
import { allocateDbcCards, allocationDeficit } from "../orders/allocation";
import { createPaidDbcOrder } from "../orders/normal-dbc";
import { loadOrderFacts } from "../orders/order";
import { cardById, normalOrderInput, preparedStock, syntheticCredentialSecrets, virginStock } from "../orders/operations-test-fixtures";
import { recordNfcCheck, retireCard } from "./card";
import { matchPackage, provisionDbc, replaceProvisioningCredential } from "./dbc";
import { cardUrl } from "./token";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

const origin = "https://getneffi.com";

test("allocated card needs one exact NFC read-back and a typed package code before assignment", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const [cardId] = await virginStock(tx, 1);
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  const card = await cardById(tx, cardId);
  const [credential] = await tx.select().from(s.activationCredentials).where(eq(s.activationCredentials.cardId, cardId));
  expect(card).toMatchObject({ state: "preparing", publicToken: expect.any(String), orderItemId: expect.any(String) });
  await expect(matchPackage(tx, { actorId: owner.id, cardId, activationCode: "0000-0000", activationSecret: secrets.lookupSecret })).rejects.toMatchObject({ code: "checks_incomplete" });
  const nfc = { actorId: owner.id, cardId, cardUrlOrigin: origin, readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true };
  await expect(recordNfcCheck(tx, { ...nfc, readBackUri: `${origin}/c/wrong` })).rejects.toMatchObject({ code: "uri_mismatch" });
  await recordNfcCheck(tx, { ...nfc, readBackUri: cardUrl(origin, card.publicToken!) });
  await expect(matchPackage(tx, { actorId: owner.id, cardId, activationCode: "0000-0000", activationSecret: secrets.lookupSecret })).rejects.toMatchObject({ code: "code_mismatch" });
  const { revealActivationCode } = await import("../activation/retrieval");
  const revealed = await revealActivationCode(tx, { actorId: owner.id, cardId, credentialId: credential.id, secrets });
  expect(revealed.status).toBe("available");
  if (revealed.status !== "available") throw new Error("Synthetic code unavailable");
  await matchPackage(tx, { actorId: owner.id, cardId, activationCode: revealed.code, activationSecret: secrets.lookupSecret });
  expect(await cardById(tx, cardId)).toMatchObject({ state: "reserved", orderItemId: card.orderItemId, publicToken: card.publicToken });
  expect((await cardById(tx, cardId)).nfcVerifiedAt).toBeInstanceOf(Date);
  expect((await cardById(tx, cardId)).packageMatchedAt).toBeInstanceOf(Date);
  expect(orderId).toBeTruthy();
}));

test("cancelling Preparing keeps its identity and evidence but returns an unlinked non-virgin Blank", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const [cardId] = await virginStock(tx, 1);
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  await nfc(tx, owner.id, cardId);
  const before = await cardById(tx, cardId);
  expect(before.nfcVerifiedAt).toBeInstanceOf(Date);
  await cancelOrder(tx, { orderId, actorId: owner.id });
  const after = await cardById(tx, cardId);
  expect(after).toMatchObject({ state: "blank", orderItemId: null, publicToken: before.publicToken, nfcVerifiedAt: before.nfcVerifiedAt });
  expect(await tx.select().from(s.activationCredentials).where(eq(s.activationCredentials.cardId, cardId))).toHaveLength(1);
  const next = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  expect(next.allocation).toEqual({ allocatedCardIds: [], missingQuantity: 1 });
}));

test("retiring failed Preparing retains item history and allocates a replacement", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const [failed] = await virginStock(tx, 1);
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  const before = await cardById(tx, failed);
  const [replacement] = await virginStock(tx, 1);
  await retireCard(tx, { actorId: owner.id, cardId: failed, reason: "NFC write failed", secrets });
  expect(await cardById(tx, failed)).toMatchObject({ state: "retired", orderItemId: before.orderItemId, publicToken: before.publicToken });
  const [oldCredential] = await tx.select().from(s.activationCredentials).where(eq(s.activationCredentials.cardId, failed));
  expect(oldCredential).toMatchObject({ revokedAt: expect.any(Date), encryptedCode: null });
  expect(await cardById(tx, replacement)).toMatchObject({ state: "preparing", orderItemId: before.orderItemId });
  expect(await allocateDbcCards(tx, { actorId: owner.id, orderId, secrets })).toEqual({ allocatedCardIds: [], missingQuantity: 0 });
}));

test("failed-card retirement replaces only its original item", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  const product = await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const [failed] = await virginStock(tx, 1);
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  const originalItemId = (await cardById(tx, failed)).orderItemId!;
  const [otherItem] = await tx.insert(s.orderItems).values({ orderId, productId: product.id, productKind: "dbc", quantity: 1, unitPrice: product.price }).returning();
  const [replacement, unrelated] = await virginStock(tx, 2);
  await tx.update(s.cards).set({ createdAt: new Date("2026-10-01") }).where(eq(s.cards.id, replacement));
  await tx.update(s.cards).set({ createdAt: new Date("2026-10-02") }).where(eq(s.cards.id, unrelated));
  await retireCard(tx, { actorId: owner.id, cardId: failed, reason: "NFC write failed", secrets });
  expect((await cardById(tx, replacement)).orderItemId).toBe(originalItemId);
  expect(await cardById(tx, unrelated)).toMatchObject({ state: "blank", orderItemId: null });
  expect((await tx.select().from(s.cards).where(eq(s.cards.orderItemId, otherItem.id)))).toEqual([]);
}));

test("replacing an assigned code preserves NFC and order link but requires package rematch", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const [cardId] = await virginStock(tx, 1);
  await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  const card = await cardById(tx, cardId);
  const [credential] = await tx.select().from(s.activationCredentials).where(eq(s.activationCredentials.cardId, cardId));
  await recordNfcCheck(tx, { actorId: owner.id, cardId, cardUrlOrigin: origin, readBackUri: cardUrl(origin, card.publicToken!), readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true });
  const first = await import("../activation/retrieval").then(({ revealActivationCode }) => revealActivationCode(tx, { actorId: owner.id, cardId, credentialId: credential.id, secrets }));
  if (first.status !== "available") throw new Error("Synthetic code unavailable");
  await matchPackage(tx, { actorId: owner.id, cardId, activationCode: first.code, activationSecret: secrets.lookupSecret });
  const replacement = await replaceProvisioningCredential(tx, { actorId: owner.id, cardId, credentialId: credential.id, reason: "Wrong package", secrets });
  expect(await cardById(tx, cardId)).toMatchObject({ state: "preparing", orderItemId: card.orderItemId, nfcVerifiedAt: expect.any(Date), packageMatchedAt: null });
  await expect(matchPackage(tx, { actorId: owner.id, cardId, activationCode: first.code, activationSecret: secrets.lookupSecret })).rejects.toMatchObject({ code: "code_mismatch" });
  await matchPackage(tx, { actorId: owner.id, cardId, activationCode: replacement.activationCode, activationSecret: secrets.lookupSecret });
  expect(await cardById(tx, cardId)).toMatchObject({ state: "reserved", orderItemId: card.orderItemId });
}));

async function nfc(tx: TestTx, actorId: string, cardId: string) {
  const card = await cardById(tx, cardId);
  await recordNfcCheck(tx, { actorId, cardId, cardUrlOrigin: origin, readBackUri: cardUrl(origin, card.publicToken!), readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true });
}

test("a prepared Ready card is allocated without repeating any physical check", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const { cardId } = await preparedStock(tx, owner.id, secrets);
  const { allocation } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  expect(allocation).toEqual({ allocatedCardIds: [cardId], missingQuantity: 0 });
  expect(await cardById(tx, cardId)).toMatchObject({ state: "reserved", orderItemId: expect.any(String), packageMatchedAt: expect.any(Date), nfcVerifiedAt: expect.any(Date) });
}));

test("standalone Blank becomes Ready only after the NFC check and the matching package code", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const [cardId] = await virginStock(tx, 1);
  const provisioned = await provisionDbc(tx, { actorId: owner.id, cardId, secrets });
  const match = { actorId: owner.id, cardId, activationCode: provisioned.activationCode, activationSecret: secrets.lookupSecret };
  await expect(matchPackage(tx, match)).rejects.toMatchObject({ code: "checks_incomplete" });
  await nfc(tx, owner.id, cardId);
  await matchPackage(tx, match);
  expect(await cardById(tx, cardId)).toMatchObject({ state: "ready", orderItemId: null });
}));

test("cancelling Reserved returns Ready and keeps the refund due", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const { cardId } = await preparedStock(tx, owner.id, secrets);
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  const payments = await tx.select().from(s.payments);
  await cancelOrder(tx, { orderId, actorId: owner.id });
  expect(await cardById(tx, cardId)).toMatchObject({ state: "ready", orderItemId: null, packageMatchedAt: expect.any(Date) });
  expect(await tx.select().from(s.payments)).toEqual(payments);
  expect(await loadOrderFacts(tx, orderId)).toMatchObject({ status: "cancelled", totals: { refundDue: payments[0].amount } });
  expect((await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }))).allocation.allocatedCardIds).toEqual([cardId]);
}));

test("cancelling Preparing preserves the paid amount as refund due", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const [cardId] = await virginStock(tx, 1);
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  const [payment] = await tx.select().from(s.payments);
  await cancelOrder(tx, { orderId, actorId: owner.id });
  expect(await cardById(tx, cardId)).toMatchObject({ state: "blank", orderItemId: null });
  expect(await tx.select().from(s.payments)).toEqual([payment]);
  expect((await loadOrderFacts(tx, orderId)).totals.refundDue).toBe(payment.amount);
}));

test("retiring Preparing with no replacement stock records a shortage that later stock fills", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const [failed] = await virginStock(tx, 1);
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  const itemId = (await cardById(tx, failed)).orderItemId;
  await retireCard(tx, { actorId: owner.id, cardId: failed, reason: "NFC write failed", secrets });
  expect(await cardById(tx, failed)).toMatchObject({ state: "retired", orderItemId: itemId });
  expect(await allocationDeficit(tx, orderId)).toBe(1);
  const [replacement] = await virginStock(tx, 1);
  expect(await allocateDbcCards(tx, { actorId: owner.id, orderId, secrets })).toEqual({ allocatedCardIds: [replacement], missingQuantity: 0 });
}));

test("replacing a Preparing credential keeps the link and NFC evidence", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const secrets = syntheticCredentialSecrets();
  const [cardId] = await virginStock(tx, 1);
  await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets }));
  await nfc(tx, owner.id, cardId);
  const before = await cardById(tx, cardId);
  const [credential] = await tx.select().from(s.activationCredentials).where(eq(s.activationCredentials.cardId, cardId));
  const replacement = await replaceProvisioningCredential(tx, { actorId: owner.id, cardId, credentialId: credential.id, reason: "Wrong package", secrets });
  expect(await cardById(tx, cardId)).toMatchObject({ state: "preparing", orderItemId: before.orderItemId, nfcVerifiedAt: before.nfcVerifiedAt, packageMatchedAt: null });
  const credentials = await tx.select().from(s.activationCredentials).where(eq(s.activationCredentials.cardId, cardId));
  expect(credentials.filter((row) => !row.revokedAt && !row.usedAt).map((row) => row.id)).toEqual([replacement.credentialId]);
  expect(credentials.find((row) => row.id === credential.id)).toMatchObject({ revokedAt: expect.any(Date), encryptedCode: null });
}));

test("released cards are Support-only for every preparation action", () => rollback(db, async (tx) => {
  const { card } = await insertReleasedDbc(tx);
  const owner = await insertAccount(tx, "owner");
  const secrets = syntheticCredentialSecrets();
  const base = { actorId: owner.id, cardId: card.id };
  await expect(recordNfcCheck(tx, { ...base, cardUrlOrigin: origin, readBackUri: cardUrl(origin, card.publicToken!), readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true })).rejects.toMatchObject({ code: "wrong_state" });
  await expect(matchPackage(tx, { ...base, activationCode: "0000-0000", activationSecret: secrets.lookupSecret })).rejects.toMatchObject({ code: "wrong_state" });
  await expect(retireCard(tx, { ...base, reason: "x", secrets })).rejects.toMatchObject({ code: "wrong_state" });
  await expect(replaceProvisioningCredential(tx, { ...base, credentialId: crypto.randomUUID(), reason: "x", secrets })).rejects.toMatchObject({ code: "wrong_state" });
  expect(await cardById(tx, card.id)).toEqual(card);
}));

test("retiring a Reserved GRC on a cancelled Order still works", () => rollback(db, async (tx) => {
  const { order, owner, item, product } = await insertOrderItem(tx, "grc");
  const stock = await insertStockPurchase(tx);
  const [card] = await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "grc", state: "reserved", orderItemId: item.id, nfcVerifiedAt: new Date() }).returning();
  await cancelOrder(tx, { orderId: order.id, actorId: owner.id });
  await retireCard(tx, { actorId: owner.id, cardId: card.id, reason: "Order cancelled" });
  expect(await cardById(tx, card.id)).toMatchObject({ state: "retired", orderItemId: item.id });
}));

test.each(["retired", "released"] as const)("a %s card on a completed Order gets wrong_state, not an order error", (state) => rollback(db, async (tx) => {
  const { card, item } = await insertReleasedDbc(tx);
  const owner = await insertAccount(tx, "owner");
  await tx.update(s.cards).set({ state }).where(eq(s.cards.id, card.id));
  await tx.update(s.orders).set({ status: "completed", completedAt: new Date() }).where(eq(s.orders.id, item.orderId));
  await expect(retireCard(tx, { actorId: owner.id, cardId: card.id, reason: "x", secrets: syntheticCredentialSecrets() })).rejects.toMatchObject({ code: "wrong_state" });
}));

test("retiring Preparing without credential secrets is refused with its own code and changes nothing", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const [cardId] = await virginStock(tx, 1);
  await createPaidDbcOrder(tx, normalOrderInput(owner.id));
  const before = await cardById(tx, cardId);
  await expect(retireCard(tx, { actorId: owner.id, cardId, reason: "x" })).rejects.toMatchObject({ code: "secrets_required" });
  expect(await cardById(tx, cardId)).toEqual(before);
}));

test("the NFC activity note states only what is verified, not a phone or writable attestation", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const [cardId] = await virginStock(tx, 1);
  await createPaidDbcOrder(tx, normalOrderInput(owner.id));
  await nfc(tx, owner.id, cardId);
  const [event] = (await tx.select().from(s.activityEvents).where(eq(s.activityEvents.cardId, cardId))).filter((row) => row.type === "card_nfc_verified");
  expect(event.note).toBe("owner confirmed; the URL read back matched the permanent card URL exactly");
  expect(event.note).not.toMatch(/phone|writable/i);
}));
