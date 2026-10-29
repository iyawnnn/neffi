# Owner Operations Redesign — design for review

> **Historical record.** Implemented in PR #50 (2026-10-26). This document is not a specification. Current behavior: [domain model](../../architecture/domain-model.md), [cards and activation](../../specs/cards-and-activation.md), [orders and fulfilment](../../specs/orders-and-fulfillment.md), [0016](../../decisions/0016-retrievable-encrypted-activation-credentials.md).

Date: 2026-10-25

Status: Proposed; implementation is not authorized by this document.

Inspected baseline: `main` / `origin/main` at `ab75f1e9c0b7a6cfe4838c6d78b98e98d2d5711a` after fetch and fast-forward pull.

Companion plan: `docs/superpowers/plans/2026-10-25-owner-operations-redesign.md`.

## 1. Purpose and scope

An owner should always understand what to do next without understanding internal card/database states. This is one order-driven operating workflow, including the physical preparation work on a PC and phone. It retains Neffi's modular monolith and existing authorization, transaction, payment-history and public-resolution boundaries.

This document records proposed changes, not implemented behavior. The task supplies product authority; no Notion lookup is needed to re-decide the locked requirements. Existing current docs remain descriptions of today's system until implementation updates them. No Production query, migration, provider/environment change, code implementation, commit or deployment is part of this planning task.

### Locked contract

- New normal DBC orders have a server-selected `79_900` centavo unit price, displayed as **Neffi Digital Business Card — ₱799**. No price override or Paid checkbox.
- Creating a normal order records receipt of the product payment, with a required method: GCash, Maya, MariBank, GoTyme or Bank transfer. No COD.
- Owner delivery choices are **In person** and **J&T**. Shipping remains a separate charge, possibly initially unknown.
- Neffi allocates eligible stock automatically. Owners never choose an interchangeable Blank card by UUID.
- Real NFC read-back/tap and physical package matching remain required; allocation is not readiness or release.
- NFC and Sharing QR encode the identical permanent `https://getneffi.com/c/{token}`. Package QR remains common `https://getneffi.com/activate`. Codes remain private and separate.
- Authorized owners can retrieve the current code until claim/revocation. No permanent plaintext storage. Existing irreversible HMACs cannot be decrypted.
- Customer capabilities stay available to OWNER Accounts. Admin navigation does not grant authorization.
- Customer ownership begins only at successful claim after fulfillment. Public unavailability stays generic.

## 2. Current-state findings and evidence

| Area | Implemented behavior / exact source | Consequence |
| --- | --- | --- |
| Stock | `src/modules/inventory/stock-intake.ts`, `stock-purchases.ts`; `src/db/schema/inventory.ts` | Receiving quantity 50 already creates one purchase and 50 Blank card rows. Counts and costs are derived. Keep this. |
| Provision | `src/modules/cards/dbc.ts::provisionDbc` | A manually opened Blank card gets a permanent token and one HMAC-only credential; remains Blank. Raw code is returned once. |
| Physical checks | `src/modules/cards/card.ts::recordNfcCheck`; `dbc.ts::matchPackage` | Exact NFC URI plus three attestation booleans, then package code comparison, makes a card Ready. Current UI requires multiple checkboxes. |
| Orders | `src/modules/orders/create.ts`, `items.ts`; `src/app/admin/orders/new/order-form.tsx` | Arbitrary catalog snapshots, optional agreed totals, optional Paid now and payment amount. No automatic card allocation. |
| Assignment | `src/modules/orders/fulfillment.ts::reserveDbcCards`; `orders/[orderId]/page.tsx` | Owner checks specific Ready cards and reserves them. Blank cannot be attached to an order. |
| Delivery | `fulfillment.ts::handOverOrder`, `shipOrder` | Pickup/local handoff release reserved cards; courier shipment already releases them in the same transaction. There is no domain need for a second handover after shipping. Shipment fields currently allow incomplete data. |
| Completion | `orders/order.ts`, `totals.ts` | Derived fulfillment and exact settled payment produce Completed. Completed/Cancelled are final. Current release functions can release a subset; redesigned normal delivery must require every DBC ready. |
| Activation | `activation/{code,credentials,claim,challenge}.ts`; public activation actions/cookie | HMAC lookup, generic refusals, signed short-lived credential-ID cookie, rate limits, Card-first atomic claim; entering a code does not consume it. |
| Ownership | `cards/manage.ts`; `profiles/view.ts` | Claim assigns an Account, not purchaser. Profile routing/on-off remains separate. Authenticated profile preview already exists. |
| Public route | `src/proxy.ts`, `cards/{resolve,request}.ts`, public `c/[token]/{page,cached-view,unavailable}.tsx` | Fresh card availability precedes rendering. Only versioned Scene content is cached. Public responses intentionally collapse private reasons. |
| Admin presentation | `src/app/admin/{ui,shell,admin-frame,nav-sections}.tsx/ts`, Inventory/Order pages | Existing Geist/app typography, restrained panels and NextStep can be reused. Raw IDs, checklist/forms and manual reservation make the operator coordinate the database. |
| Customer navigation | `src/app/(customer)/app/{layout,app-nav}.tsx` | Viewer is known but no OWNER Admin menu entry is supplied. |
| Phone authentication | `src/auth/access.ts`, `policy.ts::safeNext`, public sign-in | Safe internal returns exist, but `requireOwner()` and the Admin layout currently lose the deep card destination for signed-out users. |

### Actual lifecycle today

Receive Blank stock → manually open card → provision → copy/write permanent URL → read back/tap/check boxes → type packaged code → Ready → create order/payment separately → manually select Ready stock → Reserved → hand over OR record courier shipment → Released → validate activation code → sign in → claim/consume credential → customer connects/creates Profile → publish.

This feels difficult because the owner must translate between Inventory, card detail and Order, identify fungible stock by technical identifiers, preserve a reveal-once code, transfer URLs between devices, and interpret internal states. Shipment and product-payment concepts are not constrained to the actual business offer. Card detail devotes similar emphasis to historical/technical details and the immediate task.

### Schema and migration facts

- `src/db/schema/enums.ts`: `payment_method = gcash | bank_transfer | cash`; `delivery_method = pickup | local_handoff | courier`; `card_state = blank | ready | reserved | released | retired`.
- `orders.shipping_fee` is a non-null integer defaulting to zero. It cannot currently express unknown versus confirmed zero. Shipping charged to customer differs from `shipments.courier_cost` paid by Neffi.
- `order_items.unit_price` is a sale snapshot; `agreed_total` affects effective totals. Keep historical values and read formulas.
- `cards_order_item_fk` checks `(order_item_id, product_id)` against the sold product. `cards_stock_has_no_order_item` forbids an order link on Blank/Ready. `cards_fulfillment_needs_order_item` requires it for Reserved/Released.
- Ready requires recorded NFC/package evidence (`cards_dbc_ready_checks_recorded`, validated by migration 0015). Ownership is permitted only Released/Retired. Public token is immutable.
- Credentials have unique HMACs and a partial unique index for one usable credential per card. Used/revoked are mutually exclusive terminal outcomes; credential rows cannot be deleted.
- Migration 0009's `activation_credentials_guard()` locks/touches the Card and clears package matching when issuing a new usable credential. Ready must be demoted before replacing its credential.
- Migrations 0005/0012/0013 enforce immutable history, one-way voids and final Order states. They must not be weakened.
- Latest migration is `0018_concerned_patch.sql`. New migrations are forward-only; never edit an applied SQL file or hand-edit the generated ERD.

### Invariants retained

Money uses integer centavos. Payments/refunds/activity remain append-only; corrections use reasoned void/refund actions. Purchaser, Account, physical Card and Profile are distinct. GRC remains a simple commercial line, not a new physical-Card lifecycle. No role changes based on email names. Every action independently authorizes. Permanent URLs, exact QR parity, one usable credential, atomic claim, physical evidence, generic unavailable reasons, request-level card freshness and cached Scene revisions remain enforced.

## 3. Approaches considered

1. **Recommended: keep the existing Card association and add internal `preparing`.** It expresses allocated but physically unfinished stock without claiming that an untested card is Reserved/Ready. Reuses the composite FK and one authoritative card/order relationship. Requires auditing every state consumer and order-aware preparation locks.
2. Separate preparation-allocation table. Preserves the enum but creates a second assignment path whose uniqueness, product consistency, counts and release must be synchronized with `cards.order_item_id`. More joins and failure modes for the same operation.
3. Allow Blank to hold an order or call unfinished cards Reserved. Smaller initial diff, but changes the meaning of existing guards/states and risks releasing untested cards. Reject.

This is a change to the state machine, not merely a relabeling exercise. Update current domain specs/ADR references during implementation.

## 4. Final owner workflow

### Receive 50 cards

Inventory → **Receive stock** → quantity 50, received date and optional supplier/costs. Save once. Show available stock and **Create order**. No mass provisioning ceremony. Untouched physical cards remain interchangeable until their allocated permanent NFC URL is written; no physical inventory labeling is required.

### Record an order and allocate

Orders → **Create paid order**. Select/create purchaser, DBC quantity (default one), payment method and In person/J&T. Show `₱799 × quantity`; no manual price, negotiated total, Paid control or payment-amount field. The server writes an append-only product payment for exactly `79_900 × quantity` in the same transaction.

The allocator fills only the item's deficit (`quantity - allocatedCount`):

1. Compatible Ready DBCs with real NFC/package evidence, usable credentials, no owner and no order, oldest `created_at,id` first.
2. Virgin Blank cards with no token/order/owner, either uncommitted or committed to the same active DBC product. Never consume GRC stock or silently rebind another product.

Ready → Reserved directly. Selected Blank is provisioned and attached as Preparing atomically; no public response exposes its activation code. **Prepare card** opens the allocated workspace. Multiple quantities show one next preparation target and progress such as `2 of 3 prepared`.

Ready-first avoids repeating physical work and consumes oldest usable prepared inventory. Selection uses `FOR UPDATE SKIP LOCKED`; a Ready card already locked by another transaction is not available to this allocator. Concurrent requests cannot receive the same card.

If stock is insufficient, preserve the real paid order/payment and any successful allocations; show **Waiting for stock** with the exact remaining quantity and **Receive stock**. Do not pretend delivery is possible or roll back the recorded commercial fact solely for a stock shortage. Receiving stock triggers a bounded post-commit retry of waiting orders (oldest Order first, one order transaction at a time); failure leaves received stock intact and offers **Allocate available stock** on the affected Order. This selects cards automatically, never presents a card picker. No background-job subsystem is needed.

### Prepare on PC and phone

The workspace explains **Next step: Write and test NFC**. Neffi allocates Admin reference `N-0051`; take any untouched physical Blank card and write that allocation's permanent NFC URL. From that point, that physical card is N-0051. Prepare one physical card at a time: "Keep this card with you until preparation is complete." No sticker, handwritten inventory number, inventory QR or additional identification confirmation is required. The reference serves Admin search, orders, support and history. Identify already-prepared or returned token-bearing cards by reading the permanent NFC URL and checking the matching activation package; never substitute an arbitrary Blank for an existing token/package. Ready-first stock with valid completed checks skips repeated preparation.

- **Copy NFC URL** gives the exact permanent URL.
- **Continue on phone** opens an accessible dialog with a QR and normal link containing only `https://getneffi.com/admin/inventory/cards/{uuid}`.
- Sign in if necessary, return to that exact authorized workspace, copy URL, switch to NFC Tools, write it, read it back and tap it. Keep the tag writable. The phone does not need a special token, credential transfer or pairing session.
- Paste the read-back URI and press **Confirm NFC test**. One action attests to the plainly listed physical steps; remove the three checkbox requirements. Keep server exact-URI validation and audit evidence. The server cannot independently observe an NFC Tools test and must not claim it does.
- Reveal/copy the current code on demand, print/write the private package label, include the common Package QR, and type the code from the actual package into **Confirm package**. The displayed/decrypted value must not auto-fill this proof. Match against HMAC under lock. Preparing → Reserved, labeled **Assigned**. Independent stock preparation still uses Blank → Ready.
- Sharing QR view/download always uses the NFC URL helper. It is available before customer claim, hidden for Retired. It is separate from the phone-workspace QR and Package QR.

### In person

Once all DBC quantities are prepared, Order and Card workspace show **Give card to customer**. Helper: “Use this after physically giving the Neffi package to the customer. They can activate it afterward.” One transaction releases all assigned cards and records the existing handover event. No separate internal-state step. Customer ownership is not assigned here.

### J&T

Before shipment save recipient name, phone and full address. Name/phone default from purchaser information; do not infer customer Account ownership. No new general address-book subsystem. Save the details on a pending shipment so they survive navigation/reloads.

Display **J&T Shipping — To be confirmed** until a fee is known. Unknown is not zero. Once known, display separate DBC, shipping and total lines. Never rewrite product price. Product payment has been recorded; shipping payment has not been assumed.

**Mark as shipped** requires all DBCs prepared, recipient/contact/address, tracking number, confirmed nonnegative shipping fee and shipped date (Manila today, correctable). Enter any missing fee in this same form. Helper: "Marking as shipped confirms the J&T shipping fee has been collected and makes the cards available for activation." No Paid checkbox, second method selector or separate payment button.

Under the existing Order lock, one transaction confirms the fee, appends a shipping receipt using the order's immutable chosen normal payment method, updates the same pending shipment to J&T/in transit, releases all prepared cards, records audit events and performs exact-settlement completion. Never edit the original product receipt; zero shipping adds no zero-value payment. Retry returns the existing shipment outcome without duplicate receipt, release or completion events. Ship/cancel/fee-save/payment-correction operations serialize on the Order; failure in any receipt, shipment, release or audit write rolls back the whole action. A corrected/voided product receipt, unexpected prior shipping receipt or inconsistent balance requires the existing reasoned correction path, never fabricated collection. Historical/manual corrections remain secondary. No separate normal shipping-payment action or follow-up handover. Commercial completion does not wait for customer activation.

Retain courier cost as a distinct optional operational cost; do not infer it from customer shipping fee or count both as one expense. Existing normal shipment updates may correct `shipped_on` with a reason and an audit event; do not rewrite a Completed order's lifecycle timestamps. A shipment correction must not remove its fulfilled date or undo release/completion.

No verified J&T tracking-URL builder exists in the repository. Initially show/copy the real tracking number and **View shipment** (internal details). Do not invent a deep link. An external tracking link needs verification against current official J&T behavior before a later addition; no tracking API is part of this redesign.

### Customer activation

Customer scans common Package QR → enters private code → compact Code accepted/sign-in or Add card → atomic claim → profile setup/edit. Claim clears the retrievable encrypted copy in that same transaction. Owner queue becomes **Activated**. Customer Preview uses the existing authenticated preview renderer; the real visitor route remains `/c/{token}`.

## 5. Proposed data changes

Numbers below assume no migration lands after 0018; rebase and advance names/indexes if it does. Generate matching Drizzle snapshots/journal through the canonical workflow. PostgreSQL cannot safely use a newly added enum label before its transaction commits. All dependent migration checks/trigger conditions compare `state::text` to the new label; no migration inserts Preparing rows or uses the new label as a typed enum constant/default/index predicate. This permits a single canonical migration transaction. Rehearse the actual Drizzle migrator from zero and 0018, not only standalone SQL.

### 0019 — `owner_operations_enum_expansion`

Add `preparing` to `card_state`; add `maya`, `maribank`, `gotyme` to `payment_method`. Keep `cash`, all delivery values and every historical row. No new-value data writes occur until the migration transaction commits. The dependent SQL uses text comparisons so a runner grouping pending migrations does not encounter an unsafe new-enum-value expression.

### 0020 — `owner_operations_workflow`

| Change | Exact proposal / compatibility |
| --- | --- |
| `cards.inventory_number` | Integer sequence-backed, unique, positive, non-null; migration locks table, backfills in stable `(created_at,id)` order, advances sequence past max, sets owned sequence default and uniqueness, then installs the number-immutability guard. Format `N-` plus minimum four digits; never truncate larger numbers. UUID and routes unchanged. Gaps allowed; never `count()+1` or reuse numbers. Existing cards get references, not invented physical evidence. |
| Preparing constraints | Extend `cards_fulfillment_needs_order_item` to include Preparing. Add `cards_preparing_dbc` requiring DBC, product, token, order link and no owner. Keep Blank/Ready no-order checks, token permanence and final-state guards. |
| Preparation transition guard | New Preparing must have a usable credential. Transition Preparing → Reserved must have NFC/package evidence and a usable credential; enforce at DB as well as service. Preserve legacy Released/Reserved rows without fabricating missing evidence. Do not add a blanket historical evidence CHECK that breaks unrelated legacy updates. |
| `orders.shipping_fee_pending` | Boolean non-null default false. Existing zero stays confirmed zero. New normal J&T orders with unknown fee set true and store zero only as numeric placeholder. Check pending implies courier delivery and `shipping_fee=0`; totals expose pending explicitly and completion refuses it. Setting known fee (including zero) clears flag atomically. |
| `orders.normal_payment_method` | Nullable retained `payment_method` enum; null for legacy orders, required and restricted to the five approved methods for new normal orders (`client_key IS NOT NULL`). Persist at creation and guard against mutation. Shipping reuses this method without guessing from historical/voided receipts. No historical backfill or payment rewrite. |
| `orders.client_key` | Nullable UUID with unique index for new normal-order submissions; existing rows null. Same form submission/retry returns the same creator's existing order without duplicate product payment or allocation. Resolve insert conflict before creating purchaser/items; never return another actor's order for a reused key. No secrets in key. |
| Shipment draft | Existing nullable fields suffice. Enforce one new normal pending draft in the Order-locked service; reuse that draft on save/ship. Do not add a unique index that could reject legacy duplicate pending rows. Keep old drafts/history intact and require explicit selection/correction on an ambiguous legacy Order rather than arbitrarily selecting or deleting one. No restriction on old shipped/support shipments. |

No sale/payment values are backfilled or changed. New fixed-price path is enforced on server, not by a global `unit_price=79900` CHECK that would invalidate historical records or GRCs. Normal form/action/service rejects override fields; the Settings DBC price editor becomes a fixed-price display. Lower-level legacy money readers/corrections remain available. New DBC lines through any reachable normal add/edit/replacement-sale action also obey ₱799; changing quantity on paid normal orders is disabled in favor of explicit cancel/refund/new order, avoiding silent extra unpaid units. Existing legacy orders retain their historical correction workflow and original prices.

### 0021 — `retrievable_activation_credentials`

Add nullable `activation_credentials.encrypted_code text`, holding a versioned authenticated-encryption envelope. Null is required on any used/revoked row. Existing rows remain null. Add nullable `activity_events.activation_credential_id uuid` referencing `activation_credentials.id`, with an index for credential audit lookup; existing events stay null. Extend `recordActivity`'s allow-listed input with `activationCredentialId`. Code reveal/adoption/replacement events carry Card plus exact credential reference, never code/envelope; the existing Card subject still satisfies `activity_events_has_subject`. The append-only Activity trigger freezes the new field too.

Update `activation_credentials_guard()` without losing its current Card serialization/package-clearing behavior:

- Keep immutable card/kind/HMAC/creation/outcome history.
- Usable new credentials store the envelope; legacy active null envelopes remain valid for lookup.
- On transition to used/revoked, clear the envelope inside the DB trigger as well as the application update, in the same transaction. Already-terminal rows cannot regain ciphertext.
- For a usable row, allow null → envelope only for owner adoption of the existing matching package code; non-null envelopes are immutable until cleared. No bulk rewriting/rekeying job in this release.
- Credential rows/HMACs remain as history; no credential deletion.

### Allocation/capacity and locks

Use `allocatedCount = preparing + reserved + released` for item capacity. Preserve distinct `preparedCount = reserved + released` and `releasedCount`. No UI or completion may treat allocated as prepared. Update `loadOrderFacts`, `getOrderDetail`, item editing, cancellation and support replacement capacity together.

Lock order: Support Case if applicable → Order `NO KEY UPDATE` → item(s) → Card(s) → credential(s). Preserve the former-owner Account-before-Card requirement in support reset. Lock multiple items deterministically. Select Ready candidates then Blank using stable `(created_at,id)` with `FOR UPDATE SKIP LOCKED`, and immediately conditionally transition each selected card. Skip-locked selection avoids competing allocator card-lock cycles; fixed-ID multi-card writers lock UUID-sorted rows.

Extract a transaction-level provisioning primitive; allocation must not commit provision/assignment separately. Every preparation mutation on an order-linked card discovers its parent, locks Order/item before Card, and revalidates the link under lock. If an unlinked snapshot becomes linked before Card lock, refuse/retry from the beginning instead of taking Order after Card. Re-read still-In-Progress status. Reading a page never allocates or issues codes.

Cancellation detaches Preparing → Blank (retaining permanent token, credential and real physical evidence) and Reserved → Ready. A token-bearing Blank returned from cancellation is **Needs preparation**, not virgin interchangeable stock; do not auto-allocate it as a fresh tag. It remains visible for finishing into Ready or retiring. Never erase/change its public token or silently reuse the physical package.

Failed Preparing cards may be retired under Order/item/Card/credential locks, revoking and clearing their code, retaining the historical order link and excluding them from allocatedCount. Automatically allocate a replacement available card for that same item; show stock shortage when needed. This is pre-release replacement, not a free after-sale support replacement. Prepared/reserved cards requiring credential replacement move to Preparing with the order link intact; package evidence clears, NFC evidence survives, and real package matching is required again. Post-release reissue/reset remains the verified Support flow.

### Payment and delivery compatibility

New-entry whitelist is `gcash | maya | maribank | gotyme | bank_transfer`. Historical `cash` remains Cash, never relabeled COD. Preserve existing payment/refund rows, support corrections and effective-total formulas. Historical refunds may need to return the original Cash payment; keep that explicit correction-only path, outside normal sale creation. Do not broaden customer access to money mutations.

Map In person to canonical `local_handoff`; display old `pickup` and `local_handoff` as In person in operational views while keeping original history available. Map J&T to `courier`, setting new normal shipment courier server-side to `J&T`. Preserve existing non-J&T courier names and shipments truthfully; their detail views must not be relabeled as J&T. No delivery enum replacement.

## 6. Secure retrievable codes

### Encryption/key contract

Use Node `crypto` AES-256-GCM, a random 12-byte nonce per encryption, a 16-byte auth tag and canonical normalized code bytes. Envelope: `v1.<keyId>.<base64url nonce>.<base64url ciphertext>.<base64url tag>`. Strictly validate lengths, version and allowed key IDs. Authenticate fixed AAD containing version, credential UUID, Card UUID and lookup HMAC; generate credential UUID before encrypting/inserting. Swapping envelopes between rows must fail.

Separate server-only configuration: `ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID` and `ACTIVATION_CODE_ENCRYPTION_KEYS` (JSON object of key ID → base64-encoded random 32-byte key). Neither derives from/reuses the lookup HMAC or auth secret. Validate configuration without echoing values. CI and disposable fixtures use distinctive synthetic keys only. Add raw, escaped and decoded key material to bundle-secret scans; scanning just the JSON blob would miss leaked individual keys.

New issuance always encrypts and HMACs. Missing active key refuses issuance without partial writes. Missing old key/corrupt envelope refuses reveal with a generic owner message; never silently regenerate a code. Existing customer claim/HMAC verification does not depend on decrypting an envelope. Retain old decryption keys until no active envelope references them and retained backups/restore plans no longer need them. Rotation writes only new credentials under the new active key; never rotate HMAC secret as part of encryption-key rotation.

### Reveal boundary and retention

Owner-only Server Action `revealActivationCodeAction`, backed by `revealActivationCode(db, {actorId, cardId, credentialId, secrets})`, returns a discriminated minimal result. Action checks current OWNER role before parsing/reading; service rechecks actor role, locks Card then credential, re-reads no owner, non-Retired and usable current credential. It never takes an Order lock, so it does not invert fulfillment locking. Claim/revoke share the Card lock; once either commits, a fresh reveal refuses. Reveal audit `activation_code_viewed` records only actor/card/credential reference, never code/envelope. Audit failure means no secret returned.

Raw code appears only after explicit Show activation code action in component memory, with Copy and Hide. Clear it on hide, navigation, page-hide and visibility loss; re-reveal after returning. Do not use local/session storage, query strings, RSC initial props, prefetch, list DTOs, analytics, mail, Activity notes or Sentry. No cache directive around secret reads. A browser that already received a code cannot have its memory/clipboard/screenshot remotely erased after claim; the old code becomes unusable and fresh responses stop returning it. Label it “Valid until activation” rather than promising remote erasure.

The operational table shows **Show code**, **Activated**, **Replaced/revoked**, or **Existing package code needed**; plaintext is not eagerly decrypted for 50 rows. Show code performs the same single-card authorized action and clears on row/filter/page changes. This satisfies owner retrieval without expanding initial secret exposure.

### Legacy HMAC-only codes: explicit conflict/resolution

Existing codes cannot be reconstructed from their HMAC. No migration can truthfully make them retrievable. Keep them valid and do not auto-revoke printed labels.

Provide owner-only **Save existing package code**: enter the existing physical code, check its HMAC/current credential/card and no claim under lock, then attach an encrypted copy to that same credential. Record `activation_code_saved` without the value. It does not invent/rematch package evidence or change the code. If the code is unavailable, use explicit pre-release replacement and physical rematch; Released unclaimed cards require existing verified Support reissue. This is the smallest safe migration bridge.

Before declaring the retrieval requirement fully launched, operators must reconcile live unclaimed stock: adopt known printed codes or explicitly replace/repackage as appropriate. Until then show the honest unavailable state; never promise retrieval of an unrecoverable legacy value. This reconciliation is a future separately authorized operations step, not a Production intervention in development.

Clearing ciphertext means removal from live rows, not retroactive erasure from Neon historical backups. Document backup retention, retained-key access and restore reconciliation. Do not claim complete cryptographic erasure or legal approval. OWNER MFA remains deferred; expanded role-compromise impact is a stated launch risk.

## 7. UI / information architecture

### Shared visual language

Operate mode. Use existing `src/app/globals.css` app tokens and `src/app/admin/ui.tsx`: Geist 400/500/600, Snow canvas, Ink text, Vermilion primary action, `text-body`, `text-meta`, `text-section`, subtle dividers and `rounded-panel`. Keep existing Admin shell/sidebar/mobile menu. No gradients, glass, large status tiles, dashboard decoration or nested page scroll regions. Explicit form labels/errors, native links/buttons, focus-visible and touch targets remain required.

### Navigation and Orders

Customer Account menu gains **Admin dashboard** only for OWNER, on desktop/mobile. Home/Profiles/Cards stay. Admin's existing Orders/Inventory navigation remains familiar. Dashboard's operations links use the same derived next-action vocabulary, not a new competing queue.

New-order form is compact: Customer → Neffi DBC/quantity and ₱799 → Payment method → Delivery → **Create paid order**. Confirmatory helper says product payment has already been received. Optional internal note is secondary. GRC and legacy/support workflows keep their existing separate domain behavior; do not force GRC into DBC preparation or expose a legacy price-override escape hatch on a normal DBC order.

Order detail leads with one next task: Waiting for stock (only when needed) → Prepare card → Confirm NFC test → Confirm package → Give card to customer / Mark as shipped → Waiting for activation → Activated. Ready-first stock skips completed preparation. Show only the current primary action; Waiting for activation is informational, not another owner confirmation. Display product and shipping receipt facts separately. Commercial completion follows delivery and exact settlement internally, without waiting for activation or adding a bookkeeping button.

### Inventory queue

Desktop columns: Card · Status · Order / Customer · Activation · Delivery · Next action. Tracking belongs under the Delivery cell or shipment detail, not another mostly empty column. Search card number, order number, purchaser name and tracking; no activation-code search or indexing. Filters: Needs preparation, Ready, Assigned, Delivered, Activated, Retired, plus **Available blanks** stock view. Preserve bounded pagination and exact cursors.

| Data | Owner label | Primary action |
| --- | --- | --- |
| virgin Blank, no order/token | Available blank | Create order (stock view, no card picker) |
| Preparing, or token-bearing unlinked Blank | Needs preparation | Prepare card |
| Ready, unassigned | Ready | View preparation |
| Reserved | Assigned | Give card to customer / Mark as shipped (Order) |
| Released, unclaimed | Given to customer / Shipped | View order / View shipment |
| Released, claimed | Activated | View card |
| Retired | Retired | View history |

Retired takes precedence over Activated. Incomplete legacy delivery metadata uses “Given to customer” only with handover evidence, “Shipped” only with shipment evidence; otherwise “Waiting for activation”, never fabricated delivery. Disabled remains a secondary fact for an Activated card, not a new manufacturing state.

Mobile uses a compact record list: reference/status, customer/order, delivery, one next action; code reveal stays explicit. No seven tiny columns or horizontal page overflow.

### Card preparation workspace

Header: Back to Inventory, Admin reference `N-0051` (no required physical label), owner state and linked Order/customer. Primary full-width Next step region always comes first. One primary task action; copy/reveal/phone tools are secondary.

Desktop uses an aligned main task column and narrower contextual rail only when Order/delivery data actually exists. Unassigned preparation uses a comfortable single column. No empty equal-height blocks. Preparation order: NFC write/test → private package matching → delivery. Below: Sharing QR (view/download), related Order/payment/delivery summary, collapsed corrections and concise Activity. Raw UUID, HMAC and credential count are absent from the primary UI.

Mobile stacks Next step → NFC/copy → package reveal/match → Order/delivery → Sharing QR → History. Phone QR dialog is useful on desktop; mobile already has Copy NFC URL. Async actions show pending state, prevent duplicate submit, preserve typed input on errors and re-read fresh state after conflict.

### Safe phone return

QR URL uses trusted configured origin + canonical validated UUID path. It contains no activation code, session, bearer token or redirect parameter. The destination is not authorization.

Extend `requireOwner(nextPath = '/admin')` with an allow-listed validated Admin path. Resolve the card params before auth and supply its exact path. The parent Admin layout must not redirect first to bare `/admin`: use its viewer check for signed-in non-owner denial, let each protected page perform its own redirect/gate, and audit every Admin page's independent guard. Actions/route handlers still gate themselves. Reuse `safeNext`; reject external, protocol-relative and escaped paths. Test Google and email sign-in keep the safe destination; authenticated customer still gets 404 at Admin.

### Customer cards/profile actions

Card page actions: **Preview**, **Edit profile**, **Sharing QR**, **Card on/off**. Preview goes to `/app/profiles/{profileId}/preview?scene={activeSceneId ?? defaultSceneId}`; extend `CardSummary` with owner-scoped selected Scene data. Do not link to another Account's preview. No Profile means setup action, no bogus preview. Keep permanent URL/copy under secondary sharing details; never change the real NFC destination.

### Activation accepted state

Compact centered utility layout with small brand, “Code accepted”, one calm explanatory line and embedded sign-in/Add card. Use existing app/sign-in scale, not marketing headline scale. Real headings, responsive form width, clear errors. Security cookie, endpoint schemas, HMAC, quotas and atomic claim behavior remain intact except encrypted-copy clearing inside claim.

### Generic public unavailable

Use existing Neffi symbol/wordmark and a short calm single-column page: “This Neffi isn't available right now.” Keep one response for all private causes. Only the actual owning Account gets the existing Manage link; business OWNER role alone does not grant it. Apply presentation to both token-route fallback and `src/app/(public)/c-unavailable/page.tsx`/not-found use of the shared Unavailable component. Preserve HTTP/robots behavior and signed internal request snapshot.

### Public profile intro

Keep resolver, Proxy, fresh checks, cached Scene loader and `ProfileRenderer` on the server. Add only a tiny client presentation sibling inside the available-profile page; pass no private state. Full profile HTML exists in SSR and remains useful without JS; no server sleep, client data fetch or conditional replacement of the profile tree.

The first available profile view per tab session **must include** the Neffi wordmark/symbol intro. A fixed decorative layer fades/reveals over approximately 700–850ms, hard maximum approximately one second from mount. It has `aria-hidden`, `pointer-events:none`, no focus handling and no live announcement; the underlying SSR profile remains immediately accessible/interactable. No CLS, server delay, fake loading request, animation library or hidden main tree. Use actual initial rendering where possible; do not use late hydration as a rule to silently delete the required feature. Performance evidence may shorten the animation, not remove it.

Reduced-motion skips animation; no-JS retains immediately useful SSR content. Repeated same-tab navigation may skip the intro. Store only `neffi:profile-intro-seen:v1=true`, never token/account/code. Blocked storage still shows the intro with an in-memory tab-runtime seen flag; full reload may replay without persistence. Unavailable, authenticated preview and contact/vCard routes do not use it. Preserve resolver/cache contracts and existing noindex/nofollow. Test positive first-view rendering and allowed skip cases; measure actual LCP/CLS during later manual review.

## 8. Affected file/module map

| Responsibility | Existing files to modify; proposed additions |
| --- | --- |
| Schema/invariants | `src/db/schema/{enums,commerce,inventory,operations}.ts`; new migrations 0019–0021 plus `drizzle/meta`; new upgrade tests; `src/db/{cards,credentials,commerce,operations,owner-operations,integrity-guards,migrations,erd}.db.test.ts`; generated `docs/database/erd.md` |
| Money/order policy | `src/modules/orders/{create,items,order,totals,products,queries,cancel,fulfillment,dashboard}.ts`; `src/modules/payments/{record,void}.ts`; new `orders/{normal-dbc,allocation,policy}.ts` with matching tests; GRC/support code only where shared policies require |
| Physical preparation | `src/modules/cards/{dbc,card}.ts`; new `cards/preparation.ts` order-aware lock helper; `src/modules/inventory/{stock-intake,queries}.ts`; `src/modules/support/cards.ts` and capacity tests; activity types |
| Credential security | `src/modules/activation/{credentials,claim}.ts`; new `activation/{encryption,retrieval}.ts`; `src/config/env-schema.ts`/tests; support issue/reissue callers; `src/lib/sentry-scrub.test.ts`; `scripts/check-client-bundle.mjs`; `.github/workflows/ci.yml` synthetic config; `.env.example` (names/synthetic examples only) |
| Admin operations | `src/app/admin/orders/new/{page,order-form,actions}.tsx/ts`; `orders/[orderId]/{page,actions,money-fields}.tsx/ts`; inventory `{page,inventory-view,format,forms,actions}.tsx/ts`; `inventory/cards/[cardId]/page.tsx`; new colocated `preparation-workspace.tsx`, `continue-on-phone.tsx`, `activation-code.tsx`; `admin/{inventory-summary,dashboard-view}.tsx`; search module/types/results; settings actions/page; affected dev Admin fixtures |
| Auth/customer | `src/auth/{access,policy}.ts` and tests; `src/app/admin/layout.tsx` plus guard sweep; `src/app/(customer)/app/{layout,app-nav}.tsx`; `cards/[cardId]/{page,card-editor}.tsx`; `src/modules/cards/manage.ts`; existing preview route/tests |
| Public presentation | public `activate/page.tsx` and form tests; `c/[token]/{page,unavailable}.tsx`; new `profile-intro.tsx`/tests/local CSS; `c-unavailable/page.tsx`; `src/proxy.test.ts`, resolver/request/cache/contact tests retain contracts |
| Security/tests/docs | `src/server-only-boundary.test.ts`, `src/app/{access-sweep,client-import-graph}.test.ts`; six `scripts/check-*-concurrency` files; `src/db/{testing,test-fixtures,setup-test-fixtures}.ts`; normative docs listed below |

Exact route paths use literal bracket directories. The plan identifies existing versus proposed tests. Do not delete old assets/components until a full caller search proves them unused.

## 9. Documentation reconciliation at implementation time

Update together with behavior:

- `PRODUCT.md`: order-driven workflow, payment channels, shipping, preparation, code retrieval.
- `docs/specs/{cards-and-activation,orders-and-fulfillment,money-and-costs,accounts-and-access,support-and-corrections,profiles-and-public-card}.md`.
- `docs/architecture/{system,domain-model,customer-ui}.md`; add `docs/architecture/owner-operations-ui.md` for the owner screen contract without redefining customer UI.
- New ADR `docs/decisions/0016-owner-operations-and-retrievable-credentials.md`: explicitly supersede the HMAC-only/reveal-once parts of 0005, retain one-time-claim behavior, and explain preparing/sequence/legacy policies. Annotate 0005 with supersession, do not erase the original decision.
- `docs/README.md` authority map/ADR summaries; `src/modules/README.md` module responsibilities.
- `docs/operations.md`: key custody/rotation/restore and rollout, provisioning/phone/dispatch, legacy code adoption, journal only after actual migration.
- `docs/database/erd.md`: regenerate, never hand-edit.
- `docs/legal/privacy-terms-operations-audit.md`: decryptable-code retention, access, backup limits, payment drift resolution. Review public Privacy/Terms wording against actual claims; change only conflicting security/retention/payment descriptions, not unrelated legal policy.
- `docs/testing/prelaunch-{human-operations-acceptance,physical-acceptance}.md`: new actual physical steps and code-reload behavior. `prelaunch-production-audit.md` remains dated evidence; append a dated supersession note if assumptions change, never rewrite historical test claims.
- `docs/roadmap.md`: update launch gates/status only after implementation evidence exists. Historical Superpowers plans stay historical, with a link to this successor when useful.

Known additional public-copy conflict: marketing currently says delivery fees confirmed before payment. New operations can record product payment while shipping remains unknown. Flag this for a narrow accuracy update to `docs/specs/marketing-pages.md` and the corresponding existing Pricing/Guide/Help/Terms statement during implementation: product payment is upfront, the fee can be confirmed later, and Mark as shipped confirms collection and records the shipping receipt without a separate payment action. Do not silently leave contradictory fulfillment/payment instructions or rewrite unrelated marketing.

## 10. Implementation phases and proof

1. Legacy-fixture/migration contract and additive schema (new-enum comparisons in dependent DDL use text); prove upgrade from 0018 preserves commercial history and physical evidence.
2. Encryption, on-demand owner retrieval, legacy adoption and atomic clear on every use/revoke/reissue/reset path; key/bundle/error tests.
3. Fixed-price paid normal DBC order and whitelist, pending shipping distinction, idempotent submission. Preserve legacy/GRC readers/corrections.
4. Automatic Ready-first allocation, order-aware preparation, shortage/retry/cancel/retire behavior; real two-session tests.
5. In person/J&T delivery orchestration; Mark as shipped atomically records shipping collection, shipment, release and completion without another payment action.
6. Order/Inventory/workspace UI, phone return and OWNER discovery; customer preview.
7. Utility/public presentation and required performance-safe public intro.
8. Current docs, complete automated validation, disposable upgrade rehearsal, protected release; separately scheduled human physical acceptance after authorized deployment.

Each phase has red→green tests before UI reliance; no reduced concurrency assertions or broad snapshots. Details/commands are in the companion plan. Intermediate phases are testable checkpoints, not permission to deploy a half-migrated workflow.

## 11. Risks, rollout and acceptance gates

| Risk | Mitigation / release evidence |
| --- | --- |
| Existing data / enum transactions | Rehearse 0018→0019–0021 using real migrator, including a single grouped transaction; text-based dependent DDL, synthetic legacy Cash/non-J&T/negotiated/terminal order fixtures unchanged. Avoid destructive enum removal and duplicate-rejecting indexes over uninspected legacy shipments. |
| Over-allocation or lock inversion | Distinct capacity/readiness counts; Order→item→Card→credential; Ready/Blank row-lock selection; real races with cancel/reissue/retire/double allocation. |
| False paid totals / premature completion | Product receipt fixed; unknown shipping explicit; saving a fee is not collection; Mark as shipped explicitly confirms collection and atomically records its receipt with shipment/release/completion. Completion refuses pending fee and uses exact settled totals. Preserve void/refund logic and historical prices. |
| Retrievable code expands secret exposure | Independent AEAD keys, on-demand audited OWNER reveal, no initial/list secret payload, clear at claim/revoke under lock. Encryption does not replace authorization; compromised OWNER session is more powerful. |
| Legacy codes / backups | HMAC is not reversible; explicit adoption/replacement and physical-label reconciliation. Document live-row deletion versus historical backups; key restore rehearsal and reconciliation before reopening restored Production. |
| Physical/database identity mismatch | Admin reference only, no inventory label; write one untouched card with its allocated permanent URL, then retain it through read-back and package HMAC match. Identify returned token-bearing cards by NFC URL/package, never virgin-stock allocation. |
| Public-card latency/privacy | SSR profile, required short first-view intro, no server delay, no CLS; reduced-motion skips animation, no-JS stays useful, storage failure uses in-memory seen state. Test all unavailable causes and owner-only manage behavior. |
| New UI hides legacy/support workflows | Preserve truthful history/correction routes and GRC commercial semantics; no new legacy-entry loopholes in normal DBC creation. |

Future deployment order: reviewed additive migrations and key configuration before the new app that selects those columns; no new workflow writes until the migration transaction has committed and all constraints and code are available. Old code can ignore nullable additions but must not continue issuing HMAC-only credentials once retrieval is launched. Briefly pause owner issuance during the credential cutover and reconcile any intervening legacy credentials. Do not roll back to an app that cannot recognize Preparing after new-state writes; use a forward fix or a reviewed compatible build. No automatic Production migration from this plan.

Required go-live evidence: full checks, upgrade rehearsal on disposable local PostgreSQL, all existing and new concurrency tests, correct key setup without secret exposure, clean PR/review/checks, restore readiness, then separately authorized human provisioning/write/read/tap/package/claim/reveal-denial tests. No software fixture proves a real physical card was written.

## Normal-workflow simplicity acceptance

- In person: Create paid order → automatic allocation → Prepare card → Confirm NFC test → Confirm package → Give card to customer → Waiting for activation → Activated.
- J&T: Create paid order → automatic allocation → Prepare card → Confirm NFC test → Confirm package → enter/confirm recipient, fee, tracking and shipped date → Mark as shipped (collection + shipment + release) → Waiting for activation → Activated. Address/fee may be saved earlier; no extra payment action.
- Receive 50 untouched cards once. One Facebook order uses Ready stock first or allocates one untouched card; with only blanks initially, 49 remain available. Write the allocated permanent URL, keep that card through preparation and package matching. No physical N-XXXX label, card picker or internal-state manipulation. Ready stock skips checks already completed.
- One obvious primary action at each meaningful step. Copy, reveal and Continue on phone are secondary tools. History/corrections stay secondary; internal commercial Completed is not another owner action and does not wait for activation. The public intro is a required release acceptance item.

## 12. Planning validation and review status

Repository/source/docs were inspected read-only; two bounded reviewers checked UI/lifecycle and docs/security. Design self-review checks scope, legacy code impossibility, unknown shipping, allocation versus readiness, lock order, no secret-bearing QR, phone deep-return, public privacy/performance and source-of-truth updates. This is a proposal for manual review; no implementation, migration, test suite, provider operation or physical acceptance has been performed by this planning task.
