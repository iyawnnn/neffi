# Spec: Orders and fulfilment

**Status:** implemented (M8). Related: [money and costs](money-and-costs.md), [cards and activation](cards-and-activation.md), [GRC](google-review-card.md), [0006](../decisions/0006-grc-simple-commercial-line.md), [0007](../decisions/0007-price-snapshots-single-active-product.md).

## Purpose

Let the two owners take an order on a phone, deliver it, and have it complete itself, without touching the database.

## Actors

OWNER accounts. Both owners have equal rights; **Assigned To** is informational.

## Creating an order

A purchaser name is the only required purchaser field (an existing purchaser can be chosen; a Purchaser is never linked to an Account). At least one item is required. Each line copies the active product's price inside the creating transaction; the client never sends a price. A line may carry an **agreed total** (a negotiated override). GRC lines may carry a label and https review URL; DBC lines may not. Delivery method (pickup, local hand-off, courier) and shipping fee are set at creation or later. **Paid now** records a payment in the same transaction. The order is assigned to its creator. Order numbers start at 1001.

## Editing (In Progress only)

Add, remove or change items, quantities, prices, agreed totals, delivery method, shipping fee and notes. Rules: quantity ≥ 1; a DBC quantity cannot go below its Reserved plus Released cards; a DBC line with active cards, or the last line, cannot be removed; the delivery method is locked once any DBC is Released or commercial delivery is recorded; GRC quantities are fixed once any commercial delivery is recorded (any Hand over or shipped shipment, including a DBC-only one on a mixed order). Assignment and internal notes are allowed in every status. Every change records who and when.

## Fulfilment

- **DBC:** *Reserve cards* picks specific Ready DBCs of the line's product (up to the remaining quantity; a stale selection rolls back entirely). A Reserved card can *return to stock*. *Hand over* (pickup or local) or *Ship* (courier) releases every Reserved DBC, requiring the package match and a usable credential. Partial releases are allowed.
- **GRC:** *Hand over* or *Ship* confirms delivery of the whole GRC portion. It needs no Card.
- **Hand over** records one `order_handed_over` activity event on first use. **Ship** creates a shipment (shipped date defaulting to today, optional courier, tracking, recipient, contact, address, courier cost).
- **Shipment update** (status, tracking, courier, cost) is allowed on In Progress and Completed orders. Failed, returned or lost does not reopen or change the order.
- A delivery action with nothing to deliver is refused.

## Completion (system only, exactly once)

Written by the system at the end of every input-changing transaction, under the order lock, when all hold: In Progress; at least one item; every DBC line's Released count equals its quantity; a delivery method is set; courier orders have a shipment with a shipped date (shipments tied to a support case never count), pickup/local orders with GRC have the Hand over event; and **net paid equals the order total exactly** (an overpaid order must refund first). Customer activation never affects completion. A Completed order is final.

## Cancellation

Allowed only while In Progress and before any DBC is Released, before any Hand over, and before any shipment with a shipped date. Reserved DBCs return to Ready. Payments are kept and the refund due is shown. The reason is optional. A Cancelled order is final. GRC inventory is untouched.

## Status matrix

| Action | In Progress | Completed | Cancelled |
|---|---|---|---|
| Edit items, price, delivery, fee, notes | Yes | No | No |
| Assign, internal note | Yes | Yes | Yes |
| Reserve, return, Hand over, Ship | Yes | No | No |
| Update shipment | Yes | Yes | n/a |
| Record payment | Yes | No | No |
| Record refund | Yes | No | Yes |
| Void payment | Yes | No | No |
| Void refund | Yes | No | Yes |
| Cancel | Before release or delivery | No | No |

## Concurrency

Writers serialize on the parent order, then items, DBC cards and credentials. Two final payments: one wins. Two orders reserving one Ready card: one wins. Cancel versus release, and payment versus release, produce one consistent outcome and exactly one completion event. Losing actions fail with a plain domain message and leave no partial write.

## Non-goals (current)

Deleting orders; reopening or correcting Completed orders (**Planned: M9A**); replacements and shipping-exception cases (**Planned: M9A**); order emails; invoices; courier APIs; customer order portal; partial-payment idempotency keys.
