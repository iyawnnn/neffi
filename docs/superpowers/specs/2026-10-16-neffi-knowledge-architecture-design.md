# Neffi knowledge architecture — design

> **Implementation history — not a current specification.** Retained as written for provenance; instructions, names and verification plans below describe that implementation context. Current contracts and superseding decisions are indexed in [the documentation authority map](../../README.md#authority-map); current status is in [roadmap](../../roadmap.md). Earlier GRC lifecycle assumptions are superseded by [0006](../../decisions/0006-grc-simple-commercial-line.md).


**Status:** approved design, not implemented. Date: 2026-10-16. Baseline: `origin/main` `b1881af9d93c9181efde2ff077c4c67eeb68f617` (after M11, PR #13).

This is a design record. Once it is implemented, the normative wording lives in `AGENTS.md` and `docs/README.md`, and this file becomes history, like a milestone plan.

## 1. Purpose

Neffi knowledge lives in three places, and today they make overlapping claims. The audit of the baseline, the Notion Business Hub and the vault found these problems:

- **Global "repo wins" rule.** `docs/README.md` ranks Notion fifth and says "The repository is the source of truth." The Business Hub "Source-of-truth rule" callout and "AI Build Handoff — Read First" say the same. That gives GitHub authority over business and product intent it does not own.
- **Status copied into about seven places.** Milestone status appears in `README.md`, `PRODUCT.md`, `docs/README.md`, `docs/roadmap.md`, the hub's status callout, the Locked Plan (step 9) and the AI Build Handoff. Several copies are stale: `README.md` says PR #12 "awaits merge approval", `PRODUCT.md` is titled "through Milestone 10", `docs/README.md` lists plans as "M1 to M8 … and M9A", the `docs/roadmap.md` M11 row says merge "require[s] separate approval", and the hub calls M11 "next".
- **Release roadmap kept twice.** V1 → V2+ appears in both the Locked Plan "Release Direction" and the `docs/roadmap.md` "Release mapping".
- **Notion restates repo architecture.** Steps 4, 6, 7 and 8, Supporting Engineering Notes, the AI Build Handoff and the Locked Plan's "Step 4–8 Locked Direction" sections repeat architecture the repo now owns, and they have drifted (Step 7 still has OWNER MFA/step-up before launch, Step 8 still has Turnstile; see the [M11 report](../../verification/2026-10-m11-full-verification.md), handoff item 7).
- **Dangling reference.** Notion points to `docs/superpowers/plans/2026-10-14-neffi-ui-design-system-overhaul.md`, which exists only on the parked `feat/ui-design-system` branch, not on `main`.
- **Misfiled behavior in PRODUCT.md.** Its "Planned and later" section holds current M9B support/recovery behavior next to milestone narrative.
- **Empty vault area.** The Obsidian project area (`01 Projects/Neffi/`: `Neffi.md`, `Research.md`, `Ideas.md`, `Decisions.md`) holds stubs only.

This design gives each kind of question one owner, replaces the global rule with domain-specific conflict rules, and corrects the boundaries with the fewest possible edits.

## 2. Authoritative boundaries

| Owner | Owns | Answers |
|---|---|---|
| **Notion** — Neffi Business Hub | Company and brand; product definitions; customer experience and journeys; pricing and business model; packaging; suppliers and manufacturing; business operations and policies; sales and marketing; product roadmap and backlog; approved business/product decisions | What are we building, why does it exist, and how should the product and business work? |
| **GitHub** — `neffi` repo | Architecture; implemented behavior and contracts; technical product behavior; authentication and authorization; routes and APIs; schema; security; technical ADRs; setup and runbooks; testing; engineering milestone status; code | How does Neffi technically work, and how must it be implemented? |
| **Obsidian** — Ian's vault | Personal and private exploratory research; scratch thinking; NFC/NTAG/NDEF learning; technical discoveries; design inspiration; unapproved ideas; lessons learned; cross-project knowledge | What do I know, what have I learned, what am I still thinking about? |

Boundary cases:

| Topic | Notion | GitHub |
|---|---|---|
| Product behavior | Intent: what the customer can do and why | The exact behavior as built: states, guards, validation, edge cases (`docs/specs/`, `PRODUCT.md`) |
| Brand and visual design | Brand Identity and design direction | Implemented tokens and components |
| Roadmap | Releases (V1, V1.1, V1.2, V2+), backlog, priority | Milestones M1–M12, their status, launch gates (`docs/roadmap.md`) |
| Pricing | Price decisions and business model | Price-snapshot mechanics ([0007](../../decisions/0007-price-snapshots-single-active-product.md)). Live prices are admin data |
| Public domain | Which domain to use (still open) | `CARD_URL_ORIGIN` and its configuration |
| Pilot | The physical/customer pilot as a business activity | The M12 readiness gate and its evidence |
| Deferred features | Whether and when to build them | The record that they are not built and need their own plan |
| Shared research | Research the co-owner needs, kept as non-normative reference | — |

**Approved** in Notion means recorded in the Locked Plan or under 08 Decisions, or explicitly marked Locked on its page. Anything else in Notion, including shared research, is reference material and decides nothing.

## 3. Conflict resolution

There is no global hierarchy. Classify the conflict first:

| Conflict | Authority | Action |
|---|---|---|
| Business or product intent | Notion | GitHub changes only through a spec or ADR (§4) |
| Implemented technical behavior, schema, security, API | GitHub | Notion's technical statements are reconciled to GitHub, or left marked historical |
| An approved Notion decision ≠ current GitHub implementation | Neither, automatically | **Drift.** Do not silently change code to match Notion or rewrite Notion to match code. Report it to the user. If the same change does not resolve it, record it under "Known drift" in `docs/README.md`. Resolve it with a new spec/ADR plus implementation, or with a revised Notion decision |
| Within GitHub | Existing order | Implemented behavior/schema/tests → later ADRs → current docs → historical plans |
| A historical Notion engineering page, or the engineering details of a mixed page | GitHub | The Notion text is informational only |
| Obsidian vs anything | — | Obsidian informs and never decides |

## 4. Promotion flow

```
Personal research / exploratory idea   → Obsidian (or shared research in Notion, as reference)
Approved business/product decision     → Notion (Locked Plan / Decisions / authoritative product page)
Technical consequence / requirement    → GitHub spec (docs/specs/) or ADR (docs/decisions/)
Implementation                         → code + tests
```

- Each step links one step back and does not copy it. A spec that implements a product decision names the Notion decision (title and link) in one line and states only the technical requirement.
- A conclusion moves forward. The supporting evidence stays where it was produced.
- Promotion into Notion, or into a new behavior spec, needs the user's approval. Agents do not promote on their own.

## 5. GitHub target state

Keep the existing structure: `docs/architecture/`, `docs/database/`, `docs/decisions/`, `docs/specs/`, `docs/verification/`, `docs/superpowers/plans/`, `docs/operations.md`, `docs/roadmap.md`. There is no `docs/product/`, and nothing is moved or deleted. Planned edits:

| File | Change |
|---|---|
| `AGENTS.md` | Leave the `nextjs-agent-rules` block byte-for-byte unchanged. Add a short Neffi section **below** `<!-- END:nextjs-agent-rules -->`: reading order (§11), the boundary and conflict rules in brief, and the hard rules (Obsidian never required; Notion engineering pages and old plans are not specs). `next dev` rewrites only the text between the markers (`upsertAgentRulesBlock` in `next/dist/server/lib/generate-agent-files.js`), so the new section survives |
| `CLAUDE.md` (new) | The single line `@AGENTS.md`, so agent guidance is written once. Next.js does not generate this file |
| `docs/README.md` | Replace "Precedence when sources disagree" with §2–§3 in brief, keeping the within-GitHub order. Narrow the `PRODUCT.md` row to "how Neffi behaves today (engineering summary)". Add a row for `superpowers/specs/` (design records, historical once implemented). Correct "Current" (M11 merged, PR #13) and "Milestone plans" (M1–M11). Refresh "Known drift in Notion" with the M11 handoff item 7 and the dangling UI-plan reference |
| `PRODUCT.md` | Same name and location, re-scoped (§6). Retitle it through M11. Reduce the business context to a short paragraph that points to Notion. Move the M9B behavior paragraphs into the Support section. Delete the milestone narrative, which `docs/roadmap.md` already holds |
| `docs/roadmap.md` | Engineering only (§7). Correct the M11 row and shorten the M9B row. Replace "Release mapping" with a link to Notion 07 Roadmap, but only after that content exists in Notion |
| `README.md` | Replace the stale "Status:" paragraph with one line linking `docs/roadmap.md`. Update how the docs list describes `PRODUCT.md` |

Not touched: specs, ADRs, architecture docs, `database/erd.md` (generated), `verification/`, `operations.md` (its Notion note at line 221 is a historical runbook record), `src/modules/README.md`, milestone plans, code.

## 6. Role of PRODUCT.md

`PRODUCT.md` is the engineering-facing bridge between product intent and code. It is one readable summary of **implemented** product behavior, vocabulary, states and principles, with links to the specs and ADRs that define each area. It is not the master product definition. Product intent and rationale belong to Notion. When `PRODUCT.md` and a spec disagree, the spec wins. Approved-but-unbuilt behavior is labelled **Planned** and links the Notion decision instead of restating it. The file carries no milestone status.

## 7. Role of docs/roadmap.md

`docs/roadmap.md` is the single home for engineering delivery status: milestones, merge state, migration and shared-environment state, launch gates, and deferred engineering scope. Product release sequencing and priority belong to Notion 07 Roadmap. Any other document that needs status links here.

## 8. Roles of AGENTS.md and CLAUDE.md

`AGENTS.md` is the single entry point for every coding agent (Codex, Claude Code and others). It holds the generated Next.js block plus a short Neffi section, and it points to the `README.md` "Security rules" instead of repeating them. `CLAUDE.md` only imports `AGENTS.md`. Neither file holds status or product content.

## 9. Notion target state

The Business Hub becomes the business/product source of truth through **navigation, not migration**. The hub page gets section headings that link the existing pages. No pages are moved or recreated, and no empty placeholder pages are added. A section with no content yet says so.

| Section | Existing pages |
|---|---|
| 01 Company | Brand Identity |
| 02 Products | Step 1 — Product Catalog; Step 2 — Product Definitions |
| 03 Product Experience | Packaging & Activation Experience; Public Profile Templates; Page Inventory & UX Sitemap; Mobile-First Design System; Step 5 — Admin Pages & Capabilities |
| 04 Business | Step 3 — Order & Fulfillment Workflow; pricing and policies when written |
| 05 Operations | Step 9 — Build & Physical Pilot; suppliers and manufacturing when written |
| 06 Marketing | Market & Competitor Research (shared reference) |
| 07 Roadmap | Release direction (V1 → V2+) and backlog. Engineering status links to GitHub `docs/roadmap.md` |
| 08 Decisions | Neffi — Locked Plan |
| Research (shared reference) | NFC Technical Research |
| Engineering reference (historical) | Step 4; Step 6; Step 7; Step 8; Supporting Engineering Notes; AI Build Handoff — Read First |

Hub callouts: the "Source-of-truth rule" callout is replaced with the §2–§3 rule. The "Current implementation status" callout becomes one line linking `docs/roadmap.md`, so Notion stops carrying engineering status.

**Historical technical pages** (Step 4, Step 6, Step 7, Step 8, Supporting Engineering Notes) are preserved, not deleted. Each gets one top callout: *Historical engineering reference. GitHub is authoritative for architecture, schema, security and status*, with a link to the repo's `docs/README.md`. They are not updated to track implementation after that. The Locked Plan's "Step 4–8 Locked Direction" sections get the same one-line marker, and the rest of the Locked Plan stays active.

**AI Build Handoff — Read First** is preserved as a historical engineering/build reference with the same callout. Once the repository guidance is updated, it is no longer a current engineering source. Current agents use the sources in §11.

**Mixed pages** (Step 3, Step 5, Step 9) stay active where they express product behavior, business operations, customer experience, owner workflow from a business perspective, and pilot/readiness intent. Any architecture, schema, route, security, caching, database or code detail inside them is a non-authoritative engineering reference that defers to GitHub. They are not split or rewritten in the first pass. A short note at the top of each page states this.

## 10. Obsidian target state and the research boundary

- **Personal/private exploratory research and scratch thinking go to Obsidian.** It is Ian's personal knowledge base, not a shared company workspace, and never a dependency for implementing Neffi.
- **Shared business research the co-owner needs** may stay in Notion as non-normative research/reference material.
- **Approved business/product conclusions** go to authoritative Notion product/business pages or Decisions.
- **Technical consequences** go to GitHub.

The current shared NFC Technical Research and Market & Competitor Research pages stay in Notion and are **not** migrated automatically. The four Neffi stubs in the vault (`Neffi.md`, `Research.md`, `Ideas.md`, `Decisions.md`) stay unchanged at this stage. When they are used, notes link out to Notion and GitHub and do not mirror them. Cross-project knowledge goes in the vault's existing top-level folders.

## 11. How coding agents consume documentation

1. Sources, in order: the current task prompt, `AGENTS.md` (and `CLAUDE.md`, which imports it), `docs/README.md`, `PRODUCT.md`, the relevant specs, ADRs and architecture docs, then schema, tests and code.
2. Implementing Neffi must never require Obsidian. Agents do not consult it.
3. Agents read Notion (read-only) only when a task introduces or changes product intent and the prompt has not already supplied it. If a needed product decision exists in neither Notion nor GitHub, stop and ask rather than invent it. The decision is promoted into a spec or ADR before or within the change.
4. Notion engineering pages, the AI Build Handoff, the engineering details of mixed pages, and historical milestone plans are never used as a spec.
5. Drift that is found is reported, not silently resolved (§3).

## 12. Historical implementation plans

`docs/superpowers/plans/` stays unchanged. The M1–M11 plans cite Notion as their spec and use "TapCard". That is accurate history and is not rewritten. `docs/README.md` already labels them "historical or planned, not a specification", and that label is kept. New plans name GitHub specs and ADRs as their contract and link Notion decisions only for product intent. Design records in `docs/superpowers/specs/`, including this one, become historical once implemented.

## 13. Anti-duplication rules

1. Each fact has one home, and every other place links to it.
2. `docs/roadmap.md` is the only place current engineering milestone status (milestones, PRs, migration and test counts) is maintained. Historical verification and operations records may still contain dated evidence.
3. Product intent is not copied into GitHub. Specs state the technical requirement and link the decision.
4. Engineering detail is not maintained in Notion. Notion links GitHub.
5. Agent guidance lives only in `AGENTS.md`.
6. Obsidian notes link out and never mirror Notion or GitHub.
7. `docs/database/erd.md` stays generated and is never edited by hand.

## 14. Validation and success criteria

GitHub pass:
- `git diff --name-status` against the planning-stage commit (the execution baseline that already holds this spec and its plans), not against `main`, shows only `M`/`A` on `AGENTS.md`, `CLAUDE.md`, `README.md`, `PRODUCT.md`, `docs/README.md` and `docs/roadmap.md`, with no `D`/`R` and no non-Markdown files.
- The Next.js block in `AGENTS.md` is byte-identical to the baseline, and `next dev` leaves `AGENTS.md` unchanged.
- `docs/README.md` no longer ranks Notion and no longer says the repository is the source of truth for everything.
- Milestone status wording (PR numbers, "awaits merge", "through Milestone 10") appears only in `docs/roadmap.md` and `docs/verification/`.
- Every relative link in the changed files resolves.
- Spot check: questions on pricing, schema, M11 status, NFC chip choice and GRC behavior each lead to the correct owner.

Notion pass:
- No page is deleted or moved, and the hub shows the sections in §9.
- Both hub callouts are replaced.
- The five historical technical pages and the AI Build Handoff carry the historical callout.
- Steps 3, 5 and 9 carry the defer-to-GitHub note.

Obsidian: no change required.

## 15. Non-goals

- No restructuring in the design stage: no Notion or Obsidian edits, no repo doc moves or deletions, no code changes.
- No `docs/product/` tree, new taxonomy, templates or metadata scheme.
- No rewrite of historical milestone plans, verification reports or mixed Notion pages.
- No migration of shared research into Obsidian.
- No sync tooling across Notion, GitHub and Obsidian.
- No deletion or archiving of historical Notion pages in the first pass.
