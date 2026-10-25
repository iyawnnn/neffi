import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { normalizeActivationCode } from "./code";

export type CredentialSecrets = {
  lookupSecret: string;
  activeKeyId: string;
  encryptionKeys: ReadonlyMap<string, Buffer>;
};

export type CodeBinding = { credentialId: string; cardId: string; lookupHmac: string };

export class ActivationCodeEncryptionError extends Error {
  constructor() {
    super("Activation code unavailable");
    this.name = "ActivationCodeEncryptionError";
  }
}

const keyIdPattern = /^[A-Za-z0-9_-]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hmacPattern = /^[0-9a-f]{64}$/;

function aad(binding: CodeBinding): Buffer {
  if (!uuidPattern.test(binding.credentialId) || !uuidPattern.test(binding.cardId) || !hmacPattern.test(binding.lookupHmac)) {
    throw new ActivationCodeEncryptionError();
  }
  return Buffer.from(JSON.stringify(["v1", binding.credentialId, binding.cardId, binding.lookupHmac]));
}

function key(secrets: CredentialSecrets, keyId: string): Buffer {
  const value = secrets.encryptionKeys.get(keyId);
  if (!keyIdPattern.test(keyId) || !Buffer.isBuffer(value) || value.length !== 32) throw new ActivationCodeEncryptionError();
  return value;
}

function decode(value: string, length?: number): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new ActivationCodeEncryptionError();
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value || (length !== undefined && bytes.length !== length)) {
    throw new ActivationCodeEncryptionError();
  }
  return bytes;
}

export function encryptActivationCode(code: string, binding: CodeBinding, secrets: CredentialSecrets): string {
  const normalized = normalizeActivationCode(code);
  if (!normalized) throw new ActivationCodeEncryptionError();
  const secretKey = key(secrets, secrets.activeKeyId);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey, nonce);
  cipher.setAAD(aad(binding));
  const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  return ["v1", secrets.activeKeyId, nonce.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

export function decryptActivationCode(envelope: string, binding: CodeBinding, secrets: CredentialSecrets): string {
  try {
    const parts = envelope.split(".");
    if (parts.length !== 5 || parts[0] !== "v1") throw new ActivationCodeEncryptionError();
    const [, keyId, rawNonce, rawCiphertext, rawTag] = parts;
    const decipher = createDecipheriv("aes-256-gcm", key(secrets, keyId), decode(rawNonce, 12));
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(decode(rawTag, 16));
    const code = Buffer.concat([decipher.update(decode(rawCiphertext)), decipher.final()]).toString("utf8");
    if (normalizeActivationCode(code) !== code) throw new ActivationCodeEncryptionError();
    return code;
  } catch {
    throw new ActivationCodeEncryptionError();
  }
}
