import "server-only";
import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { revokeUsableCredential } from "../activation/credentials";
import type { CredentialSecrets } from "../activation/encryption";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { allocateDbcCardsInTransaction } from "../orders/allocation";
import { OrderError } from "../orders/errors";
import { withPreparationCard } from "./preparation";
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
  | "uri_mismatch"
  | "retry"
  | "secrets_required";

// A rule refusal the owner can act on. Messages carry no data, only the code that callers map to copy.
export class CardError extends Error {
  constructor(readonly code: CardErrorCode) {
    super(code);
    this.name = "CardError";
  }
}

// Card-only callers use this lock; order-linked preparation locks its parent first.
export async function lockCard(tx: Db, cardId: string) {
  const [card] = await tx.select().from(schema.cards).where(eq(schema.cards.id, cardId)).for("update");
  if (!card) throw new CardError("not_found");
  return card;
}

// Orders and stock refer to the one active catalog product of a kind; anything else is ambiguous.
export async function activeProduct(tx: Db, kind: "dbc" | "grc") {
  const products = await tx
    .select({ id: schema.products.id, name: schema.products.name, price: schema.products.price })
    .from(schema.products)
    .where(and(eq(schema.products.kind, kind), eq(schema.products.active, true)))
    .limit(2);
  if (products.length !== 1) throw new CardError("no_product");
  return products[0];
}

export async function activeProductId(tx: Db, kind: "dbc" | "grc"): Promise<string> {
  return (await activeProduct(tx, kind)).id;
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
// verifies the one thing it can: the URI read back is exactly the intended one (the card URL for a DBC, the order
// item's current direct review URL for a GRC).
export async function recordNfcCheck(db: Db, input: NfcCheckInput): Promise<void> {
  if (!input.readBackMatched || !input.phoneOpenedUri || !input.tagLeftWritable) throw new CardError("checks_incomplete");

  await withPreparationCard(db, input, async (tx, { card, item, orderId, orderStatus }) => {
    let expectedUri: string;

    if (card.kind === "dbc" && (card.state === "blank" || card.state === "preparing") && card.publicToken) {
      expectedUri = cardUrl(input.cardUrlOrigin, card.publicToken);
    } else if (card.kind === "grc" && card.state === "reserved" && item) {
      if (!item.reviewUrl || orderStatus !== "in_progress") throw new CardError("item_ineligible");
      expectedUri = item.reviewUrl;
    } else {
      throw new CardError("wrong_state");
    }
    if (input.readBackUri.trim() !== expectedUri) throw new CardError("uri_mismatch");

    await tx.update(schema.cards).set({ nfcVerifiedAt: new Date() }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, {
      type: "card_nfc_verified",
      actorAccountId: input.actorId,
      cardId: card.id,
      orderId: orderId ?? undefined,
      note: ["owner confirmed; the URL read back matched the permanent card URL exactly", input.device?.trim()].filter(Boolean).join("; "),
    });
  });
}

// Pre-release removal of a card that failed or must not be sold. History is kept: credentials are revoked (never
// deleted) and a reserved GRC keeps its order link, which stops counting against the item so a replacement fits.
export async function retireCard(db: Db, input: { actorId: string; cardId: string; reason: string; secrets?: CredentialSecrets }): Promise<void> {
  await withPreparationCard(db, input, async (tx, { card, item, orderId }) => {
    const retirable = card.state === "blank" || card.state === "ready" || (card.state === "reserved" && card.kind === "grc") || (card.state === "preparing" && card.kind === "dbc");
    if (!retirable) throw new CardError("wrong_state");
    if (card.state === "preparing" && !input.secrets) throw new CardError("secrets_required");

    await revokeUsableCredential(tx, card.id);
    await tx.update(schema.cards).set({ state: "retired" }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, {
      type: "card_retired",
      actorAccountId: input.actorId,
      cardId: card.id,
      orderId: orderId ?? undefined,
      note: `reason: ${input.reason}`,
    });
    if (card.state === "preparing" && item && orderId) {
      await allocateDbcCardsInTransaction(tx, { actorId: input.actorId, orderId, orderItemId: item.id, secrets: input.secrets! }).catch((error: unknown) => {
        if (error instanceof OrderError) throw new CardError("wrong_state");
        throw error;
      });
    }
  });
}
