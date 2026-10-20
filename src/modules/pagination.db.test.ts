import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards, orders, supportCases } from "@/db/schema";
import { insertAccount, insertOrder, insertReadyDbc, insertStockPurchase } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { countAccounts, listAccounts } from "./accounts/directory";
import { countCards, listCards } from "./inventory/queries";
import { countStockPurchases, listStockPurchases } from "./inventory/stock-purchases";
import { countOrders, listOrders } from "./orders/queries";
import { countPurchasers, listPurchaserDirectory } from "./orders/purchasers";
import { countCases, listCases } from "./support/queries";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("numbered order pages are disjoint, ordered newest first and counted under the same filters", () => rollback(db, async (tx) => {
  const made = [];
  for (let index = 0; index < 5; index += 1) made.push((await insertOrder(tx)).order);
  await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, made[0].id));
  expect(await countOrders(tx)).toBe(5);
  expect(await countOrders(tx, { status: "cancelled" })).toBe(1);
  expect(await countOrders(tx, { status: "in_progress", purchaserId: made[1].purchaserId })).toBe(1);
  const first = await listOrders(tx, { limit: 2, offset: 0 });
  const second = await listOrders(tx, { limit: 2, offset: 2 });
  const last = await listOrders(tx, { limit: 2, offset: 4 });
  const ids = [...first.orders, ...second.orders, ...last.orders].map((row) => row.id);
  expect(new Set(ids).size).toBe(5);
  expect(first.orders).toHaveLength(2);
  expect(last.orders).toHaveLength(1);
  expect(first.next).toBeNull();
  expect((await listOrders(tx, { limit: 10, status: "cancelled" })).orders.map((row) => row.id)).toEqual([made[0].id]);
  // The cursor mode the dashboard and purchaser page use is untouched.
  expect((await listOrders(tx)).orders).toHaveLength(5);
}));

test("support cases and cards page with real totals", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  for (let index = 0; index < 3; index += 1) await tx.insert(supportCases).values({ type: "other", summary: `Case ${index}`, openedByAccountId: owner.id, assignedToAccountId: owner.id, ...(index ? {} : { status: "resolved" as const, resolvedAt: new Date() }) });
  expect(await countCases(tx)).toBe(3);
  expect(await countCases(tx, { status: "open" })).toBe(2);
  expect((await listCases(tx, { limit: 2, offset: 2 })).cases).toHaveLength(1);
  await insertReadyDbc(tx); await insertReadyDbc(tx);
  expect(await countCards(tx, { state: "ready" })).toBe(2);
  expect(await countCards(tx, { kind: "grc" })).toBe(0);
  const page = await listCards(tx, { limit: 1, offset: 1, kind: "dbc" });
  expect(page.cards).toHaveLength(1);
  expect(page.next).toBeNull();
  expect((await listCards(tx, { limit: 1, kind: "dbc" })).next).not.toBeNull();
  expect(await tx.select({ id: cards.id }).from(cards)).toHaveLength(2);
}));

test("customers, accounts and stock purchases page with filters and counts", () => rollback(db, async (tx) => {
  const { purchaser } = await insertOrder(tx);
  await insertOrder(tx);
  expect(await countPurchasers(tx)).toBe(2);
  expect(await countPurchasers(tx, purchaser.name.slice(0, 12))).toBe(2);
  expect(await countPurchasers(tx, "100%")).toBe(0);
  const directory = await listPurchaserDirectory(tx, { limit: 1, offset: 1 });
  expect(directory).toHaveLength(1);
  expect(Object.keys(directory[0]).sort()).toEqual(["cardCount", "contactNumber", "id", "name", "orderCount"]);
  expect((await listPurchaserDirectory(tx, { limit: 5 })).map((row) => row.orderCount)).toEqual([1, 1]);
  await insertAccount(tx);
  const total = await countAccounts(tx);
  expect(total).toBeGreaterThanOrEqual(3);
  expect(await listAccounts(tx, "", { limit: 2, offset: 0 })).toHaveLength(2);
  expect(await countAccounts(tx, "customer-")).toBe(1);
  await insertStockPurchase(tx); await insertStockPurchase(tx);
  expect(await countStockPurchases(tx)).toBe(2);
  expect(await listStockPurchases(tx, { limit: 1, offset: 1 })).toHaveLength(1);
}));
