import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, expect, test, vi } from "vitest";
import { activationCredentials } from "@/db/schema";
import { insertProvisioningDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";

const m = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("./code", async (importOriginal) => ({ ...(await importOriginal<typeof import("./code")>()), generateActivationCode: m.generate }));

const { activationLookup } = await import("./code");
const { ActivationCredentialError, issueActivationCredential } = await import("./credentials");
const { decryptActivationCode } = await import("./encryption");

let db: TestDb;
const SECRET = "s".repeat(40);
const secrets = { lookupSecret: SECRET, activeKeyId: "test-v1", encryptionKeys: new Map([["test-v1", Buffer.alloc(32, 7)]]) };

beforeAll(async () => { db = await createTestDb(); });
beforeEach(() => { vi.clearAllMocks(); });

test("retries a lookup collision and returns the later credential", () => rollback(db, async (tx) => {
  const existing = await insertProvisioningDbc(tx);
  const target = await insertProvisioningDbc(tx);
  await tx.insert(activationCredentials).values({ cardId: existing.card.id, lookupHmac: activationLookup(SECRET, "N8KF42PQ") });
  m.generate.mockReturnValueOnce("N8KF42PQ").mockReturnValueOnce("PQR8JKMN");
  const result = await issueActivationCredential(tx, target.card.id, secrets);
  expect(result.code).toBe("PQR8JKMN");
  expect(m.generate).toHaveBeenCalledTimes(2);
  const [stored] = await tx.select().from(activationCredentials).where(eq(activationCredentials.id, result.credentialId));
  expect(stored.lookupHmac).toBe(activationLookup(SECRET, result.code));
  expect(decryptActivationCode(stored.encryptedCode!, { credentialId: stored.id, cardId: target.card.id, lookupHmac: stored.lookupHmac }, secrets)).toBe(result.code);
  expect(JSON.stringify(stored)).not.toContain(result.code);
}));

test("fails after five collisions without inserting a credential", () => rollback(db, async (tx) => {
  const existing = await insertProvisioningDbc(tx);
  const target = await insertProvisioningDbc(tx);
  await tx.insert(activationCredentials).values({ cardId: existing.card.id, lookupHmac: activationLookup(SECRET, "N8KF42PQ") });
  m.generate.mockReturnValue("N8KF42PQ");
  await expect(issueActivationCredential(tx, target.card.id, secrets)).rejects.toBeInstanceOf(ActivationCredentialError);
  expect(m.generate).toHaveBeenCalledTimes(5);
  expect(await tx.select().from(activationCredentials)).toHaveLength(1);
}));
