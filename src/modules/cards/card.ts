import "server-only";
import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";

export type CardErrorCode =
  | "not_found"
  | "wrong_state"
  | "already_provisioned"
  | "credential_changed"
  | "code_mismatch"
  | "no_product"
  | "item_ineligible"
  | "item_full"
  | "checks_incomplete"
  | "uri_mismatch";

// A rule refusal the owner can act on. Messages carry no data, only the code that callers map to copy.
export class CardError extends Error {
  constructor(readonly code: CardErrorCode) {
    super(code);
    this.name = "CardError";
  }
}

// Every card mutation starts here, so concurrent operations on one card serialize and re-read fresh state.
export async function lockCard(tx: Db, cardId: string) {
  const [card] = await tx.select().from(schema.cards).where(eq(schema.cards.id, cardId)).for("update");
  if (!card) throw new CardError("not_found");
  return card;
}

// Orders and stock refer to the one active catalog product of a kind; anything else is ambiguous.
export async function activeProductId(tx: Db, kind: "dbc" | "grc"): Promise<string> {
  const products = await tx
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(eq(schema.products.kind, kind), eq(schema.products.active, true)))
    .limit(2);
  if (products.length !== 1) throw new CardError("no_product");
  return products[0].id;
}
