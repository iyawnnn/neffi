<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Neffi agent rules

These rules apply to every coding agent. `CLAUDE.md` imports this file.

### Where truth lives

- **This repository** is authoritative for what Neffi does today: implemented product behavior (including prices, payment methods and order flow as shipped), architecture, authentication and authorization, routes and APIs, schema, security, technical decisions, runbooks, environment state, tests, milestone status and code.
- **Notion (Neffi — Business Hub)** holds business and product context aligned to the shipped product: positioning, brand, pricing presentation, packaging, operations and marketing context, the product roadmap and future product planning.
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

- The shipped implementation and verified Production behavior are current truth. If Notion, an older document or a historical decision disagrees, verify the code, then report the drift so the documents are updated. Never change code to match stale documentation. Deliberate product changes update code and the current docs together.
- Never use any of these as a specification: historical milestone plans (`docs/superpowers/plans/`), design records (`docs/superpowers/specs/`), dated evidence (`docs/verification/`, dated audits in `docs/testing/` and `docs/legal/`), Notion engineering pages (including archived ones), or the engineering details of other Notion pages. Implemented historical documents carry a banner pointing to the current docs; do not rewrite their bodies.
- If a product decision you need is in neither the implementation, this repository nor Notion, stop and ask. Do not invent business rules.
- Current engineering milestone and environment status is maintained only in [`docs/roadmap.md`](docs/roadmap.md). Do not restate it elsewhere.
- Never print, log, copy into documents or query activation codes, `activation_credentials.encrypted_code`, OTPs, tokens, connection strings or key values. Use variable names and aggregate counts only.
- Live database changes (migrations, seeds, resets, data fixes) need explicit approval and a ready restore branch ([operations](docs/operations.md#database-migrations)). Never point local tools at Production credentials.
- `.superpowers/` and `.worktrees/` are local, untracked working areas. Nothing in them is canonical.
- Follow the [security rules](README.md#security-rules) and the runbooks in [`docs/operations.md`](docs/operations.md).
