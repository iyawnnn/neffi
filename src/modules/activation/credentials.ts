import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { activationLookup, generateActivationCode } from "./code";
import { encryptActivationCode, type CredentialSecrets } from "./encryption";

const usable = (cardId: string) =>
  and(eq(schema.activationCredentials.cardId, cardId), isNull(schema.activationCredentials.usedAt), isNull(schema.activationCredentials.revokedAt));

export class ActivationCredentialError extends Error {
  constructor() {
    super("collision_limit");
    this.name = "ActivationCredentialError";
  }
}

export async function issueActivationCredential(tx: Db, cardId: string, secrets: CredentialSecrets): Promise<{ credentialId: string; code: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateActivationCode();
    const id = randomUUID();
    const lookupHmac = activationLookup(secrets.lookupSecret, code);
    const [row] = await tx
      .insert(schema.activationCredentials)
      .values({ id, cardId, lookupHmac, encryptedCode: encryptActivationCode(code, { credentialId: id, cardId, lookupHmac }, secrets) })
      .onConflictDoNothing({ target: schema.activationCredentials.lookupHmac })
      .returning({ id: schema.activationCredentials.id });
    if (row) return { credentialId: row.id, code };
  }
  throw new ActivationCredentialError();
}

export async function usableCredential(tx: Db, cardId: string) {
  const [row] = await tx
    .select({ id: schema.activationCredentials.id, lookupHmac: schema.activationCredentials.lookupHmac })
    .from(schema.activationCredentials)
    .where(usable(cardId));
  return row ?? null;
}

// Conditional on the credential still being usable (and being the one the owner saw), so a stale request revokes nothing.
export async function revokeUsableCredential(tx: Db, cardId: string, expectedId?: string): Promise<string | null> {
  const [row] = await tx
    .update(schema.activationCredentials)
    .set({ revokedAt: new Date(), encryptedCode: null })
    .where(and(usable(cardId), expectedId ? eq(schema.activationCredentials.id, expectedId) : undefined))
    .returning({ id: schema.activationCredentials.id });
  return row?.id ?? null;
}
