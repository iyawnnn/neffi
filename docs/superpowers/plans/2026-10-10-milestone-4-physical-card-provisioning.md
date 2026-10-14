# Neffi Milestone 4 — Physical Card Provisioning Plan
> **Historical implementation plan — implemented and merged. This is not the current specification.** Current behavior is in [PRODUCT.md](../../../PRODUCT.md) and [docs/README.md](../../README.md). Where this plan disagrees with them, they win. The Google Review Card order-fulfilment lifecycle described here (Card reservation, NFC verification, release) was superseded by [decision 0006](../../decisions/0006-grc-simple-commercial-line.md).

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]`. No worktree. Branch `feat/m4-provisioning`, created only after explicit authorization.

**Goal:** OWNER can take in minimal stock as tracked Blank cards, provision a DBC (permanent random token plus initial Activation Credential, then a recorded physical NFC check, then a verified package match, then Ready), replace a lost pre-release credential, reserve, encode and test a GRC against an existing eligible Order Item, and retire a failed card. A real NFC hardware gate must pass before M4 is complete.

**Architecture:** Server-only domain services in `src/modules/{inventory,cards,activation,activity}` take a Drizzle `db` (the same pattern as `src/modules/accounts/set-role.ts`). Every service runs one PostgreSQL transaction that locks the card row first. OWNER Server Actions under `/admin/inventory` call the services after `authorize("owner")` and Zod validation. One forward migration adds two check timestamps, a NOT VALID "Ready needs checks" CHECK, and a guard change so that issuing a credential invalidates any earlier package match.

**Tech stack:** existing only (Next.js 16.4 with `cacheComponents`, React 19.3, Drizzle 0.45, Zod 4, PGlite tests, `node:crypto`). No new dependency, no Web NFC, no `/c/{token}` route.

**Spec (read 2026-10-10 via Notion MCP):** AI Build Handoff, Locked Plan, Step 3, 4, 5, 6, 7, 8 (including the *Milestone 4 Sequencing & Boundary Clarifications — Locked*), Step 9. Precedence: Locked Plan, then Step 7, Step 8, Step 9, then earlier Steps.

---

## 1. Reconciliation findings

**Repository (`main` @ `e37cc74`, clean):**
- Migrations `0000`–`0008`. CI runs lint, typecheck, test, `db:check`, generate drift, build and `check:bundle`.
- `cards` has `state` (`blank|ready|reserved|released|retired`), optional `product_id`/`kind`, `order_item_id`, unique `public_token`, and DBC-only owner/profile/disabled columns. Existing CHECKs already enforce:
  - a token whenever a DBC is ready, reserved or released;
  - an order item whenever a card is reserved or released;
  - no order item on blank or ready cards;
  - GRC is never Ready;
  - owner only after sale;
  - DBC-only fields.
- `cards_guard` (0005): the token is permanent; released only moves to retired; retired is final; retiring requires revoking the usable credential first; only blank cards can be deleted.
- `activation_credentials`: `lookup_hmac` is 64-hex and unique. At most one usable credential per card (partial unique index). DBC only. `activation_credentials_guard` (0006) blocks a usable insert on a retired card, serializes the insert with retirement through a no-op card write, and keeps history immutable and undeletable.
- `stock_purchases` already holds supplier, `received_on`, nullable costs, reference, notes and `created_by`. `activity_events` is append-only, has explicit subject FKs, and takes `type` as free text ("validated in the activity module", but that module doesn't exist yet).
- `order_items` carries `label` and `review_url` (https and GRC only). **No schema change is needed for the stock → card relationship or for GRC destinations.**
- **There is nowhere to record the physical checks.** Ready is currently reachable with records alone, so Task 1 closes that gap.
- Auth: `requireOwner()` for pages and `authorize("owner")` for actions (`src/auth/access.ts`). The admin shell is `src/app/admin/{layout,page}.tsx` with `instant = false`. The only UI primitive is `src/components/ui/button.tsx`.
- Reusable pieces:
  - `hmacHex(secret, domain, value)` (`src/auth/otp-quota.ts`)
  - `createTestDb`/`rollback`/`expectPgError` (`src/db/testing.ts`)
  - fixtures (`src/db/test-fixtures.ts`)
  - the loopback two-session harness (`scripts/check-credential-concurrency.mjs`)
  - the `react-server` + tsx operator pattern (`accounts:set-role`)
  - the server-only boundary test (`src/server-only-boundary.test.ts`)
  - the secret scan (`scripts/check-client-bundle.mjs`)
- The seed (`src/db/seed.ts`) has `cardReadyDbc` (ready, usable credential, no physical evidence; Task 1 turns it into the valid In-provisioning form rather than inventing evidence), a GRC item `itemInProgressGrc` (qty 2, review URL, in-progress order, both units already released), `cardBlank` (uncommitted) and `cardBlankGrc`, plus one DBC and one GRC product.
- `.env.example` already anticipates an "activation-credential HMAC key".

**Notion vs. repo:** they agree. Step 5's "see the activation credential" is narrowed by Step 8's later locked clarification to a one-time OWNER reveal, with HMAC-only persistence. That is what this plan follows.

**Flowchart:** `docs/architecture/neffi-system-flow.drawio` **does not exist** in the repo or its git history. Only older `tapcard-main-system-flow*.drawio` files are in Downloads. I did not substitute them, and they're informative only. No conflict can be assessed.

**Decisions confirmed with you:**
- The card URL origin is configuration (`CARD_URL_ORIGIN`). M4/dev hardware cards are engineering test units and are never sellable. The final NFC domain must be locked, and `CARD_URL_ORIGIN` switched to it, before any pilot or commercial DBC is provisioned.
- M4 includes a narrow OWNER retire. A retired Reserved GRC must leave its Order Item able to take a replacement, while preserving history.

**Implementation decisions (not locked in Notion; documented in the README):**
- Card token (required by you): 26 Crockford-Base32 characters (130 bits; uppercase; no I/L/O/U). NFC URL length doesn't constrain this. There is no DB format CHECK on `public_token`, so existing synthetic seed/fixture tokens stay valid; the format is enforced by `generateCardToken`, the only issuer.
- Activation code: 16 Crockford-Base32 characters (80 bits), shown as `XXXX-XXXX-XXXX-XXXX`. Input normalizes case, spaces and hyphens, and maps O→0 and I/L→1.
- Lookup is `hmacHex(ACTIVATION_CODE_SECRET, "activation", normalizedCode)`, so it matches the existing 64-hex CHECK.
- The "In provisioning" label is *derived* from a blank DBC with a token. **No new card state** (Step 3: don't invent statuses).
- Stock intake captures no costs. The cost columns stay null and M8 owns cost entry (Step 8 lists inventory-cost as not pulled forward).

## 2. M4 scope

**In:**
1. Minimal stock intake: received date, quantity (1–500), and optional supplier, reference, notes and intended product kind. It creates one `stock_purchases` row plus N blank `cards` and logs `stock_received`.
2. DBC provisioning: Blank, then token plus initial credential (one-time code reveal), then a recorded NFC check (exact URI read back, real phone tap opened the exact URI, tag left writable), then a package match, then Ready.
   - **`package_matched_at` means:** the OWNER verified that the private activation credential physically packaged with this DBC matches this Card. They re-enter the code from the physical package on that Card's page, and the server compares its HMAC with the Card's current usable credential.
   - M4 physical packing uses a common activation insert containing the static `/activate` QR plus a unique printed activation-code label matched to the exact Card, inside the sealed package. The QR is common, not Card-specific, and never contains the code. No QR-generation feature is needed in M4; the working `/activate` validation/claim experience remains **M5**, and the package match does not depend on a working activation route.
3. Pre-release credential replacement for an unclaimed DBC (Blank-with-token or Ready): revoke the expected usable credential, issue a new one, demote Ready to Blank, require a re-match, and log an Activity Event. It never restores anything.
4. GRC: reserve a Blank GRC (or an uncommitted card) against an existing eligible GRC Order Item, then record the encode/test check against the item's current `review_url`.
5. Narrow retire for Blank, Ready or Reserved-GRC cards. It revokes any usable credential, keeps `order_item_id` as history, and frees item capacity.
6. Minimal OWNER UI: `/admin/inventory` (derived counts, intake form, paginated card list) and `/admin/inventory/cards/[cardId]` (state, URL, check timestamps, credential status, recent activity, contextual actions).
7. Activity Events, a migration, docs/ERD, the automated suite, the loopback concurrency check, the live dev-Neon gate, and the physical hardware gate.

**Out (explicit deferrals):**
- **M5:** the working `/activate` experience, code validation, challenge, auth handoff, atomic claim and consumption, resumability, and activation rate limits. The common physical activation insert/QR is used during M4 packing.
- **M6:** Profiles, Card→Profile routing, disable/re-enable.
- **M7:** the `/c/{token}` resolver and every public state. **No stub route in M4**: no locked source requires one, and the tap test only verifies that the phone attempts the exact URI.
- **M8:**
  - Orders, Order Item creation and editing (including setting or changing `review_url`), pricing, payments, purchasers, shipments, fulfillment, Released transitions, cancellation;
  - full Stock Purchases UI, cost entry, expenses, dashboard;
  - Products/Settings;
  - reserving DBCs;
  - release must require `package_matched_at` (DBC) and `nfc_verified_at` (GRC); changing a `review_url` must clear `nfc_verified_at` on its reserved cards;
  - credential replacement on a Reserved DBC.
- **M9:** customer lost-code, wrong-account and recovery workflows; Support Cases; any action on Released cards.
- **M10:** OWNER MFA/step-up, an `ACTIVATION_CODE_SECRET` rotation procedure, `VALIDATE CONSTRAINT cards_dbc_ready_checks_recorded` once legacy rows are gone, CSP.

## 3. Schema / migration impact

`drizzle/0009_card_provisioning.sql` (generated, then hand-reviewed; forward-only):
- `ALTER TABLE cards ADD COLUMN nfc_verified_at timestamptz, ADD COLUMN package_matched_at timestamptz;`
- `cards_dbc_ready_checks_recorded CHECK (kind IS DISTINCT FROM 'dbc' OR state <> 'ready' OR (nfc_verified_at IS NOT NULL AND package_matched_at IS NOT NULL)) NOT VALID`.
  - Hand-add `NOT VALID`, with a comment. The live `neffi-dev` still holds the pre-M4 seeded Ready row, which has no physical evidence. That row is **not** backfilled with fabricated timestamps. Every new or updated row is still checked, a fresh database is fully covered, an approved reseed turns the row into the In-provisioning form, and M10 validates.
- `CREATE OR REPLACE FUNCTION activation_credentials_guard()`: the usable-insert branch changes from `UPDATE cards SET updated_at = updated_at …` to `UPDATE cards SET package_matched_at = NULL …` (still `RETURNING state`, still the serializing row write, `updated_at` still untouched). Effect: **any newly issued usable credential invalidates the earlier package match at the database level**. On a Ready DBC the CHECK then rejects the insert, so callers must demote first. Retire-vs-issue serialization (0006) is preserved, and `check:db-concurrency` re-proves it.
- No new tables, enums or indexes. Existing indexes cover the access paths: `cards_kind_state_idx`, `cards_order_item_id_idx`, `cards_stock_purchase_id_idx`, `activity_events_card_id_idx`, unique token/lookup.
- Drift: the snapshot tracks the columns and CHECK expression; `NOT VALID` and the function body are SQL-only, as in 0005/0006. `pnpm db:generate && git diff --exit-code drizzle` must stay clean.

## 4. File map

| File | Responsibility |
|---|---|
| `src/db/schema/inventory.ts` (mod) | two columns + CHECK |
| `drizzle/0009_card_provisioning.sql`, `drizzle/meta/*` (new) | migration |
| `src/db/test-fixtures.ts` (mod) | the isolated-test `insertReadyDbc` fixture carries synthetic check timestamps (tests only) |
| `src/db/seed.ts`, `src/db/seed.db.test.ts` (mod) | seeded DBC becomes In-provisioning (blank + token, no evidence); controlled free-capacity GRC item |
| `src/db/cards.db.test.ts`, `src/db/credentials.db.test.ts`, `src/db/erd.db.test.ts` (mod) | invariant tests |
| `docs/database/erd.md` (regen) | ERD |
| `src/config/env-schema.ts` (+test) (mod) | `activationCodeSecret`, `cardUrlOrigin` |
| `.env.example`, `.github/workflows/ci.yml`, `scripts/check-client-bundle.mjs` (mod) | env names, CI dummies, secret scan |
| `src/modules/activation/code.ts` (+`code.test.ts`) (new, pure) | generate/normalize/format/lookup |
| `src/modules/activation/credentials.ts` (new, server-only) | issue/revoke/read usable credential inside a tx |
| `src/modules/cards/token.ts` (+`token.test.ts`) (new, pure) | token generation, `cardUrl` |
| `src/modules/activity/record.ts` (new, server-only) | `ActivityType` union + `recordActivity` |
| `src/modules/cards/card.ts` (new, server-only) | `CardError`, `lockCard`, `activeProductId`, `recordNfcCheck`, `retireCard` |
| `src/modules/cards/dbc.ts` (new, server-only) | `provisionDbc`, `matchPackage`, `replaceProvisioningCredential` |
| `src/modules/cards/grc.ts` (new, server-only) | `reserveGrc`, `eligibleGrcItems` |
| `src/modules/inventory/stock-intake.ts` (new, server-only) | `receiveStock` |
| `src/modules/inventory/queries.ts` (new, server-only) | `cardStateCounts`, `listCards`, `getCardDetail` DTO reads |
| `src/modules/**/*.db.test.ts` (new) | service TDD on PGlite |
| `scripts/check-provisioning-concurrency.ts` (new) + `package.json` script | loopback lock-discipline/capacity check |
| `src/app/admin/inventory/actions.ts` (+`actions.test.ts`) (new) | OWNER Server Actions |
| `src/app/admin/inventory/page.tsx`, `.../cards/[cardId]/page.tsx`, `.../forms.tsx` (new); `src/app/admin/page.tsx` (mod) | minimal UI |
| `src/server-only-boundary.test.ts`, `README.md`, `src/modules/README.md` (mod) | boundary list, runbook, module docs |

## 5. Interfaces (produced → consumed)

```ts
// activation/code.ts (pure)
generateActivationCode(): string                 // 16 normalized chars
formatActivationCode(code: string): string       // XXXX-XXXX-XXXX-XXXX
normalizeActivationCode(input: string): string | null
activationLookup(secret: string, normalized: string): string // 64 hex
// activation/credentials.ts (server-only; tx = Drizzle transaction)
issueActivationCredential(tx, cardId, secret): Promise<{ credentialId: string; code: string }>
usableCredential(tx, cardId): Promise<{ id: string; lookupHmac: string; createdAt: Date } | null>
revokeUsableCredential(tx, cardId, expectedId?: string): Promise<string | null> // conditional UPDATE … RETURNING id
// cards/token.ts (pure)
generateCardToken(): string                      // 26 Crockford chars (130 bits)
cardUrl(origin: string, token: string): string   // `${origin}/c/${token}`, origin has no path
// activity/record.ts
type ActivityType = "stock_received" | "card_provisioned" | "card_nfc_verified" | "card_ready"
  | "activation_credential_replaced" | "card_reserved" | "card_retired"
  | /* existing */ "account_role_changed" | "order_created" | "card_released" | "card_claimed" | "support_case_resolved" | "note";
recordActivity(tx, e: { type: ActivityType; actorAccountId: string; cardId?; orderId?; stockPurchaseId?; note? }): Promise<void>
// cards/card.ts
class CardError extends Error { code: "not_found" | "wrong_state" | "already_provisioned" | "credential_changed"
  | "code_mismatch" | "no_product" | "item_ineligible" | "item_full" | "checks_incomplete" | "uri_mismatch" }
lockCard(tx, cardId)              // SELECT … FOR UPDATE; throws not_found
activeProductId(tx, kind)         // exactly one active product of kind, else no_product
recordNfcCheck(db, { actorId, cardId, cardUrlOrigin, readBackUri, readBackMatched, phoneOpenedUri, tagLeftWritable, device? }): Promise<void>
retireCard(db, { actorId, cardId, reason }): Promise<void>
// cards/dbc.ts
provisionDbc(db, { actorId, cardId, activationSecret }): Promise<{ publicToken: string; credentialId: string; activationCode: string }>
matchPackage(db, { actorId, cardId, activationCode, activationSecret }): Promise<void>
replaceProvisioningCredential(db, { actorId, cardId, credentialId, reason, activationSecret }): Promise<{ credentialId: string; activationCode: string }>
// cards/grc.ts
eligibleGrcItems(db): Promise<{ orderItemId; orderNumber; label; reviewUrl; remaining }[]>
reserveGrc(db, { actorId, cardId, orderItemId }): Promise<void>
// inventory
receiveStock(db, { actorId, receivedOn, quantity, supplier?, reference?, notes?, intendedKind? }): Promise<{ stockPurchaseId: string }>
cardStateCounts(db); listCards(db, { before?: { createdAt; id }, limit }); getCardDetail(db, cardId)
// actions.ts: (prev, FormData) => Promise<{ error?: string; reveal?: { url: string; code: string } }>
```

**Transaction and concurrency rules:**
- Every card mutation runs `db.transaction`, starts with `lockCard`, and re-reads state under the lock. `reserveGrc` locks in the order *order item, then card* (`SELECT … FROM order_items JOIN orders … FOR UPDATE OF order_items`); nothing locks in the reverse order.
- Default READ COMMITTED, so no 40001 retry is needed. Idempotency comes from state checks under the lock plus conditional updates:
  - a second `provisionDbc` → `already_provisioned` (raw code never re-shown);
  - a stale `credentialId` → `credential_changed`;
  - the partial unique index and the permanent-token guard back these up.
- Eligible GRC item: order `in_progress`, item `product_kind='grc'`, `review_url IS NOT NULL`, and `count(cards in reserved|released for item) < quantity`. Retired cards don't count, so a retired failed reservation keeps its `order_item_id` as history and frees one slot.

## Global constraints

- Raw activation codes never land in the DB, Activity notes, logs, errors, URLs, Sentry, `localStorage` or `sessionStorage`. They appear only in the provision/replace action's return value and are rendered once by a Client Component.
- Every action calls `authorize("owner")` before parsing; every page calls `requireOwner()`. `/admin` stays `noindex` and dynamic.
- Client Components get minimal DTOs only: ids, token, URL, labels, timestamps.
- DBC and GRC stay distinct: a GRC never gets a token, credential, owner or profile (DB CHECKs plus service checks).
- Never record an NFC check or package match on any database without the real physical check having happened (this includes `neffi-dev` during software-only verification). Synthetic `nfc_verified_at`/`package_matched_at` values may appear **only** in isolated automated test fixtures (`src/db/test-fixtures.ts`, PGlite tests, the loopback concurrency script). They never appear in `src/db/seed.ts` or on `neffi-dev`.
- No Neon, Vercel, GitHub, Notion or Production changes without the explicit gate approval below.

## Review focus (each pinned by a test in its owning task)

1. Owner double-clicks Provision or loses the response. The second call returns `already_provisioned` without a new credential, and recovery goes through Replace (Task 4).
2. The package code is typed in lowercase, with spaces or hyphens, or with O/I/L. It normalizes and matches, while a wrong code returns `code_mismatch` and records nothing (Tasks 2, 4).
3. `CARD_URL_ORIGIN` has a trailing slash or path. Env validation rejects the path, and `cardUrl` returns the exact `origin/c/TOKEN`. A read-back URI pasted with surrounding whitespace is trimmed and otherwise compared exactly (Tasks 2, 4).
4. Two owners act on the same card or the last GRC slot at once. They serialize, and exactly one wins (Task 6).
5. A GRC item is cancelled, or its `review_url` changes, between reservation and the encode test. `recordNfcCheck` re-checks eligibility and compares against the *current* URL (Task 5).

---

## Tasks

### Task 1 — Provisioning-check columns, Ready gate, credential-invalidates-match guard
**Files:** `src/db/schema/inventory.ts`, `drizzle/0009_card_provisioning.sql` + meta, `src/db/test-fixtures.ts`, `src/db/seed.ts`, `src/db/cards.db.test.ts`, `src/db/credentials.db.test.ts`, `src/db/erd.db.test.ts`, `docs/database/erd.md`.
**Produces:** `cards.nfcVerifiedAt`, `cards.packageMatchedAt`; constraint `cards_dbc_ready_checks_recorded`.
- [ ] RED (add to the existing db tests; assert code and constraint via `expectPgError`):
  - a Ready DBC missing either timestamp → `23514 cards_dbc_ready_checks_recorded`;
  - a GRC or blank DBC without timestamps is accepted;
  - inserting a usable credential on a blank DBC clears `package_matched_at` and leaves `updated_at` unchanged;
  - inserting a usable credential on a Ready DBC → `23514`;
  - inserting a revoked/used credential leaves `package_matched_at` intact;
  - retirement-before-issue still raises `P0001`.
- [ ] Run `pnpm vitest run src/db` → new tests fail.
- [ ] GREEN: edit the schema, run `pnpm db:generate --name=card_provisioning`, hand-add `NOT VALID` plus a comment, and append the `CREATE OR REPLACE FUNCTION activation_credentials_guard()` (keep 0006's comments/semantics, with `--> statement-breakpoint`). The isolated-test fixture `insertReadyDbc` sets both timestamps to synthetic values (tests only).
- [ ] Seed (no fabricated physical evidence): change the seeded DBC to the valid In-provisioning form. Set `state: "blank"`, keep `publicToken: "SEEDDBC00001"` and its revoked plus usable credentials, leave both check timestamps null, and rename the key `cardReadyDbc` → `cardProvisioningDbc` (update references). The seed then contains no Ready DBC; Ready arises only through a real physical provisioning run.
- [ ] Seed: add a controlled GRC item with free capacity, `itemInProgressGrcB` (order `orderInProgress`, label "Branch B", qty 1, synthetic `https://g.page/r/synthetic-branch-b/review`). Today's only seed GRC item already has both units released, so nothing could be reserved. Update `seed.db.test.ts` counts/IDs, and add a seed test asserting that no seeded card has `nfc_verified_at` or `package_matched_at` set.
- [ ] `pnpm vitest run src/db` → all green (existing tests unchanged apart from the fixture). Then run `pnpm db:erd`, `pnpm db:check`, and `pnpm db:generate && git diff --exit-code drizzle`. Add the new constraint name to `erd.db.test.ts`.
- [ ] Commit `feat(db): record provisioning checks and gate DBC Ready`.

### Task 2 — Config and pure code/token helpers
**Files:** `src/config/env-schema.ts` (+test), `.env.example`, `.github/workflows/ci.yml`, `scripts/check-client-bundle.mjs`, `src/modules/activation/code.ts` (+test), `src/modules/cards/token.ts` (+test).
**Produces:** `env.activationCodeSecret`, `env.cardUrlOrigin`, plus the pure helpers in §5.
- [ ] RED tests:
  - `ACTIVATION_CODE_SECRET` missing or <32 chars → error naming the variable without echoing its value;
  - `CARD_URL_ORIGIN` must be a URL whose `pathname === "/"` with no query/hash, normalized without the trailing slash, and https in preview/production;
  - code: length 16, alphabet only, 1,000 generated codes are unique; `normalize("abcd-efgh ijkm-np0q")` matches the uppercase form; O/I/L map to 0/1/1; invalid → `null`; `format` groups 4×4; `activationLookup` is 64-hex, deterministic, differs per secret, and equals `hmacHex(secret,"activation",code)`;
  - token: length 26, Crockford alphabet only, 1,000 generated tokens are unique; `cardUrl("https://x.test","AB")` → `https://x.test/c/AB`.
- [ ] GREEN: implement using `crypto.randomInt(32)` per character and reusing `hmacHex` from `src/auth/otp-quota.ts`. Add CI dummies (distinctive ≥8 chars) and add `ACTIVATION_CODE_SECRET` to `SECRET_VARS`.
- [ ] `pnpm vitest run src/config src/modules`, `pnpm typecheck` → green. Commit `feat(cards): activation code and card token primitives`.

### Task 3 — Activity recorder and minimal stock intake
**Files:** `src/modules/activity/record.ts`, `src/modules/cards/card.ts` (`CardError`, `lockCard`, `activeProductId` only), `src/modules/inventory/stock-intake.ts` (+`stock-intake.db.test.ts`).
**Consumes:** schema. **Produces:** `recordActivity`, `CardError`, `lockCard`, `activeProductId`, `receiveStock`.
- [ ] RED (PGlite, `rollback`):
  - `receiveStock` with qty 3 creates 1 stock purchase and 3 blank cards linked to it (costs null), plus one `stock_received` event with note `3 cards`;
  - `intendedKind:"dbc"` commits the cards to the single active DBC product;
  - zero or two active products of that kind → `no_product` and no rows;
  - qty 0 or 501 is rejected before any write.
- [ ] GREEN: one transaction, a multi-row insert.
- [ ] `pnpm vitest run src/modules/inventory` green. Commit `feat(inventory): minimal stock intake`.

### Task 4 — DBC provisioning lifecycle (TDD core)
**Files:** `src/modules/activation/credentials.ts`, `src/modules/cards/dbc.ts`, `src/modules/cards/card.ts` (`recordNfcCheck`, DBC branch), `src/modules/cards/dbc.db.test.ts`.
**Consumes:** Tasks 1–3. **Produces:** `provisionDbc`, `recordNfcCheck`, `matchPackage`, `replaceProvisioningCredential`.
- [ ] RED tests:
  - *provision:* a blank uncommitted card gets the product, `kind=dbc`, a 26-char Crockford token, exactly one usable credential with `lookup = activationLookup(secret, code)`, and a `card_provisioned` event (with token, no code). The card stays `blank`, and the returned code normalizes to 16 characters.
  - *idempotency/lost response:* a second `provisionDbc` → `already_provisioned`, with credential count unchanged. A GRC-committed, retired, reserved or ready card → `wrong_state`.
  - *secrecy:* after provision and replace, `to_jsonb` of every row in `cards`, `activation_credentials` and `activity_events` contains neither the formatted nor the normalized code.
  - *NFC check:* the expected URI is `cardUrl(origin, token)`; the read-back is trimmed then compared exactly (else `uri_mismatch`). Any unconfirmed checkbox → `checks_incomplete`. It requires a blank DBC with a token. It sets `nfc_verified_at` and logs `card_nfc_verified` (note: read-back URI, "tap opened", "left writable", device).
  - *package match* (the OWNER confirms that the private credential physically packaged with this DBC matches this Card; no `/activate` involvement): without an NFC check → `checks_incomplete`. A wrong code → `code_mismatch` with no state change. The right code (lowercase/hyphenated) → `ready`, `package_matched_at` set, `card_ready` event.
  - *replace:* on a Ready card it demotes to blank, revokes exactly the expected credential, issues a new one, and clears the match (via the trigger) while keeping `nfc_verified_at`. It logs `activation_credential_replaced` with the reason. The old code now fails `matchPackage` and the new one succeeds. A stale or unknown `credentialId` → `credential_changed`. A released/retired card → `wrong_state`. A revoked or used credential never becomes usable again.
- [ ] Run → fail. GREEN: implement. Every service: `transaction` → `lockCard` → state checks → conditional writes → `recordActivity`.
- [ ] `pnpm vitest run src/modules` green. Commit `feat(cards): DBC provisioning, package match and pre-release credential replacement`.

### Task 5 — GRC reserve and encode test, and narrow retire
**Files:** `src/modules/cards/grc.ts`, `src/modules/cards/card.ts` (`recordNfcCheck` GRC branch, `retireCard`), `src/modules/cards/grc.db.test.ts`, `src/modules/cards/retire.db.test.ts`.
**Produces:** `eligibleGrcItems`, `reserveGrc`, `retireCard`.
- [ ] RED tests:
  - *reserve:* a blank uncommitted or GRC card plus an eligible item → `reserved`, product = item's product, `kind=grc`, `card_reserved` event with `orderId`.
  - Ineligible cases → `item_ineligible` with no write: DBC item, cancelled/completed order, null `review_url`.
  - Capacity: qty 1 with one reserved → `item_full`. A DBC-committed, provisioned or non-blank card → `wrong_state`.
  - The GRC still has no token/credential (a credential insert is rejected by the existing CHECK/FK).
  - `eligibleGrcItems` lists only eligible items with the correct `remaining`.
  - *encode test:* the expected URI is the item's *current* `review_url`; it re-checks that the order is still `in_progress` (else `item_ineligible`); sets `nfc_verified_at`; logs a `card_nfc_verified` event with `orderId`.
  - *retire:* works on blank, ready (revokes the usable credential in the same tx) and reserved GRC (keeps `order_item_id`, and the item's `remaining` goes back up so another blank GRC can be reserved). Each logs `card_retired` with the reason (plus `orderId` if reserved). Released/retired → `wrong_state`. Credential history rows survive.
- [ ] GREEN, then `pnpm vitest run src/modules` green. Commit `feat(cards): GRC reservation/encode test and pre-release retirement`.

### Task 6 — Real PostgreSQL lock-discipline and capacity check
**Files:** `scripts/check-provisioning-concurrency.ts`, `package.json` (`"check:provisioning-concurrency": "node --conditions=react-server --import tsx scripts/check-provisioning-concurrency.ts"`).
**Why real Postgres:**
- Correctness depends on row locks under READ COMMITTED: a package match racing a replacement, and the last GRC slot. PGlite cannot run concurrent sessions.
- The other races are already DB-guaranteed (conditional updates, unique indexes, the 0006 guard) and are covered by PGlite tests.

- [ ] Reuse the loopback guards from `check-credential-concurrency.mjs` (127.0.0.1, `neffi_m2_test`, refuses Neon) and migrate. For each card service: session A `BEGIN; SELECT … FROM cards WHERE id=$1 FOR UPDATE`; call the service on a separate pool; assert it is blocked (`pg_blocking_pids`); A commits; the service resolves against the fresh state.
- [ ] Capacity race: item qty 1. A locks the item and reserves card 1 by SQL; `reserveGrc(card 2)` blocks, then fails `item_full` after A commits. Assert exactly one reserved card.
- [ ] Run `pnpm check:provisioning-concurrency` and `pnpm check:db-concurrency` (the guard changed in 0009). Both pass. Commit `test(cards): two-session provisioning lock regression`.

### Task 7 — OWNER Server Actions and read DTOs
**Files:** `src/modules/inventory/queries.ts`, `src/app/admin/inventory/actions.ts`, `src/app/admin/inventory/actions.test.ts`, `src/server-only-boundary.test.ts`.
**Consumes:** Tasks 3–5. **Produces:** the actions used by Task 8. `queries.ts` selects only displayed columns. `listCards` uses keyset `(created_at, id)` desc with limit 50. `cardStateCounts` is one `GROUP BY kind, state` plus `count(*) FILTER (WHERE public_token IS NOT NULL)` for "In provisioning".
- [ ] RED (mock `@/auth/access` and `@/db` as in `src/auth/access.test.ts`):
  - for every action, an unauthenticated or customer caller gets an error and the service is never called;
  - invalid FormData (missing ids, non-uuid, qty out of range, unconfirmed checkboxes, reason too long) is rejected before the service runs;
  - each `CardError.code` maps to a fixed owner-facing message (no internals);
  - only the provision and replace actions return `reveal` (`{ url, code: formatActivationCode(code) }`);
  - no action logs.
  - PGlite tests for `queries.ts`: counts and pagination boundaries.
- [ ] GREEN: `"use server"`; `authorize("owner")`, Zod, service, `revalidatePath` of the card/inventory page. Add the new server-only modules to the boundary test.
- [ ] `pnpm vitest run src/app src/modules src/server-only-boundary.test.ts` green. Commit `feat(admin): owner provisioning actions`.

### Task 8 — Minimal OWNER provisioning UI
**Files:** `src/app/admin/inventory/page.tsx`, `src/app/admin/inventory/cards/[cardId]/page.tsx`, `src/app/admin/inventory/forms.tsx` (`"use client"`), `src/app/admin/page.tsx` (Inventory link). Read `node_modules/next/dist/docs/01-app/02-guides/forms.md` and `server-actions.md` first.
- Pages: `requireOwner()`, `export const instant = false`, mobile-first, plain Tailwind inputs plus the existing `Button`, and `notFound()` for unknown ids.
- The detail page shows only the actions valid for the current state (UI is convenience; the service decides).
- The provision/replace reveal uses `useActionState`. It shows the URL and the formatted code once, with a "copy now; it can't be shown again; if lost use Replace" warning. It's never written to storage, the URL or the console, and the submit button is disabled while pending.
- The NFC-check form has three required checkboxes, a read-back URI input and an optional device field.
- Replace and Retire need a reason plus a confirm checkbox (no `confirm()` dialogs).
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm build` with full dev env, and `pnpm check:bundle` → green. (The live UI walk-through happens at Task 10, because the app needs the migrated dev DB.) Commit `feat(admin): inventory and card provisioning screens`.

### Task 9 — Documentation
**Files:** `README.md`, `src/modules/README.md`, `.env.example` (finalize).
- [ ] README *Physical card provisioning (M4)*:
  - env vars;
  - engineering test units vs. final domain;
  - the stock → provision → NFC Tools steps (Write → Add record → URL/URI → paste the exact URL → Write; Read to confirm; never "Lock tag" or set a password; compatible NTAG21x);
  - tap test on a real phone (Android with NFC on; iPhone XS+ background reading where available), checking the address bar shows the exact URI. A 404 page is expected until M7;
  - package match (the OWNER verifies the printed code packaged with this DBC matches this Card; the common `/activate` insert/QR is used in M4 packing, while the working activation route is M5), Replace, GRC reserve/encode, Retire;
  - the seed contains no Ready DBC and no physical evidence, by design;
  - migration 0009 notes (`NOT VALID` rationale);
  - the hardware evidence checklist (§Acceptance).
- [ ] Module README M4 section. Commit `docs(cards): M4 provisioning runbook`.

### Task 10 — Live development gate (STOP: explicit approval required)
- [ ] Confirm the target is `neffi-dev` / branch `production` / endpoint. After approval, create the `pre-m4` restore branch.
- [ ] Read-only preflight:
  - `select kind, count(*) from products where active group by kind` (need exactly one active DBC and one GRC; if not, stop and ask: approved `db:seed` reset vs. a reviewed insert);
  - `select count(*) from cards where kind='dbc' and state='ready'` (the legacy pre-M4 seed row is expected and covered by `NOT VALID`; never backfill evidence on it).
- [ ] `pnpm db:migrate` twice (the second is a no-op). Verify:
  - the columns exist;
  - `cards_dbc_ready_checks_recorded` has `convalidated=false`;
  - `pg_get_functiondef('activation_credentials_guard'::regproc)` contains `package_matched_at = NULL`;
  - the journal has 10 entries.
- [ ] Set `ACTIVATION_CODE_SECRET` (new random dev value) and `CARD_URL_ORIGIN` (dev/Preview origin) in `.env.local`. Setting them in Vercel Preview/Development needs separate approval and must happen before any push. Production stays untouched.
- [ ] `pnpm dev`, sign in as OWNER, and walk the **software-only** path on dev: intake 2 cards (one DBC-intended); provision → reveal; reload (code gone); Replace → new reveal, old credential revoked; reserve `cardBlankGrc` only if an eligible item already exists on dev (the live dev data predates the `itemInProgressGrcB` seed; create nothing here); retire a blank. Confirm customers get 404 at `/admin/inventory`. **Do not record NFC checks or package matches without physical hardware.**
- [ ] Read-only SQL to confirm events, credential states and no plaintext codes.

### Task 11 — Whole-branch review and fresh verification gate
- [ ] Fresh run: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm db:check && pnpm db:generate && git diff --exit-code drizzle && pnpm build && pnpm check:bundle && pnpm check:db-concurrency && pnpm check:provisioning-concurrency`.
- [ ] Use superpowers:requesting-code-review for the whole branch, checking it against this plan and the Notion M4 boundaries:
  - no M5/M7/M8 leakage;
  - no plaintext codes;
  - lock order;
  - GRC never gets DBC behavior;
  - no `/c` route.
  Fix findings and re-run. No push/PR without separate approval.

### Task 12 — Physical hardware acceptance gate (BLOCKED until cards arrive)
On `neffi-dev`, with engineering test cards physically labeled TEST:
- [ ] **DBC:** provision; write the exact URL with NFC Tools; read back and confirm it's identical; tap with a real phone (record the model/OS) and confirm it opens the exact URI; confirm the tag is still writable (rewrite the same URL, read back again); record the NFC check; physically package the matched Card with the common activation insert containing the static `/activate` QR and its exact-Card printed activation-code label, inside the sealed package; re-enter the code from that package to match → Ready. The working `/activate` experience is not required for this M4 check. An internal engineering NFC encoding test alone is not customer/pilot package acceptance; development URLs remain engineering-only.
- [ ] **Replacement:** Replace on that card (Ready → Blank) → the old package code fails to match, the new package matches → Ready again.
- [ ] **GRC prerequisite (approval):** either an approved `db:seed` reset (adds `itemInProgressGrcB`; destroys dev sign-ins), or one reviewed insert of a controlled dev Order Item whose `review_url` is a real direct Google Review URL you choose (better tap evidence).
- [ ] **GRC:** reserve against that controlled item; write its review URL; read back, tap and check writable; record the encode check.
- [ ] Optional: retire a deliberately failed tag.
- [ ] Evidence goes into the README checklist (device, date, card id/token, results; never codes or photos showing codes) and is recorded by you in Notion Step 9. **M4 is complete only when this gate passes.**

## Acceptance criteria

**Software (Tasks 1–11):**
1. All commands in Task 11 pass. The migration applies from zero and on `neffi-dev` twice, and drift is clean.
2. A DBC cannot be Ready without `nfc_verified_at` and `package_matched_at` (DB), and a new usable credential always voids the earlier package match (DB).
3. Tokens are 26-character Crockford Base32 (130 bits), unique, random and permanent. A provisioned DBC URL never changes, and replacement keeps the token.
3a. Neither the seed nor `neffi-dev` contains fabricated physical evidence; synthetic check timestamps exist only in isolated test fixtures.
4. A card never has more than one usable credential. Used/revoked credentials never come back. The raw code exists only in the one action response.
5. Retirement still serializes with issuance (`check:db-concurrency`). Card operations serialize on the card row, and the GRC slot race yields exactly one winner.
6. A GRC never gets a token, credential, owner or profile. Reservation needs an existing eligible item, and retiring a reserved GRC frees its slot while preserving history.
7. Every mutation is OWNER-only server-side and writes one meaningful Activity Event in the same transaction.
8. There is no `/c/{token}` route, no Orders/Payments/Profiles/Support UI, and no new dependency.

**Hardware (Task 12; blocked until cards arrive):**
9. At least one real DBC is written, read back, tapped on a real phone (exact URI) and left writable, then package-matched → Ready.
10. One credential replacement is re-matched with a real package.
11. One real GRC is encoded and tested against an eligible Order Item.

**M4 status:** "software complete, hardware gate pending" until 9–11 pass.

## Verification commands (quick reference)

`pnpm vitest run <path>` (per task) · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm db:generate && git diff --exit-code drizzle` · `pnpm db:check` · `pnpm db:erd` · `pnpm build` · `pnpm check:bundle` · `pnpm check:db-concurrency` · `pnpm check:provisioning-concurrency` (the last two need disposable loopback PostgreSQL `neffi_m2_test`).

## Open items

- The flowchart file is missing from the repo, so it couldn't be cross-checked.
- The final NFC domain isn't locked yet. Handled: config plus test units, and it must be locked before pilot provisioning.
- The activation code length (16 Crockford characters, 80 bits) is an implementation choice and can be changed before Task 2. The token length (26 characters) is set by you.
- The live `neffi-dev` keeps its legacy pre-M4 seeded Ready row (no evidence, covered by `NOT VALID`) until an approved reseed.
