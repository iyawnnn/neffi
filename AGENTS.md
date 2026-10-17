<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
