import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activationCredentials, activityEvents, cards } from "@/db/schema";
import { insertAccount, insertProvisioningDbc, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { ownedCards } from "../cards/owned";
import { checkActivationCode, claimCard } from "./claim";
import { formatActivationCode } from "./code";
import { issueActivationCredential, revokeUsableCredential } from "./credentials";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const SECRET = "s".repeat(40);
async function released(tx: TestTx) {
  const { card } = await insertReleasedDbc(tx);
  const { credentialId, code } = await issueActivationCredential(tx, card.id, SECRET);
  return { card, credentialId, code };
}
const check = (tx: TestTx, code: string, accountId?: string) => checkActivationCode(tx, { secret: SECRET, code, accountId });
const cardRow = async (tx: TestTx, id: string) => (await tx.select().from(cards).where(eq(cards.id, id)))[0];
const credentialRow = async (tx: TestTx, id: string) => (await tx.select().from(activationCredentials).where(eq(activationCredentials.id, id)))[0];
const claimEvents = async (tx: TestTx, cardId: string) =>
  (await tx.select().from(activityEvents).where(eq(activityEvents.cardId, cardId))).filter((event) => event.type === "card_claimed");

describe("checkActivationCode", () => {
  test("accepts every way a person may type the packaged code", () =>
    rollback(db, async (tx) => {
      const { code, credentialId } = await released(tx);
      const inputs = [code, formatActivationCode(code), `  ${formatActivationCode(code).toLowerCase()} `, code.replaceAll("0", "O").replaceAll("1", "l")];
      for (const input of inputs) expect(await check(tx, input)).toEqual({ status: "claimable", credentialId });
    }));

  test.each(["", "ABCD", "Z".repeat(7), "Z".repeat(9), "N8KF-42PQ-7XYZ-ABCD", "A".repeat(200), "!@#$%^&*()_+{}|:"])("%j is invalid", (input) =>
    rollback(db, async (tx) => {
      await released(tx);
      expect(await check(tx, input)).toEqual({ status: "invalid" });
    }));

  test("an unsold card's code is unavailable, whether in provisioning or Ready", () =>
    rollback(db, async (tx) => {
      const { card } = await insertProvisioningDbc(tx);
      const { code } = await issueActivationCredential(tx, card.id, SECRET);
      expect(await check(tx, code)).toEqual({ status: "unavailable" });
      await tx.update(cards).set({ state: "ready", nfcVerifiedAt: new Date(), packageMatchedAt: new Date() }).where(eq(cards.id, card.id));
      expect(await check(tx, code)).toEqual({ status: "unavailable" });
    }));

  test("a revoked code is unavailable", () =>
    rollback(db, async (tx) => {
      const { card, code } = await released(tx);
      await revokeUsableCredential(tx, card.id);
      expect(await check(tx, code, (await insertAccount(tx)).id)).toEqual({ status: "unavailable" });
    }));

  test("a used code is unavailable to everyone but its owner, who is told it is theirs", () =>
    rollback(db, async (tx) => {
      const { card, code, credentialId } = await released(tx);
      const owner = await insertAccount(tx);
      const other = await insertAccount(tx);
      await claimCard(tx, { credentialId, accountId: owner.id });
      expect(await check(tx, code)).toEqual({ status: "unavailable" });
      expect(await check(tx, code, other.id)).toEqual({ status: "unavailable" });
      expect(await check(tx, code, owner.id)).toEqual({ status: "yours", cardId: card.id });
    }));

  test("checking never writes", () =>
    rollback(db, async (tx) => {
      const { card, code, credentialId } = await released(tx);
      await check(tx, code, (await insertAccount(tx)).id);
      expect((await credentialRow(tx, credentialId)).usedAt).toBeNull();
      expect((await cardRow(tx, card.id)).ownerAccountId).toBeNull();
      expect(await claimEvents(tx, card.id)).toHaveLength(0);
    }));
});

describe("claimCard", () => {
  test("claims atomically: owner, consumed credential and one history event", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      const account = await insertAccount(tx);
      expect(await claimCard(tx, { credentialId, accountId: account.id })).toEqual({ status: "claimed", cardId: card.id });
      expect(await cardRow(tx, card.id)).toMatchObject({ ownerAccountId: account.id, profileId: null, state: "released" });
      const credential = await credentialRow(tx, credentialId);
      expect(credential.usedAt).toBeInstanceOf(Date);
      expect(credential.revokedAt).toBeNull();
      const events = await claimEvents(tx, card.id);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ actorAccountId: account.id, accountId: account.id, note: null });
    }));

  test("a repeated claim by the same account changes nothing", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      const account = await insertAccount(tx);
      await claimCard(tx, { credentialId, accountId: account.id });
      const usedAt = (await credentialRow(tx, credentialId)).usedAt;
      expect(await claimCard(tx, { credentialId, accountId: account.id })).toEqual({ status: "already_yours", cardId: card.id });
      expect((await credentialRow(tx, credentialId)).usedAt).toEqual(usedAt);
      expect(await claimEvents(tx, card.id)).toHaveLength(1);
    }));

  test("a second account cannot claim a claimed card", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      const first = await insertAccount(tx);
      await claimCard(tx, { credentialId, accountId: first.id });
      expect(await claimCard(tx, { credentialId, accountId: (await insertAccount(tx)).id })).toEqual({ status: "unavailable" });
      expect((await cardRow(tx, card.id)).ownerAccountId).toBe(first.id);
    }));

  test("a revoked credential cannot claim", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      await revokeUsableCredential(tx, card.id);
      expect(await claimCard(tx, { credentialId, accountId: (await insertAccount(tx)).id })).toEqual({ status: "unavailable" });
      expect((await cardRow(tx, card.id)).ownerAccountId).toBeNull();
    }));

  test("a card retired after the check cannot be claimed", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      await revokeUsableCredential(tx, card.id);
      await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, card.id));
      expect(await claimCard(tx, { credentialId, accountId: (await insertAccount(tx)).id })).toEqual({ status: "unavailable" });
    }));

  test("an unknown credential id is unavailable", () =>
    rollback(db, async (tx) => {
      expect(await claimCard(tx, { credentialId: randomUUID(), accountId: (await insertAccount(tx)).id })).toEqual({ status: "unavailable" });
    }));

  test("a failure rolls back the whole claim", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      // No such account: the owner foreign key fails after the credential update inside the same transaction.
      await expect(claimCard(tx, { credentialId, accountId: randomUUID() })).rejects.toThrow();
      expect((await cardRow(tx, card.id)).ownerAccountId).toBeNull();
      expect((await credentialRow(tx, credentialId)).usedAt).toBeNull();
      expect(await claimEvents(tx, card.id)).toHaveLength(0);
    }));
});

test("ownedCards lists only the account's own cards", () =>
  rollback(db, async (tx) => {
    const { card, credentialId } = await released(tx);
    const owner = await insertAccount(tx);
    await claimCard(tx, { credentialId, accountId: owner.id });
    expect(await ownedCards(tx, owner.id)).toEqual([{ id: card.id, publicToken: card.publicToken, profileId: null }]);
    expect(await ownedCards(tx, (await insertAccount(tx)).id)).toEqual([]);
  }));
