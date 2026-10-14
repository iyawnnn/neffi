# Milestone 9A: Support Cases & Corrections Implementation Plan

> **Status: planned — approved, NOT implemented.** Approved 2026-10-14 (scope split S1/S2 and decisions B1–B9 approved by the user as written). Current product behavior is in [PRODUCT.md](../../../PRODUCT.md) and [docs/README.md](../../README.md); nothing here is current behavior until M9A ships. This plan is committed by the documentation consolidation on branch `docs/consolidation`.
>
> **For agentic workers:** **Codex is the sole implementation agent.** Execute task by task with superpowers:executing-plans (or subagent-driven-development), following §0. The plan is executor-independent: resume from repository state and the local ledger alone.

**Goal (owner's view):** when something goes wrong after a sale, both owners can handle it inside Neffi. They open a Support Case and correct it with guided, auditable actions, never by editing records. In practice:
- fix money mistakes found after an Order completed;
- refund a customer after completion;
- replace a defective DBC for free (not a fake sale);
- link a paid lost-card replacement to a real new Order;
- record a re-shipment;
- reissue a lost activation code;
- undo an activation made under the wrong Account.

The Card's permanent URL never changes.

**Spec sources** (Notion "Neffi — Business Hub", read 2026-10-13/14, not modified):
- Step 2 (Replacement, Activation Recovery & Transfer; wrong-account flow);
- Step 3 (Support & Exception Handling);
- Step 5 (Support page, Orders "Related Support Cases", Dashboard);
- Step 8 (Milestone 9 deliverables + critical verification; M2 §15 transaction boundaries).

Precedence: Locked Plan → Steps 2/3/5/6/7 → Step 8 → M8 decisions A1–A7 → this plan's decisions (§2).

**Baseline:** `main` @ `2394961` (merge of PR #8, M8), plus the documentation consolidation (docs-only; no code, schema or test changes).
- Migrations through `0012` exist, but none of `0011`/`0012` is applied to any shared Neon database.
- No production deployment.

**Tech:** Next.js 16.4, React 19.3, Drizzle 0.45/PostgreSQL, Zod 4, vitest + PGlite, loopback PostgreSQL concurrency harness. **No new dependencies, no external services.**

---

## 0. Execution & resumption protocol (read before every session)

1. **Task 0 (Codex only).**
   - Start from `origin/main` once the `docs/consolidation` branch has been merged (or from `docs/consolidation` itself if the user says so). This plan is already committed there, so there is no plan commit to make. Create `feat/m9a-support-corrections`.
   - Create the ledger `.superpowers/sdd/2026-10-14-milestone-9a-support-and-corrections/progress.md`. Its header is `# SDD ledger — plan: <path>` and `Plan commit: <SHA of the commit containing this plan>`. `.superpowers/` is already ignored by `.gitignore`.
   - Never `git add -f` the ledger. Never make ledger-only commits.
   - Record in the ledger that S1, S2 and B1–B9 (§2.3) were approved by the user on 2026-10-14, as written.
   - If `main` moved past `2394961` and the new commits touch files this plan modifies, stop.
2. **Per-task protocol:**
   1. Read the whole task plus the code it names.
   2. Expand the task into an execution checklist in the ledger (test code, commands, expected results). The checklist makes scope concrete; it never changes it.
   3. TDD: failing test → smallest correct change → green.
   4. Reuse the named services. Never re-implement M4–M8 logic.
   5. Run targeted verification:
      - tests: `node node_modules/vitest/vitest.mjs run "<path>"`;
      - then `corepack pnpm typecheck` and `corepack pnpm lint`.
   6. Add every new `server-only` module to `src/server-only-boundary.test.ts`.
   7. Commit with the task's exact message, then append the ledger entry.
3. **Ledger entry:** the M8 format.
   ```
   ## Task N — <title>
   - Status
   - Commit
   - Executor
   - Checks: command → result + counts
   - Result
   - Rulings
   ```
4. **Next task:** the lowest-numbered task that is not complete. If a task's commit exists but it has no ledger entry, re-verify it and record `complete (recovered)`.
5. **Never record secrets:** activation codes (including the codes revealed by T8), OTPs, cookies, tokens, DB URLs with passwords.
6. **Binding lessons (M5–M8):**
   - Request-time DB reads call `await connection()` first, and pages export `instant = false`.
   - Never read the clock during render before `connection()`.
   - Controls are at least `min-h-11`.
   - Use `corepack pnpm <script>`.
   - Nested service calls pass the open `tx`. Drizzle nests them as savepoints, as in the existing `cancelOrder → returnCardToStock` pattern.

---

## 1. Repository findings

### 1.1 What M9 was originally

The repo and Notion agree: **M9 = "Support, Recovery & Email"** (Notion Step 8, the M1–M8 plans, the README, `src/modules/README.md`).

**Step 8 M9 must deliver:**
- Support Case workflow;
- activation reset/reissue after verification;
- wrong-account correction;
- account-recovery support path;
- defective/incorrect Card replacement;
- shipping exception;
- paid lost-card replacement linkage;
- Resend-backed OTP/security/recovery/support messages.

**Step 8 M9 critical verification:**
1. A support action cannot bypass verification or confirmation.
2. The old credential stays used/revoked after a reissue.
3. The same Card keeps its permanent URL through a claim correction.
4. A free replacement is not a false sale.
5. A paid replacement uses a real new Order.
6. Sensitive actions create Activity.
7. Email retries do not duplicate effects.

**Contradiction with the prompt.** M9 is not just "completed-order corrections". Those corrections are one deferral *inside* the Support milestone.

**User ruling (2026-10-14):** decompose M9 like M6A–E, without changing the 12-milestone roadmap.
- **M9A (this plan):** owner-side Support Cases and corrections.
- **M9B (separate later plan):** public help intake, account recovery, and email.

### 1.2 Explicit M8 → M9 deferrals (M8 plan §3, A1, A2; README M8)

| Deferral | Lands in |
|---|---|
| Support nav and cases; "Open Support Case" (dashboard/order) | **M9A** |
| Refunds/shipments with `support_case_id` | **M9A** |
| Replacements (free; paid linkage) | **M9A** |
| Shipping-exception handling beyond the status field | **M9A** |
| Any action on Released cards | **M9A** (reissue, wrong-account reset, retire for replacement) |
| Lost-code / wrong-account | **M9A**; recovery → **M9B** |
| Payment/refund corrections on Completed orders (A1, A2) | **M9A** |
| Account merge | Deferred (user ruling: not pulled in) |
| Settings → Communications | Deferred (user ruling) |

**Earlier deferrals "to M9":**
- account deletion (M6 decision 1) → deferred (user ruling);
- `/support` page (M5) → **M9B**;
- security/recovery/support templates (M3 R6) → **M9B**;
- form-notification retry (M6, "M9/M10") → deferred.

### 1.3 What already exists (no rework needed)

**Schema (M2):**
- `support_cases`: type enum of 7, status `open | waiting_on_customer | resolved`, CHECK `resolved_at ⇔ resolved`; links to purchaser/account/order/assignee/opener; partial indexes.
- `support_case_cards`: PK `(case, card)`, role `affected | replacement`.
- `activity_events.support_case_id` with its index.
- `refunds.support_case_id` and `shipments.support_case_id`.

**M8 already keeps support rows out of the sale path:**
- `loadOrderFacts` ignores support shipments;
- `updateShipment` and `voidRefund` refuse support rows;
- the order page hides support rows' void button.

**The M2 §15 design** already defines the ownership-correction and free-replacement transactions.

### 1.4 Gaps found (real debt that M9A must fix)

| # | Gap | Evidence | M9A fix |
|---|---|---|---|
| G1 | Support refunds are counted in `refunded`, so a Completed order with an after-sale refund would show a **Balance / Unpaid** | `orders/order.ts:23`, `queries.ts:12`, `dashboard.ts:17` | Split sale vs after-sale refunds (§4.1) |
| G2 | `recordActivity` has no `supportCaseId` | `activity/record.ts` | Add it |
| G3 | `retireCard` refuses Released and never clears routing; `cards_retired_routes_nowhere` requires `profile_id NULL` | `cards/card.ts:102-121` | A new support retire service; M4 `retireCard` stays unchanged |
| G4 | `history_guard` freezes refund money columns but **not `support_case_id`** | `0005:91` | Freeze it in 0013, because it now affects balance |
| G5 | `support_case_cards` has no guard, and the replacement count depends on it | `0004` | Add a history guard in 0013 |
| G6 | A replacement card must share the original item's `product_id` (composite FK) | `cards_order_item_fk` | Holds today, because R-PRICE edits the single product per kind in place; the service checks it explicitly |
| G7 | Issuing a credential on a Released card silently clears `package_matched_at` | `0009` guard | Documented and expected; claim does not read it |
| G8 | Customer card lists and the resolver's Manage link don't filter `retired`. A retired card keeping its owner would still show. | `cards/manage.ts`, `resolve.ts` | Support retire clears the owner (B4), so new retirements never hit this. Legacy seed-only rows are a residual. |

**Must be left alone:**
- M4 `retireCard` / `replaceProvisioningCredential`;
- M5 `claimCard`;
- the M6 card actions;
- the M7 resolver and cache;
- M8 fulfilment, cancellation and completion rules;
- `orders_guard` (Completed/Cancelled stay final);
- GRC as a commercial line with no Card workflow (A7).

### 1.5 Do M8 changes invalidate any M9 assumption?

- **M2 §15 "free replacement: reserve/release replacement against the original item":** still valid for DBC. **For GRC it is invalid after A7.** GRC replacements are commercial only: a case note plus an optional support shipment, with no Card rows.
- **Step 3 "Completed = balance ₱0":** after-sale refunds must not create a balance. The M8 single money definition has to learn this (G1).
- **M8 lock order** (Order `NO KEY UPDATE` → items → DBC cards → credentials) extends with case first, FK-compatible Support item locks and former-owner Account before Card (§5.2).

---

## 2. Scope decisions

### 2.1 Locked by the user (2026-10-14)

- **S1:** M9 is split. M9A is this plan; M9B gets its own plan after M9A merges.
- **S2:** nothing extra is pulled in. Account deletion, account merge/profile move, Settings → Communications and customer-side support status stay deferred.

### 2.2 M9B outline (not planned here; recorded so nothing is lost)

- Public `/support` intake: no sign-in; contact fields + client-key dedupe columns; reuses the form route's quota/honeypot/body-cap pattern.
- Contextual help from `/activate` "unavailable" and the Account page.
- Support emails (acknowledge / request info / resolution) with deterministic idempotency keys.
- Security-confirmation emails: sign-in email changed, Google linked/removed, signed out everywhere.
- **Account-recovery support path:** owner-controlled replacement of the sign-in email after verification, session revocation, Google unlink, notification to old and new addresses.
- An isolated Neon + Vercel Preview: real Resend delivery, a public route, and Better Auth mutation all need it.

### 2.3 Decisions (approved by the user 2026-10-14, as written)

Each row lists the recommended option with its main alternative.

| # | Decision | Recommended | Alternative | Why | Risk |
|---|---|---|---|---|---|
| **B1** | Where Completed-order corrections happen | **Only from a Support Case linked to that Order.** The M8 order workspace stays terminal for Completed orders and gains only "Open support case". | Inline buttons on the Completed order page | Step 5: sensitive corrections happen in Support context with Activity. One exception layer keeps every post-completion change explained by a case. | One extra step for a pure bookkeeping fix |
| **B2** | Money meaning after completion | **Split refunds.** Sale refunds (`support_case_id IS NULL`) settle the order. After-sale refunds (case-linked) are concessions: they reduce cash collected but never create a balance. After-sale refunds exist **only on Completed orders**. | Treat all refunds alike (G1 bug); or reopen orders | Keeps "Completed = settled" true after a goodwill/defect refund. No reopening; `orders_guard` untouched. | Three SQL read models must change in lockstep. A test asserts they agree. |
| **B3** | Fixing a mis-keyed payment found after completion | **From the case: Void payment (reason) → "Balance due after correction" appears → Record payment (capped at balance).** Pre-completion sale refunds cannot be voided once Completed; only after-sale refunds can. | Same-amount-only correction; or forbid | The only realistic post-completion amount error is an over-recorded payment, because under-recording blocks completion. The existing balance cap makes "Record payment" impossible on a normally settled order. | A Completed order can temporarily show a balance due. Shown as a warning; counted in dashboard outstanding. |
| **B4** | Retiring a Released DBC (defective/lost) | **A new support service.** Revoke any usable credential, set `retired`, and clear `profile_id`, `owner_account_id` and `disabled_at` in one UPDATE. Record the former owner in the Activity `account_id`. | Keep the owner on the retired row | `cards_retired_routes_nowhere` needs the profile cleared. Keeping the owner leaves the card in customer lists, where its actions error (G8). Final state; history is in Activity. | None material; retired is final |
| **B5** | Free DBC replacement model | **M2 §15:** a Ready DBC of the same product is released directly (`ready → released`) against the **original Order Item**. Allowed only while, per (case, item), replacements < affected cards retired by that case. No new item or payment; the order total is unchanged. The replacement has its own new URL and code; the customer claims it and reconnects their Profile themselves (Step 2). | A new ₱0 Order | Not a sale. Inventory counts stay derived. Item quantity invariants hold, because the retired card no longer counts as active. | The count rule needs locks (§5.2, races R4/R5) |
| **B6** | Migration `0013_support_guards` | **Additive guards only:** freeze `refunds.support_case_id`; CHECK that a case-linked refund has a non-blank reason; history guard on `support_case_cards` (no delete, frozen columns). | No migration (service rules only) | B2 gives `support_case_id` financial meaning, so the DB must stop it being re-tagged. Case–card links drive the replacement count. | Recreating an M2 trigger is a listed stop condition, approved here |
| **B7** | Remote validation | **No isolated Preview for M9A.** Local loopback PostgreSQL (migrations, concurrency) plus `next build && next start` acceptance. | M8-style T19 Preview | No new external integration, env var, auth change or public route; the transaction patterns are already proven on Neon in M8 T19. M9B will need a Preview. | Migration 0013 first meets Neon at the later shared-DB apply; it is plain PG DDL (§6) |
| **B8** | Verification for code reissue / wrong-account reset | Owner ticks **"I verified the purchase and the requester's claim"** and enters a **required verification note** (what was checked). The new code is **revealed once** to the owner for out-of-band delivery, using the M4 reveal pattern. No email in M9A. | Email the code (M9B decision) | Step 2: support-controlled, verified, never publicly retrievable. Verification itself is an offline business check; the system enforces confirmation plus an audit note. | Owner discipline; it is audited |
| **B9** | Wrong-account reset and the Profile | **The Profile stays with the wrong Account.** Only the Card's owner, routing and credential change. | Move the Profile (= account merge, deferred by S2) | Step 2: moving a profile is a separate support exception | The customer may need to rebuild the profile; documented |

No other architecture choice is open.

---

## 3. Scope (M9A)

### In

1. **Support Cases.**
   - Open a case: type, summary, optional purchaser/account/order links, optional affected card.
   - The queue: Open / Waiting / Resolved filter, keyset paging.
   - Case detail.
   - Assign; status changes (open ⇄ waiting → resolved, with an optional resolution note); reopen; internal notes; timeline.
   - Fill a missing link once (never change one).
   - Link more cards as `affected`.
2. **Completed-order money corrections** from the case (B1–B3):
   - after-sale refund;
   - void an after-sale refund;
   - void a payment;
   - record a payment up to the corrected balance.
3. **Support shipments:** record and update a replacement/re-send shipment (`support_case_id` set). It never affects completion.
4. **DBC card corrections:**
   - retire an affected Released card (B4);
   - release a free replacement (B5);
   - reissue the activation code for a Released unclaimed card (lost code);
   - reset a Claimed card's ownership for a wrong-account activation (B8, B9).
5. **Paid replacement linkage:** "New replacement order" from the case. A normal M8 Order is created with the purchaser prefilled and an Activity link to the case.
6. **Entry points and read models:**
   - Admin nav **Support**.
   - Dashboard: open-case count and an **Open Support Case** quick action.
   - Order detail: Support cases section, totals for after-sale refunds and balance due after correction, and "Open support case".
   - Card detail and Account detail: "Open support case".
   - Orders list, dashboard outstanding and purchaser balances use the B2 money model.
7. **Migration 0013** (B6), the concurrency suite, and docs.

### Out (explicit)

- **M9B:**
  - public `/support` and contextual customer help;
  - all email (support, security, recovery, reissued-code delivery);
  - account-recovery support path;
  - Better Auth identity mutation.
- **Deferred (user ruling S2):**
  - account deletion/restriction;
  - account merge;
  - Profile move between Accounts;
  - Settings → Communications;
  - customer-visible support status.
- **Never in M9A:**
  - reopening Completed/Cancelled orders;
  - editing items, prices, fees or delivery method on Completed orders;
  - deleting or rewriting money rows;
  - un-voiding;
  - changing a Card URL;
  - restoring a used or revoked credential;
  - un-retiring a card;
  - customer-facing transfer/unclaim;
  - a GRC Card workflow (A7);
  - Google/ReviewJet integration;
  - courier APIs;
  - support-case search group;
  - editing `shipped_on`;
  - payment idempotency keys (M8 R1 stays).
- **M10:** OWNER MFA/step-up (support money/credential actions are the first candidates), rate-limit tuning, CSP.

---

## 4. Spec

### 4.1 Derived money (B2; single definition stays `src/modules/orders/totals.ts`)

| Quantity | Definition |
|---|---|
| `received` | Σ non-voided payments |
| `saleRefunded` | Σ non-voided refunds with `support_case_id IS NULL` (M8's `refunded`) |
| `afterSaleRefunded` | Σ non-voided refunds with `support_case_id IS NOT NULL` (only ever on Completed orders) |
| `settledPaid` | `received − saleRefunded`: what counts toward the order total |
| `netPaid` | `settledPaid − afterSaleRefunded`: cash Neffi kept (display "Net paid"; refund cap) |
| `balance` | `max(orderTotal − settledPaid, 0)` |
| `refundDue` | in progress: `max(settledPaid − orderTotal, 0)`; cancelled: `netPaid`; completed: 0 |
| `paymentState` | `Paid ⇔ settledPaid ≥ orderTotal` |
| eligibility | M8 rule with `settledPaid === orderTotal` |

For orders without after-sale refunds every value equals M8's. Regression tests pin this.

**Read models that must agree with the pure functions:**
- `loadOrderFacts`;
- `listOrders` (balance column, also used by purchaser detail);
- dashboard `outstanding` = Σ balance over `in_progress` **plus `completed` orders with balance > 0**.

Dashboard `collected` stays cash by date: payments − all refunds.

### 4.2 Business rules

**R-CASE (cases)**
- Owners only.
- Type is one of the 7 enum values; it is classification only, and actions are gated by their own preconditions, not by type.
- Summary is required: trimmed, ≤ 500 characters.
- `assigned_to` defaults to the creator and must be an owner.
- Status: `open ⇄ waiting_on_customer`; either → `resolved`, setting `resolved_at` with an optional resolution note; `resolved → open` (reopen) clears `resolved_at`.
- **Controlled actions require a non-resolved case.** Notes and reopen are allowed in any status.
- Links:
  - purchaser/account/order may be **filled once while null**, never changed or cleared;
  - cards are only ever added;
  - a card already linked to the case cannot be linked again (PK).
- Every mutation sets `updated_at` and writes Activity with `support_case_id`.

**R-CMONEY (Completed-order money; B1–B3).** All require:
- `case.order_id = order`;
- the order is `completed`;
- a non-resolved case;
- a reason (non-blank, ≤ 200 characters);
- a confirmation checkbox.

The rules:
- **After-sale refund:**
  - `0 < amount ≤ netPaid`;
  - method and date default to today (Manila);
  - inserts `refunds(support_case_id = case)`;
  - Activity `refund_recorded` with `orderId` and `supportCaseId`.
- **Void after-sale refund:** the row must be in this order with a non-null `support_case_id`. One-way (existing `void_once_guard`).
- **Void payment:** any non-voided payment of the order. If `settledPaid < orderTotal` afterwards, the order shows **Balance due after correction**.
- **Record payment:** M8 `recordPayment` rules (capped at `balance`), allowed on Completed only through the case.
- **Refused:**
  - a sale refund, or any after-sale refund, on In Progress/Cancelled orders (those use the M8 workspace);
  - voiding a sale refund on a Completed order;
  - any item, fee or delivery change on a Completed order.

**R-SSHIP (support shipments)**
- The case must have an order in `in_progress` or `completed`; Cancelled is refused, matching M8.
- Inserts `shipments(support_case_id = case, status in_transit, shipped_on default today)` with optional courier, tracking, recipient, contact, address and courier cost.
- Updating changes status/tracking/courier/cost of that case's shipment only.
- Never changes completion: M8 already excludes support shipments.
- Courier cost appears once in the expense report (existing `shipments` UNION).

**R-RETIRE (B4).** The card must:
- be a DBC;
- be in state `released`;
- have `order_item.order_id = case.order_id`;
- be linked to the case as `affected` (auto-linked if not).

The order must be `in_progress` or `completed`. Requires a reason and confirmation. In one transaction:
1. revoke any usable credential;
2. `UPDATE cards SET state='retired', profile_id=NULL, owner_account_id=NULL, disabled_at=NULL`;
3. Activity `card_retired` with `cardId`, `orderId`, `supportCaseId`, `accountId` = former owner (if any), and note = reason.

`/c/{token}` then resolves to the generic unavailable page. Card counts derive automatically. A retire on an In Progress order lowers its released count, so completion waits for the replacement.

**R-REPL (free DBC replacement; B5).** Input: the order item and a Ready DBC card id. Requirements:
- the case order is `in_progress` or `completed`;
- the item belongs to it and is DBC;
- `affectedRetired(case, item) > replacements(case, item)`, counting `support_case_cards` joined to cards on `order_item_id`;
- the target card is `ready`, DBC, with `product_id = item.product_id`, `package_matched_at` set, and a usable credential.

Effect:
- `ready → released` with `order_item_id = item`;
- `support_case_cards(role replacement)`;
- Activity `card_released` with `orderId`, `cardId`, `supportCaseId`.

There is no Order Item, Payment or price change. GRC replacements are commercial only: a note plus an optional support shipment.

**R-REISSUE (lost code; B8).** Requirements:
- the card is a DBC, `released`, `owner_account_id IS NULL`, and linked to the case;
- a verification note (≤ 500 characters) and confirmation.

Effect:
- revoke the usable credential, if any, with `revokeUsableCredential`;
- `issueActivationCredential`;
- return the raw code **once** to the action result (never stored, logged or put in a URL);
- Activity `activation_credential_reissued` with `cardId`, `supportCaseId`, and note = verification note.

The old code then fails at `/activate` as `unavailable`.

**R-RESET (wrong account; B8, B9).** Requirements:
- the card is a DBC, `released`, `owner_account_id IS NOT NULL`, and linked to the case;
- a verification note and confirmation.

In one transaction:
- clear `owner_account_id`, `profile_id` and `disabled_at` (CHECK 7 allows it in one UPDATE);
- the used credential stays used (immutable);
- defensively revoke any usable credential;
- issue a new credential and reveal it once;
- Activity `card_ownership_reset` with `cardId`, `supportCaseId`, `accountId` = former owner, and note.

`public_token` is unchanged (guarded). The former Account keeps its Profile.

**R-PAIDREPL (paid replacement).** "New replacement order" from a non-resolved case opens `/admin/orders/new?supportCaseId=…&purchaserId=…`. M8 `createOrder` accepts an optional `supportCaseId`. In the creating transaction it:
1. locks the case;
2. requires it to be non-resolved;
3. records Activity `support_order_linked` with `supportCaseId` and the **new** `orderId`.

Everything else is ordinary M8 (revenue, fulfilment). The case lists its original order and its linked orders.

**Shipping exception:** the original shipment's status (failed/returned/lost) is still set with the M8 `updateShipment`, allowed on Completed orders. The case carries the follow-up (notes, support shipment, replacement, after-sale refund). The order never reopens.

### 4.3 What is impossible (layer that enforces it)

| Rule | DB | Server |
|---|---|---|
| Completed/Cancelled order reopened | `orders_guard` | `mutateOrder` allow sets |
| Money row deleted/amount changed | `history_guard` | — |
| Un-void | `void_once_guard` | — |
| Refund re-tagged sale↔after-sale | **0013** frozen `support_case_id` | — |
| After-sale refund without reason | **0013** CHECK | Zod |
| After-sale refund on non-Completed order | — | order lock + status check |
| Sale refund voided on Completed | — | service filter |
| Case–card link removed/changed | **0013** guard | — |
| Card URL changed / retired card revived / released→other | `cards_guard` | — |
| Two usable credentials / used credential reused | partial unique + credential guard | — |
| Retired card still routed | `cards_retired_routes_nowhere` | service clears routing |
| Replacement beyond retired slots | — | count rule under item lock |
| Actions on a resolved case | — | case lock + status |

### 4.4 State transitions added

```
Case:      open ⇄ waiting_on_customer ──resolve──▶ resolved ──reopen──▶ open
DBC:       released ──support retire──▶ retired (final; routing cleared)
           ready ──support replacement──▶ released (original item; case link)
           released+unclaimed ──reissue──▶ released (old cred revoked, new usable)
           released+claimed ──ownership reset──▶ released+unclaimed (new usable cred)
Order:     unchanged. Completed may show "balance due after correction" (B3) until a payment settles it.
Refund:    after-sale recorded ──void(case)──▶ voided
Payment:   recorded ──void(case, Completed)──▶ voided
```

### 4.5 Owner flows (phone-first; sheets reuse `ActionSheet`/`ActionForm`)

| Flow | Steps |
|---|---|
| **Open case** | From Dashboard, an Order, a Card or an Account → type + summary (links prefilled) → case detail |
| **After-sale refund** | Case → Refund (amount ≤ net paid, method, reason, confirm) |
| **Mis-keyed payment after completion** | Case → Void payment (reason, confirm) → banner "Balance due after correction ₱X" → Record payment |
| **Defective DBC** | Case → (link affected card) → Retire card (reason, confirm) → Release replacement (pick a Ready DBC) → optional Record shipment |
| **Lost code** | Case → link card → Issue new code (verification note, confirm) → the code is shown once with a "copy it now" warning |
| **Wrong account** | Case → link card → Reset ownership (verification note, confirm; warns that the old Account loses the card, keeps its Profile, and the card goes offline until re-claimed) → code shown once |
| **Lost card, paid replacement** | Case → New replacement order → normal M8 order |
| **Resolve** | Case → Resolve (optional note) |

UI rules:
- Destructive sheets use `variant="destructive"`, a confirm checkbox, and plain copy saying what is final.
- Code reveal uses the existing M4 `reveal` ActionState pattern.
- The page never re-renders the code after navigation.

### 4.6 Security

- Every `/admin/support/**` page runs `requireOwner()` (layout + page).
- Every action runs `authorize("owner")`, then Zod (uuid ids, bounded strings, peso amounts via `parsePesos`), then the service.
- No client-supplied totals, states, owners or prices.
- Services re-read everything under locks.
- Raw codes:
  - exist only in the action's return value;
  - never in Activity notes, logs, Sentry, URLs, `revalidatePath` keys or DB columns;
  - a test asserts the Activity note and the DB contain no code.
- Case pages show Account data only through the existing A3 directory DTO. No profile content, inbox, sessions or identities.
- Verification notes are free text written by the owners. Copy tells them not to paste IDs or secrets.
- `/admin/*` stays dynamic and noindex.

### 4.7 Failure behaviour

- A typed `SupportError { code }` maps to owner copy, following the `CardError`/`OrderError` patterns. Nested M8 services surface their `OrderError` through the same mapper.
- Unknown errors rethrow (Sentry).
- Bad ids → `notFound()`.
- Losing concurrent actions get domain errors after re-reading under the lock. There are no partial writes.

---

## 5. Architecture

### 5.1 Modules

New module `src/modules/support/`, all `server-only`:

| File | Responsibility |
|---|---|
| `errors.ts` | `SupportError`, codes |
| `case.ts` | `lockCase(tx, id)` (`FOR NO KEY UPDATE`), `withCase(db, {caseId, actorId, requireActive}, fn)` (transaction → lock → status check → fn → `updated_at`); `openCase`, `assignCase`, `setCaseStatus`, `reopenCase`, `addCaseNote`, `fillCaseLink`, `linkCaseCard` |
| `money.ts` | `afterSaleRefund`, `voidAfterSaleRefund`, `voidCompletedPayment`, `recordCompletedPayment`; each is `withCase` → existing payments services with `tx` and `supportCaseId` |
| `shipments.ts` | `recordSupportShipment`, `updateSupportShipment` |
| `cards.ts` | `retireAffectedCard`, `releaseReplacementCard`, `reissueActivationCode`, `resetCardOwnership` |
| `queries.ts` | `listCases` (keyset `(created_at,id)`, status filter, 25/page); `getCaseDetail` (case, links, cards with role/state/suffix, case-scoped refunds/shipments, linked orders, timeline, order totals); `casesForOrder`; `openCaseCount` |

**Changed existing code (minimal):**
- `activity/record.ts`: `supportCaseId?` in `ActivityInput`; new types `support_case_opened`, `support_case_assigned`, `support_case_waiting`, `support_case_reopened`, `support_case_linked`, `support_order_linked`, `activation_credential_reissued`, `card_ownership_reset`. Existing `support_case_resolved` is reused.
- `orders/totals.ts`: §4.1.
- `orders/order.ts` `loadOrderFacts`: split refunds.
- `orders/queries.ts` `listOrders`: settled balance.
- `orders/dashboard.ts`: outstanding SQL plus `openSupportCases`.
- `payments/record.ts`:
  - `recordRefund({ supportCaseId? })`: with it, `allow: ["completed"]` and a required reason; without it, unchanged.
  - `recordPayment({ supportCaseId? })`: with it, `allow: ["completed"]`.
- `payments/void.ts`:
  - `voidPayment({ supportCaseId? })` allows Completed only with a case;
  - `voidRefund({ supportCaseId? })` with a case: Completed only, and the row's `support_case_id` must equal it; without one: unchanged.
- Activity rows carry `supportCaseId` when given.
- `orders/create.ts`: optional `supportCaseId` (R-PAIDREPL).
- Reused untouched:
  - `lockCard` (`cards/card.ts`);
  - `revokeUsableCredential`, `issueActivationCredential`, `usableCredential` (`activation/credentials.ts`);
  - `mutateOrder`, `loadOrderFacts`;
  - `formatPeso`/`parsePesos` (`src/lib/money.ts`);
  - `formatDateTime`;
  - the `run()` action pattern (`src/app/admin/inventory/actions.ts`) with its `reveal` state;
  - `ActionSheet`/`ActionForm`/`MoneyFields` (`src/app/admin/orders/[orderId]/`).

**Routes:**
- `/admin/support` (`?status=`);
- `/admin/support/new` (`?orderId|cardId|accountId|purchaserId=`);
- `/admin/support/[caseId]` (+ `actions.ts`).

**Nav order (Step 5):** Dashboard, Orders, Inventory, Customers, Expenses, **Support**, Settings.

### 5.2 Lock order (extends M8)

**`support_cases` (`NO KEY UPDATE`) → `orders` (`NO KEY UPDATE`) → `order_items` (`NO KEY UPDATE`) → former-owner `accounts` (`KEY SHARE`, if claimed) → DBC `cards` (`FOR UPDATE`, ascending id) → `activation_credentials`.**

- Card-only reissue locks case → card → credential. Reset locks case → former-owner Account (`KEY SHARE`) → card → credential.
- **Approved lock-order ruling (2026-10-14):** Support retirement/reset take the former-owner Account lock before Card, matching M6 setup's Account → Card order. After locking Card, refuse a changed owner snapshot rather than acting on a different Account. M6 is unchanged.
- Support item locks use `NO KEY UPDATE`: they still conflict with each other, M8's item locks and item writes/deletes, but permit the `KEY SHARE` foreign-key checks caused by recovery's Card updates. An item `UPDATE` lock can deadlock with another case's reset while waiting on its Card. M8's lock mode is unchanged.
- Regression evidence: loopback R10 covers setup vs reset/retirement with either winner; R11 covers a changed-owner snapshot during reset/retirement; R12 covers unclaimed reissue vs retirement. The original `40P01` failures became green after this Support-only fix. Full command output and commit SHAs stay in the ignored ledger.
- Compatibility with existing paths:
  - M5 claim (card → credential), M6 customer card actions (card) and M4 tools (card → credential) never lock a case. Their Activity FKs take only `KEY SHARE`, which `NO KEY UPDATE` allows.
  - M8 order writers never touch cases.
  - Paid-replacement creation locks the case, then inserts the new order (no wait on an existing order).
- Account-before-Card ordering and FK-compatible parent locks avoid these cycles.

### 5.3 Caching

None added. The `/c/{token}` card state and routing are read fresh, so neither reset nor retire needs `bumpProfileContentVersion`. Actions `revalidatePath` the case page, the order page and `/admin`.

---

## 6. Database: migration `0013_support_guards` (B6)

Generate, then hand-edit SQL with `--> statement-breakpoint`, following the 0005/0012 pattern. Forward-only.

| Change | Why |
|---|---|
| Recreate the `refunds` `history_guard` trigger with `support_case_id` added to its frozen-column arguments (exact trigger name from `0005`) | B2: the tag carries financial meaning (G4) |
| `refunds` CHECK `refunds_support_reason`: `support_case_id IS NULL OR (reason IS NOT NULL AND length(trim(reason)) > 0)`, declared in `commerce.ts` so `db:generate` stays clean | Reasoned after-sale refunds at the DB layer |
| `history_guard` trigger on `support_case_cards`, freezing `support_case_id, card_id, role, created_at` (DELETE blocked by the function) | G5: the replacement count depends on these rows |

- No new tables, columns, enums or indexes. Existing `activity_events_support_case_id_idx`, `support_cases_open_idx` and `support_cases_order_id_idx` cover the queries.
- **Pre-check before any live apply:** `SELECT count(*) FROM refunds WHERE support_case_id IS NOT NULL AND (reason IS NULL OR trim(reason) = '')` = 0. No M8 code writes support refunds, and the seed creates none.
- **Seed:** unaffected. `TRUNCATE` bypasses row triggers, and the seed's support case already uses role rows that stay valid.
- **Ordering:** a live database receives `0011` + `0012` + `0013` together. Applying them to `neffi-dev` remains a separate user decision.
- **Rollback:** forward fix only. Pre-M9A code ignores the guards.

---

## 7. Canonical task sequence (one commit per code task)

**T0 — Branch, plan commit, ledger, decision record.** See §0.1. Codex only. B1–B9 are already approved; record that in the ledger.

**T1 — After-sale money model (pure)**
- **Files:** `src/modules/orders/totals.ts`, `totals.test.ts`.
- **Tests first:**
  - all M8 cases unchanged when `afterSaleRefunded = 0`;
  - an after-sale refund on Completed → balance 0, Paid, `netPaid` reduced;
  - voided payment on Completed → balance > 0, Unpaid, `refundDue` 0;
  - eligibility uses `settledPaid`;
  - cancelled `refundDue = netPaid`.
- **Invariants:** single money definition; M8 behaviour identical without support refunds.
- **Verify:** totals tests, typecheck, lint.
- **Commit:** `feat(orders): distinguish after-sale refunds in derived order money`.

**T2 — Migration 0013**
- **Files:** `src/db/schema/commerce.ts` (CHECK), `drizzle/0013_*.sql` + meta, `src/db/support-guards.db.test.ts`, `docs/database/erd.md`.
- **Tests first:**
  - updating `refunds.support_case_id` (null→case, case→null) → P0001;
  - after-sale refund with a blank/null reason → 23514;
  - sale refund without a reason is still allowed;
  - updating or deleting a `support_case_cards` row → P0001;
  - amount still frozen;
  - `void_once_guard` unaffected;
  - seed still runs.
- **Verify:** db tests, `corepack pnpm db:check`, `corepack pnpm db:generate && git diff --exit-code drizzle`, `corepack pnpm db:erd`.
- **Commit:** `feat(db): guard support refund tags and case card links`.

**T3 — Activity + Support Case core**
- **Files:** `activity/record.ts`, `support/{errors,case}.ts` + `case.db.test.ts`, boundary test.
- **Tests first:**
  - open with/without links; summary bounds;
  - assignee must be an owner;
  - status transitions incl. `resolved_at` CHECK; reopen;
  - notes in any status;
  - `fillCaseLink` fills a null link once and refuses a change;
  - `linkCaseCard` adds `affected`, duplicate refused;
  - `withCase` refuses resolved for controlled actions;
  - every mutation writes Activity with `support_case_id`;
  - unknown ids → `not_found`.
- **Commit:** `feat(support): support cases with assignment, status and notes`.

**T4 — Order read models on the new money model**
- **Files:** `orders/{order,queries,dashboard}.ts`, `support/queries.ts` (`casesForOrder`, `openCaseCount`, `listCases`, `getCaseDetail`) + tests.
- **Tests first:**
  - `loadOrderFacts` == pure totals on mixed fixtures including voided rows and after-sale refunds;
  - `listOrders` balance == pure balance for in-progress, completed-with-after-sale-refund, completed-with-balance-due and cancelled;
  - dashboard outstanding includes completed balance due; `collected` unchanged (cash by date);
  - `openCaseCount` excludes resolved;
  - case keyset paging and status filter;
  - `getCaseDetail` DTO, including Account fields only via the A3 shape.
- **Commit:** `feat(orders): read models for after-sale refunds and support cases`.

**T5 — Completed-order money corrections**
- **Files:** `payments/{record,void}.ts`, `support/money.ts` + tests.
- **Tests first:**
  - after-sale refund only when case order = order and status completed; refused on in-progress/cancelled; refused when case resolved or unlinked;
  - amount ≤ `netPaid`; reason required;
  - row has `support_case_id`; order stays completed;
  - void after-sale refund: allowed; a sale refund on Completed is refused;
  - void payment on Completed only via a case → balance due;
  - record payment on Completed only via a case, capped at balance; refused at balance 0;
  - M8 calls without a case unchanged (existing `record.db.test.ts` stays green);
  - Activity rows carry both `orderId` and `supportCaseId`.
- **Invariants:** append-only money; Completed final; B2 semantics.
- **Commit:** `feat(support): completed-order money corrections`.

**T6 — Support shipments**
- **Files:** `support/shipments.ts` + tests.
- **Tests first:**
  - record on in-progress/completed, refused on cancelled and on a case with no order;
  - `shipped_on` defaults to today; courier cost needs `shipped_on` (existing CHECK);
  - update affects only this case's shipment;
  - M8 `updateShipment` still refuses it;
  - completion facts unchanged (an in-progress courier order is not completed by a support shipment);
  - the expense report counts its courier cost once.
- **Commit:** `feat(support): replacement shipments outside order completion`.

**T7 — Retire affected card and free replacement**
- **Files:** `support/cards.ts` (retire, replacement) + tests.
- **Tests first:**
  - retire: released DBC of the case order → retired with profile/owner/disabled null and the usable credential revoked (unclaimed case);
  - claimed card (used credential) retires;
  - refused for: ready/reserved/retired, GRC, a card from another order, a cancelled order;
  - Activity has the former owner `account_id`;
  - `/c/{token}` resolves unavailable (`resolveCard`);
  - replacement: needs a prior retired affected card on the same item; second replacement for one slot refused; wrong product/kind/state refused; missing package match or usable credential refused;
  - order item, totals and payments unchanged; card counts derive;
  - in-progress order: completion waits for the replacement, then settles;
  - **integration:** the replacement card is claimed by the existing `claimCard`;
  - M4 `retireCard` tests unchanged.
- **Commit:** `feat(support): retire defective cards and release free replacements`.

**T8 — Reissue and wrong-account reset**
- **Files:** `support/cards.ts` (reissue, reset) + tests.
- **Tests first:**
  - reissue on released + unclaimed + linked: old credential revoked, exactly one usable; `checkActivationCode(old)` → unavailable, `(new)` → claimable; `public_token` unchanged;
  - refused when claimed, not linked, not released, case resolved, or verification note missing;
  - reset on claimed: owner/profile/disabled cleared; old credential stays used; new code claims under another Account via `claimCard`; former Account's Profile untouched; same token;
  - refused when unclaimed (use reissue);
  - neither the Activity note nor any table contains the raw code (a scan of the activity rows for the returned code);
  - the returned code matches `activationLookup`.
- **Commit:** `feat(support): reissue activation codes and reset wrong-account claims`.

**T9 — Paid replacement linkage**
- **Files:** `orders/create.ts`, `src/app/admin/orders/new/*` (hidden `supportCaseId`, purchaser prefill) + tests.
- **Tests first:**
  - with a non-resolved case → order created normally and `support_order_linked` written with both ids;
  - resolved/unknown case → refused, no order;
  - without a case → M8 behaviour unchanged;
  - the case detail lists the linked order.
- **Commit:** `feat(support): link paid replacement orders to cases`.

**T10 — Support pages: queue, new case, case detail**
- **Files:** `src/app/admin/support/{page,new/page,[caseId]/page,[caseId]/actions}.tsx` + tests, `admin-nav.tsx`.
- **Tests first:**
  - customer denied (404/403); owner renders;
  - Zod rejects bad ids and oversize text;
  - `SupportError`/`OrderError` codes map to copy;
  - new-case prefill from query params is validated server-side (unknown ids → ignored or `notFound`, never trusted);
  - nav marks Support;
  - render tests for each status and for a case with cards, money and shipments.
- **Commit:** `feat(support): support queue and case workspace`.

**T11 — Controlled action sheets on the case**
- **Files:** `[caseId]/page.tsx`, `actions.ts`, small client sheets reusing `ActionSheet`/`ActionForm`/`MoneyFields`.
- **Tests first:**
  - each action requires its confirm checkbox and reason/verification note (server-side Zod, not UI only);
  - sheets render only when preconditions hold (completed order for money; released linked card for card actions; open slots for replacement);
  - stale submission (case resolved meanwhile) → domain error copy;
  - code reveal is shown once, with no code in the URL or `revalidatePath`, and the page HTML after reload contains no code;
  - all controls `min-h-11`.
- **Commit:** `feat(support): guided correction actions in the case workspace`.

**T12 — Entry points and context**
- **Files:**
  - `src/app/admin/orders/[orderId]/page.tsx` (Support cases section, after-sale refund rows tagged and linked, "Balance due after correction" banner, "Open support case");
  - `src/app/admin/inventory/cards/[cardId]/page.tsx` and `src/app/admin/customers/accounts/[id]/page.tsx` ("Open support case");
  - `src/app/admin/page.tsx` (open-case count + quick action).
- **Tests first:**
  - Completed orders show no M8 money buttons, only "Open support case";
  - after-sale refunds are not voidable from the order page;
  - the A3 Account DTO key set is unchanged;
  - dashboard renders the count;
  - existing page tests stay green.
- **Commit:** `feat(admin): support entry points across orders, cards, accounts and dashboard`.

**T13 — Concurrency regression**
- **Files:** `scripts/check-support-concurrency.mts`, `package.json` script `check:support-concurrency`. Reuse the `lockedScenario`/`pg_blocking_pids` harness from `check-orders-concurrency.mts`.
- Loopback `neffi_m2_test` only. Scenarios in §8.3.
- **Commit:** `test(support): two-session correction and recovery races`.

**T14 — Documentation updates** (§10)
- **Commit:** `docs(m9a): support cases and corrections`.

**T15 — Software gate** (verification only; §9). Independent whole-branch review. Fixes go in separate commits.

**T16 — Local production-like acceptance.** STOP: needs the user. §8.5 matrix; Codex verifies with read-only SQL.

**T17 — Integration.** Push and PR only after explicit approval. No Neon/Vercel action (B7).

---

## 8. Testing strategy

### 8.1 Unit and domain
- T1 totals truth table.
- Zod schemas for case input, money, shipment and verification note.
- Error-code → copy maps.

### 8.2 Integration / DB (PGlite)

| Rule | Authoritative layer | Test |
|---|---|---|
| Refund tag frozen; after-sale reason; case–card links immutable | **DB** (0013) | T2 |
| Completed final; money append-only; void one-way | **DB** (existing) | T2 regressions |
| After-sale refund only on Completed; sale refund not voidable on Completed | **Server** under the order lock | T5 |
| Balance/payment state after correction | **Server** (pure + SQL agreement) | T1, T4 |
| Replacement count ≤ retired affected | **Server** under the item lock | T7, R4/R5 |
| Retired card routes nowhere | **DB** CHECK + server clears | T7 |
| One usable credential; used never reused | **DB** | T8 |
| Resolved case blocks actions | **Server** under the case lock | T3, R9 |
| Owner-only | **Server** (`authorize`/`requireOwner`); UI hides only | T10 |
| Confirmation + reason/verification note | **Server** (Zod) + UI | T11 |

Chains:
- M9A replacement → `claimCard`;
- reissue → `checkActivationCode`/`claimCard`;
- reset → claim by another Account.

### 8.3 Concurrency (`check:support-concurrency`, two sessions, one blocked on the lock)

1. **R1:** two after-sale refunds whose sum exceeds `netPaid` → exactly one succeeds.
2. **R2:** void payment (Completed) vs record payment on the same case → the payment sees the post-void balance or is refused at 0; never overpaid.
3. **R3:** two record-payments on a balance-due Completed order → exactly one.
4. **R4:** retire affected vs release replacement on the same item → the replacement waits; succeeds only after the retire commits.
5. **R5:** two replacements for one retired slot → exactly one.
6. **R6:** replacement vs M8 `reserveDbcCards` for the same Ready DBC → exactly one.
7. **R7:** reissue vs `claimCard` with the old code → either claim wins and reissue is refused (`card_claimed`), or reissue wins and claim returns unavailable. Exactly one usable credential when reissue wins; none when claim wins because claim consumes it.
8. **R8:** ownership reset vs the customer's `connectCardToProfile`/`setCardDisabled` → after the reset the customer action is refused; no profile is reconnected.
9. **R9:** resolve case vs a controlled action → either the action commits first and resolve follows, or the action is refused.
10. **R10:** Profile setup vs reset/retirement, each action first → no deadlock; setup either creates its Profile before correction or is refused after correction. The former Account keeps any created Profile.
11. **R11:** reset/retirement waits while another case resets and a different Account claims → stale owner snapshot is refused atomically.
12. **R12:** unclaimed reissue vs retirement → no Card/item FK cycle; retired Card has no usable credential.

The existing five suites (31 scenarios) must stay green.

### 8.4 Regression and security

**Regression:** the full M8 suite unchanged, including:
- the 11 Step 8 verifications;
- void rules on In Progress/Cancelled;
- the `claimCard` chain;
- the A3 DTO;
- order-concurrency 7.

**Security:**
- every support action denies customers (direct action calls);
- no raw code in Activity, DB, logs or HTML;
- Account data only through A3;
- ids validated as uuid;
- `check:bundle` finds no server secrets.

### 8.5 Manual acceptance matrix (T16: `next build && next start` on loopback; seeded owner)

Each scenario lists what the user observes, then the independent SQL check.

1. **After-sale refund.** A Completed DBC order receives a partial goodwill refund through a `defective_card` case.
   - **User sees:** the order is still Completed, Paid, balance ₱0, net paid reduced, and the refund is tagged with a link to the case.
   - **SQL:** the refund row's `support_case_id` is set; the order status and `completed_at` are unchanged; dashboard collected is reduced by the amount.
2. **Mis-keyed payment after completion.**
   - **User does:** voids the payment, then records the correct payment.
   - **User sees:** a balance-due banner appears and dashboard outstanding includes it. After the correct payment the banner clears.
   - **SQL:** the original row is voided with a reason; the new row exists; no money row was updated beyond the void columns.
3. **Mis-keyed after-sale refund.**
   - **User does:** voids it and re-records the correct amount.
   - **User sees:** the totals are correct.
   - **SQL:** two refund rows, one voided.
4. **Defective DBC (courier, Completed).** Steps: link the claimed card → retire → release a replacement → support shipment with courier cost.
   - **User sees:**
     - the old `/c/{token}` shows unavailable;
     - the replacement's code (from fixture provisioning) claims under the customer's Account, and the customer reconnects their Profile;
     - the order total and items are unchanged;
     - the courier cost appears once in Expenses.
   - **SQL:** the affected card is retired with null profile/owner; the replacement card is released on the original item; there are 2 `support_case_cards` rows; no new item or payment.
5. **Lost activation code (released, unclaimed).**
   - **User does:** reissues the code, copies it from the one-time reveal, then tries both codes at `/activate`.
   - **User sees:** the old code fails and the new code claims.
   - **SQL:** the old credential is revoked, the new one used, and the token is unchanged.
6. **Wrong account.** Account A claims the card, the owner resets it, then Account B claims it with the new code.
   - **User sees:** A's card list no longer shows the card and A's profile still exists; the same `/c/{token}` URL serves B after B publishes.
   - **SQL:** A's credential is still used; B's credential is used; Activity `card_ownership_reset` has A in `account_id`.
7. **Paid lost-card replacement.** From the case, "New replacement order" → normal M8 completion.
   - **User sees:** the case lists the new order; the original order is untouched.
   - **SQL:** `support_order_linked` exists with both ids.
8. **Shipping exception.** The original shipment is marked returned on a Completed order, and the `shipping_issue` case records a re-send shipment.
   - **User sees:** the order stays Completed.
   - **SQL:** the support shipment is excluded from completion facts.
9. **Refusals and boundary.** Each of these is refused or absent:
   - Completed orders show no inline money buttons;
   - after-sale refund > net paid;
   - any action on a resolved case;
   - reissue on a claimed card;
   - a customer session posting a support action.

   The user observes the copy. Codex verifies that the DB is unchanged.

**Physical device:** not required. No NFC write happens and the URL never changes, which T7/T8 and scenarios 4–6 prove in software. M7 already passed physical acceptance. Phone-width usability of the case workspace is checked in the browser's responsive view; a real-phone pass is optional.

### 8.6 Preview / remote

**Not required for M9A (B7).**
- M9A adds no integration, env var, auth/session change or public route.
- Its transaction and locking patterns (`NO KEY UPDATE` parent, savepoint nesting, pooled transactions) were proven on Neon in M8 T19.
- Migration 0013 is plain trigger/CHECK DDL, exercised on loopback PostgreSQL by the migration tests and all six concurrency suites.

If the user wants Preview evidence anyway, reuse the M8 T19 procedure verbatim, with explicit approval before any resource is created. **M9B will require an isolated Preview.** Production is never touched.

---

## 9. Final software gate (T15)

- `corepack pnpm lint` (0 errors; existing warnings unchanged).
- `corepack pnpm typecheck`.
- `corepack pnpm test` (excluding `.superpowers/**`). Record file and test counts; the M8 1,105 tests must stay green.
- `corepack pnpm db:check`; `db:generate` + `git diff --exit-code drizzle` clean; `db:erd` committed.
- `corepack pnpm build`; `corepack pnpm check:bundle`.
- All six concurrency suites on loopback `127.0.0.1:55432/neffi_m2_test`: `check:db-concurrency`, `check:provisioning-concurrency`, `check:claim-concurrency`, `check:profile-concurrency`, `check:orders-concurrency`, `check:support-concurrency`.
- **Independent whole-branch review** of `main...HEAD` against this plan. In particular prove:
  - no reopen path;
  - no money mutation beyond voids;
  - no M8 behaviour change without a case;
  - no GRC Card mutation;
  - no raw code persisted or logged;
  - the A3 DTO is unchanged;
  - M4/M5/M7 services are untouched.
- Artifact/secret scan of new history: no ledger or evidence files tracked, no secrets.
- `git status` clean.

**Evidence placement:**
- **SDD ledger (local, ignored):** commands, counts, SHAs, user-observed vs SQL evidence (kept separate), rulings, residuals.
- **Durable docs:** only rules and runbooks (§10). Never evidence dumps.

---

## 10. Documentation impact (T14)

- **`PRODUCT.md`:** move M9A items from "Planned" to current: Support Cases, corrections to Completed Orders, card corrections, replacements, shipping exceptions; keep M9B listed as later.
- **`docs/specs/`:**
  - add `support-and-corrections.md` (case lifecycle; where Completed-order corrections live; after-sale refund vs sale refund; balance due after correction; replacement, reissue and reset rules plus the code-handling rule);
  - update the "Planned: M9A" non-goal notes in `orders-and-fulfillment.md`, `money-and-costs.md` and `cards-and-activation.md`;
  - update `docs/architecture/domain-model.md` (Support Case now implemented; new card transitions released→retired and ownership reset) and `docs/architecture/system.md` (support module, extended lock order).
- **`docs/decisions/`:** a new record only if M9A adopts a long-lived rule beyond what B1–B9 already state (for example, the after-sale refund money model, or the card ownership reset semantics).
- **`docs/roadmap.md`:** mark M9A complete; keep M9B as the next milestone.
- **`docs/operations.md`:** the `0013` entry and its pre-check; the `check:support-concurrency` command.
- **`README.md`:** the status line and the script table row for `check:support-concurrency`.
- **`src/modules/README.md`:** add the `support` module and the extended lock order.
- **ERD:** regenerated.
- **Not here:** Notion edits; M2 D4 resolution note.
- **Artifact roles:**
  - this plan = feature spec + implementation plan;
  - PRODUCT.md, specs, architecture, decisions and roadmap = durable rules;
  - ledger = temporary execution record.

---

## 11. Stop conditions (Codex stops and asks)

- Any change to an approved decision B1–B9, or a plan ↔ code ↔ Notion contradiction (log `Blocked`).
- Any guard/CHECK/trigger change beyond §6. Any change to M4 `retireCard`/`replaceProvisioningCredential`, M5 claim, M6 card actions, or the M7 resolver/cache.
- Destructive operations: row/branch deletion, `db:seed` off loopback, `TRUNCATE`, force-push.
- Any Neon, Vercel, Resend, Cloudinary or Notion action; anything in Production; migrating `neffi-dev`.
- Widening the A3 DTO; Account mutation; role grants off loopback; any email sending.
- User evidence (T16); push, PR, merge.
- New dependencies; scope from §3 Out.

## 12. Definition of Done

1. Every §3 In capability works through the case workspace with Activity carrying `support_case_id`.
2. The Step 8 M9 critical verifications covered by M9A each pass as named tests:
   - #1 confirmation/verification enforced server-side;
   - #2 old credential stays used/revoked;
   - #3 same Card URL across reset and reissue;
   - #4 free replacement is not a sale;
   - #5 paid replacement is a real new Order;
   - #6 sensitive actions create Activity.

   #7 (email idempotency) is M9B.
3. The B2 money model is consistent across the pure functions, order facts, the list, the dashboard and purchaser balances.
4. Migration 0013 guards proven.
5. R1–R12 (17 Support scenarios) pass alongside the existing 31 scenarios.
6. The T15 gate is green and the independent review is approved.
7. The T16 matrix passes, with user evidence and SQL evidence recorded separately.
8. Docs updated per §10.

## 13. Risks and residuals

- **R1** (carried from M8): no partial-payment idempotency key. Applies equally to `recordCompletedPayment`; the balance cap and the void cover it.
- **R2:** a Completed order can show "balance due after correction". Intended (B3), visible on the dashboard.
- **R3:** wrong-account reset leaves the Profile with the old Account (B9). The customer may rebuild it until Profile move is planned.
- **R4:** a reissued code is delivered out-of-band by the owners (B8) until M9B decides email delivery.
- **R5:** no owner MFA on support money/credential actions. They are the first M10 step-up candidates.
- **R6:** legacy retired cards that kept an owner (seed fixture only) still appear in that customer's list (G8). Not fixed in M9A, because no production data exists. Revisit if real data shows it.
- **R7:** migrations 0011–0013 are unapplied on shared Neon. The live apply is a separate decision; run the §6 pre-check first.
- **R8:** after-sale refund semantics rely on the service rule "Completed only". The DB freezes the tag but does not cross-check order status (no cross-table trigger, same as M8 voids).

## 14. Recommended workflow after approval

1. Done: the user approved S1, S2 and B1–B9 on 2026-10-14.
2. Done: plan saved at this path, uncommitted.
3. Codex runs T0–T15 with the per-task protocol.
4. T16 needs the user.
5. Independent GPT-6.1 reviews at T15 and the lock-order ruling (user-approved substitution on 2026-10-14 after Claude providers failed).
6. After M9A merges, plan M9B (public help, recovery, email) the same way, with an isolated Preview.
