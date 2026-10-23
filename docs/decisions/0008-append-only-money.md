# 0008 — Money history is append-only; totals are derived

**Status:** Accepted (M2, M8)

## Decision

- Money is integer centavos. Payments and refunds are separate rows that are never deleted or amended (a history guard freezes their money columns).
- A mistake is corrected by a **void**: one-way metadata (time, actor, required reason) on the original row, which stays visible but is excluded from every total.
- Totals, balance, Paid/Unpaid, refund due, inventory counts and completion eligibility are derived from facts, never stored.
- Completion is written only by the system, once, in the same transaction as the input that makes the order eligible. Completed and Cancelled are final.

## Consequences

Corrections after completion cannot reopen an order. They use explicit compensating actions described in [support and corrections](../specs/support-and-corrections.md).
