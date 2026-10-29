# Neffi documentation

Start with [PRODUCT.md](../PRODUCT.md) for how Neffi behaves today. Then read the architecture and the spec for the area you are changing. Use [`operations.md`](operations.md) for runbooks. Coding agents also follow [AGENTS.md](../AGENTS.md).

## Sources of truth

| Source | Authoritative for |
|---|---|
| This repository | What Neffi does today: implemented product behavior (prices, payment methods, order and card flows as shipped), architecture, authentication and authorization, routes and APIs, schema, security, technical decisions, runbooks, environment state, tests, engineering milestone status, code |
| Notion — Neffi Business Hub | Business and product context aligned to the shipped product: company and brand, positioning, pricing presentation, packaging, suppliers and operations, sales and marketing, product roadmap and backlog, future product planning. Links to this repository for implementation detail |
| Obsidian | Nothing. It holds the maintainer's personal research and notes and is never needed to implement Neffi |

Shared research pages in Notion (NFC, market and competitors) are reference material, not decisions.

## When sources disagree

- **Shipped implementation and verified Production behavior are current truth.** If Notion, an older document or a historical decision disagrees, verify the code, treat the implementation as current, and update the current documents (list Notion items under [Known drift](#known-drift) until Notion is updated manually). Never change code to match stale documentation.
- **Deliberate product changes** update code and current documentation together; Notion is then aligned.
- **Within the repository:** precedence is implemented behavior, schema and tests first, then later decisions that intentionally changed earlier behavior, then the documents in the map below, then historical records. Superseded decisions stay as history and name their successor.

Notion engineering pages (including the archived engineering references and developer handoff) are historical reference, and so are the engineering details of other Notion pages. Do not rebuild behavior from them or from old plans.

## Authority map

| Question | Authoritative document | Kind |
|---|---|---|
| How does Neffi behave **today**? Terms and principles | [PRODUCT.md](../PRODUCT.md) | Current, normative summary. Specs win on detail |
| Stack, surfaces, module boundaries, caching, security, environments, transaction conventions | [architecture/system.md](architecture/system.md) | Current, normative |
| Authenticated customer UI: implemented typography, tokens, chrome, objects and interactions | [architecture/customer-ui.md](architecture/customer-ui.md) | Current engineering design reference; `/app` is the visual anchor |
| Public marketing site: implemented visual system, colour roles, dock, divider, motion, anti-patterns | [architecture/marketing-ui.md](architecture/marketing-ui.md) | Current engineering design reference for `(marketing)`; marketing intent stays with Notion |
| Philippine city/municipality data: official PSGC import and snapshot requirements | [architecture/philippine-localities.md](architecture/philippine-localities.md) | Engineering data source and import workflow |
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

- [Cards and activation](specs/cards-and-activation.md): inventory, preparation, provisioning, credentials and reveal, release, claim
- [Profiles and the public card](specs/profiles-and-public-card.md): Profiles, Scenes, Blocks, Forms, Inbox, `/c/{token}`
- [Profile layouts, appearance and guided setup](specs/profile-customization-onboarding.md): Classic/Editorial/Showcase, Light/Dark, accents, Goals, guided setup
- [Profile mode editor](specs/profile-mode-editor.md): the Scene/Profile mode content editor
- [Google Review Card](specs/google-review-card.md): the simple GRC model
- [Orders and fulfilment](specs/orders-and-fulfillment.md): normal paid DBC orders (₱799, allocation, In person/J&T), GRC and historical orders
- [Money and costs](specs/money-and-costs.md): payments and methods, refunds, voids, expenses, stock costs
- [Accounts and access](specs/accounts-and-access.md): sign-in, roles, authorization, the owner Account view
- [Support and corrections](specs/support-and-corrections.md): owner cases, Completed-order money, replacements, shipping and verified card recovery
- [Marketing homepage](specs/marketing-homepage.md): section order, approved copy, section status and what each marketing page owns
- [Supporting marketing pages](specs/marketing-pages.md): Guide, Pricing, Help and legal reading layouts, content authority and open pricing/legal copy requirements

## Decision records

| # | Decision |
|---|---|
| [0001](decisions/0001-permanent-card-url.md) | Permanent `/c/{token}` indirection |
| [0002](decisions/0002-purchaser-account-card-profile.md) | Purchaser, Account, Card and Profile are separate |
| [0003](decisions/0003-profile-scene-model.md) | Profile owns identity and appearance; Scenes change content focus |
| [0004](decisions/0004-two-qr-codes.md) | Package activation QR vs digital Sharing QR |
| [0005](decisions/0005-activation-credentials.md) | One-time activation credentials (storage clauses superseded by 0016) |
| [0006](decisions/0006-grc-simple-commercial-line.md) | Google Review Card is a simple commercial line (supersedes the earlier lifecycle design) |
| [0007](decisions/0007-price-snapshots-single-active-product.md) | Price snapshots; one active product per kind |
| [0008](decisions/0008-append-only-money.md) | Append-only money; derived totals |
| [0009](decisions/0009-database-invariants-and-lock-order.md) | Database-level invariants and lock order |
| [0010](decisions/0010-environment-isolation.md) | Environment isolation |
| [0011](decisions/0011-fresh-card-state-cached-scene-content.md) | Fresh Card state, cached Scene content, noindex |
| [0012](decisions/0012-support-controlled-account-recovery.md) | Owner verification and new-inbox proof preserve the Account; no merge or code resend |
| [0013](decisions/0013-universal-layouts-profile-appearance.md) | Universal layouts are presentations of one Profile model; appearance is Layout + Mode + Accent |
| [0014](decisions/0014-guided-setup-and-goal.md) | Guided setup builds the first Profile; Goal only recommends |
| [0015](decisions/0015-showcase-cover-image.md) | Showcase may show an optional cover image; the accent band is the fallback |
| [0016](decisions/0016-retrievable-encrypted-activation-credentials.md) | Usable activation codes are retrievable through an audited, encrypted envelope |

## Status

Current engineering milestone status, launch gates and deferred scope are maintained only in [roadmap.md](roadmap.md). Verification and operations records may still contain dated evidence. Product release direction is owned by Notion.

## Milestone plans

[`superpowers/plans/`](superpowers/plans/) holds one implementation plan per milestone (M1–M11) plus documentation plans. They record the decisions and implementation sequence as they were at the time, including Notion as the spec and the earlier "TapCard" name. They are history, not specifications. Task evidence stays in the ignored local ledger. The main historical drift is the earlier GRC order-fulfilment lifecycle, which [decision 0006](decisions/0006-grc-simple-commercial-line.md) superseded. [`superpowers/specs/`](superpowers/specs/) holds design records. Once a design is implemented, its normative wording lives in the documents above; for example, the 2026-10-25 owner-operations design and plan are implemented history whose current behavior is in the domain model, the cards and orders specs and [0016](decisions/0016-retrievable-encrypted-activation-credentials.md). Historical documents get at most a status banner or a dated addendum; their bodies are not rewritten.

## Known drift

The shipped implementation is current truth. These Notion statements (pages last edited 2026-10-17) disagree with it. Notion is not edited from the repository, so reconciliation is manual; remove each item once Notion matches.

- **Normal DBC orders:** Notion describes a catalog price with an optional negotiated total, "Paid now / Not yet paid", GCash/Bank Transfer/Cash, and pickup/local/courier (J&T or LBC). Shipped: fixed ₱799, paid at creation with GCash, Maya, MariBank, GoTyme or bank transfer, In person or J&T, shipping fee possibly pending ([orders](specs/orders-and-fulfillment.md)).
- **Card handling:** Notion lists five inventory states and manual Ready → Reserved. Shipped: six states including Preparing, automatic allocation, `N-XXXX` references and owner-retrievable codes ([domain model](architecture/domain-model.md), [0016](decisions/0016-retrievable-encrypted-activation-credentials.md)).
- **Domain and Production:** Notion says the domain is not locked and Production is unconfigured. `https://getneffi.com` is live ([roadmap](roadmap.md#environment-state)).
- **Guided setup:** Notion lists three starter goals (Network, Get Clients, Show My Work) and working theme names. Shipped: four Goals ([0014](decisions/0014-guided-setup-and-goal.md)), Classic/Editorial/Showcase layouts ([0013](decisions/0013-universal-layouts-profile-appearance.md)) and the optional Showcase cover ([0015](decisions/0015-showcase-cover-image.md)).
- Older and archived Notion engineering pages (for example Decisions → Engineering References → Archive → Developer Handoff) keep old milestone status, the superseded GRC lifecycle ([0006](decisions/0006-grc-simple-commercial-line.md) is authoritative), OWNER MFA/Turnstile as delivered (both are [deferred](roadmap.md#deliberately-deferred)), and `tapcard.ph`/`neffi.ph` examples. They are history.
- Older Notion material refers to a UI design-system overhaul plan that exists only on the parked `feat/ui-design-system` branch.

For pending acceptance, use [roadmap.md](roadmap.md), not historical plans.
