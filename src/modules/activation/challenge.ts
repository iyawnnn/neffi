import { hmacHex } from "@/auth/otp-quota";
import { sameLookup } from "./code";

// Pure helpers (no server-only, no env): the secret is passed in by the caller.
// Proof that this browser entered a valid code recently. Carries only the credential id, never the code or the Card.
export const CHALLENGE_TTL_MS = 15 * 60_000;

const sign = (secret: string, body: string) => hmacHex(secret, "activation-challenge", body);

export function signChallenge(secret: string, credentialId: string, now = new Date()): string {
  const body = `${credentialId}.${now.getTime() + CHALLENGE_TTL_MS}`;
  return `${body}.${sign(secret, body)}`;
}

export function verifyChallenge(secret: string, value: string | undefined, now = new Date()): string | null {
  const [credentialId, expires, signature] = value?.split(".") ?? [];
  if (!credentialId || !expires || !/^\d+$/.test(expires) || !signature || !/^[0-9a-f]{64}$/.test(signature)) return null;
  if (!sameLookup(signature, sign(secret, `${credentialId}.${expires}`))) return null;
  return Number(expires) > now.getTime() ? credentialId : null;
}
