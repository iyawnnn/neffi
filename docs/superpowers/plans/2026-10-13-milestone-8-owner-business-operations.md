# Milestone 8: Owner Business Operations Implementation Plan

> **For agentic workers:** **Codex is the sole implementation agent.** Execute task by task with superpowers:executing-plans (or subagent-driven-development), following the per-task protocol in §0. This plan is executor-independent: any capable agent must be able to resume from repository state and the local ledger alone.

**Goal:** the two owners run the business inside Neffi without touching the database:
- receive stock (with cost);
- take an order on a phone;
- reserve cards;
- collect full, partial or later payment;
- hand over or ship;
- have the order complete itself;
- cancel and refund safely;
- track costs;
- see a dashboard and search everything.

**Spec sources** (Notion "Neffi — Business Hub", read 2026-10-13, not modified):
- Step 3 (Order & Fulfillment);
- Step 5 (Admin Pages);
- Step 6 (Data Model);
- Step 7 (Architecture);
- Step 8 (M8 contract + dependency/verification matrix);
- Step 9;
- Page Inventory §7.

Precedence: Locked Plan → Steps 3/5/6/7 → Step 8 → Step 9. The user's 2026-10-13 decisions A1–A6 (end of this file) are newer direct instructions. Step 9's progress record still shows M7 "Not started". That is Notion drift, and it does not affect scope.

**Baseline:** `main` @ `9ca1cd6`.
- M7 is merged with physical acceptance passed.
- Migration `0011` is merged but not applied to any Neon environment.
- No production deployment exists.

**Tech:** Next.js 16.4 (`cacheComponents`), React 19.3, Drizzle 0.45/PostgreSQL, Zod 4, vitest 5 + PGlite. **No new dependencies.**

---

## 0. Execution & resumption protocol (read before every session)

1. **Task 0 (Codex):**
   - Create `feat/m8-owner-operations` from current `main`.
   - Commit this plan as `docs(m8): add owner business operations implementation plan`.
   - Create the ledger `.superpowers/sdd/2026-10-13-milestone-8-owner-business-operations/progress.md` with the header `# SDD ledger — plan: docs/superpowers/plans/2026-10-13-milestone-8-owner-business-operations.md` and `Plan commit: <SHA>`.
   - Add that directory to `.git/info/exclude`.
   - Never `git add -f` the ledger and never make ledger-only commits.
   - If `main` moved past `9ca1cd6`, record the new base in the ledger. Stop if the new commits touch files this plan modifies.
2. **Per-task protocol:**
   1. Read the whole task, plus the existing code it names.
   2. Expand the task into a detailed execution checklist (test code, commands, expected results) and record it in the ledger entry. This makes scope concrete but never changes it.
   3. TDD: failing test → smallest correct change → green.
   4. Preserve existing conventions and reuse the named services; never re-implement M4–M7 logic.
   5. Run targeted verification: path tests via `node node_modules/vitest/vitest.mjs run "<path>"` (bracket paths break the pnpm shim), then `corepack pnpm typecheck` and `corepack pnpm lint`.
   6. Add every new `server-only` module to `src/server-only-boundary.test.ts`.
   7. Commit with the task's exact message.
   8. Append the ledger entry.
3. **Ledger entry** (appended after each commit, never committed):
   ```
   ## Task N — <title>
   - Status: complete
   - Commit: <SHA | "none (verification only)">
   - Executor: <agent>
   - Checks: <command → result + counts>
   - Result: <one line>
   - Rulings: <none | decision + who approved>
   ```
4. **Next task:** the lowest-numbered task without `Status: complete`. If `git log` shows a task's commit message but the ledger has no entry, re-run its verification and record `complete (recovered)`.
5. **Stop conditions:** §9. **Never record secrets** (activation codes, OTPs, cookies, tokens, DB URLs with passwords).
6. **Binding lessons (M5–M7):**
   - Request-time DB reads call `await connection()` first and pages export `instant = false`.
   - Never read the clock during render before `connection()`.
   - Controls are at least 44px tall (`h-11`/`min-h-11`).
   - Use `corepack pnpm <script>`.

---

## 1. Purpose

- **Problem.** M4–M7 can provision, claim, publish and serve cards, but nothing can **sell** one.
  - Nothing creates or prices an Order, records money, reserves a DBC, or moves any card to `released`.
  - Today the M5 claim depends on fixtures.
- **Why after M7.** Step 8's locked order puts customer and public work first and owner/admin last.
  - M8 builds on the working Card system without changing it.
  - M9 (Support) builds on M8's Orders, Payments, Shipments, Activity and Customers.
- **Outcome.** This closes the Step 8 M8 "Done when" and the M12 gate item "seller Order/fulfillment cannot be completed without database intervention".

## 2. Current-state dependencies

**Schema already exists (M2):**

| Area | Tables / columns |
|---|---|
| Catalog and buyers | `products`, `purchasers` |
| Orders | `orders` (number ≥ 1001, status, delivery method, shipping fee, notes, created/assigned/updated-by); `order_items` (unit-price snapshot, `agreed_total`, GRC `label`/`review_url`) |
| Money | `payments`, `refunds` |
| Fulfilment | `shipments` (status, `shipped_on`, `courier_cost`) |
| Inventory | `stock_purchases` (cost columns unused so far), `cards` |
| Operations | `expenses` (manual only), `activity_events` |

**Guards M8 must respect:**
- `orders_guard`: Completed and Cancelled are final.
- `history_guard`: payment/refund money columns are frozen, rows are never deleted, activity is immutable.
- `cards_guard`: Released → Retired only; Retired is final; a card is retired only after its credential is revoked.
- Card CHECKs:
  - reserved/released need `order_item_id`; blank/ready have none;
  - owner only when Released/Retired;
  - a DBC is Ready only with the NFC check and package match;
  - a GRC is never Ready.
- The composite FK `cards(order_item_id, product_id) → order_items(id, product_id)`.

**Reuse (do not duplicate):**

| Need | Existing code |
|---|---|
| OWNER auth | `requireOwner()`, `authorize("owner")`: `src/auth/access.ts` |
| Action pattern | `run()`/Zod/error-code→copy/`revalidatePath`: `src/app/admin/inventory/actions.ts`; `ActionForm`: `.../inventory/forms.tsx` |
| Card lock / retire / NFC check / active product | `lockCard`, `retireCard`, `recordNfcCheck`, `activeProductId`: `src/modules/cards/card.ts` |
| GRC reserve / eligible items | `reserveGrc`, `eligibleGrcItems`, `COUNTED_STATES`: `src/modules/cards/grc.ts` |
| DBC credential replacement | `replaceProvisioningCredential`: `src/modules/cards/dbc.ts` |
| Stock intake / counts / card list / detail | `src/modules/inventory/{stock-intake,queries}.ts` |
| Claim (integration proof) | `claimCard`: `src/modules/activation/claim.ts` |
| Activity | `recordActivity`: `src/modules/activity/record.ts` (extend the `ActivityType` union only) |
| Keyset pagination | `listCards` / `listInbox` patterns |
| Dates | `formatDateTime` (Asia/Manila): `src/lib/format-date.ts`; client date default as `defaultReceivedDate` in `forms.tsx` |
| Tests | `createTestDb`, `rollback`, `expectPgError` (`src/db/testing.ts`); `src/db/test-fixtures.ts`; `scripts/check-*-concurrency.mts` harness |

**Missing (confirmed):**
- `orders`, `payments` and `expenses` modules;
- release, DBC reserve and unreserve services;
- a money formatter;
- an admin shell/nav.

Codebase transactions use explicit `FOR UPDATE` lock-first patterns and no serialization-retry helper; M8 does the same.

**Invariants:**
1. Purchaser ≠ Account; they are never auto-linked.
2. DBC/GRC stay distinct; a GRC never gets a token, owner, profile or credential.
3. Card ownership ≠ Card→Profile routing.
4. Money is integer centavos; totals, balance, Paid/Unpaid and counts are derived, never stored.
5. One source per cost (M2 D1).
6. Money history is append-only.
7. `completed` is written only by the completion service.
8. The `/c/{token}` resolver and the M7 cache are untouched; M8 never bumps `content_version`.
9. OWNER sees only the A3 allow-list of Account data.
10. No secrets in URLs or logs, and M8 never displays activation codes.

---

## 3. Scope

**In:**
1. **Settings:** Products & Pricing (exactly one active product per kind; create if missing; edit name and price in place) and read-only Owner Access.
2. **Orders:**
   - phone-first create;
   - list with status and assignee filters (keyset);
   - detail workspace;
   - Assigned To, Last updated by/at, internal notes;
   - item edits while In Progress.
3. **Payments/Refunds in Order context,** including the void correction (A1).
4. **Card fulfilment:**
   - reserve specific Ready DBCs;
   - GRC reserve/encode via M4 services from the order;
   - return a reserved card to stock;
   - release via **Hand over** (pickup/local) or **Ship** (courier shipment);
   - shipment status, tracking and cost updates.
5. **System completion,** settled in every input-changing transaction.
6. **Cancellation:** before any release, with safe card return and the refund due shown.
7. **Inventory:**
   - Cards / Stock Purchases views;
   - cost entry at intake and edit later;
   - stock-purchase detail;
   - card detail links to its order, purchaser and owning Account.
8. **Expenses:** manual create/edit/delete plus a monthly report that UNIONs manual, stock-purchase and courier costs.
9. **Customers:** Purchasers list/detail (edit, orders with balances, "New order for this purchaser") and Neffi Accounts (read-only, A3).
10. **Dashboard:**
    - In Progress count;
    - outstanding balances;
    - collected this month;
    - expenses this month;
    - stock counts;
    - recent activity;
    - quick actions: New Order, Add Stock, Add Expense.
11. **Global search:** order number, purchaser name/contact, account email, card token/id, tracking number.
12. **Activity:** the order timeline (events + notes), dashboard recent activity, and the existing card timeline.
13. **Admin shell:** nav (Dashboard, Orders, Inventory, Customers, Expenses, Settings) plus search; responsive and phone-usable.

**Out:**
- **M9:**
  - Support nav and cases;
  - the "Open Support Case" action;
  - refunds or shipments with `support_case_id`;
  - replacements;
  - shipping-exception handling (M8 records shipment status only);
  - any action on Released cards;
  - lost-code/wrong-account/recovery;
  - **any payment or refund correction on Completed orders**;
  - account merge;
  - Settings → Communications.
- **M10:**
  - OWNER MFA/step-up;
  - CSP;
  - Owner Access mutation UI (role changes stay on the guarded CLI);
  - `EXPLAIN ANALYZE` index tuning;
  - rate-limit tuning.
- **Not V1:**
  - order, payment, courier or refund emails;
  - courier or payment APIs;
  - invoices, accounting, profit metric;
  - low-stock alerts, receipts, CRM;
  - a customer order portal;
  - Settings → Business;
  - deleting orders;
  - an admin visual redesign (admin keeps the current shadcn defaults).

---

## 4. Spec

### 4.1 Derived money (single definition: `src/modules/orders/totals.ts`)

| Quantity | Definition |
|---|---|
| item effective total | `agreed_total ?? quantity × unit_price` |
| `orderTotal` | Σ effective totals + `shipping_fee` |
| `received` / `refunded` | Σ **non-voided** payments / refunds |
| `netPaid` | `received − refunded` |
| `balance` | `max(orderTotal − netPaid, 0)` |
| `refundDue` | in progress: `max(netPaid − orderTotal, 0)`; cancelled: `netPaid`; completed: 0 by construction |
| `paymentState` | `Paid` ⇔ `netPaid ≥ orderTotal`, else `Unpaid` (partial = Unpaid) |
| discount (display only) | `quantity × unit_price − agreed_total` when an override exists |

The SQL aggregate `loadOrderFacts` and the pure functions must agree, and a test asserts equality on mixed fixtures including voided rows.

### 4.2 Business rules

**R-ORD (orders):**
- A purchaser name is the only required purchaser field.
- An order needs at least one item.
- `unit_price` is copied from the active product inside the creating transaction; the client never supplies a price.
- `assigned_to` defaults to the creator.
- Every order mutation sets `updated_by_account_id`.
- Delivery method and shipping fee are editable while In Progress. **Delivery method is locked once any card on the order is Released.**
- Allowed actions by status are in §4.3.

**R-ITEM (items):**
- Quantity is at least 1 and never below the item's active cards (Reserved + Released, per `COUNTED_STATES`).
- An item with active cards cannot be removed, and the last item cannot be removed.
- `agreed_total` can be set or cleared.
- `label`/`review_url` are GRC-only; the URL must be https.
- Changing `review_url` clears `nfc_verified_at` on that item's **Reserved** cards in the same transaction.
- New items copy the current active price. Existing items keep their snapshot.

**R-PRICE (products):**
- Exactly one active product per kind, enforced by a DB partial unique index.
- Name and price are edited in place.
- No second product row per kind is created: the card↔item composite FK would strand Ready stock.
- `order_items.unit_price` never changes. Renaming a product changes only its display label on old orders.

**R-PAY (payments):**
- In Progress orders only.
- `0 < amount ≤ balance`; the default is the balance; overpayment is refused (A2).
- Method is gcash, bank_transfer or cash.
- `paid_on` defaults to today (Asia/Manila).
- Reference is optional and hidden for Cash.
- "Paid now" at creation calls the same service inside the creating transaction.

**R-REF (refunds):**
- In Progress or Cancelled orders.
- `0 < amount ≤ netPaid`.
- Reason is optional.
- The original payment row is untouched.
- Completed orders are refused (M9).

**R-VOID (A1, corrected):**
- **Payment void:** the order must be In Progress.
- **Refund void:** the order must be In Progress **or Cancelled**, so a mis-keyed refund recorded after cancellation can be corrected.
- Both require a non-empty reason, are one-way (DB guard), keep the original row and money columns intact, show as struck through, and are excluded from every total.
- Completed-order corrections are M9 Support. The status rule is checked by the service under the order lock; the DB guards immutability.

**R-RES (reservation):**
- **DBC:** pick specific Ready DBCs of the item's product. The count must be ≤ remaining capacity (`quantity − active cards`).
  - Lock order → item, then run `UPDATE cards … WHERE id = ANY($ids) AND state='ready' AND kind='dbc' AND product_id = item.product_id`.
  - The affected row count must equal the number of ids; otherwise throw and roll back.
- **GRC:** the existing `reserveGrc` then `recordNfcCheck`, reached from the order item. No new GRC reserve logic.
- **Return to stock** (card Reserved, order In Progress; one shared routine also used by cancel):
  - DBC → `ready` with `order_item_id` cleared (its NFC check and package match remain);
  - GRC with `nfc_verified_at` → retire through the existing `retireCard` (encoded for a specific business);
  - unencoded GRC → `blank` with `order_item_id` cleared.
- **Lost DBC package while Reserved:** return to stock, then use the existing M4 `replaceProvisioningCredential`. No new service.

**R-REL (release):**
- Releases all currently Reserved cards of the order; at least one is required.
- Card rows are locked first, then preconditions are checked per card:
  - DBC: `package_matched_at` set **and** a usable credential exists;
  - GRC: `nfc_verified_at` set.
- **Hand over** requires delivery method pickup or local_handoff.
- **Ship** requires courier and inserts a `shipments` row in the same transaction: `shipped_on` (default today), status `in_transit`, and optional courier, tracking, recipient, contact, address and courier cost.
- Multiple partial releases are allowed.
- Each released card gets a `card_released` event with `cardId` and `orderId`.

**R-SHIP (shipments):**
- Update tracking, courier cost and status (in_transit, delivered, failed, returned, lost).
- Allowed on In Progress and Completed orders. A Cancelled order cannot have shipments, because shipping releases cards and cancel requires none released.
- Recording failed/returned/lost does not reopen or alter the order; follow-up is M9.

**R-DONE (completion; system-only, exactly once).** Eligible ⇔ all of:
- `status = 'in_progress'`;
- at least one item;
- every item's Released count equals its quantity;
- a delivery method is set, and if it is courier, at least one shipment exists with `shipped_on` set and `support_case_id` null;
- `netPaid = orderTotal`. An overpaid order must refund first.

`settleOrderCompletion` runs at the end of every `mutateOrder` transaction while holding the order lock. When eligible it writes `completed`/`completed_at` plus one `order_completed` event. Customer activation never affects it.

**R-CAN (cancellation):**
- In Progress with no Released card on any item.
- Every Reserved card goes through the shared return-to-stock routine.
- `cancellation_reason` is optional.
- Payments and refunds are kept; `refundDue = netPaid` is shown with **Record refund**.

**R-EXP (expenses):**
- Manual entries have `spent_on` (default today), amount > 0, one of the 6 categories, payee, note and an optional order. They can be edited and deleted (the table is not history-guarded and is the owners' own entry).
- Derived rows are read-only and link to their source:
  - `purchase_cost` → inventory_production on `received_on`;
  - `inbound_shipping_cost` → shipping_delivery on `received_on`;
  - `courier_cost` → shipping_delivery on `shipped_on`.
- Derived costs are never copied into `expenses`.

**R-STK (stock):**
- Intake gains optional `purchase_cost` and `inbound_shipping_cost`.
- Supplier, date, reference, notes and costs are editable later.
- Quantity is always derived from cards.

**Amounts:** entered in pesos (e.g. `1,500.50`), parsed to integer centavos. Each entry is `0 < x ≤ ₱10,000,000`, a typo guard that also stays well under int4.

### 4.3 Terminal-order matrix (enforced via `mutateOrder({ allow })`)

| Action | In Progress | Completed | Cancelled |
|---|---|---|---|
| Edit items / price / delivery / fee / notes | ✓ (delivery locked after first release) | ✗ | ✗ |
| Assign, internal note | ✓ | ✓ | ✓ |
| Reserve / return to stock / release / ship | ✓ | ✗ | ✗ |
| Update shipment | ✓ | ✓ | n/a |
| Record payment | ✓ | ✗ | ✗ |
| Void payment | ✓ | ✗ (M9) | ✗ |
| Record refund | ✓ | ✗ (M9) | ✓ |
| Void refund | ✓ | ✗ (M9) | ✓ |
| Cancel | ✓ if none released | ✗ | ✗ |
| Settle completion | runs | no-op | no-op |

### 4.4 State transitions

```
Order:   in_progress ──settle(eligible, system)──▶ completed (final)
         in_progress ──cancel(no released card)──▶ cancelled (final)
DBC:     ready ──reserve──▶ reserved ──release──▶ released ──(M5 claim)
         reserved ──return/cancel──▶ ready
GRC:     blank ──reserveGrc──▶ reserved ──recordNfcCheck──▶ reserved✓ ──release──▶ released
         reserved ──return/cancel──▶ blank ;  reserved✓ ──return/cancel──▶ retired
         reserved✓ ──review_url changed──▶ reserved (check cleared)
Payment: recorded ──void(reason; order in_progress)──▶ voided (final)
Refund:  recorded ──void(reason; order in_progress|cancelled)──▶ voided (final)
Shipment: created in_transit ⇄ delivered | failed | returned | lost (status only)
```

### 4.5 User flows (owner, phone-first)

| Flow | Steps |
|---|---|
| **New order** | 1. Name (+ contact), or arrive from Purchaser "New order".<br>2. Add DBC/GRC lines with the price pre-filled; **Adjust price** reveals the agreed total; GRC lines show branch label and review URL.<br>3. Delivery method (courier fields appear only when Courier is chosen) and shipping fee.<br>4. Notes.<br>5. **Paid now** (method; reference unless Cash; amount = total) or **Not yet paid**.<br>6. Land on the order detail. |
| **DBC fulfilment** | Item **Reserve cards**: a checklist of Ready DBCs showing the last 4 of the token and the stock date. Then **Hand over** or **Ship**. The order completes automatically when paid. |
| **GRC fulfilment** | Set the review URL → reserve a blank GRC (M4 form, linked from the item) → NFC check (M4) → release. |
| **Later payment** | **Record payment** (defaults to the balance). |
| **Cancel** | **Cancel order** (confirm; reason optional) → **Record refund** if money was received. A mis-keyed refund → **Void refund**. |
| **Stock** | **Receive stock** (+ costs) → stock purchase detail. |
| **Expense** | **Add expense** (date defaults to today). |

### 4.6 Security and privacy

- Every `/admin` page calls `requireOwner()`, in the layout and again in each page.
- Every action runs `authorize("owner")`, then Zod (uuid ids, bounded strings and amounts), then the domain service.
- No client-supplied prices, totals or states are trusted.
- Both owners have equal rights; Assigned To is informational.
- **Account allow-list (A3):**
  - email, role, created date;
  - sign-in method kinds (`google` / `email`);
  - owned cards: state, disabled flag, last 4 of the public token, connected profile name and status;
  - profile names and statuses.
- **Never exposed:** form submissions/inbox, profile content or contact fields, sessions, provider account identifiers, tokens or secrets.
- No Account mutation exists in M8. A test asserts the DTO key set exactly.
- `/admin/*` is dynamic, `noindex`, never shared-cached.
- MFA is M10 (accepted). Money actions are the first candidates for M10 step-up.

### 4.7 Failure behaviour

- Domain errors are a typed `OrderError { code }` mapped to plain owner copy (the M4 `CardError` pattern). Unknown errors rethrow to Sentry.
- Bad or unknown ids → `notFound()`.
- A losing concurrent action re-reads under the lock and gets a domain error ("Balance is ₱0", "Card no longer ready", "Order was cancelled"). Partial writes never happen.
- Submit buttons are disabled while pending. The balance cap blocks a duplicate final payment.
- `ponytail:` there is no idempotency key for partial payments; void corrects a duplicate. Add a key column only if duplicates occur in practice.

### 4.8 Acceptance criteria (Definition of Done)

The 11 locked Step 8 verifications pass as named automated DB tests **and** in the T18 walkthrough:
- normal DBC order;
- GRC order;
- mixed order;
- partial/later payment;
- negotiated total;
- pickup/local/courier;
- cancel before release;
- cancel after release rejected;
- refund preserves the payment;
- price change leaves history alone;
- counts derive from cards.

Also required:
- the void rules of §4.3, including a refund void on a Cancelled order and refusal of any void on a Completed order;
- voided rows excluded from all totals;
- completion settles exactly once;
- **the automated chain M8 order → DBC Reserved → Released → existing `claimCard` succeeds**;
- the Account DTO matches the allow-list exactly;
- `check:orders-concurrency` passes;
- the full software gate is green;
- T19 isolated Preview smoke passes.

T20 is recommended, non-gating evidence.

---

## 5. Architecture

Modular monolith. New domain folders: `orders`, `payments`, `expenses`, plus `accounts/directory.ts` and `src/modules/search.ts`.
- **Server Components** for every page.
- **Client Components** only for the order line editor, `ActionForm` sheets and the search input.
- **Server Actions** for all mutations.
- No route handlers, no cache layer, no external services (no email, Cloudinary or Resend changes).

### 5.1 Order core: the one justified new abstraction

`src/modules/orders/order.ts`:
- `lockOrder(tx, id)`: `SELECT … FOR UPDATE`; throws `not_found` if absent.
- `loadOrderFacts(tx, id)`: one aggregate returning:
  - items with active and released counts;
  - non-voided money sums;
  - a shipped-shipment flag (non-support);
  - an any-released flag.
- `settleOrderCompletion(tx, id, actorId)`.
- `mutateOrder(db, { orderId, actorId, allow = ["in_progress"] }, fn)`:
  1. open a transaction;
  2. `lockOrder` and check the status is in `allow`;
  3. run `fn(tx, order)`;
  4. set `updated_by_account_id`;
  5. settle.

The M2 design requires completion to be re-derived in every input-changing transaction. One wrapper makes that impossible to forget.

**Global lock order:** `orders` → `order_items` → `cards` → `activation_credentials`.

| M4 service | Change | Why |
|---|---|---|
| `reserveGrc` | Lock the parent `orders` row before the item | Otherwise a concurrent cancel can leave a card reserved on a cancelled order |
| `recordNfcCheck`, GRC path | Read the card's `order_item_id`, lock the order, then `lockCard`, then re-verify the card's item is unchanged before reading `review_url` | Otherwise a concurrent `review_url` change can be overwritten by a stale verification |

- The DBC path of `recordNfcCheck`, `retireCard`, the M5 claim (credential → card) and M6 card actions are unchanged. None of them touch orders, and release never touches credentials beyond a read under the card lock, so no cycle is possible.
- Calling `retireCard(tx, …)` from inside `mutateOrder` nests as a savepoint. Its card lock comes after the order lock, which keeps the lock order consistent.

### 5.2 Capabilities

| Capability | New / reuse | Schema |
|---|---|---|
| Money | new `src/lib/money.ts` (`parsePesos`, `formatPeso`); `orders/totals.ts` (pure) | — |
| Products/Settings | new `orders/products.ts`. Refactor `activeProductId` into `activeProduct(tx, kind) → {id, name, price}`; `activeProductId` delegates so M4 callers are unchanged. Owner Access = read of `accounts.role='owner'` | partial unique index |
| Purchasers | new `orders/purchasers.ts` | — |
| Order create/edit | new `orders/create.ts` (own transaction; nothing can be eligible at creation), `orders/items.ts` (via `mutateOrder`) | — |
| Payments/refunds/voids | new `payments/{record,void}.ts` via `mutateOrder` with the §4.3 `allow` sets | void columns + guard |
| Fulfilment | new `orders/fulfillment.ts` (`reserveDbcCards`, `returnCardToStock`, `handOverOrder`, `shipOrder`, `updateShipment`); reuses `reserveGrc`, `recordNfcCheck`, `retireCard` | — |
| Cancellation | new `orders/cancel.ts` (reuses `returnCardToStock`) | — |
| Read models | new `orders/queries.ts` (`listOrders` keyset `(created_at,id)` with status/assignee filters, 25/page, LATERAL aggregates; `getOrderDetail`) | existing `orders_status_created_at_idx` |
| Inventory | extend `inventory/stock-intake.ts` (costs) and `inventory/queries.ts` (filters, stock purchases); new `inventory/stock-purchases.ts` (update) | — |
| Expenses | new `expenses/manual.ts`, `expenses/report.ts` (UNION ALL; `?month=YYYY-MM`, default is the current Manila month computed after `connection()`) | existing `expenses_spent_on_idx` |
| Customers | purchaser queries in `orders/purchasers.ts`; new `accounts/directory.ts` (A3 DTO) | — |
| Dashboard | new `orders/dashboard.ts` (PostgreSQL aggregates only; no profit) | — |
| Search | new `src/modules/search.ts`: grouped `ILIKE` with escaped `%`/`_`, `LIMIT 8` per group; exact match for order number, uuid and token | — (M10 tunes) |
| Activity | add to `ActivityType`: `order_assigned`, `order_items_changed`, `order_completed`, `order_cancelled`, `payment_recorded`, `payment_voided`, `refund_recorded`, `refund_voided`, `card_returned`, `shipment_recorded`, `shipment_updated`; reuse `order_created`, `card_reserved`, `card_released`, `card_retired`, `note`. Notes carry amounts or labels only | — |
| Shell | `src/app/admin/layout.tsx` + `admin-nav.tsx` (server, CSS-responsive) + `search-box.tsx` (GET form to `/admin/search`) | — |

**Routes:**
- `/admin`
- `/admin/orders`, `/admin/orders/new`, `/admin/orders/[orderId]`
- `/admin/inventory` (`?view=stock`), `/admin/inventory/cards/[cardId]` (exists), `/admin/inventory/stock/[stockPurchaseId]`
- `/admin/customers` (`?view=accounts`), `/admin/customers/purchasers/[id]`, `/admin/customers/accounts/[id]`
- `/admin/expenses`
- `/admin/settings`
- `/admin/search`

**Caching:** none added. Admin stays dynamic, with `revalidatePath` after mutations. Releasing a card affects `/c/{token}` only through the fresh resolver.

---

## 6. Database: migration `0012_owner_operations` (Codex generates it in T2)

The migration is generated, then hand-edited with SQL separated by `--> statement-breakpoint` (the 0005/0009 pattern). It is forward-only.

| Change | Why |
|---|---|
| `payments` and `refunds`: `voided_at timestamptz NULL`, `voided_by_account_id uuid NULL REFERENCES accounts`, `void_reason text NULL`; CHECK `<table>_void_all_or_none` (all null, or all set with `length(trim(void_reason)) > 0`) | A1: correct mis-keyed money without deleting history (M2 D4 deferred this to M8) |
| `void_once_guard()` + `BEFORE UPDATE` triggers on payments and refunds: once `OLD.voided_at` is set, any change to the three void columns raises P0001 | Voids are one-way. `history_guard` keeps the money columns frozen and coexists unchanged. |
| `CREATE UNIQUE INDEX products_one_active_per_kind ON products(kind) WHERE active` | R-PRICE; `activeProductId` already assumes it |

- **Which order statuses may be voided** is a service rule (§4.3), enforced under the order lock. It is deliberately not a trigger, which avoids cross-table trigger logic.
- No other DDL is needed.
- **Ordering:** `0012` follows `0011`. Any live database receives both together.
- **Backfill:** none (nullable columns).
- **Pre-check before any live apply:** `SELECT kind FROM products WHERE active GROUP BY kind HAVING count(*) > 1` must return 0 rows. The seed and fixtures have one active product per kind.
- **Rollback:** no down migrations. Use a restore point or a forward fix. All changes are additive, so the pre-M8 code ignores them.
- **CI:** `db:generate && git diff --exit-code drizzle` stays clean. Run `db:erd` and commit the ERD.

---

## 7. Canonical task sequence (one commit per code task)

**T0 — Branch, plan commit, ledger** (§0.1). Codex only.

**T1 — Money and order math (pure).**
- Files: `src/lib/money.ts`, `src/modules/orders/totals.ts` (+ tests).
- Tests:
  - peso parse/format, including rejecting 0, negatives, more than 2 decimals and amounts over the cap;
  - effective total with and without an override;
  - balance / refundDue / Paid-Unpaid for partial, overpaid and cancelled orders;
  - `isCompletionEligible` truth table (pickup vs courier, unreleased, overpaid, zero items, support-only shipment).
- Commit: `feat(orders): derived order money and completion eligibility`.

**T2 — Migration 0012.**
- Files: `src/db/schema/commerce.ts`, `drizzle/0012_*.sql` + meta, integrity tests, `docs/database/erd.md`.
- Tests:
  - CHECK all-or-none, and a blank reason is rejected;
  - void-once: setting once works; changing or unsetting raises P0001 (payments and refunds);
  - `history_guard` still freezes the amount;
  - a second active product of a kind → 23505; an inactive duplicate is allowed.
- Verify: `test`, `db:check`, generate-diff clean, `db:erd`.
- Commit: `feat(db): payment and refund voids, one active product per kind`.

**T3 — Order core and lock-order fixes.**
- Files: `orders/{order,errors}.ts`, `activity/record.ts` (types), `cards/card.ts` (`activeProduct` refactor; GRC lock path in `recordNfcCheck`), `cards/grc.ts` (order lock).
- Tests:
  - `mutateOrder` honours `allow` and sets updated-by;
  - settle is exactly-once (a repeat is a no-op) and never completes an ineligible order;
  - `loadOrderFacts` equals the pure totals (voided rows excluded);
  - `reserveGrc` refuses a cancelled order;
  - `recordNfcCheck` rejects when the card's item changed;
  - existing M4 tests stay green.
- Commit: `feat(orders): order lock, facts and system completion`.

**T4 — Products & Settings.**
- Files: `orders/products.ts`, `src/app/admin/settings/{page,actions}.tsx`.
- Tests:
  - create only when no active product of that kind exists;
  - edit name and price;
  - existing `unit_price` unchanged (**locked**);
  - Owner Access lists owners only and is read-only;
  - a customer is denied (403).
- Commit: `feat(orders): products and pricing settings`.

**T5 — Purchasers and order creation.**
- Files: `orders/{purchasers,create}.ts`, `src/app/admin/orders/new/{page,actions,order-form}.tsx`.
- Tests:
  - name-only order; existing purchaser;
  - price snapshot from `activeProduct`; mixed DBC+GRC; agreed total;
  - GRC fields refused on DBC lines; non-https URL refused;
  - Paid now ≤ total in the same transaction;
  - assigned = creator;
  - `order_created` and `payment_recorded` events;
  - no active product → copy;
  - a client price field is ignored or rejected.
- Commit: `feat(orders): create orders from a phone`.

**T6 — Orders list and workspace.**
- Files: `orders/queries.ts`, `src/app/admin/orders/{page,[orderId]/page,[orderId]/actions}.tsx`.
- Tests:
  - keyset paging; status and assignee filters;
  - detail DTO (items with counts, totals, payments/refunds including voided, cards, shipments, timeline);
  - assign and note work in every status;
  - notes, delivery and fee edits only while In Progress; delivery is locked after a release; a fee change re-settles;
  - render tests.
- Commit: `feat(orders): order list and workspace`.

**T7 — Item editing.**
- Files: `orders/items.ts`, detail actions.
- Tests:
  - add or remove a line;
  - quantity below active cards refused; removing a line with cards refused; removing the last line refused;
  - set or clear the agreed total;
  - a `review_url` change clears the check only on that item's Reserved cards;
  - a lower total shows refundDue and blocks completion until a refund;
  - `order_items_changed`.
- Commit: `feat(orders): edit order items while in progress`.

**T8 — Payments, refunds, voids.**
- Files: `src/modules/payments/{record,void}.ts`, detail actions and sheets.
- Tests:
  - partial then later payment: Unpaid → Paid (**locked**); default = balance; over-balance refused;
  - payment refused on Completed/Cancelled;
  - refund ≤ netPaid on In Progress and Cancelled; refused on Completed; the original payment row is unchanged (**locked**);
  - payment void only while In Progress;
  - **refund void allowed on In Progress and Cancelled**;
  - every void refused on Completed;
  - reason required; voided rows excluded from totals; each action re-settles; events written.
- Commit: `feat(payments): record payments and refunds in order context`.

**T9 — Card fulfilment.**
- Files: `orders/fulfillment.ts`, detail actions/forms, card-detail link back to the order.
- Tests:
  - DBC reserve: capacity limit; wrong product or kind refused; one stale id rolls back the whole set;
  - return-to-stock: DBC→ready, encoded GRC→retired via `retireCard`, unencoded GRC→blank;
  - hand over: requires pickup/local; the DBC needs a package match and a usable credential; the GRC needs its check;
  - ship: creates the shipment and releases; courier cost needs `shipped_on`;
  - shipment update allowed on Completed orders;
  - DBC, GRC and mixed orders complete via pickup, local and courier once paid (**locked**); an unpaid order stays In Progress;
  - **integration:** an M8-released DBC is claimed by the existing `claimCard`.
- Commit: `feat(orders): reserve, hand over and ship cards`.

**T10 — Cancellation.**
- Files: `orders/cancel.ts`, detail action.
- Tests:
  - before release: cards are returned per R-RES (**locked**);
  - with any card released: refused (**locked**);
  - payments are kept and refundDue = netPaid;
  - refund, then refund void, after cancel;
  - the reason is optional;
  - Cancelled is terminal.
- Commit: `feat(orders): cancel orders before release`.

**T11 — Concurrency regression.**
- Files: `scripts/check-orders-concurrency.mts`, `package.json` script `check:orders-concurrency`.
- Runs on loopback `neffi_m2_test` only, using the M5/M6 harness (`lockedScenario` / `pg_blocking_pids`).
- Scenarios:
  - two final payments → exactly one succeeds;
  - two orders reserving the same Ready DBC → one wins;
  - cancel vs release → one outcome with consistent card states;
  - cancel vs `reserveGrc` → no reserved card on a cancelled order;
  - `review_url` change vs `recordNfcCheck` → no stale verification survives;
  - payment vs release racing to completion → exactly one `order_completed`;
  - refund void vs refund record on a cancelled order → totals consistent.
- Commit: `test(orders): two-session fulfillment and payment races`.

**T12 — Inventory and Stock Purchases.**
- Files: `inventory/{stock-intake,queries,stock-purchases}.ts`, `src/app/admin/inventory/**`.
- Tests:
  - intake with costs; edit a stock purchase;
  - derived quantity and state breakdown;
  - kind/state filters;
  - counts come only from card rows (**locked**);
  - card detail shows the order and purchaser, and the owning Account via the A3 DTO only.
- Commit: `feat(inventory): stock purchases with costs and card views`.

**T13 — Expenses.**
- Files: `src/modules/expenses/{manual,report}.ts`, `src/app/admin/expenses/{page,actions}.tsx`.
- Tests:
  - manual create, edit and delete;
  - the UNION assigns category and date correctly for stock, inbound and courier costs;
  - a courier cost is never duplicated in `expenses`;
  - month totals by category.
- Commit: `feat(expenses): manual expenses and combined cost report`.

**T14 — Customers.**
- Files: purchaser queries, `src/modules/accounts/directory.ts`, `src/app/admin/customers/**`.
- Tests:
  - purchaser search and edit; orders with balances; the "New order for this purchaser" prefill;
  - the Accounts DTO key set equals the A3 allow-list exactly;
  - no purchaser↔account linking;
  - no mutation action exists for accounts.
- Commit: `feat(customers): purchasers and read-only account directory`.

**T15 — Dashboard, shell, search.**
- Files: `orders/dashboard.ts`, `src/modules/search.ts`, `src/app/admin/{layout,page,admin-nav,search-box,search/page}.tsx`.
- Tests:
  - outstanding = Σ balance of In Progress orders;
  - collected this month = non-voided payments − non-voided refunds by date;
  - expenses this month = the report total;
  - stock counts;
  - search: each group, wildcard escaping, exact order number and token match, no account data beyond email;
  - nav marks the current section;
  - customers are denied.
- Commit: `feat(admin): dashboard, navigation and global search`.

**T16 — Plan-required docs.**
- README: "Owner business operations (M8)" runbook covering the rules summary, completion, voids, lock order, the `0012` entry and the isolated-Preview procedure.
- `src/modules/README.md`: M8 modules and lock order.
- Fresh ERD.
- No broader documentation consolidation.
- Commit: `docs(m8): owner business operations`.

**T17 — Software gate (verification only).**
- `lint`, `typecheck`, `test`, `db:check`, generate-diff clean, `build`, `check:bundle`.
- All five concurrency scripts on loopback.
- An independent code-review pass of `main..HEAD` against this plan. Fixes go in separate commits.

**T18 — Local production-like acceptance.** STOP: needs the user.
- `next build && next start` against the loopback database, seeded via the existing seed or fixture plus an owner role set with `accounts:set-role` on loopback only.
- The user walks the §8 matrix on desktop and phone. Codex verifies each end state with read-only SQL.

**T19 — Isolated Preview validation (A5).** STOP: every step needs explicit approval; nothing is created before then.
1. Create a temporary Neon branch from the current `neffi-dev` development baseline.
2. Run the pre-check query.
3. Apply committed migrations through `0011` + `0012` **to that branch only**. Migrate twice; the second run is a no-op.
4. Seed only the minimum synthetic fixtures (active products, a few Ready DBC/blank GRC cards). Grant the OWNER role to the user's account on that branch only.
5. Push the M8 branch. Point a branch-scoped Vercel Preview at the temporary branch only. Keep Vercel Authentication on.
6. Smoke test: `/api/health`, owner sign-in, create → pay → reserve → ship/hand over → complete on real Neon pooled transactions, cancel + refund, dashboard.
7. Record evidence. Delete the temporary Vercel env vars/Preview resources and the Neon branch, and record the teardown.

Migrating the existing `neffi-dev` database is **not** part of M8. It is a separate post-validation decision that needs user approval.

**T20 — Real-card chain (recommended, non-gating, A4).** User-performed and recorded separately: one real Ready DBC → M8 order → reserve → hand over → `/activate` claim on a phone → publish → tap.

The PR is opened only after explicit approval.

---

## 8. Acceptance strategy

| Layer | Evidence | Who |
|---|---|---|
| Unit | money, totals, eligibility (T1) | automated |
| DB integration (PGlite) | every rule in §4.2–4.3; each **locked** verification is a named test; M8 → `claimCard` chain (T9) | automated |
| Concurrency | `check:orders-concurrency` + 4 existing scripts (loopback PostgreSQL) | automated |
| Actions/pages | owner-only denial, Zod rejection, render tests, A3 DTO key set | automated |
| Software gate | T17 + independent review | automated + reviewer |
| Production-like browser | T18 matrix | **user-performed**, Codex SQL-verified |
| Isolated Preview on real Neon | T19 | Codex-run after approval; user signs in |
| Physical | T20 (non-gating) | **user-performed** |

**T18 matrix** (each scenario ends with an SQL check of order status, card states and money sums):
1. DBC pickup, paid now.
2. GRC with two branches, local handoff, payment in two parts.
3. Mixed order with an agreed total, courier with tracking and courier cost.
4. Cancel before release → refund → void that refund as mis-keyed → re-record the correct refund.
5. Cancel after release (refused).
6. Mis-keyed payment void on an In Progress order.
7. Price change → a new order uses the new price; the old order is unchanged.
8. Stock received with cost → it appears once in the expense report.
9. Dashboard figures match SQL.
10. Search finds an order, a purchaser, a tracking number and a card.
11. Order creation on a phone, one-handed, with no horizontal scroll.

Automated, user-performed and physical evidence are recorded separately in the ledger. Nothing is fabricated.

## 9. Stop conditions (Codex stops and asks)

- **Architecture conflict:** a plan vs code or Notion contradiction. Log it as `Blocked`.
- **Guard changes:** any change to M2–M7 guards, CHECKs or `/c` behaviour beyond the two §5.1 lock fixes.
- **Destructive operations:** row or branch deletion outside the approved T19 teardown, `db:seed` anywhere but loopback, `TRUNCATE`, force-push.
- **Any Neon action:** creating the T19 branch, migrating it, seeding it, any write. Also read-only inspection without approval.
- **Migrating the existing `neffi-dev`:** always a separate approval, never implied by T19.
- **External services:** any Vercel, env, Resend, Cloudinary or Notion change; anything in production.
- **Security-sensitive work:** auth or policy changes; role grants outside loopback or the approved T19 branch; widening the A3 DTO; adding Account or owner-role mutation UI.
- **User evidence:** T18 and T20.
- **Release steps:** push, PR, merge.
- **Scope:** new dependencies or admin sections not in §3.

## 10. Risks and residual notes

- **R1 — No idempotency key for partial payments.** The pending-disabled UI and void cover it (ponytail note in §4.7).
- **R2 — Search uses unindexed ILIKE.** Fine at pilot volume; `EXPLAIN ANALYZE` tuning is M10.
- **R3 — No owner MFA.** Accepted by the roadmap; money actions go first for M10 step-up.
- **R4 — Product rename relabels old orders.** Display only; prices stay snapshotted.
- **R5 — Migration `0011` is not applied on any Neon database.** T19 applies it only to the temporary branch; `neffi-dev` stays a separate decision.

## 11. Documentation impact

- **This milestone:** only T16 (README M8 runbook, modules README, ERD).
- **Later consolidation, out of this plan's scope:**
  - PRODUCT.md, docs/README.md, architecture docs, decision records;
  - Notion Step 9 progress (M7 complete, M8 status);
  - the Step 5 Settings deferral note;
  - M2 D4 resolution (the void design).

---

## Decisions (user-approved 2026-10-13)

| # | Disposition |
|---|---|
| **A1** | **Approved with correction.** Append-only void: metadata columns, a required reason, a one-way DB guard, the original money row intact, excluded from totals. **Payment void:** In Progress only. **Refund void:** In Progress or Cancelled. Completed-order corrections → M9. |
| **A2** | **Approved.** Payments are capped at the balance (no overpayment). Refunds on In Progress or Cancelled orders only. Completed-order refunds → M9. |
| **A3** | **Approved.** Read-only minimal Account DTO (§4.6 allow-list). No Account mutation UI. |
| **A4** | **Approved, non-gating.** T20 is recommended evidence. The automated M8 → Reserved → Released → `claimCard` chain is required (T9). |
| **A5** | **Changed.** Isolated temporary Neon branch + isolated Vercel Preview (T19), torn down afterwards. Migrating `neffi-dev` is a separate later decision. |
| **A6** | **Approved.** Settings = Products & Pricing + read-only Owner Access. Business and Communications deferred. |

No architecture decision remains unresolved.
