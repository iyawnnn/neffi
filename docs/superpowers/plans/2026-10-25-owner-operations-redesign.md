# Owner Operations Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document is a review deliverable, not authorization to start implementation.

**Goal:** Make paid DBC orders drive automatic stock allocation, guided physical preparation and one clear delivery action, with secure owner code retrieval and simpler customer/public utility screens.

**Architecture:** Retain the modular monolith, server-authorized actions and database-enforced lifecycle. Add internal Preparing using the existing Card→Order Item FK; allocate Ready first, otherwise virgin Blank. Add encrypted current-code retention alongside HMAC, keep shipping separate from product price, and atomically record shipping collection at Mark as shipped using the chosen order method.

**Tech Stack:** Next 16.4.2, React 19.3, TypeScript, PostgreSQL/Drizzle, PGlite/Vitest/happy-dom, Tailwind 4, existing Base UI/Geist/uqr; Node 24 `crypto`. No new animation, carousel, device-sync or cryptography library.

**Spec:** `docs/superpowers/specs/2026-10-25-owner-operations-redesign-design.md`.

## Global constraints

- Planning baseline: clean `main` at `ab75f1e9c0b7a6cfe4838c6d78b98e98d2d5711a`; sync/review intervening changes before implementation.
- Do not implement, create branches, commit, push, query/mutate Production or change provider configuration during this planning task.
- Future implementation requires approval of the design. Follow repository AGENTS, `docs/README.md`, `PRODUCT.md`, relevant current specs and installed Next guides.
- Normal DBC price: `79_900` centavos / **Neffi Digital Business Card — ₱799**. Product payment is received at normal order creation. No normal arbitrary price, negotiated total or Paid checkbox.
- New sale methods: `gcash`, `maya`, `maribank`, `gotyme`, `bank_transfer`. Preserve historical `cash`; no COD.
- Normal J&T Mark as shipped confirms shipping collection and atomically records its receipt, shipment, card release and exact-settlement completion. No extra payment action, Paid checkbox or method selection.
- N-XXXX is an Admin reference, not a required physical label. Write one untouched card at a time; its permanent NFC URL establishes identity.
- The available public profile first-view Neffi intro is required, with immediate SSR usefulness and reduced-motion/no-JS behavior.
- New normal delivery: `in_person` → stored `local_handoff`; `jnt` → stored `courier`, server-controlled `J&T`. Preserve old values and courier history.
- NFC URL = Sharing QR URL = `https://getneffi.com/c/{token}`. Package QR = `https://getneffi.com/activate`.
- Keep append-only payments/refunds/activity, historical prices, real NFC/package checks, one usable credential, atomic claim, authorization, rate limits and generic public privacy semantics.
- No activation codes in URLs/logs/analytics/mail/initial RSC/list payloads/browser storage. Only an explicit authorized reveal response contains plaintext.
- Forward-only additive migrations. No seed/reset/shared-DB operations. Migration/concurrency rehearsal targets disposable loopback PostgreSQL only.
- Do not ship intermediate phases independently without the rollout gates in the design. Existing real physical acceptance evidence is not replaced by synthetic fixtures.

## Execution conventions and interfaces

Read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `01-app/02-guides/authentication.md` and relevant cache/proxy guides before touching routes. Existing async route params, server-only boundaries, `instant` and prefetch settings are intentional.

Each task follows red → observe intended failure → minimum implementation → green → review. Preserve meaningful old assertions; update changed product-contract assertions explicitly, not by deleting suites. Use small semantic tests, not full-page snapshots or CSS-pixel assertions. `corepack pnpm test -- <file>` is shorthand for a focused run of the canonical Vitest script. Quote paths containing parentheses/brackets in PowerShell. Future commits/checkpoints require execution authorization; none are made by writing this plan.

New public types/functions below are design contracts, not existing exports. Use existing `Db` and transaction conventions. Keep service errors data-free and map them to plain owner copy in actions.

```ts
// src/modules/orders/policy.ts (pure)
export const NORMAL_DBC_UNIT_PRICE = 79_900;
export type NewPaymentMethod = 'gcash' | 'maya' | 'maribank' | 'gotyme' | 'bank_transfer';
export type OwnerDelivery = 'in_person' | 'jnt';
export const NEW_PAYMENT_METHODS: readonly NewPaymentMethod[] = [
  'gcash', 'maya', 'maribank', 'gotyme', 'bank_transfer',
];

// src/modules/activation/encryption.ts (server-only)
export type CredentialSecrets = {
  lookupSecret: string;
  activeKeyId: string;
  encryptionKeys: ReadonlyMap<string, Buffer>; // decoded validated 32-byte keys
};
export type CodeBinding = { credentialId: string; cardId: string; lookupHmac: string };
export function encryptActivationCode(code: string, binding: CodeBinding, secrets: CredentialSecrets): string;
export function decryptActivationCode(envelope: string, binding: CodeBinding, secrets: CredentialSecrets): string;

// src/modules/orders/allocation.ts (server-only)
export type AllocationResult = { allocatedCardIds: string[]; missingQuantity: number };
export function allocateDbcCards(db: Db, input: {
  actorId: string; orderId: string; secrets: CredentialSecrets;
}): Promise<AllocationResult>;
// Internal allocateDbcCardsInTransaction(tx, input) consumes held Order/item locks.

// src/modules/orders/normal-dbc.ts (server-only)
export type NormalDbcOrderInput = {
  actorId: string; clientKey: string; quantity: number; paymentMethod: NewPaymentMethod;
  purchaserId?: string; purchaser?: { name: string; contactNumber?: string };
  delivery: { method: OwnerDelivery; recipientName?: string; recipientPhone?: string;
    address?: string; shippingFee?: number };
  notes?: string; supportCaseId?: string; secrets: CredentialSecrets;
};
export function createPaidDbcOrder(db: Db, input: NormalDbcOrderInput): Promise<{
  orderId: string; allocation: AllocationResult;
}>;

// src/modules/activation/retrieval.ts (server-only)
export type CodeReveal = { status: 'available'; code: string; credentialId: string }
  | { status: 'legacy_code_needed' | 'unavailable' | 'key_unavailable' };
export function revealActivationCode(db: Db, input: {
  actorId: string; cardId: string; credentialId: string; secrets: CredentialSecrets;
}): Promise<CodeReveal>;
export function saveExistingActivationCode(db: Db, input: {
  actorId: string; cardId: string; credentialId: string; code: string; secrets: CredentialSecrets;
}): Promise<void>;
```

`quantity` is integer 1–500; all monetary inputs integer 0–1_000_000_000, bounded against multiplication overflow. Purchaser ID XOR purchaser is required. Normal input validation is strict: reject `unitPrice`, `agreedTotal`, `paidNow`, `paid`, arbitrary courier and extra unknown fields; do not merely strip a malicious override and silently accept it. Actor identity/secrets are server-supplied, never FormData. Payment date defaults to Manila today, no normal amount control. An optional fee at creation/draft-save does not mean shipping has been collected; Mark as shipped confirms collection and records its receipt using the persisted order method.

### Test helpers

Reuse `src/db/testing.ts::{createTestDb,rollback,expectPgError}` and `src/db/test-fixtures.ts::{insertAccount,insertProduct,insertStockPurchase,insertOrderItem,insertReadyDbc,insertClaimedCard}`. Do not change the default synthetic price globally and break historical-price tests.

Create `src/modules/orders/operations-test-fixtures.ts` (test-only, imported only by tests) with:

```ts
export function syntheticCredentialSecrets(): CredentialSecrets;
// lookupSecret is a distinctive synthetic string; key test-v1 is Buffer.alloc(32, 7).
export function normalOrderInput(actorId: string, overrides?: Partial<NormalDbcOrderInput>): NormalDbcOrderInput;
// New random clientKey, purchaser 'Synthetic Buyer', qty 1, gcash, in_person, synthetic secrets.
export function virginStock(tx: TestTx, quantity: number): Promise<string[]>;
// Creates one synthetic stock purchase and quantity uncommitted Blank cards; returns IDs.
export function preparedStock(tx: TestTx, actorId: string, secrets: CredentialSecrets): Promise<{cardId: string; code: string}>;
// Provision → exact NFC check → physical package-code match through actual services.
export function cardById(tx: TestTx, cardId: string): Promise<typeof cards.$inferSelect>;
```

Use random/generated synthetic codes inside tests, not real credentials or committed operational exports. Fixtures representing legacy history may use direct INSERTs because the new normal creation policy intentionally cannot recreate historical negotiated/Cash orders.

## Phase A — additive schema and security foundations

### Task 1: Prove legacy upgrade and extend schema without rewriting history

**Modify:** `src/db/schema/{enums,inventory,commerce,operations}.ts`, `drizzle/meta/_journal.json` and generated snapshots.

**Create:** `drizzle/0019_owner_operations_enum_expansion.sql`, `0020_owner_operations_workflow.sql`, `0021_retrievable_activation_credentials.sql` (canonical generated sequence names can be renamed before applying); `src/db/migration-owner-operations.db.test.ts`.

**Extend tests:** `src/db/{cards,credentials,commerce,operations,integrity-guards,owner-operations,migrations}.db.test.ts`.

**Produces:** new Preparing state, immutable inventory number, fee-pending/client-key/immutable normal-payment-method fields, nullable encrypted envelope and credential audit FK, lifecycle guards.

- [ ] Write upgrade tests following `src/db/migration-0018.db.test.ts`: copy journal through 0018 into a temp folder, migrate a new PGlite, insert synthetic legacy Cash/negotiated/non-J&T/pending/Completed/Cancelled and usable/used/revoked credentials, fingerprint original fields, then migrate forward. Close and remove only the created temporary resources.

```ts
expect(after.orderItems.map(({ unitPrice, agreedTotal }) => ({ unitPrice, agreedTotal })))
  .toEqual(before.orderItems.map(({ unitPrice, agreedTotal }) => ({ unitPrice, agreedTotal })));
expect(after.payments).toEqual(before.payments);
expect(after.shipments).toEqual(before.shipments);
expect(after.credentials.every(c => c.encryptedCode === null)).toBe(true);
expect(new Set(after.cards.map(c => c.inventoryNumber)).size).toBe(after.cards.length);
expect(after.orders.every(o => o.shippingFeePending === false && o.clientKey === null && o.normalPaymentMethod === null)).toBe(true);
```

- [ ] Add `expectPgError` tests: Preparing without order/product/token/DBC rejected; Prepared transition without evidence/usable credential rejected; token/number/history immutable; terminal ciphertext cannot reappear; arbitrary changes to used/revoked credential history still fail.
- [ ] Run red: `corepack pnpm test -- src/db/migration-owner-operations.db.test.ts src/db/cards.db.test.ts src/db/credentials.db.test.ts`.
- [ ] Generate/review additive SQL. Preserve exact old CHECKs/trigger behavior; only add the new semantics. Allocate inventory numbers via owned sequence with stable backfill and sequence advancement under table lock, not application max/count. Keep legacy fee zero confirmed. Unique client key is nullable. Add nullable `orders.normal_payment_method` using the retained enum, null for legacy rows; CHECK new normal orders require an approved method and guard immutability. Test missing/Cash method on new normal rows and subsequent mutation fail; existing rows remain untouched.

```sql
-- Schema intent; generated migration must keep statement-breakpoints.
ALTER TYPE card_state ADD VALUE 'preparing';
ALTER TYPE payment_method ADD VALUE 'maya';
ALTER TYPE payment_method ADD VALUE 'maribank';
ALTER TYPE payment_method ADD VALUE 'gotyme';
-- Dependent CHECK/trigger comparisons cast enum to text; no typed Preparing
-- constants/defaults/index predicates or new-label data writes before commit.
-- Retain cards_stock_has_no_order_item for Blank/Ready and the composite FKs.
```

- [ ] Preserve duplicate legacy pending shipments. Do not add a partial unique index over them. Enforce one new draft under Order lock in Task 8; ambiguous old drafts require an explicit correction/selection, never silent merge/deletion.
- [ ] Add nullable `activity_events.activation_credential_id` FK/index in 0021; existing events remain null. Extend `ActivityInput` with `activationCredentialId?: string`. Add DB tests for invalid FK refusal, append-only credential reference, and old-row preservation; credential events still include Card as their subject.
- [ ] Extend credential trigger so use/revoke automatically sets `encrypted_code=NULL`, terminal rows cannot regain it, usable non-null envelopes cannot be rewritten, and adoption only fills legacy null. Preserve credential insert's Card serialization/package-match invalidation. Do not add a database constraint forbidding legacy usable null envelopes.
- [ ] Green: targeted tests plus `corepack pnpm db:check`, `corepack pnpm db:generate`, `corepack pnpm db:erd`. Inspect generated SQL/journal/ERD.
- [ ] Rehearse the actual migrator on disposable PostgreSQL both from zero and 0018 fixtures, including a grouped migration transaction. Use `state::text` comparisons throughout dependent migration DDL and no typed new-label expressions or inserts before commit. Record the exact successful rehearsal in operations docs; a filename split alone is not proof of transaction separation.

### Task 2: Implement separately keyed authenticated encryption

**Create:** `src/modules/activation/encryption.ts`, `encryption.test.ts`.

**Modify:** `src/config/env-schema.ts`, `env-schema.test.ts`, `.env.example`, `.github/workflows/ci.yml`, `scripts/check-client-bundle.mjs`, `src/server-only-boundary.test.ts`.

**Consumes/produces:** `CredentialSecrets`, `CodeBinding`, encrypt/decrypt functions above; validated `ServerEnv.activationCodeEncryptionActiveKeyId` and `activationCodeEncryptionKeys` (server-only decoded map).

- [ ] Write failing round-trip, fresh-nonce, tamper, wrong-Card/credential/HMAC/AAD, wrong-key, unknown-version and malformed-envelope cases.

```ts
const secrets = syntheticCredentialSecrets();
const binding = { credentialId: crypto.randomUUID(), cardId: crypto.randomUUID(), lookupHmac: 'a'.repeat(64) };
const code = generateActivationCode();
const one = encryptActivationCode(code, binding, secrets);
expect(decryptActivationCode(one, binding, secrets)).toBe(code);
expect(encryptActivationCode(code, binding, secrets)).not.toBe(one);
expect(() => decryptActivationCode(one, { ...binding, cardId: crypto.randomUUID() }, secrets)).toThrow();
expect(one).not.toContain(code);
```

- [ ] Red: `corepack pnpm test -- src/modules/activation/encryption.test.ts src/config/env-schema.test.ts`.
- [ ] Implement strict `v1.keyId.nonce.ciphertext.tag` parsing and AES-256-GCM using Node crypto with canonical AAD. No custom encryption scheme. Fail with generic typed error, never include secret data.
- [ ] Validate active ID exists and every key is exactly 32 decoded bytes; reject empty/duplicate/invalid key IDs and key encodings. Keep encryption keys separate from HMAC and auth secrets. CI gets distinctive synthetic values, not provider secrets.
- [ ] Extend bundle scan to raw JSON, JSON-escaped representation, individual encoded/decoded textual key material, and synthetic HMAC/encryption secrets. Keep public build output scanning; add a fixture test for an individual leaked key rather than just matching its whole JSON container.
- [ ] Green: focused crypto/config tests, `corepack pnpm test -- src/server-only-boundary.test.ts`; typecheck. Do not configure actual providers in development.

### Task 3: Encrypt issuance; clear atomically on every terminal outcome

**Modify:** `src/modules/activation/{credentials,claim}.ts`, `src/modules/cards/dbc.ts`, `src/modules/support/cards.ts`, `src/app/admin/inventory/actions.ts`, `src/app/admin/support/[caseId]/actions.ts`; issuance callers in scripts/dev fixtures/tests.

**Tests:** `src/modules/activation/{credentials,claim}.db.test.ts`, `src/modules/cards/{dbc,dbc-collision,retire}.db.test.ts`, `src/modules/support/cards.db.test.ts`, `src/db/credentials.db.test.ts`.

**Interface:** `issueActivationCredential(tx, cardId, secrets: CredentialSecrets)` keeps `{credentialId,code}` result; lookup/check still uses `lookupSecret` and existing HMAC algorithm. Public claim/check signatures need not acquire encryption keys.

- [ ] Failing tests prove fresh issuance has valid decryptable envelope/HMAC; no plaintext in rows/events; claim/revoke/retire/replacement/reset clears old envelope; old credential remains terminal history; new code independently decrypts and passes lookup; raw code is absent on page reload until explicit reveal.

```ts
expect(issued.lookupHmac).toBe(activationLookup(secrets.lookupSecret, code));
expect(decryptActivationCode(issued.encryptedCode!, binding, secrets)).toBe(code);
expect(JSON.stringify([cardRows, credentialRows, activityRows])).not.toContain(code);
expect(oldCredential.encryptedCode).toBeNull();
expect(oldCredential.usedAt ?? oldCredential.revokedAt).not.toBeNull();
```

- [ ] Red: focused credential/claim/dbc/support tests. Use `rg -n 'issueActivationCredential|provisionDbc|replaceProvisioningCredential|reissueActivationCode|resetCardOwnership|usedAt:|revokedAt:' src scripts` to enumerate every writer and fixture.
- [ ] Generate credential UUID before encrypting; store ciphertext/HMAC atomically. Keep collision retry and one-usable index. Explicitly clear envelope in use/revoke updates, with DB trigger as defense. No reissue on GET/reveal errors.
- [ ] Thread server secrets through provisioning and support recovery without changing customer challenge-cookie, HMAC/rate-limit or ownership-verification semantics. Update all fixtures/scripts to supply synthetic keys. Assert denied support operations still change nothing.
- [ ] Green: same focused tests; all existing activation/support suites and boundaries. Customer claim succeeds with a valid legacy HMAC-only credential or when a reveal key is missing; claim never needs decryption.

### Task 4: Authorized reveal and safe legacy code adoption

**Create:** `src/modules/activation/retrieval.ts`, `retrieval.db.test.ts`.

**Modify:** `src/app/admin/inventory/actions.ts`, `actions.test.ts`, `src/modules/activity/record.ts`, server-only boundary list.

**Produces:** reveal/adopt services above; `revealActivationCodeAction` and `saveExistingActivationCodeAction` with only Card/credential IDs (plus submitted legacy code for adoption), no user-provided actor/secrets.

- [ ] Test OWNER success and audit; anonymous/customer denial before DB work; stale credential/claimed/retired/used/revoked refuse; malformed/corrupt/missing-key results contain no secret. Test audit-insert failure returns no code and rolls back event. Test legacy null returns `legacy_code_needed` without issuing a credential.

```ts
expect(await revealActivationCode(tx, input)).toMatchObject({ status: 'available', code });
expect(await revealActivationCode(tx, { ...input, actorId: customer.id })).toEqual({ status: 'unavailable' });
expect(events.filter(e => e.type === 'activation_code_viewed')).toHaveLength(1);
expect(events.find(e => e.type === 'activation_code_viewed'))
  .toMatchObject({ actorAccountId: owner.id, cardId, activationCredentialId: credentialId });
expect(JSON.stringify(events)).not.toContain(code);
```

- [ ] Test adoption correct HMAC fills only the same active credential envelope; wrong code/stale ID/claimed card leaves data unchanged; does not set packageMatchedAt or create a replacement code. Test non-null encrypted code cannot be overwritten. Adoption audit references that exact credential through the new FK, without code/envelope in notes.
- [ ] Red: `corepack pnpm test -- src/modules/activation/retrieval.db.test.ts src/app/admin/inventory/actions.test.ts`.
- [ ] Implement fresh OWNER check, Card/credential locking and audit before returning; no Order lock after Card. Action authorization comes first. Generic errors; no secret read during ordinary page/list queries.
- [ ] Green: focused tests plus `src/app/access-sweep.test.ts`, `src/lib/sentry-scrub.test.ts`, `src/server-only-boundary.test.ts`.

## Phase B — order-driven domain orchestration

### Task 5: Fixed-price normal order receipt and legacy-safe channels

**Create:** `src/modules/orders/{policy,normal-dbc}.ts`, `policy.test.ts`, `normal-dbc.db.test.ts`, `operations-test-fixtures.ts`.

**Modify:** `orders/{create,items,products,totals,order,errors}.ts`, `payments/record.ts`; relevant tests; Settings DBC price action tests.

**Consumes:** credential secrets; allocator contract (initially test its orchestration boundary, implement the real allocator in Task 6 before full integration).

**Produces:** strict paid normal DBC creation; expanded whitelist, legacy reader compatibility, feePending-aware totals/completion.

- [ ] Write failing normal-order tests: catalog price 50000 still produces new normal DBC snapshot 79900, agreedTotal null, one payment for product total and immutable chosen `normalPaymentMethod`, no shipping receipt before dispatch even if fee is known; each five allowed method works; Cash/COD/overrides rejected. Preserve explicit legacy order snapshots and negotiated totals through reads/refunds/corrections.

```ts
const result = await createPaidDbcOrder(tx, normalOrderInput(owner.id, { quantity: 2 }));
expect(items).toMatchObject([{ orderId: result.orderId, unitPrice: 79_900, agreedTotal: null, quantity: 2 }]);
expect(payments).toMatchObject([{ orderId: result.orderId, amount: 159_800, method: 'gcash' }]);
expect(orderTotals({ ...facts, shippingFee: 0, shippingFeePending: true }).shippingFeePending).toBe(true);
expect(isCompletionEligible({ ...fullyDeliveredFacts, shippingFeePending: true })).toBe(false);
```

- [ ] Red: `corepack pnpm test -- src/modules/orders/normal-dbc.db.test.ts src/modules/orders/totals.test.ts src/modules/payments/record.db.test.ts`.
- [ ] Implement constant/strict normal schema and transaction: guard optional Support Case first; idempotent client-key claim; purchaser/items; persist chosen `normalPaymentMethod`; product receipt; allocation; activity. Use active DBC product identity, but locked unit price independent of arbitrary catalog price. Every reachable new normal DBC creation/addition/paid replacement must use this policy. Do not leave a legacy server action as a price-override bypass.
- [ ] Same clientKey replay returns the creator's original Order without new purchaser/payment/credential; a different actor cannot reuse it. Resolve unique-key races before creating child facts. A retry with different field values must clearly return the existing Order, not silently mutate the paid receipt.
- [ ] Disable normal paid-order quantity/price edits (`client_key IS NOT NULL` identifies these new normal orders); direct users to cancel/refund/new order where allowed. Preserve legacy edit/correction and GRC commercial-line behavior. Settings shows fixed DBC price; rejects DBC price mutation while keeping GRC settings.
- [ ] Add `shippingFeePending` to facts/totals DTOs; unknown shows no final total, only product subtotal and pending shipping; confirmed fee computes exact total/balance. Test confirmed fee before shipment yields outstanding shipping balance with no shipping receipt; Task 8 settles this atomically at shipment. Keep exact-settlement and append-only corrections unchanged.
- [ ] Green: focused tests plus existing create/items/products/totals/payment/support-money tests. Do not turn old synthetic prices into ₱799 by rewriting history fixtures.

### Task 6: Automatic Ready-first allocation and stock-shortage recovery

**Create:** `src/modules/orders/allocation.ts`, `allocation.db.test.ts`.

**Modify:** `orders/{normal-dbc,order,queries,items}.ts`, `cards/dbc.ts`, `inventory/stock-intake.ts`; tests; `scripts/check-orders-concurrency.mts`.

**Produces:** `allocateDbcCards`/transaction helper and bounded `allocateWaitingOrders(db,{actorId,secrets,limit})`; txn-level provisioning helper in `dbc.ts`. `limit` bounds work per stock-receipt request, with oldest In-Progress Order first.

- [ ] Test Ready chosen before virgin Blank; inactive/mismatched product, already preparing/reserved/released/retired, token-bearing Blank and GRC never chosen; no client card ID input. Allocation repeated on an already full item is a no-op. Separate allocated/prepared/released counts.

```ts
const result = await allocateDbcCards(tx, { orderId, actorId: owner.id, secrets });
expect(result.allocatedCardIds).toContain(ready.cardId);
expect((await cardById(tx, ready.cardId)).state).toBe('reserved');
expect((await cardById(tx, virginId)).state).toBe('blank');
expect(facts.items[0]).toMatchObject({ allocatedCount: 1, preparedCount: 1, releasedCount: 0 });
```

- [ ] Test Blank becomes Preparing with item/product/token/current encrypted credential in one transaction; issuance/audit failure rolls it all back. Stock shortage preserves paid order, reports exact deficit and cannot fulfill. Receiving more stock retries waiting orders without duplicate allocations/payment. A post-receipt retry failure must not undo stock receipt; Order retry remains available.
- [ ] Red: `corepack pnpm test -- src/modules/orders/allocation.db.test.ts src/modules/orders/normal-dbc.db.test.ts src/modules/inventory/stock-intake.db.test.ts`.
- [ ] Implement Order→items locks, stable Ready then virgin Blank `FOR UPDATE SKIP LOCKED`, conditional transitions and capacity rechecks. Do not call a separately committing provisioning operation. Keep public token/credential generation out of list/page GETs.
- [ ] Update all capacity consumers in `orders/order.ts`, `queries.ts`, `items.ts`, support replacement and UI DTOs. Existing `activeCount` is not enough; explicitly distinguish allocated from ready-to-deliver.
- [ ] Add real two-session cases: two orders/one Ready; two orders/one Blank; same Order double allocation; Ready locked by another allocator; stock intake retry versus manual Order retry; no duplicate assignment or code and no deadlock. Preserve all existing seven order-concurrency checks.
- [ ] Green: focused tests, loopback `corepack pnpm check:orders-concurrency`. Repeat order receipt integration without mocks after real allocator exists.

### Task 7: Preparation, cancellation, replacement and failure under the new state

**Create:** `src/modules/cards/preparation.ts`, `preparation.db.test.ts`.

**Modify:** `cards/{card,dbc}.ts`, `orders/{cancel,fulfillment}.ts`, `support/cards.ts`; related db tests, `scripts/check-{provisioning,orders,support}-concurrency` suites.

**Interface:** `withPreparationCard(db,{cardId,actorId}, fn)` snapshots association, locks parent Order/item if linked, then Card, verifies association/status again; no post-Card Order acquisition. Transaction-level check/match helpers consume these held locks.

- [ ] Test no inventory sticker/number scan/identification confirmation is required: write an untouched card with its allocated URL. Ready-first stock skips completed checks. Returned token-bearing cards require NFC URL/package identity, never virgin-stock allocation.
- [ ] Test one explicit NFC action with exact readBackUri remains required; wrong URI fails; phone/read-back/writable guidance is attested by one action. Missing test cannot match package. Matching correct actual package code moves Preparing→Reserved, standalone Blank→Ready. Returned code is never auto-filled as package proof.

```ts
await expect(matchPackage(tx, { ...input, activationCode: code })).rejects.toMatchObject({ code: 'checks_incomplete' });
await recordNfcCheck(tx, { ...nfcInput, readBackUri: permanentUrl });
await matchPackage(tx, { ...input, activationCode: code });
expect(await cardById(tx, cardId)).toMatchObject({ state: 'reserved', orderItemId });
```

- [ ] Test cancellation Preparing→unlinked Blank preserving permanent token/credential/evidence, Reserved→Ready, refund due preserved; no cancellation after release. Return to stock must not lose the distinction between virgin and provisioned blanks.
- [ ] Test failed Preparing retirement retains its original item link/history, clears/revokes code, frees capacity and triggers automatic replacement or shortage. Credential replacement for Preparing/Reserved preserves order link, clears package match, retains real NFC evidence, and returns to Preparing before re-match. Released corrections remain Support-only.
- [ ] Red: targeted preparation/cancel/dbc/retire/support tests.
- [ ] Implement state-aware helpers and update actions without weakening exact checks. For a snapshot race from unlinked to linked, return a data-free retry error; never lock in reverse order. Fixed-ID multi-card operations lock sorted IDs.
- [ ] Add races: package match vs cancel, NFC check vs cancel, allocation vs retire, replacement vs confirm package, claim/reveal/revoke, released Support correction vs customer claim. Assert terminal semantics and no hidden partial effects.
- [ ] Green: focused tests plus relevant loopback concurrency suites.

### Task 8: One normal fulfillment action per delivery method

**Modify:** `src/modules/orders/{fulfillment,order,totals,queries}.ts`, `src/modules/payments/record.ts`, `src/modules/activity/record.ts`.

**Tests:** `orders/{fulfillment,order,queries}.db.test.ts`, `totals.test.ts`, payment tests, support shipment regressions.

**Produce:** `saveJntDelivery(db,{actorId,orderId,recipientName,recipientPhone,address,shippingFee?})`; `markJntShipped(db,{actorId,orderId,trackingNumber,shippedOn?,shippingFee?})`; reasoned `correctShipmentDate` for existing actual shipments. No separate shipping-payment service/action. Method comes from immutable `orders.normal_payment_method`, not another owner input. Normal courier is server-fixed J&T. Insert payment inside the existing Order transaction, not through a separately committing receipt service.

- [ ] Test In person requires all DBC quantities prepared and emits one handover/release with exact-settlement completion; deficit prevents release. No automatic customer claim/ownership.
- [ ] Test recipient defaults/persistence in one pending shipment, unknown versus confirmed zero fee, no receipt merely from saving a fee, unchanged product price/receipt. Existing support shipments remain distinct.
- [ ] Test Mark as shipped requires tracking, destination, prepared cards and known nonnegative fee (supplied now if missing), with Manila today default. Atomically append shipping receipt using the chosen method, update the same shipment, release cards and settle to Completed. Cover all five methods; zero fee creates no zero-value payment. No Paid checkbox, extra payment action or handover.

```ts
expect(after.item.unitPrice).toBe(79_900);
expect(after.shipment).toMatchObject({ courier: 'J&T', trackingNumber: 'SYNTH-TRACK', status: 'in_transit' });
expect(after.cards.every(c => c.state === 'released')).toBe(true);
expect(after.payments.map(p => p.amount)).toEqual([79_900, 12_000]);
expect(after.payments.every(p => p.method === before.order.normalPaymentMethod)).toBe(true);
expect(after.payments[0]).toEqual(before.payments[0]);
expect(after.totals.balance).toBe(0);
expect(after.order.status).toBe('completed');
```

- [ ] Red: `corepack pnpm test -- src/modules/orders/fulfillment.db.test.ts src/modules/orders/totals.test.ts src/modules/payments/record.db.test.ts`.
- [ ] Under Order→item→Card locks, confirm fee, validate unchanged product settlement/no unexpected shipping receipts, append positive shipping receipt, record shipment/release/audit and invoke final settlement once. Shipment success marks idempotency: replay returns existing outcome with no new receipt/event/release. Any write failure rolls back everything. Corrected/voided product receipts, unexpected manual shipping receipts or incompatible balances use reasoned correction paths, never fabricated collection. Preserve legacy partial-release compatibility explicitly. Courier cost stays distinct and optional.
- [ ] Correct shipped date only with valid date/reason/activity, maintaining shipped state and final Order timestamps. Preserve historical courier/Cash/refund/void paths.
- [ ] Add real races: ship vs cancel, double ship, fee save vs ship, receipt void/correction vs ship, settlement exactly once. Assert one shipping receipt/shipment, consistent committed fee/total and no duplicate release; inject receipt/shipment/audit failures to prove whole-operation rollback. Existing final-order correction guards remain. Green focused + `corepack pnpm check:orders-concurrency`.

## Phase C — operational UI and phone continuity

### Task 9: Owner-aware customer navigation and safe Admin return

**Modify:** `src/auth/access.ts`, `access.test.ts`, `policy.test.ts`; `src/app/admin/layout.tsx`; customer `app/{layout,app-nav}.tsx`/tests; card-preparation page guard; `src/app/access-sweep.test.ts`.

**Interface:** `requireOwner(nextPath?: string)` accepts only safe Admin destinations, default `/admin`; existing callers continue working.

- [ ] Test OWNER sees Admin dashboard in Account menu on desktop/mobile while normal customer links remain; customer does not. Links do not grant role or access.
- [ ] Test signed-out exact Card route redirects with safely encoded same-site next; Google/email flows return there. Parent layout cannot replace it with `/admin`. Signed-in customer gets notFound and denied action; external/escaped next falls back safely.

```ts
expect(safeNext('https://attacker.example/admin')).toBe('/app');
expect(safeNext(`/admin/inventory/cards/${cardId}`)).toBe(`/admin/inventory/cards/${cardId}`);
expect(ownerMenuLinks).toContain('/admin');
expect(customerMenuLinks).not.toContain('/admin');
```

- [ ] Red: `corepack pnpm test -- src/auth/access.test.ts src/auth/policy.test.ts 'src/app/(customer)/app/app-nav.test.tsx' src/app/access-sweep.test.ts`.
- [ ] Change Admin layout only enough to let independently protected pages preserve their redirect. Audit every `/admin` page and handler with `rg -n 'requireOwner|authorize\(' src/app/admin`; no page may rely solely on layout for data authorization. Card page validates UUID and passes canonical path; guard before protected fetches.
- [ ] Green same tests plus auth routes DB tests and customer layout tests.

### Task 10: Order form/detail become the operating home

**Modify:** `src/app/admin/orders/new/{page,order-form,actions}.tsx/ts`, `orders/[orderId]/{page,actions,money-fields}.tsx/ts`, orders table/view, `src/app/admin/settings/{page,actions}.tsx/ts`; tests.

**Consumes:** normal creation, allocation, fulfillment and fee-pending DTOs.

**Produces:** normal order action calls only paid DBC facade; no client-supplied card IDs or amounts/prices.

- [ ] Add semantic tests: exact product price, all five payment choices, only two normal delivery choices, no Paid checkbox/Adjust price/unit price/agreed total inputs; action tampering rejects overrides/Cash/arbitrary courier. Facebook ordering/marketing is not replaced with checkout.
- [ ] Test detail next action for stock shortage, partial preparation, all prepared, In person, J&T pending fee, shipment complete with zero balance, Waiting for activation, Activated, Completed and legacy orders. Assert no extra shipping-payment action or method re-selection, and only one current primary task. Reject direct ship when not prepared. No normal “Reserve selected DBCs” or “Record handover”.

```tsx
expect(screen.getByText('Neffi Digital Business Card — ₱799')).toBeTruthy();
expect(screen.queryByRole('checkbox', { name: /paid/i })).toBeNull();
expect(screen.getByRole('button', { name: 'Create paid order' })).toBeTruthy();
expect(screen.getByRole('link', { name: 'Prepare card' }).getAttribute('href'))
  .toBe(`/admin/inventory/cards/${cardId}`);
```

- [ ] Red: new-order actions tests and order detail/page/actions/money-fields tests.
- [ ] Use existing `FormPanel`, `NextStep`, `ActionForm`, buttons/dialog patterns. Fields go customer → product/quantity → method → delivery; receipt helper plain. Preserve idempotency key across retry. Move legacy/support money/history behind secondary actions, truthful historical price display.
- [ ] Add J&T draft inputs and one Mark as shipped form (fee if missing, tracking, shipped date default today); helper confirms fee collection and activation availability, with no Paid checkbox or extra payment form; courier value is server-owned; page errors preserve inputs. Date is correctable with audit. Do not promise a verified external tracking link.
- [ ] Green focused UI/actions/settings tests plus existing Admin shell/access tests.

### Task 11: Card preparation workspace, phone QR and code controls

**Modify:** `src/app/admin/inventory/cards/[cardId]/page.tsx`, `src/app/admin/inventory/{forms,actions,card-url}.tsx/ts`, detail query.

**Create colocated under card directory:** `preparation-workspace.tsx`, `continue-on-phone.tsx`, `activation-code.tsx`, their focused `.test.tsx` files.

**Extend:** existing card page, `forms-lifecycle`, `provision-reveal`, card-url and action tests.

- [ ] Test displayed stable Admin reference, no required physical N-XXXX label/sticker/inventory QR; show "Keep this card with you until preparation is complete." Ready stock skips completed preparation. Test one current Next step, Copy NFC URL, explicit Confirm NFC test without checkbox ceremony, manual actual-package code input, correct post-check delivery action and Sharing QR parity/download. Retired hides Sharing QR/code and offers only history.
- [ ] Test phone QR/normal fallback link is exact trusted Admin route, contains no code/credential/session; mock shared `qrSvgDataUri` and inspect its input. QR accessible name explains opening the workspace, not sharing a public profile.

```ts
expect(qrInputs).toContain(`https://getneffi.com/admin/inventory/cards/${cardId}`);
expect(qrInputs).toContain(`https://getneffi.com/c/${publicToken}`);
expect(qrInputs.join(' ')).not.toContain(activationCode);
expect(qrInputs).not.toContain('https://getneffi.com/activate');
```

- [ ] Test no plaintext initially; Show activation code calls authorized action; Copy only after success; Hide/visibility/page change clears memory; next reveal after claim/revoke refuses. Legacy adoption form presents honest existing-code message; no silent replacement. Errors announced without secret echo.
- [ ] Red: existing inventory card page/actions/forms tests plus new components.
- [ ] Build desktop task-first workspace and conditional narrow contextual rail using existing app typography/tokens; mobile single-column task order. One primary task button. Use the Admin reference, written permanent URL/package identity, existing QR helper and copy pattern, not generated assets. Keep history/corrections secondary and require reasons for replacements/retirement.
- [ ] Green focused tests and targeted ESLint/typecheck. Manual visual acceptance later covers narrow devices, long customer names, low stock, errors and keyboard flow; unit tests do not assert CSS pixels or pretend to validate NFC.

### Task 12: Inventory as a paginated queue and consistent search/dashboard

**Modify:** `src/modules/inventory/queries.ts`, `queries.db.test.ts`; `src/app/admin/inventory/{page,inventory-view,format}.tsx/ts`; `src/modules/search.ts`, `search-types.ts`, `search.db.test.ts`; admin search results, `inventory-summary.tsx`, `dashboard-view.tsx`; related tests/dev Admin fixtures.

**Create:** `src/modules/inventory/operations-view.ts`, `operations-view.test.ts` (pure status/next-action mapping, no crypto).

**Interface:**

```ts
export type InventoryOperationFacts = {
  id: string; state: 'blank' | 'preparing' | 'ready' | 'reserved' | 'released' | 'retired';
  publicToken: string | null; ownerAccountId: string | null; orderId: string | null;
  deliveryMethod: 'pickup' | 'local_handoff' | 'courier' | null;
  hasShippedShipment: boolean; hasHandedOver: boolean;
};
export function toInventoryOperation(card: InventoryOperationFacts): {
  status: 'Available blank' | 'Needs preparation' | 'Ready' | 'Assigned'
    | 'Shipped' | 'Given to customer' | 'Waiting for activation' | 'Activated' | 'Retired';
  actionLabel: string; href: string;
};
```

- [ ] Test priority Retired→Activated→Shipped/Given/Waiting activation→Assigned→Needs preparation→Ready/Blank. Delivery labels require real evidence, not just intended method. Normal old pickup/local map In person; old non-J&T shipment retains actual courier.

```ts
expect(toInventoryOperation({ ...base, state: 'preparing' }).status).toBe('Needs preparation');
expect(toInventoryOperation({ ...base, state: 'released', ownerAccountId: accountId }).status).toBe('Activated');
expect(toInventoryOperation({ ...base, state: 'retired', ownerAccountId: accountId }).status).toBe('Retired');
```

- [ ] Test filters/counts/search card number, purchaser/order/tracking, precise cursor continuation, 50+ card pagination and no list plaintext/envelopes/HMAC. Explicit code reveal uses Task 4 action, never list query decryption. Test no activation-code search path.
- [ ] Red: inventory query/view and search tests.
- [ ] Add joined allow-listed DTOs and bounded aggregates, no per-row decrypt/query loop. Keep cursor precision and filter preservation. Desktop six operational columns; tracking in Delivery. Mobile compact record stack; Available blanks stock view avoids meaningless per-blank preparation work. Reuse mapping in dashboard so queues agree.
- [ ] Green focused inventory/search/dashboard tests and existing pagination regressions.

## Phase D — customer/public clarity and release proof

### Task 13: Customer card actions use authenticated profile preview

**Modify:** `src/modules/cards/manage.ts`, `manage.db.test.ts`; customer `cards/[cardId]/{page,card-editor}.tsx` and page tests; existing profile preview tests.

**Produces:** `CardSummary.previewSceneId: string | null` from owner-scoped `coalesce(active_scene_id,default_scene_id)`.

- [ ] Test Preview exact `/app/profiles/{id}/preview?scene={id}` for shown/default Scene, no-profile setup path, other Account profile denial, Edit/Sharing QR/on-off remain; `/c` stays real share destination only.

```ts
expect(screen.getByRole('link', { name: 'Preview' }).getAttribute('href'))
  .toBe(`/app/profiles/${profileId}/preview?scene=${sceneId}`);
expect(sharingQrDestination).toBe(permanentCardUrl);
```

- [ ] Red: card detail page/manage DB/preview route tests.
- [ ] Extend minimal DTO; keep ownership-scoped query. Promote familiar four actions, technical URL secondary. Do not import server service into Client Component or create a new preview renderer.
- [ ] Green focused tests plus existing customer actions/profile privacy tests.

### Task 14: Compact activation and branded generic unavailable

**Modify:** `src/app/(public)/activate/page.tsx`, `activate-forms.tsx` only where presentation needs; `c/[token]/unavailable.tsx`, `c-unavailable/page.tsx`.

**Tests:** activation page/forms/actions/cookie, public token page/Proxy/resolver/request/contact suites.

- [ ] Test Code accepted keeps sign-in next `/activate`, signed-in Add card, challenge expiry/start over/switch account behavior and generic refusals. Public unavailable for unknown, preparing, unclaimed, off, missing Profile, Draft/Unpublished/retired remains the same body/message/status category and no private-state props.

```ts
expect(unavailableBodies.every(body => body.includes('This Neffi isn’t available right now'))).toBe(true);
expect(visitorBody).not.toContain('Manage this card');
expect(owningAccountBody).toContain('Manage this card');
```

- [ ] Red: focused public route/activation tests; preserve semantic error/security assertions rather than class snapshots.
- [ ] Use existing NeffiLogo and app/sign-in type scale. No marketing-sized utility headlines. One generic shared unavailable component, correct own-account Manage only. Keep metadata, HTTP 404 rewrites, signed internal header and noindex behavior.
- [ ] Green focused activation/proxy/resolver/public/contact tests; auth/access sweep.

### Task 15: Required first-view public-profile intro with no data/rendering delay

**Create:** `src/app/(public)/c/[token]/profile-intro.tsx`, `profile-intro.test.tsx`, local `profile-intro.css`.

**Modify:** `c/[token]/page.tsx`, page test; `src/app/client-import-graph.test.ts` only to include new leaf if necessary.

- [ ] Test server-rendered profile/name/actions remain in HTML; intro absent on SSR/no-JS, reduced-motion and repeated session. Positively assert first eligible client mount renders the required wordmark/symbol intro. Storage failure still renders it with an in-memory seen flag (full reload may replay). First client mount uses only a decorative nonblocking layer; cleanup removes timers/listeners. No token/account/code in storage key/value. Skip unavailable/preview/contact paths.

```tsx
expect(renderToStaticMarkup(<AvailableProfileFixture />)).toContain('Synthetic Person');
expect(screen.getByText('Synthetic Person')).toBeTruthy();
expect(intro.getAttribute('aria-hidden')).toBe('true');
expect(storageWrites).toEqual([['neffi:profile-intro-seen:v1', 'true']]);
```

- [ ] Red: intro/page tests. Use fake timers to prove removal within one second and no replay, without brittle exact-animation-millisecond assertions.
- [ ] Add a tiny client sibling, not a client wrapper importing renderer/data/config. SSR profile stays accessible/interactable; fixed pointer-transparent decorative overlay, no `inert`, no hidden main tree, no server sleep/data waterfall. Test late hydration/missing performance entries retain the required intro without delaying or hiding the SSR profile; no general late-hydration deletion rule. CSS respects reduced motion; total duration 700–850ms and bounded by one second. Keep cached Scene/fresh Card split unchanged.
- [ ] Green intro/public/privacy tests, typecheck/build/bundle and existing performance/security contracts. In later manual review, inspect actual LCP/CLS and low-end device behavior; shorten duration if necessary without deleting the approved feature or delaying usefulness. Do not claim synthetic timers measure production performance.

### Task 16: Reconcile current docs and verify the whole release candidate

**Modify current sources:** `PRODUCT.md`; `docs/specs/{cards-and-activation,orders-and-fulfillment,money-and-costs,accounts-and-access,support-and-corrections,profiles-and-public-card,marketing-pages}.md`; `docs/architecture/{system,domain-model,customer-ui}.md`; `docs/README.md`; `src/modules/README.md`; `docs/operations.md`; generated `docs/database/erd.md`; `docs/legal/privacy-terms-operations-audit.md`; `docs/testing/prelaunch-human-operations-acceptance.md`, `prelaunch-physical-acceptance.md`.

**Create:** `docs/architecture/owner-operations-ui.md`, `docs/decisions/0016-owner-operations-and-retrievable-credentials.md` (advance number if taken).

**Annotate:** `docs/decisions/0005-activation-credentials.md`; dated audit evidence with successor note only; roadmap gates only after actual evidence. Inspect public Privacy/Terms and existing shipping-payment marketing statements; narrowly correct contradictions identified in design §9.

- [ ] Perform semantic searches before doc edits:

```powershell
rg -n 'HMAC.only|shown once|revealed once|never stored|cash|Paid now|agreed|negotiated|pickup|local.handoff|hand.over|before payment' PRODUCT.md docs/specs docs/architecture docs/operations.md docs/legal src/modules/README.md
rg -n 'usedAt:|revokedAt:|encryptedCode|activationCode|lookupHmac' src scripts
rg -n "reserved.*released|state ===|state !==|state IN|cardState" src scripts
```

- [ ] Distinguish accurate history from current instructions; do not globally replace Cash/handovers or erase historical plans. Add decryptable-copy/key/backup limits and legacy adoption rollout instructions, revised payment/shipping steps, phone workflow and real physical acceptance expectations.
- [ ] Add end-to-end synthetic DB lifecycle test `src/modules/orders/owner-operations-lifecycle.db.test.ts`: receive 50 → paid Order → Preparing → confirm real-test fixture NFC/package → Reserved → In person/J&T release → HMAC claim → code ciphertext null → Account ownership/public resolver behavior. Verify 49 available stock for one DBC, correct money/event counts and parity. J&T adds exactly one shipping receipt using the persisted method during Mark as shipped, ends with zero balance/Completed and no later owner payment action; In person keeps only the product receipt. Cover zero shipping, Ready-first skipping, and no physical inventory labeling or technical-state manipulation. It is not a physical acceptance claim.

```ts
expect(stockCounts.availableBlank).toBe(49);
expect(finalCard.ownerAccountId).toBe(customer.id);
expect(usedCredential.encryptedCode).toBeNull();
expect(finalItem.unitPrice).toBe(79_900);
expect(nfcUrl).toBe(sharingQrUrl);
expect(packageUrl).toBe('https://getneffi.com/activate');
```

- [ ] Red→green lifecycle test; run all six loopback concurrency suites after adapting synthetic key configuration and new allocation cases. Do not delete old race assertions. Add `scripts/check-owner-operations-migrations.mts` only if existing migration/concurrency harnesses cannot express 0018-upgrade rehearsal; prefer extending `check-orders-concurrency.mts` rather than adding a new framework.
- [ ] Run the exact complete validation block below on the actual candidate. Capture commands/results and any environment failures; do not claim pass from this plan.
- [ ] Review final diff/security exposure, all current docs, migration SQL/journal, and rendered/keyboard/mobile behavior in later authorized manual QA. Stop for review before any provider/Production action. Shipping requires a separate protected-main request and restore/config verification.

## Complete future validation commands

Use Node 24 and `corepack pnpm` (repository packageManager pnpm 11.9.0). Initial install:

```powershell
corepack pnpm install --frozen-lockfile
```

PGlite tests need no live DB. Drizzle config still parses isolation-checked env, even for generate/check; build needs all server configuration. Use the synthetic environment pattern in `.github/workflows/ci.yml`, extended by Task 2, or an isolated reviewed Development environment. Never pull Production env into a file. Existing `.env.local` is loaded by Next/Drizzle/bundle scripts: inspect names/target safely and ensure it cannot override the intended synthetic/disposable environment; do not print or overwrite its values. A clean implementation worktree with no `.env.local` is preferred for CI-parity checks.

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm db:check
corepack pnpm db:generate
git diff --exit-code -- drizzle
corepack pnpm db:erd
git diff --exit-code -- docs/database/erd.md
corepack pnpm build
corepack pnpm check:bundle
git diff --check
```

`git diff --exit-code -- drizzle` and generated ERD no-drift checks run after intended generated changes have been reviewed and included in the candidate checkpoint; otherwise they correctly show the intended unstaged work. No-drift is not permission to discard generated files. For uncommitted implementation verification, compare regeneration against a saved before-generation hash, then review intended generated diff.

Real PostgreSQL races/migration rehearsal (explicit disposable target, never Neon; scripts refuse Neon/host overrides):

```powershell
$env:DATABASE_URL_TEST = 'postgresql://postgres@127.0.0.1:55432/neffi_m2_test'
corepack pnpm check:db-concurrency
corepack pnpm check:provisioning-concurrency
corepack pnpm check:claim-concurrency
corepack pnpm check:profile-concurrency
corepack pnpm check:orders-concurrency
corepack pnpm check:support-concurrency
Remove-Item Env:DATABASE_URL_TEST
```

Run sequentially because the scripts modify the same disposable schema/data. Check actual port/database and server's Neon marker before any migration/fixture insert. Never relax loopback guards or load `.env.local` into these scripts. Use their canonical migrator for rehearsal; never run seed to produce validation evidence. An unavailable loopback server is a blocker to concurrency proof, not grounds to substitute Production or weaken tests.

Relevant security regression selection (full suite already includes these):

```powershell
corepack pnpm test -- src/server-only-boundary.test.ts src/app/client-import-graph.test.ts src/app/access-sweep.test.ts src/auth/policy.test.ts src/auth/access.test.ts src/config/isolation.test.ts src/config/security-headers.test.ts src/lib/sentry-scrub.test.ts
```

`scripts/check-public-http.mts` is the existing optional read-only local HTTP helper; inspect its inputs and local server target before use. Do not invent an E2E script or run real Google/NFC/Cloudinary/provisioning acceptance automatically. No new Playwright dependency is required. Do not claim physical or Production behavior from unit tests/build.

## Requirement-to-task review matrix

| Acceptance | Tasks / evidence |
| --- | --- |
| OWNER Admin discoverability, non-owner denial, safe phone auth return | 9, 11; auth/access/nav/action tests |
| Fixed ₱799, approved methods, no normal Paid/price override | 1, 5, 10; schema/strict action/domain/UI tests |
| Receive 50, allocate automatically, Ready first, no duplicate allocation | 6, 7, 12, 16; stock/lifecycle DB + real races |
| Preparation exact read-back/package, no physical inventory label, one card at a time, order-aware locks/cancel/retire | 7, 11; DB guards/services + races |
| In person and atomic J&T collection/receipt/release, tracking, later fee, exact totals; no extra payment action | 5, 8, 10; money/fulfillment DB/UI + races |
| OWNER-only retrieval, no public/customer exposure, clear claim/revoke/replace | 2–4, 7, 11; crypto/DB/auth/bundle/race tests |
| Legacy data and HMAC code handling, stable concurrent number | 1, 4, 6; upgrade/sequence/adoption tests |
| Safe phone QR, exact Sharing/NFC parity, common Package QR | 7, 11, 16; QR input, services and lifecycle tests |
| Customer authenticated preview/actions | 13; ownership/scene/route tests |
| Calm accepted UI, generic unavailable, required first-view intro/no-JS/reduced motion/storage fallback | 14–15; route/privacy/timer/boundary tests, later manual performance check |
| Current docs, complete validation, existing race coverage retained | 16 and full validation block |

## Normal-workflow simplicity gate

- In person: Create paid order → automatic allocation → Prepare card → Confirm NFC test → Confirm package → Give card to customer → Waiting for activation → Activated.
- J&T: Create paid order → automatic allocation → Prepare card → Confirm NFC test → Confirm package → enter/confirm recipient, fee, tracking and shipped date → Mark as shipped (collection + shipment + release) → Waiting for activation → Activated. Address/fee may be saved earlier; no extra payment action.
- Receive 50 untouched cards once. One Facebook order uses Ready stock first or allocates one untouched card; with only blanks initially, 49 remain available. Write the allocated permanent URL, keep that card through preparation and package matching. No physical N-XXXX label, card picker or internal-state manipulation. Ready stock skips checks already completed.
- One obvious primary action at each meaningful step. Copy, reveal and Continue on phone are secondary tools. History/corrections stay secondary; internal commercial Completed is not another owner action and does not wait for activation. The public intro is a required release acceptance item.

## Review / stop condition

This plan and its design must be reviewed before execution. The design intentionally calls out unrecoverable legacy HMAC-only codes, pending shipping and atomic collection-at-dispatch semantics, canceled provisioned stock and enum migration transaction behavior; none may be hidden behind a cosmetic UI change. No implementation or Production action is performed by preparing these documents.
