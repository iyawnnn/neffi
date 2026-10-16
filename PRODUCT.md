# Neffi — product definition (local implementation: through Milestone 10)

This is the canonical description of what Neffi is and how it behaves today. Behavior that is approved but not yet built is labelled **Planned**. For detail, follow the links to [`docs/specs/`](docs/specs/) and [`docs/decisions/`](docs/decisions/). [`docs/README.md`](docs/README.md) is the map of which document is authoritative for what.

## Identity

Neffi sells NFC cards that turn one tap into an action. It is built for non-technical customers in the Philippines, and the two owners sell and fulfil through Facebook Messenger, with manual payment (GCash, bank transfer, cash) and manual courier recording. The brand is "Neffi" (the wordmark is lowercase `neffi`). Earlier planning material called it "TapCard". The final public domain is not yet locked; the code uses `CARD_URL_ORIGIN`.

Two product lines:

| Product | What the customer gets | Does it use Neffi software after the sale? |
|---|---|---|
| **Digital Business Card (DBC)** | A physical NFC card that opens the customer's Neffi profile | Yes: activation, Profile, Scenes, Forms, Inbox |
| **Google Review Card (GRC)** | A physical NFC card that opens the business's Google review page directly | No |

## Principles

- **Easy for non-technical people.** A useful Neffi is published through a few clear decisions, without third-party integrations. The customer never sees tokens, keys or NFC.
- **Hardware and software are distinct.** The physical card carries one permanent URL; everything that changes lives on the server.
- **Owners never touch the database.** Selling, fulfilling and tracking happen in the admin area.
- **History is preserved.** Money, activity and credentials are append-only. Mistakes are corrected with explicit, reasoned actions (void, retire, revoke), never by rewriting history.
- **Derive, don't store.** Balances, payment state, inventory counts and completion are calculated from facts.
- **Important rules live in the database** as well as in code ([0009](docs/decisions/0009-database-invariants-and-lock-order.md)).
- **Purchaser ≠ Account ≠ Card owner ≠ Profile** ([0002](docs/decisions/0002-purchaser-account-card-profile.md)).
- **Server-side authorization always.** Secrets (activation codes, OTPs, tokens) never appear in URLs, logs or analytics.

## Digital Business Card

The chain is **Card → Profile → shown Scene (or Default Scene) → Blocks**.

1. **Provisioning (owner, before any sale).** Receive stock as Blank cards, then Provision a card: it gets its permanent token and its first activation code (shown once). The owner writes `<CARD_URL_ORIGIN>/c/<token>` to the tag with a phone app, reads it back, taps it with a real phone, and records the NFC check. The owner then matches the package (types the code from the label sealed with the card), which makes the card **Ready**. Ready requires both physical checks, enforced by the database.
2. **Sale and release (owner).** An Order reserves specific Ready cards, then Hand over (pickup/local) or Ship (courier) releases them. Selling a card does not make the buyer its owner.
3. **Activation (customer).** The package contains a common insert whose QR opens `/activate`, plus a unique printed code. The customer enters the code, signs in with Google or an email code, and claims the card. A claim assigns ownership to that Account and consumes the code. Entering a code does not consume it.
4. **Setup (customer).** From **Ready to set up** the customer picks a purpose (Network, Get Clients or Show My Work), enters their essentials, previews and publishes. A Profile is created only from this step.
5. **Use.** Tapping the card (or scanning its digital Sharing QR) opens `/c/{token}`. The server reads the Card fresh and shows the Profile's shown Scene, falling back to the Default Scene. Visitors need no account to view, save the contact, follow links, book, or send a form message.

Vocabulary: **Card** is the physical item. **Profile** is the shared identity and appearance. A **Scene** is a context-specific set of ordered **Blocks** (About, Project, Link, Contact/Save Contact, Booking, Form). Every Profile has a protected Default Scene; one other Scene may be shown instead. Appearance applies to all Scenes. **Card states:** Blank, Ready, Reserved, Released, Retired. "In provisioning" and "Ready to set up" are labels derived from data, not states. A **Profile** is Draft, Published or Unpublished.

A signed-in owner who opens their own published card sees the real public page plus small **Edit** and **Switch scene** links. An unavailable card (unknown, unclaimed, turned off, no Profile, Draft or Unpublished) shows visitors one generic "This Neffi isn't available right now" page with no reason; its own owner also gets a **Manage this card** link.

The customer can connect a Card to any of their Profiles, turn a Card off and on, and share its QR. Several Cards may show one Profile. Detail: [cards and activation](docs/specs/cards-and-activation.md), [profiles and the public card](docs/specs/profiles-and-public-card.md), [0001](docs/decisions/0001-permanent-card-url.md), [0003](docs/decisions/0003-profile-scene-model.md), [0004](docs/decisions/0004-two-qr-codes.md), [0005](docs/decisions/0005-activation-credentials.md).

## Google Review Card

A GRC is a **simple commercial order line** ([0006](docs/decisions/0006-grc-simple-commercial-line.md), [spec](docs/specs/google-review-card.md)):

- The tag holds the business's **direct Google review URL**, written to the tag by the owners by hand. There is no `/c/{token}`, no Neffi redirect, no activation, no Account, no Profile and no Scene.
- Finding the business's Place ID, generating the review link (for example with ReviewJet), writing the tag and testing it are manual and happen outside Neffi.
- In an Order, a GRC line has a quantity, price, and optionally a branch or business label and an HTTPS review URL. Both are references only. The order is delivered with the ordinary Hand over or courier shipment, and it needs no Card rows and no NFC evidence.
- It completes when it is fully paid and delivered. In a mixed order the DBC quantities must also be released.

## Owner business operations (`/admin`)

OWNER accounts see Dashboard, Orders, Inventory, Customers, Expenses, Support and Settings, plus global search. Detail: [orders and fulfilment](docs/specs/orders-and-fulfillment.md), [money and costs](docs/specs/money-and-costs.md), [accounts and access](docs/specs/accounts-and-access.md).

- **Orders.** A purchaser name is enough to create an order from a phone. Lines copy the catalog price; an optional negotiated total overrides a line. Orders are assigned to an owner, carry internal notes and activity history, and are In Progress, Completed or Cancelled. Items, delivery and fee can be edited while In Progress. Completion is automatic ([orders and fulfilment](docs/specs/orders-and-fulfillment.md)). Cancellation is allowed only before any DBC release or commercial delivery.
- **Payments and refunds.** Partial or later payments are allowed, capped at the balance. Sale refunds apply to In Progress or Cancelled orders. Completed-order payment corrections and after-sale refunds require an active linked Support Case, a reason and confirmation. After-sale refunds reduce cash kept without creating a balance; a voided payment may show Balance due after correction. Originals are never changed; a void (reason required) strikes a row through and excludes it from totals.
- **Fulfilment.** Pickup and local hand-off are recorded as Hand over; courier orders record a shipment with courier, tracking and cost. Shipment status (in transit, delivered, failed, returned, lost) can be updated even after completion, without reopening the order.
- **Inventory.** Cards are the inventory unit; counts by state are always derived. Stock purchases carry supplier, reference, date and optional purchase and inbound-shipping costs.
- **Expenses.** Manual entries plus costs derived from stock purchases and courier shipments, each counted once. This is operational tracking, not accounting.
- **Customers.** Purchasers (editable, with their orders) and a read-only Account directory that shows only an allow-listed subset of data.
- **Dashboard and search.** In Progress count, outstanding balances, collected and expenses this month, stock counts, recent activity; search across orders, purchasers, accounts, cards and tracking numbers.
- **Settings.** Products and pricing (one active product per kind; changes affect future orders only) and the read-only list of owners. Owner roles are changed only by a guarded command-line tool.

## Support and corrections (M9A)

Owners open cases from the Dashboard, Orders, Cards or Accounts. Cases have assignment, Open/Waiting/Resolved status, reopen, immutable related links, internal notes and Activity. Guided actions correct Completed-order money, retire defective Released DBCs, release verified free replacements against the original item, link real paid replacement orders and record support shipments. Reissue and wrong-account reset require purchase/claim verification and a note; the code is revealed once for delivery outside Neffi. Reset keeps the permanent URL and leaves the former Account’s Profile intact. See [support and corrections](docs/specs/support-and-corrections.md).

## Planned and later (not current behavior)

- **M9B acceptance:** software verification, independent review and user-approved reduced acceptance passed; PR #11 merged into main. Shared Neon development is now verified through `0015_validate_dbc_ready_checks` as of 2026-10-15. Full recovery with a verified Neffi-owned sender and two independent inboxes remains a launch gate; Production remains untouched/unconfigured. See [operations](docs/operations.md#m9b-support-recovery-and-email-runbook) for the acceptance limits.
- **Deferred:** account deletion, account merge or Profile move, Settings → Communications.
- **M10:** IPv6 /64 quotas, daily caps, non-blocking cleanup, static CSP/nosniff, Sentry SQL-parameter scrubbing, precise Inbox cursors and constraint validation migration 0015. Merged in PR #12. Software verification and T12 browser acceptance passed; shared development is through 0015 with a 16-entry journal and the Ready-check constraint validated. Schema remains 27 tables / 16 enums; both M10 restore points remain retained. OWNER MFA/step-up and Turnstile are deferred. M11 local full verification passed, with Vercel edge observation not exercised for lack of access; see [the report](docs/verification/2026-10-m11-full-verification.md) and [roadmap](docs/roadmap.md). M12 pilot readiness remains open.

`/support` creates unassigned cases without sign-in. Public contact is unverified and never auto-links records; signed-in requests use the verified Account and link only its owned Cards. Quotas and a 24-hour acknowledgement throttle bound mail. Owners reply or resolve with notices; activation codes remain out of band and are blocked in email bodies.

An owner verifies a linked customer Account, then sends an eight-digit, 24-hour recovery code to an unused new address. The customer completes `/support/recover` before signing in with it. Three wrong attempts cancel the proof. Completion preserves Account id and business records, verifies the new address and revokes sessions and optional Google. Pending recovery blocks resolution. Owner Accounts and occupied addresses are refused; no merge or deletion occurs. Secure account revokes sessions and optionally Google without changing ownership. Security notices reveal neither the other address nor codes. See [support](docs/specs/support-and-corrections.md) and [0012](docs/decisions/0012-support-controlled-account-recovery.md).
