# Neffi

NFC Digital Business Cards and Google Review Cards. One Next.js 16 modular monolith (App Router, TypeScript, Tailwind and shadcn/ui) on PostgreSQL via Drizzle, with Better Auth, Resend, Cloudinary, Sentry and Vercel.

| Product | In short |
|---|---|
| **Digital Business Card** | An NFC card with a permanent URL that opens the customer's Neffi profile. Customers activate it with a package code and manage their profile and Scenes from a phone |
| **Google Review Card** | An NFC card that opens a business's direct Google review page. Neffi records the sale; the tag is prepared by hand |

Milestone status: [`docs/roadmap.md`](docs/roadmap.md).

## Documentation

Start at [`docs/README.md`](docs/README.md), the map of which document is authoritative for what.

- [`PRODUCT.md`](PRODUCT.md): how Neffi behaves today (engineering summary). Product and business intent live in Notion; see the [sources of truth](docs/README.md#sources-of-truth).
- [`docs/architecture/`](docs/architecture/): system and domain model. [`docs/database/erd.md`](docs/database/erd.md) is the generated schema reference.
- [`docs/specs/`](docs/specs/): feature contracts. [`docs/decisions/`](docs/decisions/): long-lived decisions.
- [`docs/operations.md`](docs/operations.md): runbooks for migrations, seed, auth, card provisioning, deploys and verification.
- [`docs/superpowers/`](docs/superpowers/): historical milestone plans and design records (not specifications).
- [`src/modules/README.md`](src/modules/README.md): domain module map.
- [`AGENTS.md`](AGENTS.md): rules for coding agents.

## Prerequisites

- Node.js 24 (`.nvmrc`)
- pnpm 11 (`packageManager` in `package.json`; `corepack enable` picks it up)
- A **development** Neon project (`neffi-dev`). Never use production credentials locally or in Preview.

## Setup

1. Clone and install: `git clone <repo-url> neffi && cd neffi && pnpm install --frozen-lockfile`
2. Create the development database: in the Neon console, create project `neffi-dev` (AWS Asia Pacific, Singapore). Do not enable Neon Auth.
3. Configure: `cp .env.example .env.local` (`copy` in cmd.exe), then fill in:
   - `DATABASE_URL`: the pooled connection string (connection pooling **on**; host contains `-pooler`)
   - `DATABASE_URL_UNPOOLED`: the direct connection string (connection pooling **off**)
   - `BETTER_AUTH_SECRET`: output of `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: `http://localhost:3000`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: the development/Preview OAuth web client
   - `RESEND_API_KEY`, `AUTH_EMAIL_FROM`: the development/Preview send-only key and sender (see the [auth runbook](docs/operations.md#authentication-runbook))
   - optional `SUPPORT_REPLY_TO`: valid support reply email; a verified Resend sending domain is required for M9B live two-inbox acceptance
   - `ACTIVATION_CODE_SECRET`: at least 32 random characters (`openssl rand -base64 32`); keys the activation-code lookup hash
   - `CARD_URL_ORIGIN`: bare origin written onto NFC cards, e.g. `http://localhost:3000` (see [card provisioning](docs/operations.md#physical-card-provisioning))
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: the development Cloudinary account (the secret stays server-only)
   - optional `NEXT_PUBLIC_SENTRY_DSN`: Sentry stays disabled without it
4. Migrate: `pnpm db:migrate`. Applying migrations to a shared database needs a restore point and explicit approval ([operations](docs/operations.md#database-migrations)).
5. Run: `pnpm dev`, then check <http://localhost:3000/api/health> returns `{"status":"ok","db":"ok"}`.

The app refuses to start with missing or invalid configuration and names the variable without printing its value. The approved development target is Neon project `neffi-dev`, branch `production` (Neon's default label; it is a development database, separate from application Production). Verify the project, branch and endpoint before every database-changing command.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Development server / production build (needs the server env, never connects to the database) / serve the build |
| `pnpm lint` / `pnpm typecheck` | ESLint / route types then `tsc --noEmit` |
| `pnpm test` | Unit tests and database invariants on fresh in-process PGlite databases |
| `pnpm check:bundle` | After `build`: fail if a server secret value appears in public build output |
| `pnpm db:generate` / `db:migrate` / `db:check` | Generate a migration from the schema (no connection) / apply pending migrations (uses `DATABASE_URL_UNPOOLED`) / check history consistency |
| `pnpm db:seed` | Destructive development-only reset to synthetic fixtures; requires explicit development context |
| `pnpm db:erd` | Regenerate [`docs/database/erd.md`](docs/database/erd.md) from migrations (no credentials). Never edit that file by hand |
| `pnpm accounts:set-role <email> <owner\|customer>` | Guarded operator-only role change with an atomic activity event |
| `pnpm check:db-concurrency`, `check:provisioning-concurrency`, `check:claim-concurrency`, `check:profile-concurrency`, `check:orders-concurrency`, `check:support-concurrency` | Two-session race regressions on a disposable loopback PostgreSQL only (never Neon; not run in CI) |
| `pnpm dev:activation-fixture`, `pnpm dev:form-submission` | Local-only synthetic fixtures for browser acceptance (loopback database only) |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, `db:check`, migration drift check, build and `check:bundle`.

## Project structure

```
src/app/        routes: (public), (customer)/app, admin, api    src/proxy.ts   /c/:token availability
src/modules/    domain services (accounts, activation, activity, cards, expenses, forms, inventory, orders, payments, profiles, support)
src/db/         schema, connection, seed, invariant tests       drizzle/       reviewed SQL migrations
src/auth/       Better Auth, access checks                      src/config/    validated environment and isolation
src/integrations/  email (Resend), media (Cloudinary)           docs/          documentation (see above)
```

## Security rules

- Never commit secrets. `.env*` is ignored except `.env.example`, which holds names only.
- Activation codes, OTPs, auth cookies and tokens must never appear in URLs, logs, error messages, analytics, Sentry or browser storage.
- Sentry runs errors-only with personal-data collection disabled and request scrubbing (`src/lib/sentry-scrub.ts`).
- Authorization is always enforced server-side. Hiding UI is not authorization.
