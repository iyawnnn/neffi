# Neffi Notion knowledge alignment — operational plan

> **Implementation history — not a current specification.** Retained as written for provenance; instructions, names and verification plans below describe that implementation context. Current contracts and superseding decisions are indexed in [the documentation authority map](../../README.md#authority-map); current status is in [roadmap](../../roadmap.md). Earlier GRC lifecycle assumptions are superseded by [0006](../../decisions/0006-grc-simple-commercial-line.md).


> **For agentic workers:** Run this plan in a Claude session that has the Notion connector (`notion-fetch`, `notion-search`, `notion-update-page`). Steps use checkbox (`- [ ]`) syntax. Before the first write, read `notion://docs/enhanced-markdown-spec`.

**Goal:** Make Neffi — Business Hub the entry point for business and product, organized by the 01–08 grouping. Make the engineering material in Notion visibly defer to GitHub. Delete, move and recreate nothing.

**Architecture:** All edits happen in place on existing pages:
- One `replace_content` on the hub reorders the hub's own child-page blocks under new headings. No page changes parent.
- The other pages get a callout at the top.
- Global "repository wins" wording is fixed with targeted search-and-replace.

**Spec:** `docs/superpowers/specs/2026-10-16-neffi-knowledge-architecture-design.md` in the `neffi` repository, sections 2, 3, 9 and 10.

## Global Constraints

- No page is deleted, archived or moved to another parent. Never pass `allow_deleting_content: true`. If a tool reports that content would be deleted, STOP and ask.
- Prefer `insert_content` (position `start`) and `update_content`. Use `replace_content` only on the hub, and keep every fetched `<page url="…">` tag.
- Do not rewrite page bodies, recreate GitHub specs in Notion, migrate research to Obsidian, or edit Obsidian.
- GitHub links: rules at `https://github.com/iyawnnn/neffi/blob/main/docs/README.md`, status at `https://github.com/iyawnnn/neffi/blob/main/docs/roadmap.md`.
- Precondition: [repository knowledge alignment](2026-10-16-neffi-repository-knowledge-alignment.md) is merged to `main`, so those links already show the new rules.
- Spec §9 clarification: in the Locked Plan, the Step 4, 6, 7 and 8 "Locked Direction" sections get the historical marker. The Step 5 section gets the mixed-page note instead, because Step 5 is an active mixed page.

## Review Focus

1. The hub `replace_content` drops a child-page tag. Task 1 compares the full tag set before and after.
2. A callout lands on the wrong page, or appears twice after a rerun. Every task fetches the page first and checks whether the marker text is already there.
3. A mixed page (Step 3, 5 or 9) ends up looking historical. Its callout must say "active".
4. Global "repo wins" wording survives on an active page. Task 6 searches for it.
5. Shared research reads as a decision. The callout in Task 5 says "reference, not a decision".

The hub has 19 expected child pages. Use the exact tags from the Task 0 fetch; this table is the set they must match:

| Page | ID |
|---|---|
| AI Build Handoff — Read First | 3f443f7dfcb08179af5ad3de461bb688 |
| Neffi — Locked Plan | 3f343f7dfcb0812baaf7d8135c038c0f |
| Step 1 — Product Catalog | 3f343f7dfcb0813791b2eac62c02765a |
| Step 2 — Product Definitions | 3f343f7dfcb0810ead72d771dd320b8b |
| Step 3 — Order & Fulfillment Workflow | 3f343f7dfcb081e1afffef556b1d4e85 |
| Step 4 — System Objects & Relationships | 3f443f7dfcb081bd8903e51255e33b62 |
| Step 5 — Admin Pages & Capabilities | 3f443f7dfcb08149aa9ae820261b6ce5 |
| Step 6 — Data Model & Integrity Rules | 3f343f7dfcb081c4aea6d04780d38206 |
| Step 7 — Technical Architecture | 3f443f7dfcb0815fb346c6f3b7881ed7 |
| Step 8 — Implementation Plan | 3f443f7dfcb0815db681f66c6b0ba06a |
| Step 9 — Build & Physical Pilot | 3f443f7dfcb081609f6ed2dde2f2be79 |
| Brand Identity | 3f543f7dfcb081ca8ce0fc02a992b738 |
| Mobile-First Design System | 3f343f7dfcb081b28196c468a0c363ca |
| Public Profile Templates | 3f343f7dfcb081b6bffbf76e4b2cb20a |
| Supporting Engineering Notes | 3f343f7dfcb08152894ff753963cc63f |
| NFC Technical Research | 3f343f7dfcb08188a3b4f79e22e8e2cb |
| Market & Competitor Research | 3f343f7dfcb081d6b1d3dbbbf9b7458c |
| Packaging & Activation Experience | 3f543f7dfcb0817485d0eb42368d3951 |
| Neffi — Page Inventory & UX Sitemap | 3f643f7dfcb0811ab43ec8ba0c07cc64 |

---

### Task 0: Preflight (read-only)

- [ ] Confirm that GitHub `main` contains the repository alignment, meaning `docs/README.md` has a "Sources of truth" heading. If it does not, STOP.
- [ ] Fetch the hub (`3f343f7dfcb081039b73ff1955b545b5`) and every page in the table. Save each raw fetch result in the session scratchpad as `notion-snapshot/<id>.md`, for diffing and manual rollback.
- [ ] Confirm that the hub's `<page>` tags match the 19 expected IDs exactly and that the hub is each page's parent. If anything differs, STOP and report.
- [ ] Search the hub tree (`page_url` = hub) for `repository wins`, `GitHub is authoritative`, `source of truth`, `before writing code`, `implementation decisions`, `resume from Notion` and `Current coordinated work`. The last four catch active-page instructions that tell coding agents to use Notion as their engineering execution source. Record every hit, with the page and the exact sentence, for Tasks 2–4 and 6.
- [ ] Search the workspace for `TapCard` and report any pages outside the hub. Do not edit them.

### Task 1: Make the hub the business/product entry point

- [ ] Re-fetch the hub immediately before the replace. The result must report that the page is not truncated and must contain no unknown blocks or unknown block IDs. If either condition fails, STOP and report; do not replace the page.
- [ ] Run `replace_content` on the hub with the content below. Use each page's exact fetched `<page url="…">` tag, and make sure each tag appears exactly once. Do not set `allow_deleting_content`.

```markdown
<callout icon="🧭" color="blue_bg">
	**Neffi — Business Hub is the business and product source of truth:** what Neffi sells, why, how customers experience it, and how the business runs. GitHub owns engineering: architecture, implemented behavior, schema, security, APIs and milestone status. Start at [docs/README.md](https://github.com/iyawnnn/neffi/blob/main/docs/README.md). Engineering status: [docs/roadmap.md](https://github.com/iyawnnn/neffi/blob/main/docs/roadmap.md).
</callout>
<callout icon="⚖️" color="yellow_bg">
	**When sources disagree.** For business or product intent, Notion is authoritative. For implemented technical behavior, schema, security or APIs, GitHub is authoritative. An approved decision that the implementation contradicts is drift: report it and reconcile it, and don't silently overwrite either side. A decision counts as approved when it is recorded in Neffi — Locked Plan or marked Locked. Research pages are reference material, not decisions. Ian's Obsidian notes are personal and never required.
</callout>
## 01 Company
<page Brand Identity>
## 02 Products
<page Step 1> <page Step 2>
## 03 Product Experience
<page Packaging & Activation Experience> <page Public Profile Templates> <page Page Inventory & UX Sitemap> <page Mobile-First Design System> <page Step 5>
## 04 Business
<page Step 3>
Pricing, business model and policies: no page yet.
## 05 Operations
<page Step 9>
Suppliers and manufacturing: no page yet.
## 06 Marketing
<page Market & Competitor Research>
## 07 Roadmap
Product release direction (V1 → V2+) is in <mention-page Locked Plan/> → Release Direction. Engineering milestones: [docs/roadmap.md](https://github.com/iyawnnn/neffi/blob/main/docs/roadmap.md).
## 08 Decisions
<page Neffi — Locked Plan>
## Shared research (reference, not decisions)
<page NFC Technical Research>
## Engineering reference (historical)
GitHub is authoritative for everything on these pages about architecture, schema, security or status.
<page Step 4> <page Step 6> <page Step 7> <page Step 8> <page Supporting Engineering Notes> <page AI Build Handoff — Read First>
```

In this template, each `<page X>` stands for that page's exact fetched tag; put one tag per line. `<mention-page Locked Plan/>` stands for `<mention-page url="https://app.notion.com/p/3f343f7dfcb0812baaf7d8135c038c0f"/>`.

- [ ] Re-fetch the hub. Its set of `<page>` IDs must equal the 19 expected IDs, each appearing once. Re-fetch each page and confirm the hub is still its parent.

### Task 2: Historical engineering pages

This task covers Step 4, Step 6, Step 7, Step 8, Supporting Engineering Notes and AI Build Handoff — Read First.

- [ ] Fetch each page. If the text "Historical engineering reference" is not already there, run `insert_content` at `start` with:

```markdown
<callout icon="🗄️" color="gray_bg">
	**Historical engineering reference.** Kept for history and no longer maintained. GitHub is authoritative for architecture, implemented behavior, schema, security and milestone status. Start at [docs/README.md](https://github.com/iyawnnn/neffi/blob/main/docs/README.md). For product and business intent, use the active pages on Neffi — Business Hub.
</callout>
```

- [ ] In the AI Build Handoff, take each sentence recorded in Task 0 that states the global rule (for example "If Notion conflicts with current repository behavior, **the repository wins** and Notion should be reconciled."). Use `update_content` to replace it with `Superseded: see the domain-specific source-of-truth rule on Neffi — Business Hub.` Make no other edits to the body.

### Task 3: Neffi — Locked Plan

- [ ] Replace the text of the top green callout with: `**Approved business and product decisions.** This page records Neffi decisions that were explicitly locked, and it is authoritative for product and business intent. GitHub is authoritative for implemented technical behavior, schema, security and engineering status ([docs/README.md](https://github.com/iyawnnn/neffi/blob/main/docs/README.md)). If a locked decision and the implementation disagree, treat it as drift to reconcile; neither side wins automatically.`
- [ ] Use one targeted `update_content` to replace the current-focus instruction that tells a new AI/developer session to begin with AI Build Handoff / Steps 6–8 / Step 9 with `Coding agents start from the GitHub repository's [AGENTS.md](https://github.com/iyawnnn/neffi/blob/main/AGENTS.md).` Replace only that engineering-session instruction; keep the surrounding product/business content.
- [ ] In "Planning Sequence" item 9, replace the status sentence or sentences after "**Build & physical pilot / execution** —" with `Engineering milestone status: [docs/roadmap.md](https://github.com/iyawnnn/neffi/blob/main/docs/roadmap.md). 🔄 In progress`.
- [ ] Use `update_content` on each of these heading lines to insert `*Historical engineering summary. GitHub is authoritative for these details.*` directly below it:
  - "Step 4 Locked Direction — Object Model"
  - "Step 6 Locked Direction — Data Model & Integrity Rules"
  - "Step 7 Locked Direction — Technical Architecture"
  - "Step 8 Locked Direction — Implementation Plan"
  - "Current Engineering Boundary"
- [ ] Directly below "Step 5 Locked Direction — Pages & Capabilities", insert `*Product capabilities remain active. Implementation status and technical detail defer to GitHub.*`

### Task 4: Mixed active pages (Step 3, Step 5, Step 9)

- [ ] Fetch each page. If the text "Active product/business page" is not already there, run `insert_content` at `start` with:

```markdown
<callout icon="📌" color="blue_bg">
	**Active product/business page.** Everything here about product behavior, business operations, customer experience, owner workflow and pilot intent is authoritative. Details about architecture, schemas, routes, security, caching, databases or code are non-authoritative engineering references; GitHub is authoritative for them ([docs/README.md](https://github.com/iyawnnn/neffi/blob/main/docs/README.md)). Engineering milestone status: [docs/roadmap.md](https://github.com/iyawnnn/neffi/blob/main/docs/roadmap.md).
</callout>
```

- [ ] On Step 9 only, the callout carries one more sentence at the end: `The Start Here reading list, the instruction to record evidence here, and the Milestone Progress Record are historical; engineering execution is recorded in GitHub.` Do not broadly rewrite Step 9.
- [ ] Replace any global "repository wins" sentence recorded in Task 0 for these pages with the "Superseded" sentence from Task 2. Do not split or rewrite the pages.
- [ ] Stale milestone status, with targeted `update_content` only:
  - **Step 5:** replace only the stale implementation-status wording (for example "progressed through M10" or "M11 is next/current") with `Engineering milestone status: see GitHub [docs/roadmap.md](https://github.com/iyawnnn/neffi/blob/main/docs/roadmap.md).` Step 5 stays active for its product/business and UX meaning.
  - **Step 9:** replace only its stale current-coordinated-work / M11 status wording with the same sentence. Keep the rest of its product/pilot intent.

### Task 5: Shared research pages

This task covers NFC Technical Research and Market & Competitor Research.

- [ ] Fetch each page. If the text "Shared research" is not already there, run `insert_content` at `start` with:

```markdown
<callout icon="🔬" color="gray_bg">
	**Shared research: reference, not a decision.** Approved conclusions live in Neffi — Locked Plan and the product pages. Technical consequences live in GitHub specs and decision records. This page stays in Notion so both owners can use it.
</callout>
```

### Task 6: Validation and report

- [ ] Re-fetch the hub and all 19 pages, then confirm:
  - No page is missing or archived, and the hub is still every page's parent.
  - The hub shows the 01–08 sections, Shared research, and Engineering reference (historical).
  - The six historical pages carry the gray callout.
  - Steps 3, 5 and 9 carry the blue "Active" callout.
  - Both research pages carry the research callout.
- [ ] Search the hub tree again for `repository wins` and `GitHub is authoritative for implemented behavior and engineering status`. Remaining hits are acceptable only inside pages marked historical; report each one.
- [ ] Search the hub tree for current-status claims such as `M11 is next`, `Current coordinated work is M11` and `through M10`, and for the Task 0 agent-instruction terms. Active pages (the hub, Locked Plan, Steps 1, 2, 3, 5 and 9, and the product-experience pages) must contain none. Historical pages may keep dated historical statements when clearly marked historical; report each one.
- [ ] Spot-check that every GitHub link added in this plan opens the intended file on `main`.
- [ ] Report:
  - the pages that changed;
  - where the snapshots are saved;
  - which items in the "Known drift" section of `docs/README.md` are now resolved (for example, the hub status callout). Updating that list is a separate small repository change and needs approval first.
