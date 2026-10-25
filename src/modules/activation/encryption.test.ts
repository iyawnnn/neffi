import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { generateActivationCode } from "./code";
import { decryptActivationCode, encryptActivationCode, type CodeBinding, type CredentialSecrets } from "./encryption";

const secrets: CredentialSecrets = {
  lookupSecret: "synthetic-lookup-secret-separate-from-encryption",
  activeKeyId: "test-v1",
  encryptionKeys: new Map([["test-v1", Buffer.alloc(32, 7)]]),
};
const binding: CodeBinding = { credentialId: randomUUID(), cardId: randomUUID(), lookupHmac: "a".repeat(64) };

describe("activation code encryption", () => {
  test("round-trips canonical code with a fresh nonce and no plaintext in the envelope", () => {
    const code = generateActivationCode();
    const one = encryptActivationCode(code.toLowerCase(), binding, secrets);
    const two = encryptActivationCode(code, binding, secrets);
    expect(one).toMatch(/^v1\.test-v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(one).not.toBe(two);
    expect(one).not.toContain(code);
    expect(decryptActivationCode(one, binding, secrets)).toBe(code);
  });

  test("rejects swapped row bindings and a changed key with one data-free error", () => {
    const envelope = encryptActivationCode(generateActivationCode(), binding, secrets);
    const changed = [
      { ...binding, cardId: randomUUID() },
      { ...binding, credentialId: randomUUID() },
      { ...binding, lookupHmac: "b".repeat(64) },
    ];
    for (const other of changed) expect(() => decryptActivationCode(envelope, other, secrets)).toThrow("Activation code unavailable");
    expect(() => decryptActivationCode(envelope, binding, { ...secrets, encryptionKeys: new Map([["test-v1", Buffer.alloc(32, 8)]]) }))
      .toThrow("Activation code unavailable");
  });

  test("rejects tampering, unknown versions and malformed envelopes", () => {
    const envelope = encryptActivationCode(generateActivationCode(), binding, secrets);
    const parts = envelope.split(".");
    const malformed = [
      "", "v2." + parts.slice(1).join("."), envelope + ".extra", "v1.bad.key",
      [parts[0], parts[1], "AA", parts[3], parts[4]].join("."),
      [parts[0], parts[1], parts[2].replace(/.$/, parts[2].at(-1) === "A" ? "B" : "A"), parts[3], parts[4]].join("."),
      [parts[0], parts[1], parts[2], "!", parts[4]].join("."),
      [parts[0], parts[1], parts[2], parts[3], "AA"].join("."),
      [parts[0], parts[1], parts[2], parts[3], parts[4].replace(/.$/, parts[4].at(-1) === "A" ? "B" : "A")].join("."),
      [parts[0], "missing", ...parts.slice(2)].join("."),
      [parts[0], parts[1], parts[2], parts[3].replace(/.$/, parts[3].at(-1) === "A" ? "B" : "A"), parts[4]].join("."),
    ];
    for (const value of malformed) expect(() => decryptActivationCode(value, binding, secrets)).toThrow("Activation code unavailable");
  });
});
