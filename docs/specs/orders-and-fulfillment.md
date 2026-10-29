# Spec: Orders and fulfilment

For current engineering milestone status, see [the roadmap](../roadmap.md). Related: [money and costs](money-and-costs.md), [cards and activation](cards-and-activation.md), [GRC](google-review-card.md), [0006](../decisions/0006-grc-simple-commercial-line.md), [0007](../decisions/0007-price-snapshots-single-active-product.md).

## Purpose

Let the two owners take an order on a phone, deliver it, and have it complete itself, without touching the database.

## Actors

OWNER accounts. Both owners have equal rights; **Assigned To** is informational.

There are two order shapes. **Normal DBC orders** are how Digital Business Cards are sold today. **GRC orders** use the general order form. Historical DBC orders created before the normal flow keep the general rules as compatibility behavior. A Purchaser is never linked to an Account; a purchaser name is the only required purchaser field. Orders are assigned to their creator and numbered from 1001.

## Normal DBC orders

Created from `/admin/orders/new` (the only DBC order form) in one transaction:

- **Purchaser** (existing, or a new name with optional contact number), **quantity** 1–500, optional notes and optional linked Support Case.
- **Price** is fixed at ₱799 per card (`NORMAL_DBC_UNIT_PRICE`, `src/modules/orders/policy.ts`) and snapshotted on the line. There is no agreed total or price override. Settings refuses any other DBC price.
- **Payment** for the cards is recorded at creation as one payment of quantity × ₱799, using one required method: GCash, Maya, MariBank, GoTyme or Bank transfer. The method is stored on the order and cannot change. There is no unpaid or cash option.
- **Delivery** is **In person** (stored as `local_handoff`, fee ₱0) or **J&T** (stored as `courier`, courier fixed to "J&T"). J&T orders take recipient name, phone and address, at creation or later. The shipping fee is separate from the product price; if it is not known yet the order is *shipping fee pending*, has no order total, and cannot complete.
- **Idempotency.** The form carries a client key; resubmitting the same key returns the same order instead of creating another.
- **Allocation** runs in the same transaction and assigns cards per the [cards spec](cards-and-activation.md#dbc-preparation-owner). An order without enough stock shows *Waiting for stock* and is allocated when stock is received or from **Allocate available stock**.

After creation, a normal order's items, quantity, price, payment method and delivery method do not change. J&T details and the shipping fee are set through the J&T flow below. Ordinary payments are refused; Completed-order corrections go through Support.

## GRC orders and historical DBC orders

Created from `/admin/orders/new?product=grc` (GRC only). Each line copies the active GRC product's price inside the creating transaction; the client never sends a price. A line may carry an **agreed total** (a negotiated override) and optionally a label and https review URL. Delivery method (pickup, local hand-off, courier) and shipping fee are set at creation or later. **Paid now** records a payment in the same transaction. DBC orders created before the normal flow follow these same rules.

## Editing (GRC and historical DBC orders, In Progress only)

Add or remove items; change quantities, negotiated agreed-total overrides, delivery method, shipping fee and notes. The catalog `unit_price` snapshot on an existing line is immutable ([0007](../decisions/0007-price-snapshots-single-active-product.md)). Rules: quantity ≥ 1; a DBC quantity cannot go below its Reserved plus Released cards; a DBC line with active cards, or the last line, cannot be removed; the delivery method is locked once any DBC is Released or commercial delivery is recorded; GRC quantities are fixed once any commercial delivery is recorded (any Hand over or shipped shipment, including a DBC-only one on a mixed order). Assignment and internal notes are allowed in every status. Every change records who and when.

## Fulfilment

**Normal DBC orders**

- Cards are prepared on their card pages (NFC check, package match) until every allocated card is Reserved.
- **In person:** *Hand over* is allowed only when the full quantity is Reserved or Released. It releases the Reserved cards, requiring the package match and a usable credential, and records `order_handed_over`.
- **J&T:** *Save delivery details* records recipient, phone, address and optionally the fee. *Mark as shipped* takes the tracking number, the shipped date (default today, not in the future or before the order) and the fee if still pending. In one transaction it requires the full quantity Reserved and the product payment exact with no refunds, records the shipping fee as a payment with the order's method (when above ₱0), marks the shipment in transit, and releases the cards. A shipped date can later be corrected with a reason.
- A Reserved or Preparing card can be returned to stock (Reserved → Ready, Preparing → Blank).

**GRC and historical DBC orders**

- **DBC:** *Reserve cards* picks specific Ready DBCs of the line's product (up to the remaining quantity; a stale selection rolls back entirely). A Reserved card can *return to stock*. *Hand over* (pickup or local) or *Ship* (courier) releases every Reserved DBC, requiring the package match and a usable credential. Partial releases are allowed.
- **GRC:** *Hand over* or *Ship* confirms delivery of the whole GRC portion. It needs no Card.
- **Hand over** records one `order_handed_over` activity event on first use. **Ship** (GRC and historical orders) creates a shipment (shipped date defaulting to today, optional courier, tracking, recipient, contact, address, courier cost).
- **Shipment update** (status, tracking, courier, cost) is allowed on In Progress and Completed orders. On normal orders it applies only after shipping and cannot change the courier. Failed, returned or lost does not reopen or change the order.
- A delivery action with nothing to deliver is refused.

## Completion (system only, exactly once)

Written by the system at the end of every input-changing transaction, under the order lock, when all hold: In Progress; at least one item; every DBC line's Released count equals its quantity; a delivery method is set; the shipping fee is not pending; courier orders have a shipment with a shipped date (shipments tied to a support case never count), pickup/local orders with GRC have the Hand over event; and **settled paid (received minus sale refunds) equals the order total exactly** (an overpaid order must refund first). Customer activation never affects completion. A Completed order is final.

## Cancellation

Allowed only while In Progress and before any DBC is Released, before any Hand over, and before any shipment with a shipped date. Reserved DBCs return to Ready and Preparing DBCs to Blank. Payments are kept and the refund due is shown. The reason is optional. A Cancelled order is final. GRC inventory is untouched.

## Status matrix

For GRC and historical DBC orders. Normal DBC orders skip item/price/delivery editing and ordinary payment recording, as described above.

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

Deleting orders; reopening Completed/Cancelled orders; order emails; invoices; courier APIs; customer order portal; partial-payment idempotency keys.

## Support and corrections (M9A)

The status matrix above describes the ordinary order workspace. Completed-order payments/refunds are corrected only through an active linked Support Case with reason and confirmation. After-sale refunds reduce cash kept without creating a balance; a voided payment may expose **Balance due after correction**. **Support cases** on the order lists its cases and provides **Open support case**. Free replacements use the original item; paid replacements create a normal new order linked through Activity. Support shipments never contribute to completion. See [support and corrections](support-and-corrections.md).
