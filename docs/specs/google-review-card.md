# Spec: Google Review Card (GRC)

For current engineering milestone status, see [the roadmap](../roadmap.md). Decision: [0006](../decisions/0006-grc-simple-commercial-line.md). This is the single source of GRC truth; it supersedes the earlier Card-lifecycle design that still appears in historical milestone plans and in Notion.

## What a GRC is

A physical NFC card whose tag holds the customer's **direct Google review URL**. Tapping it opens Google's review page. Neffi hosts nothing for it.

## What Neffi does

Neffi treats a GRC as an ordinary **Order line**:

- Product, quantity, price (snapshotted), optional agreed total.
- Optional **branch/business label** and optional **https review URL**. These are references to help the owners, and editing them has no effect on any Card or completion. Neither is required.
- Payments and refunds like any order ([money and costs](money-and-costs.md)).
- Delivery by the normal **Hand over** (pickup or local) or **Ship** (courier shipment).

Completion is exact payment plus commercial delivery. A GRC-only order needs no Card rows. A mixed order additionally requires every DBC quantity to be Released. Once a GRC portion is handed over or shipped, GRC quantities cannot be added, removed or changed on that order; prices and references stay editable while In Progress.

## What Neffi does not do

- No `/c/{token}`, redirect, activation, Account, Profile, Scene, Block, Form or analytics for a GRC.
- No Card reservation, NFC verification, review-URL encoding state, release or retirement as part of order fulfilment or cancellation.
- No Google Maps, Places or ReviewJet integration. Finding the business's Place ID, generating the review link (for example with ReviewJet), writing the tag and testing it are manual, done by the owners outside Neffi.

## Existing manual tools

The earlier M4 utilities (reserve a Blank GRC against an order item, record an NFC check for a GRC, retire a reserved GRC) remain available in Inventory. They are independent of Orders: nothing in order creation, fulfilment, cancellation or completion calls them or depends on their results. Two edges remain: removing an order line is refused while any Card is linked to it (including a reserved legacy GRC), and the legacy reserve itself needs an In Progress order and a review URL on the line.

## Non-goals

A GRC lifecycle engine, per-card fulfilment status, review-link verification, or any GRC support flow. A later decision would be needed to add any of these.
