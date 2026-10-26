import { desc, eq, sql } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertAccount, insertProduct } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { recordNfcCheck } from "../cards/card";
import { matchPackage } from "../cards/dbc";
import { cardUrl } from "../cards/token";
import { voidPayment } from "../payments/void";
import { handOverOrder, shipOrder } from "./fulfillment";
import { correctShipmentDate, markJntShipped, saveJntDelivery } from "./jnt-fulfillment";
import { createPaidDbcOrder, type NormalDbcOrderInput } from "./normal-dbc";
import { loadOrderFacts } from "./order";
import { cardById, normalOrderInput, preparedStock, syntheticCredentialSecrets, virginStock } from "./operations-test-fixtures";
import { NEW_PAYMENT_METHODS, type NewPaymentMethod } from "./policy";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

const secrets = syntheticCredentialSecrets();
const manilaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
const destination = { recipientName: "Synthetic Recipient", recipientPhone: "0917 000 0000", address: "1 Synthetic Street" };

async function setup(tx: TestTx, overrides: Partial<NormalDbcOrderInput> = {}, prepared = true) {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const quantity = overrides.quantity ?? 1;
  const cardIds: string[] = [];
  for (let n = 0; n < quantity; n++) cardIds.push(prepared ? (await preparedStock(tx, owner.id, secrets)).cardId : (await virginStock(tx, 1))[0]);
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets, ...overrides }));
  return { owner, orderId, cardIds, base: { orderId, actorId: owner.id } };
}
const jnt = (shippingFee?: number, extra: Partial<NormalDbcOrderInput["delivery"]> = {}) => ({ delivery: { method: "jnt" as const, ...destination, shippingFee, ...extra } });
const count = async (tx: TestTx, orderId: string, type: string) => (await tx.select().from(s.activityEvents).where(eq(s.activityEvents.orderId, orderId))).filter((event) => event.type === type).length;
const payments = (tx: TestTx, orderId: string) => tx.select().from(s.payments).where(eq(s.payments.orderId, orderId)).orderBy(desc(s.payments.amount));
const shipments = (tx: TestTx, orderId: string) => tx.select().from(s.shipments).where(eq(s.shipments.orderId, orderId));

test("In person releases once only when every DBC quantity is prepared, and assigns no ownership", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const ready = await preparedStock(tx, owner.id, secrets);
  const [blank] = await virginStock(tx, 1);
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets, quantity: 2 }));
  const base = { orderId, actorId: owner.id };
  await expect(handOverOrder(tx, base)).rejects.toMatchObject({ code: "checks_incomplete" });
  expect((await cardById(tx, ready.cardId)).state).toBe("reserved");
  expect(await count(tx, orderId, "order_handed_over")).toBe(0);
  const card = await cardById(tx, blank);
  await recordNfcCheck(tx, { actorId: owner.id, cardId: blank, cardUrlOrigin: "https://getneffi.com", readBackUri: cardUrl("https://getneffi.com", card.publicToken!), readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true });
  const { revealActivationCode } = await import("../activation/retrieval");
  const [credential] = await tx.select().from(s.activationCredentials).where(eq(s.activationCredentials.cardId, blank));
  const revealed = await revealActivationCode(tx, { actorId: owner.id, cardId: blank, credentialId: credential.id, secrets });
  if (revealed.status !== "available") throw new Error("Synthetic code unavailable");
  await matchPackage(tx, { actorId: owner.id, cardId: blank, activationCode: revealed.code, activationSecret: secrets.lookupSecret });
  await handOverOrder(tx, base);
  const released = [await cardById(tx, ready.cardId), await cardById(tx, blank)];
  expect(released.map((c) => c.state)).toEqual(["released", "released"]);
  expect(released.every((c) => c.ownerAccountId === null)).toBe(true);
  expect(await count(tx, orderId, "order_handed_over")).toBe(1);
  expect(await count(tx, orderId, "order_completed")).toBe(1);
  expect((await loadOrderFacts(tx, orderId)).status).toBe("completed");
}));

test("In person with a stock deficit releases nothing", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const ready = await preparedStock(tx, owner.id, secrets);
  const { orderId } = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { secrets, quantity: 2 }));
  await expect(handOverOrder(tx, { orderId, actorId: owner.id })).rejects.toMatchObject({ code: "checks_incomplete" });
  expect((await cardById(tx, ready.cardId)).state).toBe("reserved");
}));

test("saving J&T details keeps one pending shipment, a pending fee stays unknown, and no receipt is created", () => rollback(db, async (tx) => {
  const { base, orderId } = await setup(tx, jnt());
  const before = await loadOrderFacts(tx, orderId);
  expect(before).toMatchObject({ shippingFeePending: true });
  const paymentsBefore = await payments(tx, orderId);
  await saveJntDelivery(tx, { ...base, recipientName: "Changed Name", recipientPhone: "0999", address: "2 New Street" });
  expect((await loadOrderFacts(tx, orderId)).shippingFeePending).toBe(true);
  await saveJntDelivery(tx, { ...base, recipientName: "Changed Name", recipientPhone: "0999", address: "2 New Street", shippingFee: 12_000 });
  const rows = await shipments(tx, orderId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ courier: "J&T", status: "pending", recipientName: "Changed Name", recipientContact: "0999", address: "2 New Street", shippedOn: null });
  const after = await loadOrderFacts(tx, orderId);
  expect(after).toMatchObject({ shippingFee: 12_000, shippingFeePending: false });
  expect(after.totals).toMatchObject({ orderTotal: 79_900 + 12_000, balance: 12_000 });
  expect(await payments(tx, orderId)).toEqual(paymentsBefore);
  expect(after.items[0].unitPrice).toBe(79_900);
  await saveJntDelivery(tx, { ...base, recipientName: "Changed Name", recipientPhone: "0999", address: "2 New Street", shippingFee: 0 });
  expect(await loadOrderFacts(tx, orderId)).toMatchObject({ shippingFee: 0, shippingFeePending: false });
  await expect(saveJntDelivery(tx, { ...base, ...destination, shippingFee: -1 })).rejects.toMatchObject({ code: "invalid_input" });
  await expect(saveJntDelivery(tx, { ...base, ...destination, shippingFee: 1.5 })).rejects.toMatchObject({ code: "invalid_input" });
}));

test("ambiguous legacy pending shipments are never silently merged", () => rollback(db, async (tx) => {
  const { base, orderId } = await setup(tx, jnt(0));
  await tx.insert(s.shipments).values({ orderId, courier: "J&T" });
  await expect(saveJntDelivery(tx, { ...base, ...destination })).rejects.toMatchObject({ code: "delivery_locked" });
  expect(await shipments(tx, orderId)).toHaveLength(2);
}));

test.each(NEW_PAYMENT_METHODS)("Mark as shipped atomically receipts shipping with %s, ships, releases and completes", (method: NewPaymentMethod) => rollback(db, async (tx) => {
  const { base, orderId, cardIds } = await setup(tx, { paymentMethod: method, ...jnt(12_000) });
  const before = { payments: await payments(tx, orderId), order: (await tx.select().from(s.orders).where(eq(s.orders.id, orderId)))[0] };
  await markJntShipped(tx, { ...base, trackingNumber: "SYNTH-TRACK" });
  const after = { facts: await loadOrderFacts(tx, orderId), payments: await payments(tx, orderId), shipments: await shipments(tx, orderId), cards: await Promise.all(cardIds.map((id) => cardById(tx, id))) };
  expect(after.facts.items[0].unitPrice).toBe(79_900);
  expect(after.shipments).toHaveLength(1);
  expect(after.shipments[0]).toMatchObject({ courier: "J&T", trackingNumber: "SYNTH-TRACK", status: "in_transit", shippedOn: manilaToday() });
  expect(after.cards.every((c) => c.state === "released" && c.ownerAccountId === null)).toBe(true);
  expect(after.payments.map((p) => p.amount)).toEqual([79_900, 12_000]);
  expect(after.payments.every((p) => p.method === before.order.normalPaymentMethod && p.method === method)).toBe(true);
  expect(after.payments[0]).toEqual(before.payments[0]);
  expect(after.facts.totals.balance).toBe(0);
  expect(after.facts.status).toBe("completed");
  expect(await count(tx, orderId, "order_handed_over")).toBe(0);
  expect(await count(tx, orderId, "order_completed")).toBe(1);
}));

test("Mark as shipped needs tracking, destination, prepared cards and a known nonnegative fee, and refusals change nothing", () => rollback(db, async (tx) => {
  const { base, orderId } = await setup(tx, jnt());
  const snapshot = async () => JSON.stringify([await payments(tx, orderId), await shipments(tx, orderId), (await tx.select().from(s.orders).where(eq(s.orders.id, orderId)))[0], (await tx.select().from(s.cards)).map((c) => c.state)]);
  const initial = await snapshot();
  await expect(markJntShipped(tx, { ...base, trackingNumber: "T-1" })).rejects.toMatchObject({ code: "invalid_input" });
  await expect(markJntShipped(tx, { ...base, trackingNumber: "  ", shippingFee: 100 })).rejects.toMatchObject({ code: "invalid_input" });
  await expect(markJntShipped(tx, { ...base, trackingNumber: "T-1", shippingFee: -5 })).rejects.toMatchObject({ code: "invalid_input" });
  expect(await snapshot()).toBe(initial);
  await tx.update(s.shipments).set({ address: null }).where(eq(s.shipments.orderId, orderId));
  const withoutAddress = await snapshot();
  await expect(markJntShipped(tx, { ...base, trackingNumber: "T-1", shippingFee: 100 })).rejects.toMatchObject({ code: "invalid_input" });
  expect(await snapshot()).toBe(withoutAddress);
}));

test("Mark as shipped refuses an unprepared card", () => rollback(db, async (tx) => {
  const { base, orderId, cardIds } = await setup(tx, jnt(12_000), false);
  await expect(markJntShipped(tx, { ...base, trackingNumber: "T-1" })).rejects.toMatchObject({ code: "checks_incomplete" });
  expect((await cardById(tx, cardIds[0])).state).toBe("preparing");
  expect(await payments(tx, orderId)).toHaveLength(1);
  expect((await shipments(tx, orderId))[0].status).toBe("pending");
}));

test("a fee supplied while shipping confirms it, zero creates no payment, and the shipped date is honored", () => rollback(db, async (tx) => {
  const { base, orderId } = await setup(tx, jnt());
  await tx.update(s.orders).set({ createdAt: new Date("2026-10-01T04:00:00Z") }).where(eq(s.orders.id, orderId));
  await markJntShipped(tx, { ...base, trackingNumber: "T-0", shippingFee: 0, shippedOn: "2026-10-20" });
  expect((await payments(tx, orderId)).map((p) => p.amount)).toEqual([79_900]);
  expect((await shipments(tx, orderId))[0]).toMatchObject({ shippedOn: "2026-10-20", status: "in_transit" });
  expect(await loadOrderFacts(tx, orderId)).toMatchObject({ status: "completed", shippingFee: 0, shippingFeePending: false });
}));

test("Mark as shipped replay returns the existing outcome with no new receipt, event or release", () => rollback(db, async (tx) => {
  const { base, orderId } = await setup(tx, jnt(12_000));
  await markJntShipped(tx, { ...base, trackingNumber: "T-1" });
  const events = (await tx.select().from(s.activityEvents).where(eq(s.activityEvents.orderId, orderId))).length;
  await markJntShipped(tx, { ...base, trackingNumber: "T-1" });
  expect(await payments(tx, orderId)).toHaveLength(2);
  expect(await shipments(tx, orderId)).toHaveLength(1);
  expect((await tx.select().from(s.activityEvents).where(eq(s.activityEvents.orderId, orderId))).length).toBe(events);
  expect(await count(tx, orderId, "order_completed")).toBe(1);
}));

test("a voided product receipt needs the correction path, never fabricated collection", () => rollback(db, async (tx) => {
  const voided = await setup(tx, jnt(12_000));
  const [product] = await payments(tx, voided.orderId);
  await voidPayment(tx, { ...voided.base, paymentId: product.id, reason: "Mis-keyed" });
  await expect(markJntShipped(tx, { ...voided.base, trackingNumber: "T-1" })).rejects.toMatchObject({ code: "settlement_mismatch" });
  expect(await payments(tx, voided.orderId)).toHaveLength(1);
  expect((await shipments(tx, voided.orderId))[0].status).toBe("pending");
}));

test("an unexpected prior shipping receipt needs the correction path", () => rollback(db, async (tx) => {
  const extra = await setup(tx, jnt(12_000));
  await tx.insert(s.payments).values({ orderId: extra.orderId, amount: 5_000, method: "gcash", paidOn: manilaToday(), recordedByAccountId: extra.owner.id });
  await expect(markJntShipped(tx, { ...extra.base, trackingNumber: "T-1" })).rejects.toMatchObject({ code: "settlement_mismatch" });
  expect((await loadOrderFacts(tx, extra.orderId)).status).toBe("in_progress");
}));

test("an audit failure rolls back receipt, shipment, release and completion", () => rollback(db, async (tx) => {
  const { base, orderId, cardIds } = await setup(tx, jnt());
  await tx.execute(sql.raw(`create function fail_ship_audit() returns trigger language plpgsql as $$ begin if new.type = 'shipment_recorded' then raise exception 'synthetic audit failure'; end if; return new; end $$`));
  await tx.execute(sql.raw(`create trigger fail_ship_audit before insert on activity_events for each row execute function fail_ship_audit()`));
  await expect(markJntShipped(tx, { ...base, trackingNumber: "T-1", shippingFee: 12_000 })).rejects.toThrow();
  expect(await payments(tx, orderId)).toHaveLength(1);
  expect((await shipments(tx, orderId))[0]).toMatchObject({ status: "pending", trackingNumber: null, shippedOn: null });
  expect((await cardById(tx, cardIds[0])).state).toBe("reserved");
  expect(await loadOrderFacts(tx, orderId)).toMatchObject({ status: "in_progress", shippingFeePending: true, shippingFee: 0 });
}));

test("the shipped date can be corrected with a reason without undoing fulfillment", () => rollback(db, async (tx) => {
  const { base, orderId } = await setup(tx, jnt(12_000));
  await tx.update(s.orders).set({ createdAt: new Date("2026-10-01T04:00:00Z") }).where(eq(s.orders.id, orderId));
  await markJntShipped(tx, { ...base, trackingNumber: "T-1", shippedOn: "2026-10-20" });
  const [shipment] = await shipments(tx, orderId);
  const [order] = await tx.select().from(s.orders).where(eq(s.orders.id, orderId));
  await expect(correctShipmentDate(tx, { ...base, shipmentId: shipment.id, shippedOn: "2026-10-21", reason: " " })).rejects.toMatchObject({ code: "invalid_input" });
  await expect(correctShipmentDate(tx, { ...base, shipmentId: shipment.id, shippedOn: "not-a-date", reason: "Typo" })).rejects.toMatchObject({ code: "invalid_input" });
  await correctShipmentDate(tx, { ...base, shipmentId: shipment.id, shippedOn: "2026-10-21", reason: "Courier receipt date" });
  expect((await shipments(tx, orderId))[0]).toMatchObject({ shippedOn: "2026-10-21", status: "in_transit", trackingNumber: "T-1" });
  const [after] = await tx.select().from(s.orders).where(eq(s.orders.id, orderId));
  expect(after).toMatchObject({ status: "completed", completedAt: order.completedAt });
  const events = (await tx.select().from(s.activityEvents).where(eq(s.activityEvents.orderId, orderId))).filter((e) => e.type === "shipment_updated");
  expect(events.at(-1)?.note).toContain("Courier receipt date");
  const [pending] = await tx.insert(s.shipments).values({ orderId, courier: "J&T" }).returning();
  await expect(correctShipmentDate(tx, { ...base, shipmentId: pending.id, shippedOn: "2026-10-21", reason: "x" })).rejects.toMatchObject({ code: "not_found" });
}));

test("normal orders cannot use the legacy shipping action", () => rollback(db, async (tx) => {
  const { base, orderId } = await setup(tx, jnt(12_000));
  await expect(shipOrder(tx, { ...base, trackingNumber: "T-1" })).rejects.toMatchObject({ code: "wrong_status" });
  expect((await shipments(tx, orderId))[0].status).toBe("pending");
}));

test("the shipped date cannot be in the future or before the Order was created (Manila dates)", () => rollback(db, async (tx) => {
  const { base, orderId } = await setup(tx, jnt(12_000));
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(Date.now() + 86_400_000));
  await tx.update(s.orders).set({ createdAt: new Date("2026-10-10T17:30:00Z") }).where(eq(s.orders.id, orderId)); // 2026-10-11 01:30 in Manila
  for (const shippedOn of [tomorrow, "2026-10-10"]) {
    await expect(markJntShipped(tx, { ...base, trackingNumber: "T-1", shippedOn })).rejects.toMatchObject({ code: "invalid_input" });
  }
  expect((await shipments(tx, orderId))[0].status).toBe("pending");
  expect(await payments(tx, orderId)).toHaveLength(1);
  await markJntShipped(tx, { ...base, trackingNumber: "T-1", shippedOn: "2026-10-11" });
  expect((await shipments(tx, orderId))[0]).toMatchObject({ shippedOn: "2026-10-11", status: "in_transit" });
}));
