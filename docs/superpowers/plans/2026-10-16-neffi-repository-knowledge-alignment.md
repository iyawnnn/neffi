# Neffi repository knowledge alignment — implementation plan

> **Implementation history — not a current specification.** Retained as written for provenance; instructions, names and verification plans below describe that implementation context. Current contracts and superseding decisions are indexed in [the documentation authority map](../../README.md#authority-map); current status is in [roadmap](../../roadmap.md). Earlier GRC lifecycle assumptions are superseded by [0006](../../decisions/0006-grc-simple-commercial-line.md).


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved authority boundaries to the repository's entry documents. That means domain-specific conflict rules, a single home for status and one agent-guidance file.

**Architecture:** The plan edits Markdown only, in six files: `AGENTS.md`, a new `CLAUDE.md`, `docs/README.md`, `PRODUCT.md`, `docs/roadmap.md` and `README.md`. Nothing is moved or deleted, and no other file changes.

**Tech Stack:** Markdown, git and bash checks. No application tooling is needed.

**Spec:** [`docs/superpowers/specs/2026-10-16-neffi-knowledge-architecture-design.md`](../specs/2026-10-16-neffi-knowledge-architecture-design.md)

## Global Constraints

- Work on branch `docs/knowledge-architecture`, based on `b1881af9d93c9181efde2ff077c4c67eeb68f617`.
- Only these files change: `AGENTS.md`, `CLAUDE.md` (new), `README.md`, `PRODUCT.md`, `docs/README.md` and `docs/roadmap.md`.
- The `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END:nextjs-agent-rules -->` block in `AGENTS.md` stays byte-for-byte unchanged.
- Use LF line endings (`.gitattributes` sets `* text=auto eol=lf`).
- `docs/roadmap.md` is the only place current engineering milestone status (PR numbers, migration and test counts, merge state) is maintained. Historical verification and operations records may still contain dated evidence.
- Do not change application code, Notion or Obsidian, and do not move or delete files. These stay untouched: specs, ADRs, architecture, `database/erd.md`, `verification/`, `operations.md`, `src/modules/README.md` and the milestone plans.
- Do not run the application test suite. These are documentation-only changes.
- Two interpretations of the spec are deliberate:
  - The Notion Locked Plan already holds the "Release Direction" table, so the spec §5 condition for replacing `docs/roadmap.md` "Release mapping" with a link is met now.
  - In `docs/README.md`, the "Current" section is replaced by a link to the roadmap rather than corrected in place. Anti-duplication rule 2 (spec §13) keeps status out of that file.

## Review Focus

1. A status statement (PR number, migration count, "awaits merge") survives outside `docs/roadmap.md`. Task 5 greps for it.
2. Content lands inside the Next.js markers, where `next dev` would overwrite it. Task 1 diffs the block.
3. A relative link or anchor breaks after a heading is renamed. Task 5 checks links and anchors.
4. Wording still implies the repository wins on product intent. Task 5 greps for it.
5. Implemented behavior gets lost when the status bullets are removed from PRODUCT.md (the M10 bullet holds the hardening behavior). Task 3 keeps it as behavior.

---

### Task 1: Agent entry point (`AGENTS.md`, `CLAUDE.md`)

**Files:** Modify `AGENTS.md` by appending after the END marker. Create `CLAUDE.md`.

- [ ] **Step 1:** In `AGENTS.md`, after the final line `<!-- END:nextjs-agent-rules -->`, add one blank line and then the text below:

```markdown
## Neffi agent rules

These rules apply to every coding agent. `CLAUDE.md` imports this file.

### Where truth lives

- **This repository** is authoritative for engineering: architecture, implemented behavior, authentication and authorization, routes and APIs, schema, security, technical decisions, runbooks, tests, milestone status and code.
- **Notion (Neffi — Business Hub)** is authoritative for business and product intent: what Neffi sells and why, customer experience, pricing, packaging, operations, marketing, the product roadmap and approved product decisions.
- **Obsidian** holds the maintainer's personal notes. It is never required and never consulted.

See [`docs/README.md`](docs/README.md#sources-of-truth) for the full rule.

### Read in this order

1. The task prompt.
2. [`docs/README.md`](docs/README.md): sources of truth, conflict rules and the authority map.
3. [`PRODUCT.md`](PRODUCT.md): how Neffi behaves today.
4. The spec in [`docs/specs/`](docs/specs/), the decisions in [`docs/decisions/`](docs/decisions/) and the architecture docs for the area you change.
5. Schema, tests and code.

Everything needed to implement Neffi is in this repository. Read Notion (read-only) only when a task introduces or changes product intent and the prompt does not already supply it.

### Rules

- Never use any of these as a specification: historical milestone plans (`docs/superpowers/plans/`), design records (`docs/superpowers/specs/`), Notion engineering pages (Steps 4, 6, 7 and 8, Supporting Engineering Notes, AI Build Handoff), or the engineering details of other Notion pages.
- If a product decision you need is in neither this repository nor Notion, stop and ask. Do not invent business rules.
- If an approved Notion decision disagrees with implemented behavior, report it as drift. Do not silently change code to match Notion, and do not treat the code as overriding the decision.
- Current engineering milestone status is maintained only in [`docs/roadmap.md`](docs/roadmap.md). Do not restate it elsewhere.
- Follow the [security rules](README.md#security-rules) and the runbooks in [`docs/operations.md`](docs/operations.md).
```

- [ ] **Step 2:** Create `CLAUDE.md` containing exactly this one line, followed by a trailing newline:

```
@AGENTS.md
```

- [ ] **Step 3: Verify**

```bash
diff <(git show b1881af:AGENTS.md) <(sed -n '1,/<!-- END:nextjs-agent-rules -->/p' AGENTS.md) && echo BLOCK-OK
test "$(cat CLAUDE.md)" = "@AGENTS.md" && echo CLAUDE-OK
grep -c 'nextjs-agent-rules' AGENTS.md   # expect 2
```

Expected output is `BLOCK-OK`, `CLAUDE-OK` and `2`. `next dev` regenerates only the text between the markers (`upsertAgentRulesBlock` in `node_modules/next/dist/server/lib/generate-agent-files.js`), so the appended section survives.

- [ ] **Step 4: Commit:** `git add AGENTS.md CLAUDE.md && git commit -m "docs: add Neffi agent rules and CLAUDE.md import"`

### Task 2: `docs/README.md` authority rules

**Files:** Modify `docs/README.md`.

- [ ] **Step 1:** Replace the intro paragraph (line 3, starting `Start with [PRODUCT.md]`) with the text below:

```markdown
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
```

- [ ] **Step 2:** Make three changes to the "Authority map" table:
  - Replace the PRODUCT.md row with `| How does Neffi behave **today**? Terms and principles | [PRODUCT.md](../PRODUCT.md) | Current, normative summary. Specs win on detail |`.
  - Replace the roadmap row with `| Engineering milestone status, launch gates and deferred engineering scope | [roadmap.md](roadmap.md) | Status (the only place current status is maintained; verification and operations records keep dated evidence) |`.
  - After the `superpowers/plans/` row, insert `| Why and how a documentation or architecture change was designed | [`superpowers/specs/`](superpowers/specs/) | Design record. Historical once implemented. Not a specification |`.
- [ ] **Step 3:** Delete the whole `## Precedence when sources disagree` section. It runs from its heading through the line `The repository is the source of truth. Do not rebuild core behavior from old plans or Notion pages.`, and Step 1 replaces it.
- [ ] **Step 4:** Replace the whole `## Current, planned and later` section with the text below. That section is its heading, both bullets and the paragraph starting "Shared Neon development is verified…".

```markdown
## Status

Current engineering milestone status, launch gates and deferred scope are maintained only in [roadmap.md](roadmap.md). Verification and operations records may still contain dated evidence. Product release direction is owned by Notion.
```

- [ ] **Step 5:** Replace the body of `## Milestone plans` with the text below:

```markdown
[`superpowers/plans/`](superpowers/plans/) holds one implementation plan per milestone (M1–M11) plus documentation plans. They record the decisions and implementation sequence as they were at the time, including Notion as the spec and the earlier "TapCard" name. They are history, not specifications. Task evidence stays in the ignored local ledger. The main historical drift is the earlier GRC order-fulfilment lifecycle, which [decision 0006](decisions/0006-grc-simple-commercial-line.md) superseded. [`superpowers/specs/`](superpowers/specs/) holds design records. Once a design is implemented, its normative wording lives in the documents above.
```

- [ ] **Step 6:** Replace the `## Known drift in Notion (not edited)` heading and its list with the text below:

```markdown
## Known drift

These Notion statements disagree with the repository or are stale. Notion is not edited from the repository, so reconciliation is manual.

- Older Notion material still describes the superseded GRC lifecycle (Blank, Reserved, encode and test, Released) and a narrow GRC provisioning capability in M4. [Decision 0006](decisions/0006-grc-simple-commercial-line.md) is authoritative.
- Engineering status in Notion lags the repository: the hub callout, the AI Build Handoff, Locked Plan step 9, and Step 9, whose Milestone Progress Record is stale (for example, M7 and M10 are still marked "Not started"). [roadmap.md](roadmap.md) is authoritative.
- Step 7 says OWNER MFA/step-up is enabled, the Locked Plan's Step 7 section proposes TOTP/step-up before commercial launch, and Step 8 lists Turnstile and migration rehearsal as M10 deliverables. MFA/step-up and Turnstile are deferred ([roadmap](roadmap.md#deliberately-deferred)).
- Examples use `tapcard.ph` or `neffi.ph`. No source has locked the final public domain, so use `CARD_URL_ORIGIN`.
- "Quick Demo" and "Standard vs Custom package" are not part of the implemented product.
- The hub and the AI Build Handoff refer to `docs/superpowers/plans/2026-10-14-neffi-ui-design-system-overhaul.md`, which exists only on the parked `feat/ui-design-system` branch.
```

- [ ] **Step 7: Verify:** Run `grep -n '^## ' docs/README.md`. The headings must appear in this order: Sources of truth, When sources disagree, Authority map, Specs, Decision records, Status, Milestone plans, Known drift, Open questions.
- [ ] **Step 8: Commit:** `git add docs/README.md && git commit -m "docs: replace global precedence with domain-specific authority"`

### Task 3: Re-scope `PRODUCT.md`

**Files:** Modify `PRODUCT.md`.

- [ ] **Step 1:** Replace the title and intro (lines 1–3) with the text below:

```markdown
# Neffi — implemented product behavior

This is the engineering-facing summary of how Neffi behaves **today**. It covers vocabulary, states, principles and the main flows, with links to the specs and decisions that define each area. When this file and a spec disagree, the spec wins. Notion owns product intent: what Neffi sells and why, pricing, brand and the product roadmap (see [the sources of truth](docs/README.md#sources-of-truth)). Behavior that is approved but not built is labelled **Planned**. Milestone status is in [`docs/roadmap.md`](docs/roadmap.md).
```

- [ ] **Step 2:** At the end of the first `## Identity` paragraph, after "the code uses `CARD_URL_ORIGIN`.", append: ` Brand, naming, pricing and the business model are owned by Notion.`
- [ ] **Step 3:** Rename `## Support and corrections (M9A)` to `## Support and corrections`. Two paragraphs currently follow the "Planned and later" bullets, starting with "`/support` creates unassigned cases" and "An owner verifies a linked customer Account". Move both, unchanged, to the end of the Support section under a new heading `### Public support and account recovery`.
- [ ] **Step 4:** Replace the `## Planned and later (not current behavior)` heading and its three bullets (M9B acceptance, Deferred, M10) with the text below:

```markdown
## Abuse limits and hardening

Abuse limits use per-IPv6-/64 quotas and daily caps, with non-blocking cleanup. Responses carry a static Content Security Policy and `nosniff`, Sentry scrubs SQL parameters, and Inbox pagination uses precise cursors. Detail: [architecture](docs/architecture/system.md), [browser security headers](docs/operations.md#browser-security-headers) and [forms and Inbox limits](docs/operations.md#m10-forms-and-inbox-limits).

## Not built yet

[`docs/roadmap.md`](docs/roadmap.md#deliberately-deferred) lists the deferred features (including OWNER MFA/step-up and Turnstile) and the remaining launch gates. Notion sets their product priority.
```

- [ ] **Step 5: Verify:** `grep -nE 'PR #|0015|Milestone 10|M9B acceptance' PRODUCT.md` prints nothing. The output of `grep -n '^##' PRODUCT.md` ends with Support and corrections, Public support and account recovery, Abuse limits and hardening, and Not built yet.
- [ ] **Step 6: Commit:** `git add PRODUCT.md && git commit -m "docs: re-scope PRODUCT.md as implemented-behavior summary"`

### Task 4: Narrow `docs/roadmap.md` and de-duplicate `README.md`

**Files:** Modify `docs/roadmap.md` and `README.md`.

- [ ] **Step 1:** In `docs/roadmap.md`, rename the title to `# Engineering roadmap and milestone status` and replace the intro paragraph with the text below:

```markdown
Engineering delivery status as of 2026-10-16: milestones, launch gates and deferred engineering scope. This is the only place current engineering milestone status is maintained; the reports in [`verification/`](verification/) and [operations.md](operations.md) keep dated evidence. Notion owns product release direction and priority. Implementation plans for each milestone are kept as history under [`superpowers/plans/`](superpowers/plans/). They are not the current specification; [PRODUCT.md](../PRODUCT.md) and [`specs/`](specs/) describe current behavior.
```

- [ ] **Step 2:** Replace the M9A row's status cell with `Merged (PR #10). [Plan](superpowers/plans/2026-10-14-milestone-9a-support-and-corrections.md)`, and remove the bold from its milestone cell.
- [ ] **Step 3:** Replace the M9B row's status cell with `Merged (PR #11). Software gate and independent review passed. Reduced manual acceptance approved: A1 basic and A4 core passed, A6 deferred, remaining manual checks not exercised. [Approved plan](superpowers/plans/2026-10-14-milestone-9b-public-support-recovery-email.md)`, and remove the bold from its milestone cell.
- [ ] **Step 4:** Replace the M11 row's status cell with `Merged (PR #13). Local full gate passed: 161 files / 1,481 tests, build/bundle, six concurrency suites, HTTP and 37 browser checkpoints. Shared-development evidence carried forward. Vercel edge observation not exercised (no access) and handed to M12. [Report](verification/2026-10-m11-full-verification.md)`.
- [ ] **Step 5:** In the M10 row, delete `. MFA/step-up and Turnstile deferred`. Then, under `## Deliberately deferred`, replace the opening `Account deletion or restriction,` with `OWNER MFA/step-up, Turnstile, account deletion or restriction,`.
- [ ] **Step 6:** Replace the `## Release mapping` heading and table with the text below:

```markdown
## Product releases

Notion owns product release direction (V1 Neffi Core, V1.1, V1.2, V2+): [Neffi — Locked Plan, Release Direction](https://app.notion.com/p/3f343f7dfcb0812baaf7d8135c038c0f).
```

- [ ] **Step 7:** Make four changes in `README.md`:
  - Replace the paragraph starting `Status: Milestones 1 through 9B` with `Milestone status: [`docs/roadmap.md`](docs/roadmap.md).`
  - In the Documentation list, replace the PRODUCT.md bullet with `- [`PRODUCT.md`](PRODUCT.md): how Neffi behaves today (engineering summary). Product and business intent live in Notion; see the [sources of truth](docs/README.md#sources-of-truth).`
  - Replace the plans bullet with `- [`docs/superpowers/`](docs/superpowers/): historical milestone plans and design records (not specifications).`
  - Append the bullet `- [`AGENTS.md`](AGENTS.md): rules for coding agents.`
- [ ] **Step 8: Verify:** `grep -nE 'awaits merge|0015|27 tables|PR #' README.md` prints nothing.
- [ ] **Step 9: Commit:** `git add docs/roadmap.md README.md && git commit -m "docs: keep milestone status only in the roadmap"`

### Task 5: Validation sweep

Every step below uses the planning commit as its base:

```bash
base=$(git log --format=%H -1 --grep='^docs: plan knowledge architecture alignment$')
```

- [ ] **Step 1: Diff scope.** Run `git diff --name-status "$base"..HEAD`. The expected list is `M AGENTS.md`, `A CLAUDE.md`, `M PRODUCT.md`, `M README.md`, `M docs/README.md` and `M docs/roadmap.md`, with nothing else: no `D`, no `R`, nothing under `src/`. Then read the full diff with `git diff "$base"..HEAD`.
- [ ] **Step 2: Links.**

```bash
for f in AGENTS.md CLAUDE.md README.md PRODUCT.md docs/README.md docs/roadmap.md; do
  d=$(dirname "$f")
  grep -oE '\]\([^)#]+' "$f" | sed 's/^](//' | grep -vE '^(https?:|mailto:)' | while read -r l; do
    [ -e "$d/$l" ] || echo "BROKEN $f -> $l"
  done
done
grep -n '^## Sources of truth\|^## Known drift' docs/README.md
grep -n '^## Deliberately deferred' docs/roadmap.md
grep -n '^## Security rules' README.md
grep -n '^## Browser security headers\|^## M10 forms and Inbox limits' docs/operations.md
```

The loop must print no `BROKEN` lines, and every grep must find its anchor heading.
- [ ] **Step 3: Generated block and CLAUDE.md.** Rerun the two checks from Task 1, Step 3.
- [ ] **Step 4: Obsolete global rule.** `grep -nEi 'repository is the source of truth|(repo|repository) (always )?wins|^5\. Notion' AGENTS.md CLAUDE.md README.md PRODUCT.md docs/README.md docs/roadmap.md` prints nothing.
- [ ] **Step 5: Duplicated status.** `grep -nE 'PR #[0-9]+|awaits merge|through Milestone|0015|16-entry|27 tables|1,481' AGENTS.md CLAUDE.md README.md PRODUCT.md docs/README.md` prints nothing. Matches in `docs/roadmap.md` are expected and allowed.
- [ ] **Step 6: No application code.** `git diff --name-only "$base"..HEAD | grep -vE '\.md$'` prints nothing.
- [ ] **Step 7: Source-routing spot checks.** Read only the changed entry documents and confirm that each question lands on the right owner:
  1. "What does a DBC cost?" leads to the `docs/README.md` sources table and then to Notion (pricing). Live prices are admin data.
  2. "What columns does `cards` have?" leads to the authority map and then to `docs/database/erd.md`.
  3. "Is M11 done?" leads to the M11 row in `docs/roadmap.md`.
  4. "Which NFC chip should we buy?" leads to Notion shared research (NFC Technical Research) as reference. The repository is not the owner.
  5. "How does a GRC order complete?" leads to `PRODUCT.md` and then `docs/specs/google-review-card.md`. Product intent is in Notion Steps 1–2.
- [ ] **Step 8:** If any check fails, fix it and commit with `docs: fix knowledge alignment validation findings`. Report the results. Do not push or open a PR without approval.
