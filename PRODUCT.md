# Neffi — implemented product behavior

This is the engineering-facing summary of how Neffi behaves **today**. It covers vocabulary, states, principles and the main flows, with links to the specs and decisions that define each area. When this file and a spec disagree, the spec wins. The shipped implementation is current truth; Notion holds the business context (positioning, brand, pricing presentation and the product roadmap) aligned to it (see [the sources of truth](docs/README.md#sources-of-truth)). Behavior that is approved but not built is labelled **Planned**. Milestone status is in [`docs/roadmap.md`](docs/roadmap.md).

## Identity

Neffi sells NFC cards that turn one tap into an action. It is built for non-technical customers in the Philippines, and the two owners sell and fulfil through Facebook Messenger, with manual payment confirmation (GCash, Maya, MariBank, GoTyme or bank transfer) and J&T or in-person delivery. The brand is "Neffi" (the wordmark is lowercase `neffi`). Earlier planning material called it "TapCard". The tagline is **One tap. Instant connection.** The permanent public origin is `https://getneffi.com`; card URLs are `https://getneffi.com/c/{token}`. `www.getneffi.com` redirects 308 to the apex. Configuration uses `CARD_URL_ORIGIN`; see [operations](docs/operations.md#production-setup-infrastructure-acceptance). Brand, naming, pricing and the business model are owned by Notion.

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

1. **Sale and preparation (owner).** A paid normal order (₱799 per card) is allocated cards automatically: Ready stock first, otherwise a Blank card that gets its permanent token and activation code and becomes **Preparing**. The owner copies the code onto the package label (it can be shown again until claimed), writes `<CARD_URL_ORIGIN>/c/<token>` to the tag with a phone app, reads it back, taps it with a real phone, records the NFC check, and matches the package, which makes the card **Reserved** for the order. Cards can also be prepared ahead as **Ready** stock. Both physical checks are enforced by the database. See [cards](docs/specs/cards-and-activation.md) and [0016](docs/decisions/0016-retrievable-encrypted-activation-credentials.md).
2. **Release (owner).** Hand over (In person) or Mark as shipped (J&T) releases the Reserved cards. Selling a card does not make the buyer its owner.
3. **Activation (customer).** The package contains a common insert whose QR opens `/activate`, plus a unique printed code. The customer enters the code, signs in with Google or an email code, and claims the card. A claim assigns ownership to that Account and consumes the code. Entering a code does not consume it.
4. **Setup (customer).** From **Ready to set up** a successful claim opens a step-by-step guided setup: an optional Goal (a recommendation only), then You, Photo or logo, Contact, Links, Look, Colours and Review, then Publish and Done. A Profile is created only from this step, and no starter content is created. Profile appearance is Layout (Classic, Editorial, Showcase), Light/Dark and Accent, plus an optional Showcase cover image ([spec](docs/specs/profile-customization-onboarding.md)).
5. **Use.** Tapping the card (or scanning its digital Sharing QR) opens `/c/{token}`. The server reads the Card fresh and shows the Profile's shown Scene, falling back to the Default Scene. Visitors need no account to view, save the contact, follow links, book, or send a form message.

Vocabulary: **Card** is the physical item. **Profile** is the shared identity and appearance. A **Scene** is a context-specific set of ordered **Blocks** (About, Project, Link, Contact/Save Contact, Booking, Form). Every Profile has a protected Default Scene; one other Scene may be shown instead. Appearance applies to all Scenes. **Card states:** Blank, Preparing, Ready, Reserved, Released, Retired ([transitions](docs/architecture/domain-model.md#state-machines)). Each card also has a permanent owner-facing inventory reference `N-XXXX`. "In provisioning" and "Ready to set up" are labels derived from data, not states. A **Profile** is Draft, Published or Unpublished.

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

- **Orders.** A DBC order is created from a phone with a purchaser name, quantity, payment method and delivery: the price is fixed at ₱799 per card, the product payment is recorded at creation (GCash, Maya, MariBank, GoTyme or Bank transfer; no cash), and delivery is In person or J&T with the shipping fee charged separately (it may be pending until shipping). GRC orders use the general form with the catalog price and an optional negotiated total. Orders are assigned to an owner, carry internal notes and activity history, and are In Progress, Completed or Cancelled. Completion is automatic ([orders and fulfilment](docs/specs/orders-and-fulfillment.md)). Cancellation is allowed only before any DBC release or commercial delivery.
- **Payments and refunds.** On GRC and historical orders, partial or later payments are allowed, capped at the balance ([money](docs/specs/money-and-costs.md)). Sale refunds apply to In Progress or Cancelled orders. Completed-order payment corrections and after-sale refunds require an active linked Support Case, a reason and confirmation. After-sale refunds reduce cash kept without creating a balance; a voided payment may show Balance due after correction. Originals are never changed; a void (reason required) strikes a row through and excludes it from totals.
- **Fulfilment.** In person orders are completed with Hand over; J&T orders with Mark as shipped, which confirms the fee, records its payment and the tracking number, and releases the cards. Shipment status (in transit, delivered, failed, returned, lost) can be updated even after completion, without reopening the order.
- **Inventory.** Cards are the inventory unit; counts by state and the preparation queues are always derived. Stock purchases carry supplier, reference, date and optional purchase and inbound-shipping costs.
- **Expenses.** Manual entries plus costs derived from stock purchases and courier shipments, each counted once. This is operational tracking, not accounting.
- **Customers.** Purchasers (editable, with their orders) and a read-only Account directory that shows only an allow-listed subset of data.
- **Dashboard and search.** In Progress count, outstanding balances, collected and expenses this month, stock counts, recent activity; search across orders, purchasers, accounts, cards and tracking numbers.
- **Settings.** Products and pricing (one active product per kind; the DBC price is fixed at ₱799, the GRC price is editable and changes affect future orders only) and the read-only list of owners. Owner roles are changed only by a guarded command-line tool.

## Support and corrections

Owners open cases from the Dashboard, Orders, Cards or Accounts. Cases have assignment, Open/Waiting/Resolved status, reopen, immutable related links, internal notes and Activity. Guided actions correct Completed-order money, retire defective Released DBCs, release verified free replacements against the original item, link real paid replacement orders and record support shipments. Reissue and wrong-account reset require purchase/claim verification and a note; the new code is delivered outside Neffi. Reset keeps the permanent URL and leaves the former Account’s Profile intact. See [support and corrections](docs/specs/support-and-corrections.md).

### Public support and account recovery

Customers who still control their sign-in email sign in and change it from `/app/account`, verifying the new address. `/support` creates unassigned cases without sign-in and offers support-assisted recovery for a lost inbox: an owner verifies the Account and sends a one-time recovery code to an approved new address, which the customer completes at `/support/recover`. Recovery keeps the same Account and business records; no merge or deletion occurs. Activation codes stay out of band and are blocked in email bodies. Limits and rules: [accounts](docs/specs/accounts-and-access.md), [support](docs/specs/support-and-corrections.md) and [0012](docs/decisions/0012-support-controlled-account-recovery.md).

## Abuse limits and hardening

Abuse limits use per-IPv6-/64 quotas and daily caps, with non-blocking cleanup. Responses carry a static Content Security Policy and `nosniff`, Sentry scrubs SQL parameters, and Inbox pagination uses precise cursors. Detail: [architecture](docs/architecture/system.md), [browser security headers](docs/operations.md#browser-security-headers) and [forms and Inbox limits](docs/operations.md#m10-forms-and-inbox-limits).

## Not built yet

[`docs/roadmap.md`](docs/roadmap.md#deliberately-deferred) lists the deferred features (including OWNER MFA/step-up and Turnstile) and the remaining launch gates. Notion sets their product priority.
