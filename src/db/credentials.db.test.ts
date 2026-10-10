import { eq } from "drizzle-orm";
import { beforeAll, describe, test } from "vitest";
import { activationCredentials, cards } from "./schema";
import { insertProduct, insertReadyDbc, insertStockPurchase, syntheticLookup } from "./test-fixtures";
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
      const { card } = await insertReadyDbc(tx);
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
      const { card } = await insertReadyDbc(tx);
      await expectPgError(
        tx,
        (s) => s.insert(activationCredentials).values({ cardId: card.id, lookupHmac: nextLookup(), usedAt: new Date(), revokedAt: new Date() }),
        "23514",
        "activation_credentials_single_outcome",
      );
    }));

  test("only a keyed-hash lookup value is stored, never a plaintext code", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      await expectPgError(
        tx,
        (s) => s.insert(activationCredentials).values({ cardId: card.id, lookupHmac: "K8F2-QX4M-77PD" }),
        "23514",
        "activation_credentials_lookup_hmac_format",
      );
    }));

  test("lookup values are globally unique", () =>
    rollback(db, async (tx) => {
      const { card: a } = await insertReadyDbc(tx);
      const { card: b } = await insertReadyDbc(tx);
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
