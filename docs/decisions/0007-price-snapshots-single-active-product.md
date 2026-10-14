# 0007 — Order lines snapshot prices; one active product per kind

**Status:** Accepted (M2, M8)

## Decision

`order_items.unit_price` is copied from the catalog when the line is created and never changes. Exactly one active product exists per kind (a partial unique index), and Settings edits its name and price in place. A negotiated `agreed_total` can override a line's total. Renaming a product changes only the display label on old orders.

## Consequences

Catalog price changes affect future orders only. A second product row per kind is avoided because the Card↔item composite foreign key would strand Ready stock.
