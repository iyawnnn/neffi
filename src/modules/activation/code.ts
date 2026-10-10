import { hmacHex } from "@/auth/otp-quota";
import { CROCKFORD, randomCrockford } from "@/lib/crockford";

// Pure helpers (no server-only, no env): the secret is passed in by the caller.

const CODE_LENGTH = 16; // 80 bits

export const generateActivationCode = () => randomCrockford(CODE_LENGTH);

export const formatActivationCode = (code: string) => code.match(/.{4}/g)!.join("-");

// Accepts what a person reads off a package: any case, spaces or hyphens, and Crockford's look-alike mapping.
export function normalizeActivationCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "").replaceAll("O", "0").replace(/[IL]/g, "1");
  return code.length === CODE_LENGTH && [...code].every((char) => CROCKFORD.includes(char)) ? code : null;
}

// Domain-separated keyed hash: the only form of an activation code that is ever stored.
export const activationLookup = (secret: string, normalizedCode: string) => hmacHex(secret, "activation", normalizedCode);
