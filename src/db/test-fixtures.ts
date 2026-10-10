// Test-only builders for the minimum valid rows each invariant test needs. Synthetic values only.
import { accounts, orderItems, orders, products, purchasers } from "./schema";
import type { TestTx } from "./testing";

let sequence = 0;
const next = () => ++sequence;

export async function insertAccount(tx: TestTx, role: "customer" | "owner" = "customer") {
  const n = next();
  const [row] = await tx
    .insert(accounts)
    .values({ name: `Synthetic ${role} ${n}`, email: `${role}-${n}@example.test`, role })
    .returning();
  return row;
}

export async function insertProduct(tx: TestTx, kind: "dbc" | "grc", price = 50_000) {
  const [row] = await tx.insert(products).values({ kind, name: `Synthetic ${kind} ${next()}`, price }).returning();
  return row;
}

export async function insertOrder(tx: TestTx) {
  const owner = await insertAccount(tx, "owner");
  const [purchaser] = await tx.insert(purchasers).values({ name: `Synthetic Purchaser ${next()}` }).returning();
  const [order] = await tx
    .insert(orders)
    .values({ purchaserId: purchaser.id, createdByAccountId: owner.id, assignedToAccountId: owner.id })
    .returning();
  return { order, owner, purchaser };
}

export async function insertOrderItem(tx: TestTx, kind: "dbc" | "grc", quantity = 1) {
  const { order, owner } = await insertOrder(tx);
  const product = await insertProduct(tx, kind);
  const [item] = await tx
    .insert(orderItems)
    .values({ orderId: order.id, productId: product.id, productKind: kind, quantity, unitPrice: product.price })
    .returning();
  return { item, order, owner, product };
}
