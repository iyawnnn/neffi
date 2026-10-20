import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { expect, test } from "vitest";
import * as s from "@/db/schema";
import { createTestDb } from "@/db/testing";
import { checkActivationCode, claimCard } from "@/modules/activation/claim";
import { recordNfcCheck } from "@/modules/cards/card";
import { matchPackage, provisionDbc } from "@/modules/cards/dbc";
import { resolvePublicExperience } from "@/modules/cards/resolve";
import { cardUrl } from "@/modules/cards/token";
import { expenseReport } from "@/modules/expenses/report";
import { listInbox, openSubmission, submitForm } from "@/modules/forms/submissions";
import { receiveStock } from "@/modules/inventory/stock-intake";
import { createOrder } from "@/modules/orders/create";
import { dashboard } from "@/modules/orders/dashboard";
import { handOverOrder, reserveDbcCards } from "@/modules/orders/fulfillment";
import { loadOrderFacts } from "@/modules/orders/order";
import { getOrderDetail } from "@/modules/orders/queries";
import { recordPayment } from "@/modules/payments/record";
import { createProfileFromStarter, publishProfile } from "@/modules/profiles/profiles";
import { loadVersionedPublicSceneView } from "@/modules/profiles/view";
import { searchRecords } from "@/modules/search";

test("real provisioning output flows through sale, gift/bulk claims, publish, public Form and private Inbox", async () => {
  const db = await createTestDb();
  try {
    const [owner, a, c] = await db.insert(s.accounts).values([
      { name: "Journey owner", email: "ja-owner@example.invalid", role: "owner", emailVerified: true },
      { name: "Gift recipient", email: "ja-a@example.invalid", role: "customer", emailVerified: true },
      { name: "Bulk recipient", email: "ja-c@example.invalid", role: "customer", emailVerified: true },
    ]).returning();
    await db.insert(s.products).values([
      { kind: "dbc", name: "Journey DBC", price: 50_000 },
      { kind: "grc", name: "Journey GRC", price: 20_000 },
    ]);
    const secret = "synthetic-journey-activation-secret-0123456789";
    const origin = "https://cards.example.invalid";
    const stock = await receiveStock(db, { actorId: owner.id, receivedOn: "2026-10-16", quantity: 2, intendedKind: "dbc", purchaseCost: 16_000 });
    const received = await db.select({ id: s.cards.id }).from(s.cards).where(eq(s.cards.stockPurchaseId, stock.stockPurchaseId)).orderBy(asc(s.cards.id));
    expect(received).toHaveLength(2);
    const provisioned = [];
    for (const card of received) {
      const output = await provisionDbc(db, { actorId: owner.id, cardId: card.id, activationSecret: secret });
      // These are synthetic attestations, not physical NFC evidence.
      await recordNfcCheck(db, { actorId: owner.id, cardId: card.id, cardUrlOrigin: origin, readBackUri: cardUrl(origin, output.publicToken), readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true, device: "Synthetic journey fixture" });
      await matchPackage(db, { actorId: owner.id, cardId: card.id, activationCode: output.activationCode, activationSecret: secret });
      provisioned.push({ cardId: card.id, ...output });
    }
    expect((await db.select({ state: s.cards.state }).from(s.cards)).map(row => row.state)).toEqual(["ready", "ready"]);

    const { orderId } = await createOrder(db, { actorId: owner.id, purchaser: { name: "Independent purchaser P" }, deliveryMethod: "pickup", items: [{ kind: "dbc", quantity: 1 }, { kind: "dbc", quantity: 1 }, { kind: "grc", quantity: 1, reviewUrl: "https://reviews.example.invalid/journey" }] });
    const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId)).orderBy(asc(s.orderItems.id));
    const dbcItems = items.filter(item => item.productKind === "dbc");
    expect(dbcItems).toHaveLength(2);
    expect(items.filter(item => item.productKind === "grc")).toHaveLength(1);
    for (const [index, card] of provisioned.entries()) await reserveDbcCards(db, { actorId: owner.id, orderId, orderItemId: dbcItems[index].id, cardIds: [card.cardId] });
    await recordPayment(db, { actorId: owner.id, orderId, method: "cash", amount: 30_000, paidOn: "2026-10-16" });
    await handOverOrder(db, { actorId: owner.id, orderId });
    const partial = await loadOrderFacts(db, orderId);
    expect(partial.status).toBe("in_progress");
    expect(partial.totals.balance).toBe(90_000);
    await recordPayment(db, { actorId: owner.id, orderId, method: "cash", amount: partial.totals.balance, paidOn: "2026-10-16" });
    const detail = await getOrderDetail(db, orderId);
    assert(detail);
    expect(detail.status).toBe("completed");
    expect(detail.totals.balance).toBe(0);
    expect(detail.cards).toHaveLength(2);
    expect(await db.select({ id: s.cards.id }).from(s.cards).where(eq(s.cards.kind, "grc"))).toEqual([]);

    for (const [index, recipient] of [a, c].entries()) {
      const card = provisioned[index];
      const checked = await checkActivationCode(db, { secret, code: card.activationCode, accountId: recipient.id });
      assert(checked.status === "claimable", "Released provisioning output must be claimable");
      expect(await claimCard(db, { credentialId: checked.credentialId, accountId: recipient.id })).toEqual({ status: "claimed", cardId: card.cardId });
    }
    expect(detail.purchaser.name).toBe("Independent purchaser P");
    expect(detail.purchaser).not.toHaveProperty("accountId");
    expect((await db.select({ id: s.accounts.id }).from(s.accounts)).map(row => row.id).sort()).toEqual([owner.id, a.id, c.id].sort());
    expect((await db.select({ owner: s.cards.ownerAccountId }).from(s.cards).orderBy(asc(s.cards.id))).map(row => row.owner)).toEqual([a.id, c.id]);

    const { profileId } = await createProfileFromStarter(db, { accountId: a.id, cardId: provisioned[0].cardId, purpose: "get_clients", essentials: { fullName: "Journey customer", headline: "Designer", bio: "Synthetic services", email: a.email, phone: null, link: "https://booking.example.invalid/journey" } });
    await publishProfile(db, { accountId: a.id, profileId });
    const experience = await resolvePublicExperience(db, provisioned[0].publicToken, key => loadVersionedPublicSceneView(db, key));
    assert(experience.status === "published", "Published claimed Card must resolve");
    const [profile] = await db.select({ defaultSceneId: s.profiles.defaultSceneId }).from(s.profiles).where(eq(s.profiles.id, profileId));
    expect(experience.view.scene.id).toBe(profile.defaultSceneId);
    const form = experience.view.blocks.find(block => block.type === "form");
    assert(form?.type === "form", "Get Clients starter must expose its public Form");
    const [definition] = await db.select({ preset: s.formDefinitions.preset }).from(s.formDefinitions).where(eq(s.formDefinitions.id, form.formId));
    expect(definition.preset).toBe("project_inquiry");
    const submitted = await submitForm(db, { formId: form.formId, clientKey: randomUUID(), answers: { name: "Synthetic visitor", email: "visitor@example.invalid", message: "Synthetic project inquiry" } });
    assert(submitted.status === "created", "Public inquiry must be persisted");
    const inbox = await listInbox(db, { accountId: a.id });
    expect(inbox.items.map(item => ({ id: item.id, unread: item.unread }))).toEqual([{ id: submitted.submissionId, unread: true }]);
    expect(await openSubmission(db, { accountId: c.id, submissionId: submitted.submissionId })).toBeNull();
    expect((await db.select({ readAt: s.formSubmissions.readAt }).from(s.formSubmissions).where(eq(s.formSubmissions.id, submitted.submissionId)))[0].readAt).toBeNull();
    expect((await listInbox(db, { accountId: a.id })).items[0].unread).toBe(true);

    const home = await dashboard(db, "2026-10");
    expect(home.inProgress).toBe(0);
    expect(home.outstanding).toBe(0);
    expect(home.stock.rows.filter(row => row.state === "released")).toEqual([{ kind: "dbc", state: "released", count: 2 }]);
    expect(home.stock.rows.filter(row => row.state === "ready")).toEqual([]);
    const expenses = await expenseReport(db, "2026-10");
    expect(expenses.total).toBe(16_000);
    expect(expenses.rows.filter(row => row.source === "stock").map(row => row.amount)).toEqual([16_000]);
    const found = (query: string) => searchRecords(db, query, { limit: 20 }).then(result => result.hits);
    expect((await found(String(detail.number))).filter(hit => hit.type === "order").map(hit => hit.id)).toContain(orderId);
    expect((await found(provisioned[0].publicToken)).filter(hit => hit.type === "card").map(hit => hit.id)).toContain(provisioned[0].cardId);
    const types = (await db.select({ type: s.activityEvents.type }).from(s.activityEvents)).map(row => row.type);
    for (const [type, count] of [["card_provisioned", 2], ["payment_recorded", 2], ["card_released", 2], ["order_handed_over", 1], ["card_claimed", 2]] as const) expect(types.filter(value => value === type)).toHaveLength(count);
  } finally { await db.$client.close(); }
});
