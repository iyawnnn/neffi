import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activationCredentials, activityEvents, cards, products } from "@/db/schema";
import { insertAccount, insertProduct, insertStockPurchase } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { activationLookup, formatActivationCode, normalizeActivationCode } from "../activation/code";
import { recordNfcCheck } from "./card";
import { matchPackage, provisionDbc, replaceProvisioningCredential } from "./dbc";
import { cardUrl } from "./token";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const SECRET = "s".repeat(40);
const ORIGIN = "https://tap.example.test";

async function setup(tx: TestTx, kind: "dbc" | "grc" = "dbc") {
  const owner = await insertAccount(tx, "owner");
  // One active product per kind, as in the real catalog.
  const [existing] = await tx.select().from(products).where(and(eq(products.kind, kind), eq(products.active, true)));
  const product = existing ?? (await insertProduct(tx, kind));
  const stock = await insertStockPurchase(tx);
  const [card] = await tx.insert(cards).values({ stockPurchaseId: stock.id }).returning();
  return { owner, product, card, base: { actorId: owner.id, cardId: card.id } };
}
const reload = async (tx: TestTx, cardId: string) => (await tx.select().from(cards).where(eq(cards.id, cardId)))[0];
const credentialsOf = (tx: TestTx, cardId: string) => tx.select().from(activationCredentials).where(eq(activationCredentials.cardId, cardId));
const events = (tx: TestTx, cardId: string) => tx.select().from(activityEvents).where(eq(activityEvents.cardId, cardId));

const nfc = (tx: TestTx, base: { actorId: string; cardId: string }, overrides: Partial<Parameters<typeof recordNfcCheck>[1]> = {}) =>
  recordNfcCheck(tx, {
    ...base,
    cardUrlOrigin: ORIGIN,
    readBackUri: "",
    readBackMatched: true,
    phoneOpenedUri: true,
    tagLeftWritable: true,
    ...overrides,
  });

// Drives a card to Ready and returns the code the owner would find in the package.
async function readyCard(tx: TestTx) {
  const s = await setup(tx);
  const provisioned = await provisionDbc(tx, { ...s.base, activationSecret: SECRET });
  await nfc(tx, s.base, { readBackUri: cardUrl(ORIGIN, provisioned.publicToken) });
  await matchPackage(tx, { ...s.base, activationCode: provisioned.activationCode, activationSecret: SECRET });
  return { ...s, ...provisioned };
}

describe("provisionDbc", () => {
  test("issues the token and the one usable credential, leaving the card blank", () =>
    rollback(db, async (tx) => {
      const { base, product, card } = await setup(tx);
      const result = await provisionDbc(tx, { ...base, activationSecret: SECRET });

      expect(result.publicToken).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(normalizeActivationCode(result.activationCode)).toBe(result.activationCode);
      const after = await reload(tx, card.id);
      expect(after).toMatchObject({ state: "blank", kind: "dbc", productId: product.id, publicToken: result.publicToken, nfcVerifiedAt: null, packageMatchedAt: null });
      const [credential, ...rest] = await credentialsOf(tx, card.id);
      expect(rest).toEqual([]);
      expect(credential).toMatchObject({ id: result.credentialId, usedAt: null, revokedAt: null });
      expect(credential.lookupHmac).toBe(activationLookup(SECRET, result.activationCode));
      expect(await events(tx, card.id)).toMatchObject([{ type: "card_provisioned", actorAccountId: base.actorId }]);
    }));

  test("a repeated call (double click, lost response) neither re-issues nor re-shows the code", () =>
    rollback(db, async (tx) => {
      const { base } = await setup(tx);
      const first = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      await expect(provisionDbc(tx, { ...base, activationSecret: SECRET })).rejects.toMatchObject({ code: "already_provisioned" });
      const after = await reload(tx, base.cardId);
      expect(after.publicToken).toBe(first.publicToken);
      expect(await credentialsOf(tx, base.cardId)).toHaveLength(1);
    }));

  test("refuses unknown, GRC, ready and retired cards", async () => {
    await rollback(db, async (tx) => {
      const { base } = await setup(tx);
      await expect(provisionDbc(tx, { ...base, cardId: crypto.randomUUID(), activationSecret: SECRET })).rejects.toMatchObject({ code: "not_found" });
      await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, base.cardId));
      await expect(provisionDbc(tx, { ...base, activationSecret: SECRET })).rejects.toMatchObject({ code: "wrong_state" });
    });
    await rollback(db, async (tx) => {
      const { base, product } = await setup(tx, "grc");
      await tx.update(cards).set({ productId: product.id, kind: "grc" }).where(eq(cards.id, base.cardId));
      await expect(provisionDbc(tx, { ...base, activationSecret: SECRET })).rejects.toMatchObject({ code: "wrong_state" });
    });
    await rollback(db, async (tx) => {
      const ready = await readyCard(tx);
      await expect(provisionDbc(tx, { ...ready.base, activationSecret: SECRET })).rejects.toMatchObject({ code: "wrong_state" });
    });
  });

  test("the raw code is never stored in cards, credentials or activity", () =>
    rollback(db, async (tx) => {
      const { base, card } = await setup(tx);
      const first = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      const second = await replaceProvisioningCredential(tx, { ...base, credentialId: first.credentialId, reason: "package lost", activationSecret: SECRET });
      const everything = JSON.stringify([await tx.select().from(cards), await credentialsOf(tx, card.id), await tx.select().from(activityEvents)]);
      for (const code of [first.activationCode, second.activationCode]) {
        expect(everything).not.toContain(code);
        expect(everything).not.toContain(formatActivationCode(code));
      }
    }));
});

describe("recordNfcCheck (DBC)", () => {
  test("records the check against the exact card URL and logs it", () =>
    rollback(db, async (tx) => {
      const { base } = await setup(tx);
      const { publicToken } = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      await nfc(tx, base, { readBackUri: `  ${cardUrl(ORIGIN, publicToken)}\n`, device: "Pixel 8 / Android 15" });
      expect((await reload(tx, base.cardId)).nfcVerifiedAt).toBeInstanceOf(Date);
      const logged = (await events(tx, base.cardId)).find((event) => event.type === "card_nfc_verified");
      expect(logged?.note).toContain("Pixel 8");
    }));

  test("a different, truncated or case-changed read-back is a mismatch and records nothing", () =>
    rollback(db, async (tx) => {
      const { base } = await setup(tx);
      const { publicToken } = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      const url = cardUrl(ORIGIN, publicToken);
      for (const readBackUri of ["", url.slice(0, -1), url.toLowerCase(), `${url}/`, cardUrl("http://tap.example.test", publicToken)]) {
        await expect(nfc(tx, base, { readBackUri })).rejects.toMatchObject({ code: "uri_mismatch" });
      }
      expect((await reload(tx, base.cardId)).nfcVerifiedAt).toBeNull();
    }));

  test("every physical confirmation is required", () =>
    rollback(db, async (tx) => {
      const { base } = await setup(tx);
      const { publicToken } = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      for (const missing of ["readBackMatched", "phoneOpenedUri", "tagLeftWritable"] as const) {
        await expect(nfc(tx, base, { readBackUri: cardUrl(ORIGIN, publicToken), [missing]: false })).rejects.toMatchObject({ code: "checks_incomplete" });
      }
      expect((await reload(tx, base.cardId)).nfcVerifiedAt).toBeNull();
    }));

  test("needs a provisioned blank DBC", () =>
    rollback(db, async (tx) => {
      const { base } = await setup(tx);
      await expect(nfc(tx, base, { readBackUri: "x" })).rejects.toMatchObject({ code: "wrong_state" });
      const ready = await readyCard(tx);
      await expect(nfc(tx, ready.base, { readBackUri: cardUrl(ORIGIN, ready.publicToken) })).rejects.toMatchObject({ code: "wrong_state" });
    }));
});

describe("matchPackage", () => {
  test("requires the NFC check first", () =>
    rollback(db, async (tx) => {
      const { base } = await setup(tx);
      const { activationCode } = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      await expect(matchPackage(tx, { ...base, activationCode, activationSecret: SECRET })).rejects.toMatchObject({ code: "checks_incomplete" });
      expect((await reload(tx, base.cardId)).state).toBe("blank");
    }));

  test("a wrong or malformed code changes nothing", () =>
    rollback(db, async (tx) => {
      const { base } = await setup(tx);
      const { publicToken } = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      await nfc(tx, base, { readBackUri: cardUrl(ORIGIN, publicToken) });
      for (const activationCode of ["0000-0000-0000-0000", "nonsense"]) {
        await expect(matchPackage(tx, { ...base, activationCode, activationSecret: SECRET })).rejects.toMatchObject({ code: "code_mismatch" });
      }
      expect(await reload(tx, base.cardId)).toMatchObject({ state: "blank", packageMatchedAt: null });
      expect((await events(tx, base.cardId)).map((event) => event.type)).not.toContain("card_ready");
    }));

  test("the right code, however it was typed from the package, makes the card Ready", () =>
    rollback(db, async (tx) => {
      const { base } = await setup(tx);
      const { publicToken, activationCode } = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      await nfc(tx, base, { readBackUri: cardUrl(ORIGIN, publicToken) });
      const typed = ` ${formatActivationCode(activationCode).toLowerCase()} `;
      await matchPackage(tx, { ...base, activationCode: typed, activationSecret: SECRET });
      expect(await reload(tx, base.cardId)).toMatchObject({ state: "ready", publicToken });
      expect((await reload(tx, base.cardId)).packageMatchedAt).toBeInstanceOf(Date);
      expect((await events(tx, base.cardId)).map((event) => event.type)).toContain("card_ready");
    }));

  test("a code from another card does not match", () =>
    rollback(db, async (tx) => {
      const a = await setup(tx);
      const b = await setup(tx);
      const first = await provisionDbc(tx, { ...a.base, activationSecret: SECRET });
      const other = await provisionDbc(tx, { ...b.base, activationSecret: SECRET });
      await nfc(tx, a.base, { readBackUri: cardUrl(ORIGIN, first.publicToken) });
      await expect(matchPackage(tx, { ...a.base, activationCode: other.activationCode, activationSecret: SECRET })).rejects.toMatchObject({ code: "code_mismatch" });
    }));
});

describe("replaceProvisioningCredential", () => {
  test("on a Ready card: demotes it, revokes exactly the old credential, issues a new one and requires a re-match", () =>
    rollback(db, async (tx) => {
      const ready = await readyCard(tx);
      const replaced = await replaceProvisioningCredential(tx, { ...ready.base, credentialId: ready.credentialId, reason: "wrong package inside", activationSecret: SECRET });

      expect(replaced.credentialId).not.toBe(ready.credentialId);
      expect(await reload(tx, ready.card.id)).toMatchObject({ state: "blank", publicToken: ready.publicToken, packageMatchedAt: null });
      expect((await reload(tx, ready.card.id)).nfcVerifiedAt).toBeInstanceOf(Date);
      const credentials = await credentialsOf(tx, ready.card.id);
      expect(credentials).toHaveLength(2);
      expect(credentials.find((c) => c.id === ready.credentialId)?.revokedAt).toBeInstanceOf(Date);
      expect(credentials.filter((c) => !c.usedAt && !c.revokedAt).map((c) => c.id)).toEqual([replaced.credentialId]);
      const logged = (await events(tx, ready.card.id)).find((event) => event.type === "activation_credential_replaced");
      expect(logged?.note).toContain("wrong package inside");

      await expect(matchPackage(tx, { ...ready.base, activationCode: ready.activationCode, activationSecret: SECRET })).rejects.toMatchObject({ code: "code_mismatch" });
      await matchPackage(tx, { ...ready.base, activationCode: replaced.activationCode, activationSecret: SECRET });
      expect((await reload(tx, ready.card.id)).state).toBe("ready");
    }));

  test("works on a blank card still being provisioned", () =>
    rollback(db, async (tx) => {
      const { base } = await setup(tx);
      const first = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      const second = await replaceProvisioningCredential(tx, { ...base, credentialId: first.credentialId, reason: "lost before packaging", activationSecret: SECRET });
      expect((await credentialsOf(tx, base.cardId)).filter((c) => !c.usedAt && !c.revokedAt).map((c) => c.id)).toEqual([second.credentialId]);
    }));

  test("a stale or unknown credential id is refused without changes (lost response / second click)", () =>
    rollback(db, async (tx) => {
      const { base } = await setup(tx);
      const first = await provisionDbc(tx, { ...base, activationSecret: SECRET });
      await replaceProvisioningCredential(tx, { ...base, credentialId: first.credentialId, reason: "once", activationSecret: SECRET });
      for (const credentialId of [first.credentialId, crypto.randomUUID()]) {
        await expect(replaceProvisioningCredential(tx, { ...base, credentialId, reason: "again", activationSecret: SECRET })).rejects.toMatchObject({ code: "credential_changed" });
      }
      expect(await credentialsOf(tx, base.cardId)).toHaveLength(2);
    }));

  test("never touches released or retired cards and never revives used or revoked credentials", () =>
    rollback(db, async (tx) => {
      const ready = await readyCard(tx);
      await tx.update(activationCredentials).set({ revokedAt: new Date() }).where(eq(activationCredentials.id, ready.credentialId));
      await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, ready.card.id));
      await expect(replaceProvisioningCredential(tx, { ...ready.base, credentialId: ready.credentialId, reason: "x", activationSecret: SECRET })).rejects.toMatchObject({ code: "wrong_state" });
      expect((await credentialsOf(tx, ready.card.id)).filter((c) => !c.usedAt && !c.revokedAt)).toEqual([]);
    }));
});
