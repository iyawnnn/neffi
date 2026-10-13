import { beforeAll, expect, test } from "vitest";
import { insertOrderItem } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { getPurchaser, listPurchasers, purchaserOrders, updatePurchaser } from "./purchasers";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
test("purchaser search/edit and order balances stay independent of Accounts", () => rollback(db, async (tx) => {
  const { order } = await insertOrderItem(tx, "dbc", 2);
  await updatePurchaser(tx, { id: order.purchaserId, name: "Buyer%_", contactNumber: "09123456789" });
  expect(await getPurchaser(tx, order.purchaserId)).toMatchObject({ name: "Buyer%_", contactNumber: "09123456789" });
  expect((await listPurchasers(tx, "%_")).map((r) => r.id)).toEqual([order.purchaserId]);
  expect(await purchaserOrders(tx, order.purchaserId)).toMatchObject([{ id: order.id, orderTotal: 100000, balance: 100000 }]);
  expect(Object.keys((await getPurchaser(tx, order.purchaserId))!)).not.toContain("accountId");
}));
