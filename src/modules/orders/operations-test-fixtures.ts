import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { cards, products } from "../../db/schema";
import { insertStockPurchase, syntheticCredentialSecrets } from "../../db/test-fixtures";
import type { TestTx } from "../../db/testing";
import { recordNfcCheck } from "../cards/card";
import { matchPackage, provisionDbc } from "../cards/dbc";
import { cardUrl } from "../cards/token";
import type { CredentialSecrets } from "../activation/encryption";
import type { NormalDbcOrderInput } from "./normal-dbc";

export { syntheticCredentialSecrets };

export function normalOrderInput(actorId: string, overrides: Partial<NormalDbcOrderInput> = {}): NormalDbcOrderInput {
  return { actorId, clientKey: randomUUID(), quantity: 1, paymentMethod: "gcash", purchaser: { name: "Synthetic Buyer" }, delivery: { method: "in_person" }, secrets: syntheticCredentialSecrets(), ...overrides };
}

export async function virginStock(tx: TestTx, quantity: number): Promise<string[]> {
  const stock = await insertStockPurchase(tx);
  return (await tx.insert(cards).values(Array.from({ length: quantity }, () => ({ stockPurchaseId: stock.id }))).returning({ id: cards.id })).map((card) => card.id);
}

export async function preparedStock(tx: TestTx, actorId: string, secrets: CredentialSecrets): Promise<{ cardId: string; code: string }> {
  const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.kind, "dbc"));
  if (!product) throw new Error("Create the synthetic DBC product first");
  const [cardId] = await virginStock(tx, 1);
  const provisioned = await provisionDbc(tx, { actorId, cardId, secrets });
  const origin = "https://cards.example.test";
  await recordNfcCheck(tx, { actorId, cardId, cardUrlOrigin: origin, readBackUri: cardUrl(origin, provisioned.publicToken), readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true });
  await matchPackage(tx, { actorId, cardId, activationCode: provisioned.activationCode, activationSecret: secrets.lookupSecret });
  return { cardId, code: provisioned.activationCode };
}

export async function cardById(tx: TestTx, cardId: string): Promise<typeof cards.$inferSelect> {
  const [card] = await tx.select().from(cards).where(eq(cards.id, cardId));
  return card;
}
