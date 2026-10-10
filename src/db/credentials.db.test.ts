import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activationCredentials, cards } from "./schema";
import { insertProduct, insertProvisioningDbc, insertReadyDbc, insertStockPurchase, syntheticLookup } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

let lookup = 0;
const nextLookup = () => syntheticLookup(++lookup);

describe("Activation Credentials", () => {
  test("exist only for Digital Business Cards", () =>
    rollback(db, async (tx) => {
      const stock = await insertStockPurchase(tx);
      const grc = await insertProduct(tx, "grc");
      const [grcCard] = await tx.insert(cards).values({ stockPurchaseId: stock.id, productId: grc.id, kind: "grc" }).returning();
      await expectPgError(
        tx,
        (s) => s.insert(activationCredentials).values({ cardId: grcCard.id, lookupHmac: nextLookup() }),
        "23503",
        "activation_credentials_card_fk",
      );
      await expectPgError(
        tx,
        (s) => s.insert(activationCredentials).values({ cardId: grcCard.id, cardKind: "grc", lookupHmac: nextLookup() }),
        "23514",
        "activation_credentials_dbc_only",
      );
    }));

  test("a card has at most one usable credential; a new one may follow a revoked one", () =>
    rollback(db, async (tx) => {
      const { card } = await insertProvisioningDbc(tx);
      const [first] = await tx.insert(activationCredentials).values({ cardId: card.id, lookupHmac: nextLookup() }).returning();
      await expectPgError(
        tx,
        (s) => s.insert(activationCredentials).values({ cardId: card.id, lookupHmac: nextLookup() }),
        "23505",
        "activation_credentials_one_usable_per_card",
      );
      await tx.update(activationCredentials).set({ revokedAt: new Date() }).where(eq(activationCredentials.id, first.id));
      await tx.insert(activationCredentials).values({ cardId: card.id, lookupHmac: nextLookup() });
    }));

  test("a credential ends either used or revoked, never both", () =>
    rollback(db, async (tx) => {
      const { card } = await insertProvisioningDbc(tx);
      await expectPgError(
        tx,
        (s) => s.insert(activationCredentials).values({ cardId: card.id, lookupHmac: nextLookup(), usedAt: new Date(), revokedAt: new Date() }),
        "23514",
        "activation_credentials_single_outcome",
      );
    }));

  test("only a keyed-hash lookup value is stored, never a plaintext code", () =>
    rollback(db, async (tx) => {
      const { card } = await insertProvisioningDbc(tx);
      await expectPgError(
        tx,
        (s) => s.insert(activationCredentials).values({ cardId: card.id, lookupHmac: "K8F2-QX4M-77PD" }),
        "23514",
        "activation_credentials_lookup_hmac_format",
      );
    }));

  test("lookup values are globally unique", () =>
    rollback(db, async (tx) => {
      const { card: a } = await insertProvisioningDbc(tx);
      const { card: b } = await insertProvisioningDbc(tx);
      const shared = nextLookup();
      await tx.insert(activationCredentials).values({ cardId: a.id, lookupHmac: shared });
      await expectPgError(
        tx,
        (s) => s.insert(activationCredentials).values({ cardId: b.id, lookupHmac: shared }),
        "23505",
        "activation_credentials_lookup_hmac_unique",
      );
    }));
});

describe("a newly issued usable credential voids the package match", () => {
  test("clears the match on a blank DBC without touching updated_at", () =>
    rollback(db, async (tx) => {
      const stock = await insertStockPurchase(tx);
      const product = await insertProduct(tx, "dbc");
      const [card] = await tx
        .insert(cards)
        .values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", publicToken: `VOID${nextLookup()}`, packageMatchedAt: new Date() })
        .returning();
      await tx.insert(activationCredentials).values({ cardId: card.id, lookupHmac: nextLookup() });
      const [after] = await tx.select().from(cards).where(eq(cards.id, card.id));
      expect(after.packageMatchedAt).toBeNull();
      expect(after.updatedAt).toEqual(card.updatedAt);
    }));

  test("a usable credential on a Ready DBC is rejected", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      await expectPgError(
        tx,
        (s) => s.insert(activationCredentials).values({ cardId: card.id, lookupHmac: nextLookup() }),
        "23514",
        "cards_dbc_ready_checks_recorded",
      );
    }));

  test("a revoked credential leaves the match intact", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      await tx.insert(activationCredentials).values({ cardId: card.id, lookupHmac: nextLookup(), revokedAt: new Date() });
      const [after] = await tx.select().from(cards).where(eq(cards.id, card.id));
      expect(after.packageMatchedAt).not.toBeNull();
    }));

  test("retirement still blocks a usable credential", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, card.id));
      await expectPgError(tx, (s) => s.insert(activationCredentials).values({ cardId: card.id, lookupHmac: nextLookup() }), "P0001");
    }));
});
