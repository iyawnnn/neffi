import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activationCredentials, activityEvents, cards, orders, payments, refunds } from "./schema";
import { insertClaimedCard, insertOrder, insertProvisioningDbc, insertReadyDbc, insertStockPurchase, syntheticLookup } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

// Trigger guards (migration 0005): rules that compare a row's old and new values, which CHECK constraints
// cannot express. Every rejection is SQLSTATE P0001 raised by the guard.
let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const GUARD = "P0001";
const today = "2026-10-10";

describe("cards_guard", () => {
  test("a DBC public token is permanent once issued", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      await expectPgError(tx, (s) => s.update(cards).set({ publicToken: "SYNTHCHANGED" }).where(eq(cards.id, card.id)), GUARD);
    }));

  test("a released card never returns to inventory; it can only be retired", () =>
    rollback(db, async (tx) => {
      const { card } = await insertClaimedCard(tx);
      await tx.update(cards).set({ ownerAccountId: null, profileId: null }).where(eq(cards.id, card.id));
      for (const state of ["ready", "reserved", "blank"] as const) {
        await expectPgError(tx, (s) => s.update(cards).set({ state, orderItemId: null }).where(eq(cards.id, card.id)), GUARD);
      }
      await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, card.id));
    }));

  test("a retired card stays retired", () =>
    rollback(db, async (tx) => {
      const { card } = await insertClaimedCard(tx);
      await tx.update(cards).set({ state: "retired", profileId: null }).where(eq(cards.id, card.id));
      await expectPgError(tx, (s) => s.update(cards).set({ state: "released" }).where(eq(cards.id, card.id)), GUARD);
    }));

  test("only a blank card can be deleted", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      await expectPgError(tx, (s) => s.delete(cards).where(eq(cards.id, card.id)), GUARD);
      const stock = await insertStockPurchase(tx);
      const [blank] = await tx.insert(cards).values({ stockPurchaseId: stock.id }).returning();
      await tx.delete(cards).where(eq(cards.id, blank.id));
    }));
});

describe("activation_credentials_guard", () => {
  test("used and revoked are final, and the lookup value and card are immutable", () =>
    rollback(db, async (tx) => {
      const { card } = await insertProvisioningDbc(tx);
      const { card: other } = await insertProvisioningDbc(tx);
      const [used] = await tx
        .insert(activationCredentials)
        .values({ cardId: card.id, lookupHmac: syntheticLookup(9001) })
        .returning();
      await tx.update(activationCredentials).set({ usedAt: new Date() }).where(eq(activationCredentials.id, used.id));
      const where = eq(activationCredentials.id, used.id);
      await expectPgError(tx, (s) => s.update(activationCredentials).set({ usedAt: null }).where(where), GUARD);
      await expectPgError(tx, (s) => s.update(activationCredentials).set({ lookupHmac: syntheticLookup(9002) }).where(where), GUARD);
      await expectPgError(tx, (s) => s.update(activationCredentials).set({ cardId: other.id }).where(where), GUARD);

      const [revoked] = await tx
        .insert(activationCredentials)
        .values({ cardId: card.id, lookupHmac: syntheticLookup(9003), revokedAt: new Date() })
        .returning();
      await expectPgError(
        tx,
        (s) => s.update(activationCredentials).set({ revokedAt: null }).where(eq(activationCredentials.id, revoked.id)),
        GUARD,
      );
    }));

  test("credentials are history and cannot be deleted", () =>
    rollback(db, async (tx) => {
      const { card } = await insertProvisioningDbc(tx);
      const [credential] = await tx
        .insert(activationCredentials)
        .values({ cardId: card.id, lookupHmac: syntheticLookup(9004) })
        .returning();
      await expectPgError(tx, (s) => s.delete(activationCredentials).where(eq(activationCredentials.id, credential.id)), GUARD);
    }));
});

describe("history_guard", () => {
  test("payments, refunds and activity events cannot be deleted", () =>
    rollback(db, async (tx) => {
      const { order, owner } = await insertOrder(tx);
      const money = { orderId: order.id, amount: 100, method: "cash" as const, recordedByAccountId: owner.id };
      const [payment] = await tx.insert(payments).values({ ...money, paidOn: today }).returning();
      const [refund] = await tx.insert(refunds).values({ ...money, refundedOn: today }).returning();
      const [event] = await tx.insert(activityEvents).values({ type: "note", orderId: order.id, note: "synthetic" }).returning();
      await expectPgError(tx, (s) => s.delete(payments).where(eq(payments.id, payment.id)), GUARD);
      await expectPgError(tx, (s) => s.delete(refunds).where(eq(refunds.id, refund.id)), GUARD);
      await expectPgError(tx, (s) => s.delete(activityEvents).where(eq(activityEvents.id, event.id)), GUARD);
    }));

  test("blocking deletes leaves room for an additive void/correction mechanism (Milestone 8)", () =>
    rollback(db, async (tx) => {
      const { order, owner } = await insertOrder(tx);
      const [payment] = await tx
        .insert(payments)
        .values({ orderId: order.id, amount: 100, method: "cash", paidOn: today, recordedByAccountId: owner.id })
        .returning();
      await tx.execute(sql`alter table payments add column voided_at timestamptz`);
      await tx.execute(sql`update payments set voided_at = now() where id = ${payment.id}`);
      const { rows } = await tx.execute<{ voided: boolean }>(
        sql`select voided_at is not null as voided from payments where id = ${payment.id}`,
      );
      expect(rows[0].voided).toBe(true);
    }));
});

describe("orders_guard", () => {
  test("Completed and Cancelled are final", () =>
    rollback(db, async (tx) => {
      const { order: done } = await insertOrder(tx);
      await tx.update(orders).set({ status: "completed", completedAt: new Date() }).where(eq(orders.id, done.id));
      await expectPgError(
        tx,
        (s) => s.update(orders).set({ status: "in_progress", completedAt: null }).where(eq(orders.id, done.id)),
        GUARD,
      );

      const { order: stopped } = await insertOrder(tx);
      await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, stopped.id));
      await expectPgError(
        tx,
        (s) =>
          s.update(orders).set({ status: "completed", cancelledAt: null, completedAt: new Date() }).where(eq(orders.id, stopped.id)),
        GUARD,
      );
      // Non-lifecycle fields (e.g. who it is assigned to) stay editable.
      await tx.update(orders).set({ notes: "synthetic follow-up" }).where(eq(orders.id, done.id));
    }));
});

describe("review follow-ups", () => {
  test("recorded money cannot be rewritten in place; annotations can", () =>
    rollback(db, async (tx) => {
      const { order, owner } = await insertOrder(tx);
      const money = { orderId: order.id, amount: 100, method: "cash" as const, recordedByAccountId: owner.id };
      const [payment] = await tx.insert(payments).values({ ...money, paidOn: today }).returning();
      const [refund] = await tx.insert(refunds).values({ ...money, refundedOn: today }).returning();
      await expectPgError(tx, (s) => s.update(payments).set({ amount: 999 }).where(eq(payments.id, payment.id)), GUARD);
      await expectPgError(tx, (s) => s.update(payments).set({ paidOn: "2026-01-01" }).where(eq(payments.id, payment.id)), GUARD);
      await expectPgError(tx, (s) => s.update(refunds).set({ method: "gcash" }).where(eq(refunds.id, refund.id)), GUARD);
      await tx.update(payments).set({ reference: "SYNTH-REF" }).where(eq(payments.id, payment.id));
      await tx.update(refunds).set({ reason: "Synthetic reason" }).where(eq(refunds.id, refund.id));
    }));

  test("activity events are immutable", () =>
    rollback(db, async (tx) => {
      const { order } = await insertOrder(tx);
      const [event] = await tx.insert(activityEvents).values({ type: "note", orderId: order.id, note: "synthetic" }).returning();
      await expectPgError(tx, (s) => s.update(activityEvents).set({ note: "rewritten" }).where(eq(activityEvents.id, event.id)), GUARD);
    }));

  test("a card cannot be retired while it still has a usable credential, nor get one afterwards", () =>
    rollback(db, async (tx) => {
      const { card } = await insertProvisioningDbc(tx);
      const [credential] = await tx
        .insert(activationCredentials)
        .values({ cardId: card.id, lookupHmac: syntheticLookup(9100) })
        .returning();
      await expectPgError(tx, (s) => s.update(cards).set({ state: "retired" }).where(eq(cards.id, card.id)), GUARD);
      await tx.update(activationCredentials).set({ revokedAt: new Date() }).where(eq(activationCredentials.id, credential.id));
      await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, card.id));
      await expectPgError(
        tx,
        (s) => s.insert(activationCredentials).values({ cardId: card.id, lookupHmac: syntheticLookup(9101) }),
        GUARD,
      );
      // Recording historical (already revoked) credentials stays possible.
      await tx.insert(activationCredentials).values({ cardId: card.id, lookupHmac: syntheticLookup(9102), revokedAt: new Date() });
    }));

  test("completed and cancelled orders cannot be deleted; an empty in-progress one can", () =>
    rollback(db, async (tx) => {
      const { order: done } = await insertOrder(tx);
      await tx.update(orders).set({ status: "completed", completedAt: new Date() }).where(eq(orders.id, done.id));
      await expectPgError(tx, (s) => s.delete(orders).where(eq(orders.id, done.id)), GUARD);
      const { order: mistake } = await insertOrder(tx);
      await tx.delete(orders).where(eq(orders.id, mistake.id));
    }));
});
