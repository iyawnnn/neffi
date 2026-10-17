# Spec: Money, payments, refunds and costs

For current engineering milestone status, see [the roadmap](../roadmap.md). Related: [0008](../decisions/0008-append-only-money.md), [orders and fulfilment](orders-and-fulfillment.md), [support and corrections](support-and-corrections.md).

## Principles

Money is integer PHP centavos; owners enter pesos (for example `1,500.50`), each entry greater than zero and at most ₱10,000,000. Payments and refunds are append-only history. Totals and states are derived, with one definition in `src/modules/orders/totals.ts` and a SQL aggregate that must agree with it.

## Derived values

| Value | Definition |
|---|---|
| Item total | `agreed_total`, or `quantity × unit_price` |
| Order total | Sum of item totals + shipping fee |
| Received | Sum of **non-voided** payments |
| Sale refunded | Non-voided refunds without a support case |
| After-sale refunded | Non-voided refunds linked to a support case (Completed orders only) |
| Settled paid | Received − Sale refunded |
| Net paid | Settled paid − After-sale refunded (cash kept; refund cap) |
| Balance | `max(Order total − Settled paid, 0)` |
| Payment state | **Paid** if Settled paid ≥ Order total, otherwise **Unpaid** |
| Refund due | In Progress: `max(Settled paid − Order total, 0)`; Cancelled: Net paid; Completed: 0 |
| Discount (display only) | `quantity × unit_price − agreed_total` when overridden |

## Payments

In Progress orders only. `0 < amount ≤ balance`; the default is the balance; overpayment is refused. Methods: GCash, bank transfer, cash. The date defaults to today (Asia/Manila). A reference is optional and hidden for cash. Partial and later payments are allowed.

## Refunds

In Progress or Cancelled orders, `0 < amount ≤ net paid`, optional reason. A refund never touches the original payment.

## Voids

A void records time, actor and a required reason on the original row, one way (a database guard blocks changing it), and excludes the row from every total. The row stays visible, struck through. The order workspace allows payment voids while In Progress and sale-refund voids while In Progress or Cancelled. An active Support Case linked to a Completed order permits payment correction, after-sale refunds and their voids. Sale refunds cannot be voided after completion. A voided payment may show **Balance due after correction**, settled by a new payment capped at balance; the order remains Completed.

## Costs and expenses

- A cost has exactly one source. Stock-purchase cost (`purchase_cost`, `inbound_shipping_cost`) lives on the stock purchase; courier cost lives on the shipment; both are editable at the source. **Manual expenses** are separate rows (date, amount, one of 6 categories, optional payee, note and order) that can be edited and deleted.
- The Expenses report is a union of all three: purchase cost counts as inventory/production on the received date, inbound shipping and courier cost as shipping/delivery on the received or shipped date. Derived rows are read-only and link to their source. A derived cost is never copied into manual expenses, so it is counted once.
- Shipping fee charged to the customer (order) and courier cost paid by Neffi (shipment) are different things.

## Dashboard definitions

*Outstanding* = sum of balances of In Progress and Completed orders (including balance due after correction). *Collected this month* = non-voided payments minus all non-voided refunds by their own dates. *Expenses this month* = the report total. There is no profit metric.

## Non-goals

Accounting, tax, payables, invoices, receipts, payment gateways and idempotency keys for partial payments (a duplicate is corrected by a void).
