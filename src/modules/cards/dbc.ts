import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../../db/schema";
import { activationLookup, normalizeActivationCode, sameLookup } from "../activation/code";
import { issueActivationCredential, revokeUsableCredential, usableCredential } from "../activation/credentials";
import type { CredentialSecrets } from "../activation/encryption";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { activeProductId, CardError, lockCard } from "./card";
import { generateCardToken } from "./token";

type Actor = { actorId: string; cardId: string };

// The allocator already holds the Order, item and virgin Blank card locks.
export async function prepareAllocatedDbc(tx: Db, input: Actor & { orderId: string; orderItemId: string; productId: string; secrets: CredentialSecrets }): Promise<void> {
  const publicToken = generateCardToken();
  const [card] = await tx.update(schema.cards).set({ kind: "dbc", productId: input.productId, publicToken })
    .where(and(eq(schema.cards.id, input.cardId), eq(schema.cards.state, "blank"), isNull(schema.cards.publicToken), isNull(schema.cards.orderItemId))).returning({ id: schema.cards.id });
  if (!card) throw new CardError("wrong_state");
  await issueActivationCredential(tx, card.id, input.secrets);
  await tx.update(schema.cards).set({ state: "preparing", orderItemId: input.orderItemId }).where(eq(schema.cards.id, card.id));
  await recordActivity(tx, { type: "card_provisioned", actorAccountId: input.actorId, orderId: input.orderId, cardId: card.id, note: `token ${publicToken}` });
}

// Blank -> permanent token + the initial credential. The raw code is returned exactly once; a repeated call fails
// instead of issuing another, and a lost response is recovered through replaceProvisioningCredential.
export async function provisionDbc(
  db: Db,
  input: Actor & { secrets: CredentialSecrets },
): Promise<{ publicToken: string; credentialId: string; activationCode: string }> {
  return db.transaction(async (tx) => {
    const card = await lockCard(tx, input.cardId);
    if (card.state !== "blank" || card.kind === "grc") throw new CardError("wrong_state");
    if (card.publicToken) throw new CardError("already_provisioned");

    const publicToken = generateCardToken();
    const productId = card.productId ?? (await activeProductId(tx, "dbc"));
    await tx.update(schema.cards).set({ productId, kind: "dbc", publicToken }).where(eq(schema.cards.id, card.id));
    const { credentialId, code } = await issueActivationCredential(tx, card.id, input.secrets);
    await recordActivity(tx, { type: "card_provisioned", actorAccountId: input.actorId, cardId: card.id, note: `token ${publicToken}` });
    return { publicToken, credentialId, activationCode: code };
  });
}

// The OWNER confirms the private code physically packaged with this DBC belongs to this Card. Only then is it Ready.
export async function matchPackage(db: Db, input: Actor & { activationCode: string; activationSecret: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const card = await lockCard(tx, input.cardId);
    if (card.kind !== "dbc" || card.state !== "blank" || !card.publicToken) throw new CardError("wrong_state");
    if (!card.nfcVerifiedAt) throw new CardError("checks_incomplete");

    const code = normalizeActivationCode(input.activationCode);
    const credential = await usableCredential(tx, card.id);
    if (!code || !credential || !sameLookup(credential.lookupHmac, activationLookup(input.activationSecret, code))) {
      throw new CardError("code_mismatch");
    }
    await tx.update(schema.cards).set({ state: "ready", packageMatchedAt: new Date() }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, { type: "card_ready", actorAccountId: input.actorId, cardId: card.id });
  });
}

// Pre-release correction for a lost or mismatched unused credential. A Ready card is demoted first (Ready requires a
// recorded package match), the seen credential is revoked, a new one is issued and the package must be matched again.
export async function replaceProvisioningCredential(
  db: Db,
  input: Actor & { credentialId: string; reason: string; secrets: CredentialSecrets },
): Promise<{ credentialId: string; activationCode: string }> {
  return db.transaction(async (tx) => {
    const card = await lockCard(tx, input.cardId);
    if (card.kind !== "dbc" || !card.publicToken || (card.state !== "blank" && card.state !== "ready")) throw new CardError("wrong_state");

    if (card.state === "ready") {
      await tx.update(schema.cards).set({ state: "blank", packageMatchedAt: null }).where(eq(schema.cards.id, card.id));
    }
    if (!(await revokeUsableCredential(tx, card.id, input.credentialId))) throw new CardError("credential_changed");
    const { credentialId, code } = await issueActivationCredential(tx, card.id, input.secrets);
    await recordActivity(tx, {
      type: "activation_credential_replaced",
      actorAccountId: input.actorId,
      cardId: card.id,
      note: `reason: ${input.reason}`,
    });
    return { credentialId, activationCode: code };
  });
}
