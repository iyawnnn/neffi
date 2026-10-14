# 0009 — Important invariants live in the database; writers use a fixed lock order

**Status:** Accepted (M2 onward)

## Decision

State machines and ownership rules are enforced with CHECK constraints, triggers and composite foreign keys, not only in application code. Examples: Card state CHECKs, a single usable credential, final Order states, frozen money columns.

Multi-row changes use real transactions that lock first and re-read under the lock. Order writers lock the parent Order with `FOR NO KEY UPDATE`, then items, then DBC Cards, then activation credentials. Concurrency is regression-tested with real two-session scripts on a disposable loopback PostgreSQL.

## Consequences

Schema changes go through reviewed, forward-only migrations; there are no down migrations. Application services map database errors to plain owner-facing copy.
