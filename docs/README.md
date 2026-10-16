# Neffi documentation

Start with [PRODUCT.md](../PRODUCT.md) for how Neffi behaves today. Then read the architecture and the spec for the area you are changing. Use [`operations.md`](operations.md) for runbooks. Coding agents also follow [AGENTS.md](../AGENTS.md).

## Sources of truth

| Source | Authoritative for |
|---|---|
| This repository | Engineering: architecture, implemented and technical product behavior, authentication and authorization, routes and APIs, schema, security, technical decisions, runbooks, tests, engineering milestone status, code |
| Notion — Neffi Business Hub | Business and product intent: company and brand, product definitions, customer experience, pricing and business model, packaging, suppliers and operations, sales and marketing, product roadmap and backlog, approved business and product decisions |
| Obsidian | Nothing. It holds the maintainer's personal research and notes and is never needed to implement Neffi |

A Notion decision counts as approved when it is recorded in "Neffi — Locked Plan" or marked Locked on its page. Shared research pages in Notion (NFC, market and competitors) are reference material, not decisions.

## When sources disagree

- **Business or product intent:** Notion is authoritative. The repository follows through a spec or decision record.
- **Implemented technical behavior, schema, security or APIs:** the repository is authoritative. Technical statements in Notion are informational.
- **An approved Notion decision and the implementation disagree:** this is drift. Do not silently change either side. Report it, and list it under [Known drift](#known-drift) if the same change does not resolve it. Resolve it with a spec or decision record plus implementation, or with a revised Notion decision.
- **Within the repository:** precedence is implemented behavior, schema and tests first, then later approved decisions that intentionally changed earlier behavior, then the documents in the map below, then historical milestone plans.

Notion engineering pages (Steps 4, 6, 7 and 8, Supporting Engineering Notes, AI Build Handoff) are historical reference, and so are the engineering details of other Notion pages. Do not rebuild behavior from them or from old plans.

## Authority map

| Question | Authoritative document | Kind |
|---|---|---|
| How does Neffi behave **today**? Terms and principles | [PRODUCT.md](../PRODUCT.md) | Current, normative summary. Specs win on detail |
| Stack, surfaces, module boundaries, caching, security, environments, transaction conventions | [architecture/system.md](architecture/system.md) | Current, normative |
| Entities, relationships, state machines | [architecture/domain-model.md](architecture/domain-model.md) | Current, normative |
| Exact tables, columns, constraints, indexes, triggers | [database/erd.md](database/erd.md) | Generated from migrations. Never edit by hand |
| Required behavior of a feature | [`specs/`](specs/) (list below) | Current, normative |
| Why a long-lived choice was made | [`decisions/`](decisions/) (list below) | Normative. Do not reverse without a new record |
| How to set up, migrate, deploy, provision and verify | [operations.md](operations.md) | Runbook |
| Engineering milestone status, launch gates and deferred engineering scope | [roadmap.md](roadmap.md) | Status (the only place current status is maintained; verification and operations records keep dated evidence) |
| Verification results, evidence limits and launch handoffs | [`verification/`](verification/) | Recorded evidence, not a behavior specification |
| How a milestone was or will be built | [`superpowers/plans/`](superpowers/plans/) | **Historical or planned. Not a specification** |
| Why and how a documentation or architecture change was designed | [`superpowers/specs/`](superpowers/specs/) | Design record. Historical once implemented. Not a specification |
| Per-task execution evidence | `.superpowers/sdd/` ledgers | Local and untracked. Never canonical |

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
| [0012](decisions/0012-support-controlled-account-recovery.md) | Owner verification and new-inbox proof preserve the Account; no merge or code resend |

## Status

Current engineering milestone status, launch gates and deferred scope are maintained only in [roadmap.md](roadmap.md). Verification and operations records may still contain dated evidence. Product release direction is owned by Notion.

## Milestone plans

[`superpowers/plans/`](superpowers/plans/) holds one implementation plan per milestone (M1–M11) plus documentation plans. They record the decisions and implementation sequence as they were at the time, including Notion as the spec and the earlier "TapCard" name. They are history, not specifications. Task evidence stays in the ignored local ledger. The main historical drift is the earlier GRC order-fulfilment lifecycle, which [decision 0006](decisions/0006-grc-simple-commercial-line.md) superseded. [`superpowers/specs/`](superpowers/specs/) holds design records. Once a design is implemented, its normative wording lives in the documents above.

## Known drift

These Notion statements disagree with the repository or are stale. Notion is not edited from the repository, so reconciliation is manual.

- Older Notion material still describes the superseded GRC lifecycle (Blank, Reserved, encode and test, Released) and a narrow GRC provisioning capability in M4. [Decision 0006](decisions/0006-grc-simple-commercial-line.md) is authoritative.
- Engineering status in Notion lags the repository: the hub callout, the AI Build Handoff, Locked Plan step 9, and Step 9, whose Milestone Progress Record is stale (for example, M7 and M10 are still marked "Not started"). [roadmap.md](roadmap.md) is authoritative.
- Step 7 says OWNER MFA/step-up is enabled, the Locked Plan's Step 7 section proposes TOTP/step-up before commercial launch, and Step 8 lists Turnstile and migration rehearsal as M10 deliverables. MFA/step-up and Turnstile are deferred ([roadmap](roadmap.md#deliberately-deferred)).
- Examples use `tapcard.ph` or `neffi.ph`. No source has locked the final public domain, so use `CARD_URL_ORIGIN`.
- "Quick Demo" and "Standard vs Custom package" are not part of the implemented product.
- The hub and the AI Build Handoff refer to `docs/superpowers/plans/2026-10-14-neffi-ui-design-system-overhaul.md`, which exists only on the parked `feat/ui-design-system` branch.

## Open questions

- The final public domain and NFC origin.
- `profiles.theme` exists in the schema but nothing reads or writes it.
