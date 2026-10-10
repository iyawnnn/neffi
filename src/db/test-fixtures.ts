// Test-only builders for the minimum valid rows each invariant test needs. Synthetic values only.
import { accounts, cards, orderItems, orders, products, profiles, purchasers, stockPurchases } from "./schema";
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

let tokenSequence = 0;
export const syntheticToken = () => `SYNTH${String(++tokenSequence).padStart(6, "0")}`;
// 64 lowercase hex chars: the shape of an HMAC-SHA256 lookup value. Synthetic; no activation code exists for it.
export const syntheticLookup = (n: number) => n.toString(16).padStart(64, "0");

export async function insertStockPurchase(tx: TestTx) {
  const owner = await insertAccount(tx, "owner");
  const [row] = await tx.insert(stockPurchases).values({ receivedOn: "2026-10-01", createdByAccountId: owner.id }).returning();
  return row;
}

export async function insertProfile(tx: TestTx, accountId: string) {
  const [row] = await tx.insert(profiles).values({ accountId }).returning();
  return row;
}

// A DBC that was sold and claimed: released against an order item, owned, optionally routed to a profile.
export async function insertClaimedCard(tx: TestTx) {
  const { item, product } = await insertOrderItem(tx, "dbc");
  const stock = await insertStockPurchase(tx);
  const owner = await insertAccount(tx);
  const profile = await insertProfile(tx, owner.id);
  const [card] = await tx
    .insert(cards)
    .values({
      stockPurchaseId: stock.id,
      productId: product.id,
      kind: "dbc",
      state: "released",
      orderItemId: item.id,
      publicToken: syntheticToken(),
      ownerAccountId: owner.id,
      profileId: profile.id,
    })
    .returning();
  return { card, owner, profile, item, product, stock };
}

export async function insertReadyDbc(tx: TestTx) {
  const stock = await insertStockPurchase(tx);
  const product = await insertProduct(tx, "dbc");
  const [card] = await tx
    .insert(cards)
    .values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "ready", publicToken: syntheticToken(), nfcVerifiedAt: new Date(), packageMatchedAt: new Date() })
    .returning();
  return { card, product, stock };
}

// A DBC mid-provisioning: blank with its permanent token and no physical evidence. This is the only form that can
// hold a usable credential before the package match.
export async function insertProvisioningDbc(tx: TestTx) {
  const stock = await insertStockPurchase(tx);
  const product = await insertProduct(tx, "dbc");
  const [card] = await tx
    .insert(cards)
    .values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", publicToken: syntheticToken() })
    .returning();
  return { card, product, stock };
}
