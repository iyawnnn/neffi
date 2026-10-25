import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, expect, test, vi } from "vitest";
import { accounts, activationCredentials, activityEvents, cards } from "@/db/schema";
import { insertAccount, insertReleasedDbc, syntheticCredentialSecrets } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { activationLookup } from "./code";
import { issueActivationCredential } from "./credentials";
import { decryptActivationCode } from "./encryption";

const audit = vi.hoisted(() => ({ fail: false }));
vi.mock("../activity/record", async (original) => {
  const actual = await original<typeof import("../activity/record")>();
  return { ...actual, recordActivity: async (...args: Parameters<typeof actual.recordActivity>) => {
    if (audit.fail) throw new Error("audit insert failed");
    return actual.recordActivity(...args);
  } };
});
const { revealActivationCode, saveExistingActivationCode } = await import("./retrieval");

let db: TestDb;
const secrets = syntheticCredentialSecrets();
beforeAll(async () => { db = await createTestDb(); });

async function fixture(tx: TestTx) {
  const actor = await insertAccount(tx, "owner");
  const customer = await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  const { credentialId, code } = await issueActivationCredential(tx, card.id, secrets);
  const input = { actorId: actor.id, cardId: card.id, credentialId, secrets };
  return { actor, customer, card, code, input };
}
const events = (tx: TestTx) => tx.select().from(activityEvents);
const credential = async (tx: TestTx, id: string) => (await tx.select().from(activationCredentials).where(eq(activationCredentials.id, id)))[0];

test("fresh OWNER reveal audits the exact credential before returning its code", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  expect(await revealActivationCode(tx, f.input)).toEqual({ status: "available", credentialId: f.input.credentialId, code: f.code });
  const history = await events(tx);
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({ type: "activation_code_viewed", actorAccountId: f.actor.id, cardId: f.card.id, activationCredentialId: f.input.credentialId, note: null });
  expect(JSON.stringify(history)).not.toContain(f.code);
}));

test("customer, missing actor, changed role and stale credential cannot read or audit", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  for (const actorId of [f.customer.id, randomUUID()]) {
    expect(await revealActivationCode(tx, { ...f.input, actorId })).toEqual({ status: "unavailable" });
  }
  expect(await revealActivationCode(tx, { ...f.input, credentialId: randomUUID() })).toEqual({ status: "unavailable" });
  await tx.update(accounts).set({ role: "customer" }).where(eq(accounts.id, f.actor.id));
  expect(await revealActivationCode(tx, f.input)).toEqual({ status: "unavailable" });
  expect(await events(tx)).toEqual([]);
}));

test.each(["claimed", "retired", "used", "revoked"] as const)("%s card or credential refuses reveal", (state) => rollback(db, async (tx) => {
  const f = await fixture(tx);
  if (state === "claimed") await tx.update(cards).set({ ownerAccountId: f.customer.id }).where(eq(cards.id, f.card.id));
  if (state === "retired") {
    await tx.update(activationCredentials).set({ revokedAt: new Date() }).where(eq(activationCredentials.id, f.input.credentialId));
    await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, f.card.id));
  }
  if (state === "used") await tx.update(activationCredentials).set({ usedAt: new Date() }).where(eq(activationCredentials.id, f.input.credentialId));
  if (state === "revoked") await tx.update(activationCredentials).set({ revokedAt: new Date() }).where(eq(activationCredentials.id, f.input.credentialId));
  expect(await revealActivationCode(tx, f.input)).toEqual({ status: "unavailable" });
  expect(await events(tx)).toEqual([]);
}));

test("legacy credential requests its existing code without issuing or auditing", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  await tx.update(activationCredentials).set({ revokedAt: new Date() }).where(eq(activationCredentials.id, f.input.credentialId));
  const [legacy] = await tx.insert(activationCredentials).values({ cardId: f.card.id, lookupHmac: activationLookup(secrets.lookupSecret, "PQR8JKMN") }).returning();
  const input = { ...f.input, credentialId: legacy.id };
  expect(await revealActivationCode(tx, input)).toEqual({ status: "legacy_code_needed" });
  expect(await events(tx)).toEqual([]);
}));

test("missing key and corrupt envelope return no code or audit", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  expect(await revealActivationCode(tx, { ...f.input, secrets: { ...secrets, encryptionKeys: new Map() } })).toEqual({ status: "key_unavailable" });
  await tx.update(activationCredentials).set({ revokedAt: new Date() }).where(eq(activationCredentials.id, f.input.credentialId));
  const [corrupt] = await tx.insert(activationCredentials).values({ cardId: f.card.id, lookupHmac: activationLookup(secrets.lookupSecret, "PQR8JKMN"), encryptedCode: "corrupt" }).returning();
  expect(await revealActivationCode(tx, { ...f.input, credentialId: corrupt.id })).toEqual({ status: "unavailable" });
  expect(await events(tx)).toEqual([]);
}));

test("audit failure returns no code and leaves no event", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  audit.fail = true;
  try {
    await expect(revealActivationCode(tx, f.input)).rejects.toThrow("audit insert failed");
  } finally { audit.fail = false; }
  expect(await events(tx)).toEqual([]);
}));

test("adopts a matching legacy code onto the same credential without changing package evidence", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  await tx.update(activationCredentials).set({ revokedAt: new Date() }).where(eq(activationCredentials.id, f.input.credentialId));
  const code = "PQR8JKMN";
  const [legacy] = await tx.insert(activationCredentials).values({ cardId: f.card.id, lookupHmac: activationLookup(secrets.lookupSecret, code) }).returning();
  const input = { ...f.input, credentialId: legacy.id, code };
  const before = (await tx.select().from(cards).where(eq(cards.id, f.card.id)))[0];
  await saveExistingActivationCode(tx, input);
  const after = await credential(tx, legacy.id);
  expect(decryptActivationCode(after.encryptedCode!, { credentialId: legacy.id, cardId: f.card.id, lookupHmac: legacy.lookupHmac }, secrets)).toBe(code);
  expect(await tx.select().from(activationCredentials).where(eq(activationCredentials.cardId, f.card.id))).toHaveLength(2);
  expect((await tx.select().from(cards).where(eq(cards.id, f.card.id)))[0].packageMatchedAt).toEqual(before.packageMatchedAt);
  expect((await events(tx))[0]).toMatchObject({ type: "activation_code_adopted", actorAccountId: f.actor.id, cardId: f.card.id, activationCredentialId: legacy.id, note: null });
  expect(JSON.stringify(await events(tx))).not.toContain(code);
  await expect(saveExistingActivationCode(tx, input)).rejects.toThrow();
  expect((await credential(tx, legacy.id)).encryptedCode).toBe(after.encryptedCode);
}));

test("wrong code, stale ID and claimed card leave legacy credential unchanged", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  await tx.update(activationCredentials).set({ revokedAt: new Date() }).where(eq(activationCredentials.id, f.input.credentialId));
  const [legacy] = await tx.insert(activationCredentials).values({ cardId: f.card.id, lookupHmac: activationLookup(secrets.lookupSecret, "PQR8JKMN") }).returning();
  const input = { ...f.input, credentialId: legacy.id, code: "N8KF42PQ" };
  await expect(saveExistingActivationCode(tx, input)).rejects.toThrow();
  await expect(saveExistingActivationCode(tx, { ...input, credentialId: f.input.credentialId, code: "PQR8JKMN" })).rejects.toThrow();
  await tx.update(cards).set({ ownerAccountId: f.customer.id }).where(eq(cards.id, f.card.id));
  await expect(saveExistingActivationCode(tx, { ...input, code: "PQR8JKMN" })).rejects.toThrow();
  expect((await credential(tx, legacy.id)).encryptedCode).toBeNull();
  expect(await events(tx)).toEqual([]);
}));

test("adoption audit failure rolls back the envelope", () => rollback(db, async (tx) => {
  const f = await fixture(tx);
  await tx.update(activationCredentials).set({ revokedAt: new Date() }).where(eq(activationCredentials.id, f.input.credentialId));
  const code = "PQR8JKMN";
  const [legacy] = await tx.insert(activationCredentials).values({ cardId: f.card.id, lookupHmac: activationLookup(secrets.lookupSecret, code) }).returning();
  audit.fail = true;
  try {
    await expect(saveExistingActivationCode(tx, { ...f.input, credentialId: legacy.id, code })).rejects.toThrow("audit insert failed");
  } finally { audit.fail = false; }
  expect((await credential(tx, legacy.id)).encryptedCode).toBeNull();
  expect(await events(tx)).toEqual([]);
}));
