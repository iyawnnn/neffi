import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import { CardError } from "../cards/card";
import { withPreparationCard } from "../cards/preparation";
import type { Db } from "../db";
import { activationLookup, normalizeActivationCode, sameLookup } from "./code";
import { decryptActivationCode, encryptActivationCode, type CredentialSecrets } from "./encryption";

export type CodeReveal = { status: "available"; code: string; credentialId: string }
  | { status: "legacy_code_needed" | "unavailable" | "key_unavailable" };

type RetrievalInput = { actorId: string; cardId: string; credentialId: string; secrets: CredentialSecrets };

export class ActivationCodeRetrievalError extends Error {
  constructor() {
    super("Activation code unavailable");
    this.name = "ActivationCodeRetrievalError";
  }
}

async function currentCredential(tx: Db, input: RetrievalInput, card: typeof schema.cards.$inferSelect) {
  const [actor] = await tx.select({ role: schema.accounts.role }).from(schema.accounts).where(eq(schema.accounts.id, input.actorId));
  if (actor?.role !== "owner") return null;
  if (card.kind !== "dbc" || card.state === "retired" || card.ownerAccountId) return null;
  const [credential] = await tx.select().from(schema.activationCredentials)
    .where(and(eq(schema.activationCredentials.id, input.credentialId), eq(schema.activationCredentials.cardId, input.cardId), isNull(schema.activationCredentials.usedAt), isNull(schema.activationCredentials.revokedAt)))
    .for("update");
  return credential ?? null;
}

export function revealActivationCode(db: Db, input: RetrievalInput): Promise<CodeReveal> {
  return withPreparationCard<CodeReveal>(db, input, async (tx, { card }) => {
    const credential = await currentCredential(tx, input, card);
    if (!credential) return { status: "unavailable" };
    if (!credential.encryptedCode) return { status: "legacy_code_needed" };
    const binding = { credentialId: credential.id, cardId: input.cardId, lookupHmac: credential.lookupHmac };
    let code: string;
    try {
      code = decryptActivationCode(credential.encryptedCode, binding, input.secrets);
    } catch {
      const parts = credential.encryptedCode.split(".");
      return { status: parts.length === 5 && parts[0] === "v1" && /^[A-Za-z0-9_-]+$/.test(parts[1]) && !input.secrets.encryptionKeys.has(parts[1])
        ? "key_unavailable" : "unavailable" };
    }
    if (!sameLookup(credential.lookupHmac, activationLookup(input.secrets.lookupSecret, code))) return { status: "unavailable" };
    await recordActivity(tx, { type: "activation_code_viewed", actorAccountId: input.actorId, cardId: input.cardId, activationCredentialId: credential.id });
    return { status: "available", credentialId: credential.id, code };
  }).catch((error: unknown): CodeReveal => {
    if (error instanceof CardError) return { status: "unavailable" };
    throw error;
  });
}

export function saveExistingActivationCode(db: Db, input: RetrievalInput & { code: string }): Promise<void> {
  return withPreparationCard(db, input, async (tx, { card }) => {
    const credential = await currentCredential(tx, input, card);
    const code = normalizeActivationCode(input.code);
    if (!credential || credential.encryptedCode || !code || !sameLookup(credential.lookupHmac, activationLookup(input.secrets.lookupSecret, code))) {
      throw new ActivationCodeRetrievalError();
    }
    const encryptedCode = encryptActivationCode(code, { credentialId: credential.id, cardId: input.cardId, lookupHmac: credential.lookupHmac }, input.secrets);
    const [updated] = await tx.update(schema.activationCredentials).set({ encryptedCode })
      .where(and(eq(schema.activationCredentials.id, credential.id), isNull(schema.activationCredentials.encryptedCode), isNull(schema.activationCredentials.usedAt), isNull(schema.activationCredentials.revokedAt)))
      .returning({ id: schema.activationCredentials.id });
    if (!updated) throw new ActivationCodeRetrievalError();
    await recordActivity(tx, { type: "activation_code_adopted", actorAccountId: input.actorId, cardId: input.cardId, activationCredentialId: credential.id });
  }).catch((error: unknown) => {
    if (error instanceof CardError) throw new ActivationCodeRetrievalError();
    throw error;
  });
}
