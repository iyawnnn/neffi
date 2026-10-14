# Neffi documentation

Start with [PRODUCT.md](../PRODUCT.md) for what Neffi is and how it behaves today. Then read the architecture and the spec for the area you are changing. Use [`operations.md`](operations.md) for runbooks.

## Authority map

| Question | Authoritative document | Kind |
|---|---|---|
| What is Neffi? How does it behave **today**? Terms and principles | [PRODUCT.md](../PRODUCT.md) | Current, normative |
| Stack, surfaces, module boundaries, caching, security, environments, transaction conventions | [architecture/system.md](architecture/system.md) | Current, normative |
| Entities, relationships, state machines | [architecture/domain-model.md](architecture/domain-model.md) | Current, normative |
| Exact tables, columns, constraints, indexes, triggers | [database/erd.md](database/erd.md) | Generated from migrations. Never edit by hand |
| Required behavior of a feature | [`specs/`](specs/) (list below) | Current, normative |
| Why a long-lived choice was made | [`decisions/`](decisions/) (list below) | Normative. Do not reverse without a new record |
| How to set up, migrate, deploy, provision and verify | [operations.md](operations.md) | Runbook |
| Milestone status and what is planned or deferred | [roadmap.md](roadmap.md) | Status |
| How a milestone was or will be built | [`superpowers/plans/`](superpowers/plans/) | **Historical or planned. Not a specification** |
| Per-task execution evidence | `.superpowers/sdd/` ledgers | Local and untracked. Never canonical |

## Precedence when sources disagree

1. Implemented behavior, schema and tests.
2. Later approved decisions that intentionally changed earlier behavior ([`decisions/`](decisions/)).
3. The documents above.
4. Historical milestone plans.
5. Notion.

The repository is the source of truth. Do not rebuild core behavior from old plans or Notion pages.

## Specs

- [Cards and activation](specs/cards-and-activation.md): inventory, provisioning, release, claim, credentials
- [Profiles and the public card](specs/profiles-and-public-card.md): Profiles, Scenes, Blocks, Forms, Inbox, `/c/{token}`
- [Google Review Card](specs/google-review-card.md): the simple GRC model
- [Orders and fulfilment](specs/orders-and-fulfillment.md)
- [Money and costs](specs/money-and-costs.md): payments, refunds, voids, expenses, stock costs
- [Accounts and access](specs/accounts-and-access.md): sign-in, roles, authorization, the owner Account view
- [Support and corrections](specs/support-and-corrections.md): owner cases, Completed-order money, replacements, shipping and verified card recovery

## Decision records

| # | Decision |
|---|---|
| [0001](decisions/0001-permanent-card-url.md) | Permanent `/c/{token}` indirection |
| [0002](decisions/0002-purchaser-account-card-profile.md) | Purchaser, Account, Card and Profile are separate |
| [0003](decisions/0003-profile-scene-model.md) | Profile owns identity and appearance; Scenes change content focus |
| [0004](decisions/0004-two-qr-codes.md) | Package activation QR vs digital Sharing QR |
| [0005](decisions/0005-activation-credentials.md) | One-time, HMAC-only activation credentials |
| [0006](decisions/0006-grc-simple-commercial-line.md) | Google Review Card is a simple commercial line (supersedes the earlier lifecycle design) |
| [0007](decisions/0007-price-snapshots-single-active-product.md) | Price snapshots; one active product per kind |
| [0008](decisions/0008-append-only-money.md) | Append-only money; derived totals |
| [0009](decisions/0009-database-invariants-and-lock-order.md) | Database-level invariants and lock order |
| [0010](decisions/0010-environment-isolation.md) | Environment isolation |
| [0011](decisions/0011-fresh-card-state-cached-scene-content.md) | Fresh Card state, cached Scene content, noindex |

## Current, planned and later

- **Current:** M1–M8 are merged. M9A is implemented on the feature branch, with software/local acceptance gates before integration; the specs describe its behavior.
- **Later:** M9B and M10–M12 (see [roadmap](roadmap.md)).

M9A uses the existing Support tables and subject links, with the additive guards in migration `0013`. Neon development remains through `0012` pending separate apply approval.

## Milestone plans

[`superpowers/plans/`](superpowers/plans/) holds one implementation plan per milestone, M1 to M8 (all implemented and merged) and the canonical M9A execution plan. They record the decisions and implementation sequence; task evidence stays in the ignored local ledger. The main historical drift is the earlier GRC order-fulfilment lifecycle, superseded by [decision 0006](decisions/0006-grc-simple-commercial-line.md).

## Known drift in Notion (not edited)

The locked Notion pages ("TapCard — …", Business Hub) remain useful for product intent, but these statements are stale:

- They still describe the old GRC lifecycle (Blank, Reserved, encode and test, Released) and a narrow GRC provisioning capability in M4.
- They record M7 and M8 as "not started" and the hub says the current build is M4.
- Examples use `tapcard.ph`. The final public domain is not locked in any source; use `CARD_URL_ORIGIN`.
- "Quick Demo" and "Standard vs Custom package" are not part of the implemented product.

## Open questions

- The final public domain and NFC origin.
- `profiles.theme` exists in the schema but nothing reads or writes it.
