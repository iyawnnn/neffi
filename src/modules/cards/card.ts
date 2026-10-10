import "server-only";
import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { cardUrl } from "./token";

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

export type NfcCheckInput = {
  actorId: string;
  cardId: string;
  cardUrlOrigin: string;
  readBackUri: string;
  readBackMatched: boolean;
  phoneOpenedUri: boolean;
  tagLeftWritable: boolean;
  device?: string;
};

// Records that a real tag was written, read back and tapped. The OWNER attests to the physical steps; the server
// verifies the one thing it can: the URI read back is exactly the card's intended URI.
export async function recordNfcCheck(db: Db, input: NfcCheckInput): Promise<void> {
  if (!input.readBackMatched || !input.phoneOpenedUri || !input.tagLeftWritable) throw new CardError("checks_incomplete");

  await db.transaction(async (tx) => {
    const card = await lockCard(tx, input.cardId);
    if (card.kind !== "dbc" || card.state !== "blank" || !card.publicToken) throw new CardError("wrong_state");
    if (input.readBackUri.trim() !== cardUrl(input.cardUrlOrigin, card.publicToken)) throw new CardError("uri_mismatch");

    await tx.update(schema.cards).set({ nfcVerifiedAt: new Date() }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, {
      type: "card_nfc_verified",
      actorAccountId: input.actorId,
      cardId: card.id,
      note: ["read back exactly, phone opened it, tag left writable", input.device?.trim()].filter(Boolean).join("; "),
    });
  });
}
