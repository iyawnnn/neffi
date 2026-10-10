import { eq } from "drizzle-orm";
import { beforeAll, describe, test } from "vitest";
import { accounts, cards, profiles } from "./schema";
import {
  insertAccount,
  insertClaimedCard,
  insertOrderItem,
  insertProduct,
  insertProfile,
  insertReadyDbc,
  insertStockPurchase,
  syntheticToken,
} from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

describe("DBC public token", () => {
  test("is unique across all cards", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      const { stock, product } = await insertReadyDbc(tx);
      await expectPgError(
        tx,
        (s) =>
          s.insert(cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "ready", publicToken: card.publicToken }),
        "23505",
        "cards_public_token_unique",
      );
    }));

  test("is required once a DBC is provisioned", () =>
    rollback(db, async (tx) => {
      // Inserted rather than updated: clearing an issued token is already rejected by cards_guard.
      const { stock, product } = await insertReadyDbc(tx);
      await expectPgError(
        tx,
        (s) => s.insert(cards).values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "ready" }),
        "23514",
        "cards_dbc_token_when_provisioned",
      );
    }));
});

describe("DBC/GRC separation", () => {
  test("a Google Review Card cannot carry a token, owner, profile or disable flag", () =>
    rollback(db, async (tx) => {
      const stock = await insertStockPurchase(tx);
      const grc = await insertProduct(tx, "grc");
      const owner = await insertAccount(tx);
      const base = { stockPurchaseId: stock.id, productId: grc.id, kind: "grc" as const };
      for (const extra of [{ publicToken: syntheticToken() }, { ownerAccountId: owner.id, state: "retired" as const }]) {
        await expectPgError(tx, (s) => s.insert(cards).values({ ...base, ...extra }), "23514", "cards_dbc_only_fields");
      }
    }));

  test("a card not yet committed to a product cannot carry DBC fields either", () =>
    rollback(db, async (tx) => {
      const stock = await insertStockPurchase(tx);
      await expectPgError(
        tx,
        (s) => s.insert(cards).values({ stockPurchaseId: stock.id, publicToken: syntheticToken() }),
        "23514",
        "cards_dbc_only_fields",
      );
    }));

  test("a Google Review Card is never Ready stock", () =>
    rollback(db, async (tx) => {
      const stock = await insertStockPurchase(tx);
      const grc = await insertProduct(tx, "grc");
      await expectPgError(
        tx,
        (s) => s.insert(cards).values({ stockPurchaseId: stock.id, productId: grc.id, kind: "grc", state: "ready" }),
        "23514",
        "cards_grc_never_ready",
      );
    }));
});

describe("Fulfillment links", () => {
  test("reserved and released cards belong to an order item; stock does not", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      await expectPgError(
        tx,
        (s) => s.update(cards).set({ state: "reserved" }).where(eq(cards.id, card.id)),
        "23514",
        "cards_fulfillment_needs_order_item",
      );
      const { item } = await insertOrderItem(tx, "dbc");
      await expectPgError(
        tx,
        (s) => s.update(cards).set({ orderItemId: item.id }).where(eq(cards.id, card.id)),
        "23514",
        "cards_stock_has_no_order_item",
      );
    }));

  test("a card can only fulfil an item of its own product", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      const { item: otherProductItem } = await insertOrderItem(tx, "dbc");
      await expectPgError(
        tx,
        (s) => s.update(cards).set({ state: "reserved", orderItemId: otherProductItem.id }).where(eq(cards.id, card.id)),
        "23503",
        "cards_order_item_fk",
      );
    }));
});

describe("Ownership and Profile routing", () => {
  test("an unsold card cannot have an owner", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      const customer = await insertAccount(tx);
      await expectPgError(
        tx,
        (s) => s.update(cards).set({ ownerAccountId: customer.id }).where(eq(cards.id, card.id)),
        "23514",
        "cards_owner_only_after_sale",
      );
    }));

  test("a card cannot route to a Profile owned by another Account", () =>
    rollback(db, async (tx) => {
      const { card } = await insertClaimedCard(tx);
      const stranger = await insertAccount(tx);
      const strangersProfile = await insertProfile(tx, stranger.id);
      await expectPgError(
        tx,
        (s) => s.update(cards).set({ profileId: strangersProfile.id }).where(eq(cards.id, card.id)),
        "23503",
        "cards_profile_owner_fk",
      );
    }));

  test("a card cannot route to a Profile without an owner (composite FK would skip the check)", () =>
    rollback(db, async (tx) => {
      const { card } = await insertClaimedCard(tx);
      await expectPgError(
        tx,
        (s) => s.update(cards).set({ ownerAccountId: null }).where(eq(cards.id, card.id)),
        "23514",
        "cards_profile_needs_owner",
      );
    }));

  test("a retired card routes nowhere", () =>
    rollback(db, async (tx) => {
      const { card } = await insertClaimedCard(tx);
      await expectPgError(
        tx,
        (s) => s.update(cards).set({ state: "retired" }).where(eq(cards.id, card.id)),
        "23514",
        "cards_retired_routes_nowhere",
      );
      await tx.update(cards).set({ state: "retired", profileId: null }).where(eq(cards.id, card.id));
    }));

  test("a Profile with a connected card cannot be deleted", () =>
    rollback(db, async (tx) => {
      const { profile } = await insertClaimedCard(tx);
      await expectPgError(tx, (s) => s.delete(profiles).where(eq(profiles.id, profile.id)), "23503", "cards_profile_owner_fk");
    }));

  test("deleting an Account never frees its cards or erases its orders", () =>
    rollback(db, async (tx) => {
      const { owner, profile } = await insertClaimedCard(tx);
      // Remove the profile so card ownership is the only thing still referencing the Account.
      await tx.update(cards).set({ profileId: null }).where(eq(cards.ownerAccountId, owner.id));
      await tx.delete(profiles).where(eq(profiles.id, profile.id));
      await expectPgError(
        tx,
        (s) => s.delete(accounts).where(eq(accounts.id, owner.id)),
        "23503",
        "cards_owner_account_id_accounts_id_fk",
      );
      const { owner: seller } = await insertOrderItem(tx, "dbc");
      await expectPgError(
        tx,
        (s) => s.delete(accounts).where(eq(accounts.id, seller.id)),
        "23503",
        "orders_created_by_account_id_accounts_id_fk",
      );
    }));
});

describe("Composite-FK gap closers (MATCH SIMPLE skips a FK when any column is NULL)", () => {
  test("product and kind are set together, and committed states need a product", () =>
    rollback(db, async (tx) => {
      const stock = await insertStockPurchase(tx);
      const dbc = await insertProduct(tx, "dbc");
      await expectPgError(tx, (s) => s.insert(cards).values({ stockPurchaseId: stock.id, productId: dbc.id }), "23514", "cards_product_kind_together");
      await expectPgError(tx, (s) => s.insert(cards).values({ stockPurchaseId: stock.id, kind: "dbc" }), "23514", "cards_product_kind_together");
      await expectPgError(
        tx,
        (s) => s.insert(cards).values({ stockPurchaseId: stock.id, productId: dbc.id, kind: "grc" }),
        "23503",
        "cards_product_fk",
      );
      const { item } = await insertOrderItem(tx, "dbc");
      await expectPgError(
        tx,
        (s) => s.insert(cards).values({ stockPurchaseId: stock.id, state: "reserved", orderItemId: item.id }),
        "23514",
        "cards_committed_states_need_product",
      );
    }));

  test("an order-item link needs a product, so the product match is always checked", () =>
    rollback(db, async (tx) => {
      const stock = await insertStockPurchase(tx);
      const { item } = await insertOrderItem(tx, "dbc");
      await expectPgError(
        tx,
        (s) => s.insert(cards).values({ stockPurchaseId: stock.id, state: "retired", orderItemId: item.id }),
        "23514",
        "cards_order_item_needs_product",
      );
    }));

  test("only an owned card can be disabled", () =>
    rollback(db, async (tx) => {
      const { card } = await insertReadyDbc(tx);
      await expectPgError(
        tx,
        (s) => s.update(cards).set({ disabledAt: new Date() }).where(eq(cards.id, card.id)),
        "23514",
        "cards_disabled_needs_owner",
      );
    }));
});
