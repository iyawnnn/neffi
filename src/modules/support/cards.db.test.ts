import { eq } from "drizzle-orm";
import { beforeAll, expect, test, vi } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertReleasedDbc, insertProvisioningDbc, insertProfile, insertProduct, insertStockPurchase } from "@/db/test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb, type TestTx } from "@/db/testing";
import { issueActivationCredential } from "../activation/credentials";
import { claimCard } from "../activation/claim";
import { resolveCard } from "../cards/resolve";
import { loadOrderFacts } from "../orders/order";
import { openCase, linkCaseCard } from "./case";
import { retireAffectedCard, releaseReplacementCard } from "./cards";

vi.mock("@/config/env", () => ({ env: { cloudinaryCloudName: "synthetic" } }));

let db: TestDb;
const SECRET = "s".repeat(40);
beforeAll(async () => { db = await createTestDb(); });

async function fixture(tx: TestTx) {
  const { card, item, product } = await insertReleasedDbc(tx);
  const [order] = await tx.select().from(s.orders).where(eq(s.orders.id, item.orderId));
  const actorId = order.createdByAccountId;
  const credential = await issueActivationCredential(tx, card.id, SECRET);
  const { caseId } = await openCase(tx, { actorId, type: "defective_card", summary: "Defect", orderId: order.id });
  return { card, item, product, order, credential, caseId, actorId };
}

async function ready(tx: TestTx, productId: string) {
  const stock = await insertStockPurchase(tx);
  const [card] = await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId, kind: "dbc", publicToken: `R${crypto.randomUUID().replaceAll("-", "")}` }).returning();
  const credential = await issueActivationCredential(tx, card.id, SECRET);
  await tx.update(s.cards).set({ state: "ready", nfcVerifiedAt: new Date(), packageMatchedAt: new Date() }).where(eq(s.cards.id, card.id));
  return { card, credential };
}

test.each([false, true])("retire claimed=%s clears routing, revokes only usable credentials, and replacement is no sale", (claimed) => rollback(db, async (tx) => {
  const f = await fixture(tx);
  const customer = await insertAccount(tx);
  if (claimed) {
    await claimCard(tx, { accountId: customer.id, credentialId: f.credential.credentialId });
    const profile = await insertProfile(tx, customer.id);
    await tx.update(s.cards).set({ profileId: profile.id, disabledAt: new Date() }).where(eq(s.cards.id, f.card.id));
  }
  const before = await loadOrderFacts(tx, f.order.id);
  const replacement = await ready(tx, f.product.id);
  const base = { caseId: f.caseId, actorId: f.actorId, reason: "Verified defect" };
  await expect(releaseReplacementCard(tx, { ...base, orderItemId: f.item.id, cardId: replacement.card.id })).rejects.toMatchObject({ code: "replacement_unavailable" });
  await retireAffectedCard(tx, { ...base, cardId: f.card.id });
  expect((await tx.select().from(s.cards).where(eq(s.cards.id, f.card.id)))[0]).toMatchObject({ state: "retired", ownerAccountId: null, profileId: null, disabledAt: null, publicToken: f.card.publicToken });
  const [credential] = await tx.select().from(s.activationCredentials).where(eq(s.activationCredentials.id, f.credential.credentialId));
  expect(claimed ? credential.usedAt : credential.revokedAt).toBeInstanceOf(Date);
  expect(await resolveCard(tx, f.card.publicToken!)).toMatchObject({ status: "unavailable", ownerAccountId: null });
  await releaseReplacementCard(tx, { ...base, orderItemId: f.item.id, cardId: replacement.card.id });
  expect((await loadOrderFacts(tx, f.order.id)).totals).toEqual(before.totals);
  expect(await tx.select().from(s.orderItems)).toHaveLength(1);
  expect(await tx.select().from(s.payments)).toHaveLength(0);
  expect(await tx.select().from(s.supportCaseCards)).toHaveLength(2);
  const second = await ready(tx, f.product.id);
  await expect(releaseReplacementCard(tx, { ...base, orderItemId: f.item.id, cardId: second.card.id })).rejects.toMatchObject({ code: "replacement_unavailable" });
  expect(await claimCard(tx, { accountId: customer.id, credentialId: replacement.credential.credentialId })).toMatchObject({ status: "claimed", cardId: replacement.card.id });
  const [retired] = (await tx.select().from(s.activityEvents)).filter((event) => event.type === "card_retired");
  expect(retired).toMatchObject({ supportCaseId: f.caseId, orderId: f.order.id, accountId: claimed ? customer.id : null });
}));

test("retirement refuses a different order, cancelled order, and every unreleased state", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  const base = { caseId: f.caseId, actorId: f.actorId, reason: "Defect" };
  const other = await insertReleasedDbc(tx);
  await expect(retireAffectedCard(tx, { ...base, cardId: other.card.id })).rejects.toMatchObject({ code: "wrong_order" });
  const blank = await insertProvisioningDbc(tx);
  await expect(retireAffectedCard(tx, { ...base, cardId: blank.card.id })).rejects.toMatchObject({ code: "wrong_order" });
  await tx.update(s.orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(s.orders.id, f.order.id));
  await expect(retireAffectedCard(tx, { ...base, cardId: f.card.id })).rejects.toMatchObject({ code: "wrong_status" });
}));

test("replacement checks product, kind, state, package and credential under locks", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  const base = { caseId: f.caseId, actorId: f.actorId, reason: "Defect" };
  await retireAffectedCard(tx, { ...base, cardId: f.card.id });
  const target = await ready(tx, f.product.id);
  await expectPgError(tx, (savepoint) => savepoint.update(s.cards).set({ packageMatchedAt: null }).where(eq(s.cards.id, target.card.id)), "23514", "cards_dbc_ready_checks_recorded");
  await tx.update(s.activationCredentials).set({ revokedAt: new Date() }).where(eq(s.activationCredentials.id, target.credential.credentialId));
  await expect(releaseReplacementCard(tx, { ...base, orderItemId: f.item.id, cardId: target.card.id })).rejects.toMatchObject({ code: "checks_incomplete" });
  const [wrong] = await tx.insert(s.products).values({ kind: "dbc", name: "Old product", price: 1, active: false }).returning();
  const wrongCard = await ready(tx, wrong.id);
  await expect(releaseReplacementCard(tx, { ...base, orderItemId: f.item.id, cardId: wrongCard.card.id })).rejects.toMatchObject({ code: "card_unavailable" });
  const grc = await insertProduct(tx, "grc");
  const stock = await insertStockPurchase(tx);
  const [grcCard] = await tx.insert(s.cards).values({ stockPurchaseId: stock.id, productId: grc.id, kind: "grc" }).returning();
  await expect(releaseReplacementCard(tx, { ...base, orderItemId: f.item.id, cardId: grcCard.id })).rejects.toMatchObject({ code: "card_unavailable" });
}));

test("in-progress completion waits for replacement and settles on its release", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  const base = { caseId: f.caseId, actorId: f.actorId, reason: "Defect" };
  await tx.update(s.orders).set({ deliveryMethod: "pickup" }).where(eq(s.orders.id, f.order.id));
  await retireAffectedCard(tx, { ...base, cardId: f.card.id });
  await tx.insert(s.payments).values({ orderId: f.order.id, amount: 50000, method: "cash", paidOn: "2026-10-14", recordedByAccountId: f.actorId });
  expect((await loadOrderFacts(tx, f.order.id)).status).toBe("in_progress");
  const replacement = await ready(tx, f.product.id);
  await releaseReplacementCard(tx, { ...base, orderItemId: f.item.id, cardId: replacement.card.id });
  expect((await loadOrderFacts(tx, f.order.id)).status).toBe("completed");
}));

test("a retirement cannot be reused by a different case or exceed item capacity", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  await retireAffectedCard(tx, { caseId: f.caseId, actorId: f.actorId, cardId: f.card.id, reason: "Defect" });
  const other = await openCase(tx, { actorId: f.actorId, type: "replacement", summary: "Other", orderId: f.order.id });
  await linkCaseCard(tx, { ...other, actorId: f.actorId, cardId: f.card.id });
  const target = await ready(tx, f.product.id);
  await expect(releaseReplacementCard(tx, { ...other, actorId: f.actorId, orderItemId: f.item.id, cardId: target.card.id })).rejects.toMatchObject({ code: "replacement_unavailable" });
  const reserved = await ready(tx, f.product.id);
  await tx.update(s.cards).set({ state: "reserved", orderItemId: f.item.id }).where(eq(s.cards.id, reserved.card.id));
  await expect(releaseReplacementCard(tx, { caseId: f.caseId, actorId: f.actorId, orderItemId: f.item.id, cardId: target.card.id })).rejects.toMatchObject({ code: "replacement_unavailable" });
}));
