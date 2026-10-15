import { beforeAll, expect, test } from "vitest";
import { insertAccount } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { supportCases } from "@/db/schema";
import { getCaseDetail } from "../support/queries";
import { recordActivity } from "./record";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
test("case timeline preserves anonymous and authenticated actors for system rendering", () => rollback(db, async tx => {
  const account = await insertAccount(tx);
  const [support] = await tx.insert(supportCases).values({ type: "account_recovery", summary: "Recovery" }).returning();
  await recordActivity(tx, { type: "account_recovery_completed", actorAccountId: null, accountId: account.id, supportCaseId: support.id });
  await recordActivity(tx, { type: "security_notice_sent", actorAccountId: account.id, accountId: account.id, supportCaseId: support.id });
  expect((await getCaseDetail(tx, support.id))!.timeline.map(e => e.actorAccountId)).toEqual(expect.arrayContaining([null, account.id]));
}));
