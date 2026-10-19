import { beforeAll, beforeEach, expect, test, vi } from "vitest";
import { activationCredentials } from "@/db/schema";
import { insertProvisioningDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";

const m = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("./code", async (importOriginal) => ({ ...(await importOriginal<typeof import("./code")>()), generateActivationCode: m.generate }));

const { activationLookup } = await import("./code");
const { ActivationCredentialError, issueActivationCredential } = await import("./credentials");

let db: TestDb;
const SECRET = "s".repeat(40);

beforeAll(async () => { db = await createTestDb(); });
beforeEach(() => { vi.clearAllMocks(); });

test("retries a lookup collision and returns the later credential", () => rollback(db, async (tx) => {
  const existing = await insertProvisioningDbc(tx);
  const target = await insertProvisioningDbc(tx);
  await tx.insert(activationCredentials).values({ cardId: existing.card.id, lookupHmac: activationLookup(SECRET, "N8KF42PQ") });
  m.generate.mockReturnValueOnce("N8KF42PQ").mockReturnValueOnce("PQR8JKMN");
  const result = await issueActivationCredential(tx, target.card.id, SECRET);
  expect(result.code).toBe("PQR8JKMN");
  expect(m.generate).toHaveBeenCalledTimes(2);
}));

test("fails after five collisions without inserting a credential", () => rollback(db, async (tx) => {
  const existing = await insertProvisioningDbc(tx);
  const target = await insertProvisioningDbc(tx);
  await tx.insert(activationCredentials).values({ cardId: existing.card.id, lookupHmac: activationLookup(SECRET, "N8KF42PQ") });
  m.generate.mockReturnValue("N8KF42PQ");
  await expect(issueActivationCredential(tx, target.card.id, SECRET)).rejects.toBeInstanceOf(ActivationCredentialError);
  expect(m.generate).toHaveBeenCalledTimes(5);
  expect(await tx.select().from(activationCredentials)).toHaveLength(1);
}));
