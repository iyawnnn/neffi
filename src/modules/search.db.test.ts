import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { orders, purchasers, shipments, supportCases } from "@/db/schema";
import { insertClaimedCard } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { searchPage, searchRecords } from "./search";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

const find = async (tx: TestTx, query: string, type?: string) => (await searchRecords(tx, query, { limit: 50 })).hits.filter((hit) => !type || hit.type === type);

test("search finds orders, customers, accounts, cards, support cases and tracking, and says why", () => rollback(db, async (tx) => {
  const { card, owner, item } = await insertClaimedCard(tx);
  const [order] = await tx.select().from(orders).where(eq(orders.id, item.orderId));
  await tx.update(purchasers).set({ name: "Buyer%_", contactNumber: "091234" }).where(eq(purchasers.id, order.purchaserId));
  await tx.insert(shipments).values({ orderId: item.orderId, trackingNumber: "TRACK-123" });
  const [supportCase] = await tx.insert(supportCases).values({ type: "other", summary: "Card will not tap", orderId: order.id, openedByAccountId: owner.id, assignedToAccountId: owner.id }).returning();

  for (const query of [String(order.number), `#${order.number}`, `order ${order.number}`]) expect((await find(tx, query, "order")).map((hit) => hit.id)).toContain(order.id);
  expect(await find(tx, String(order.number), "order")).toMatchObject([{ title: `Order ${order.number}`, subtitle: "Buyer%_", matched: "Order number" }]);
  expect(await find(tx, "buyer%_", "order")).toMatchObject([{ matched: "Customer name" }]);
  expect(await find(tx, "%_", "customer")).toMatchObject([{ title: "Buyer%_", matched: "Name" }]);
  expect(await find(tx, "091234", "customer")).toMatchObject([{ matched: "Contact number" }]);
  expect(await find(tx, "091234", "order")).toMatchObject([{ matched: "Customer contact" }]);
  expect(await find(tx, owner.email, "account")).toMatchObject([{ id: owner.id, matched: "Account email" }]);
  expect((await find(tx, card.publicToken!, "card")).map((hit) => hit.id)).toEqual([card.id]);
  expect((await find(tx, card.id, "card")).map((hit) => hit.id)).toEqual([card.id]);
  expect((await find(tx, card.publicToken!.slice(-4), "card")).map((hit) => hit.id)).toContain(card.id);
  expect(await find(tx, "will not tap", "support")).toMatchObject([{ id: supportCase.id, matched: "Summary" }]);
  expect(await find(tx, supportCase.id.slice(0, 8), "support")).toMatchObject([{ id: supportCase.id, matched: "Case reference" }]);
  expect(await find(tx, String(order.number), "support")).toMatchObject([{ id: supportCase.id, matched: "Linked order" }]);
  expect(await find(tx, "track-123", "tracking")).toMatchObject([{ id: item.orderId, title: "TRACK-123", matched: "Tracking number" }]);
  expect((await searchRecords(tx, "x", { limit: 5 }))).toEqual({ hits: [], total: 0 });
  expect(await searchRecords(tx, "   ", { limit: 5 })).toEqual({ hits: [], total: 0 });
}));

test("search returns display fields only and nothing that looks like a secret", () => rollback(db, async (tx) => {
  const { card, owner } = await insertClaimedCard(tx);
  const hits = (await searchRecords(tx, owner.email, { limit: 50 })).hits;
  expect(hits.every((hit) => Object.keys(hit).sort().join() === "id,matched,status,subtitle,title,type")).toBe(true);
  const cardHits = await find(tx, card.publicToken!, "card");
  // Only the last four characters of the public token are shown, never the credential tables.
  expect(JSON.stringify(cardHits)).not.toContain(card.publicToken!);
}));

test("wildcards are escaped, per-type caps hold and numbered pages are real and clamped", () => rollback(db, async (tx) => {
  for (let index = 0; index < 5; index += 1) await tx.insert(purchasers).values({ name: `Pager Buyer ${index}` });
  await tx.insert(purchasers).values({ name: "Other" });
  expect((await find(tx, "pager%", "customer"))).toEqual([]);
  expect((await searchRecords(tx, "pager buyer", { limit: 50, perType: 3 })).hits).toHaveLength(3);
  const all = await searchRecords(tx, "pager buyer", { limit: 2, offset: 2 });
  expect(all.total).toBe(5);
  expect(all.hits).toHaveLength(2);
  const last = await searchPage(tx, "pager buyer", "99");
  expect(last.window).toMatchObject({ page: 1, total: 5 });
  expect(last.hits).toHaveLength(5);
  expect((await searchPage(tx, "no such thing here", "4")).window).toMatchObject({ page: 1, total: 0 });
}));

test("full search remains pageable beyond one thousand matches", () => rollback(db, async (tx) => {
  await tx.insert(purchasers).values(Array.from({ length: 1003 }, (_, index) => ({ name: `Large pager ${index}` })));
  const last = await searchPage(tx, "Large pager", "51");
  expect(last.window).toMatchObject({ page: 51, total: 1003 });
  expect(last.hits).toHaveLength(3);
  expect((await searchRecords(tx, "Large pager", { limit: 20, perType: 4 })).hits).toHaveLength(4);
}));
