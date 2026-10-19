import { timingSafeEqual } from "node:crypto";
import { hmacHex } from "@/auth/otp-quota";
import { CROCKFORD, randomCrockford } from "@/lib/crockford";

// Pure helpers (no server-only, no env): the secret is passed in by the caller.

const CODE_LENGTH = 8; // ~40 bits

export function generateActivationCode() {
  let code: string;
  do {
    code = randomCrockford(CODE_LENGTH);
  } while (!/\d/.test(code) || !/[G-HJ-KM-NP-TV-Z]/.test(code));
  return code;
}

export const formatActivationCode = (code: string) => code.match(/.{4}/g)!.join("-");

// Accepts what a person reads off a package: any case, spaces or hyphens, and Crockford's look-alike mapping.
export function normalizeActivationCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "").replaceAll("O", "0").replace(/[IL]/g, "1");
  return code.length === CODE_LENGTH && [...code].every((char) => CROCKFORD.includes(char)) ? code : null;
}

// Domain-separated keyed hash: the only form of an activation code that is ever stored.
export const activationLookup = (secret: string, normalizedCode: string) => hmacHex(secret, "activation", normalizedCode);

// Constant-time comparison of two hex lookup values; unequal lengths are simply unequal.
export const sameLookup = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
