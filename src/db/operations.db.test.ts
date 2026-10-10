import { eq } from "drizzle-orm";
import { beforeAll, describe, test } from "vitest";
import { activityEvents, expenses, refunds, shipments, supportCaseCards, supportCases } from "./schema";
import { insertOrder, insertReadyDbc } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const missing = "00000000-0000-4000-8000-000000000000";

describe("Support Cases", () => {
  test("Resolved and its timestamp cannot disagree", () =>
    rollback(db, async (tx) => {
      const [kase] = await tx.insert(supportCases).values({ type: "other", summary: "Synthetic case" }).returning();
      await expectPgError(
        tx,
        (s) => s.update(supportCases).set({ status: "resolved" }).where(eq(supportCases.id, kase.id)),
        "23514",
        "support_cases_resolved_at_matches_status",
      );
    }));

  test("a card is linked to a case once", () =>
    rollback(db, async (tx) => {
      const [kase] = await tx.insert(supportCases).values({ type: "defective_card", summary: "Synthetic case" }).returning();
      const { card } = await insertReadyDbc(tx);
      await tx.insert(supportCaseCards).values({ supportCaseId: kase.id, cardId: card.id, role: "affected" });
      await expectPgError(
        tx,
        (s) => s.insert(supportCaseCards).values({ supportCaseId: kase.id, cardId: card.id, role: "replacement" }),
        "23505",
        "support_case_cards_support_case_id_card_id_pk",
      );
    }));

  test("support-driven refunds and shipments link to a real case", () =>
    rollback(db, async (tx) => {
      const { order, owner } = await insertOrder(tx);
      await expectPgError(
        tx,
        (s) =>
          s.insert(refunds).values({
            orderId: order.id,
            amount: 100,
            method: "cash",
            refundedOn: "2026-10-10",
            recordedByAccountId: owner.id,
            supportCaseId: missing,
          }),
        "23503",
        "refunds_support_case_id_support_cases_id_fk",
      );
      await expectPgError(
        tx,
        (s) => s.insert(shipments).values({ orderId: order.id, supportCaseId: missing }),
        "23503",
        "shipments_support_case_id_support_cases_id_fk",
      );
    }));
});

describe("Activity Events and Expenses", () => {
  test("an activity event is always about something", () =>
    rollback(db, async (tx) => {
      await expectPgError(tx, (s) => s.insert(activityEvents).values({ type: "note", note: "orphan" }), "23514", "activity_events_has_subject");
    }));

  test("expense amounts are positive", () =>
    rollback(db, async (tx) => {
      const { owner } = await insertOrder(tx);
      await expectPgError(
        tx,
        (s) => s.insert(expenses).values({ spentOn: "2026-10-10", amount: 0, category: "other", createdByAccountId: owner.id }),
        "23514",
        "expenses_amount_positive",
      );
    }));
});
