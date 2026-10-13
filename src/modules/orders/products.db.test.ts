import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { orderItems, products } from "@/db/schema";
import { insertAccount, insertOrderItem } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { listOwnerAccess, listProducts, saveProduct } from "./products";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("create only when the kind has no active product", () => rollback(db, async (tx) => {
  const id = await saveProduct(tx, { kind: "dbc", name: "DBC", price: 50000 });
  expect(await listProducts(tx)).toMatchObject([{ id, kind: "dbc", name: "DBC", price: 50000 }]);
  await expect(saveProduct(tx, { kind: "dbc", name: "Duplicate", price: 100 })).rejects.toMatchObject({ code: "no_product" });
  expect(await tx.select().from(products)).toHaveLength(1);
}));

test("edit the active product in place, leaving historical unit_price locked", () => rollback(db, async (tx) => {
  const { item, product } = await insertOrderItem(tx, "dbc");
  expect(await saveProduct(tx, { productId: product.id, kind: "dbc", name: "New name", price: 60000 })).toBe(product.id);
  expect((await tx.select().from(orderItems).where(eq(orderItems.id, item.id)))[0].unitPrice).toBe(50000);
  expect(await listProducts(tx)).toMatchObject([{ id: product.id, name: "New name", price: 60000 }]);
}));

test("Owner Access lists owners only with readonly approved fields", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertAccount(tx, "customer");
  const rows = await listOwnerAccess(tx);
  expect(rows).toEqual([{ email: owner.email, role: "owner", createdAt: owner.createdAt }]);
  expect(Object.keys(rows[0]).sort()).toEqual(["createdAt", "email", "role"]);
}));
