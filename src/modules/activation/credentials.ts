import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { activationLookup, generateActivationCode } from "./code";

const usable = (cardId: string) =>
  and(eq(schema.activationCredentials.cardId, cardId), isNull(schema.activationCredentials.usedAt), isNull(schema.activationCredentials.revokedAt));

// Stores only the keyed lookup value. The raw code is returned to the caller once and exists nowhere else.
export async function issueActivationCredential(tx: Db, cardId: string, secret: string): Promise<{ credentialId: string; code: string }> {
  const code = generateActivationCode();
  const [row] = await tx
    .insert(schema.activationCredentials)
    .values({ cardId, lookupHmac: activationLookup(secret, code) })
    .returning({ id: schema.activationCredentials.id });
  return { credentialId: row.id, code };
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
    .set({ revokedAt: new Date() })
    .where(and(usable(cardId), expectedId ? eq(schema.activationCredentials.id, expectedId) : undefined))
    .returning({ id: schema.activationCredentials.id });
  return row?.id ?? null;
}
