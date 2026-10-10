# Neffi

NFC Digital Business Cards and Google Review Cards. One Next.js 16 modular monolith (App Router, TypeScript) on PostgreSQL via Drizzle, with Better Auth, Sentry and Vercel.

The product and architecture specification lives in the locked Notion pages (still titled "TapCard — …" from before the rename to Neffi). Domain module boundaries are in [`src/modules/README.md`](src/modules/README.md); milestone plans are in [`docs/superpowers/plans/`](docs/superpowers/plans/).

## Prerequisites

- Node.js 24 (`.nvmrc`)
- pnpm 11 (`packageManager` in `package.json`; `corepack enable` picks it up)
- A **development** Neon project (`tapcard-dev`). Never use production credentials locally or in Preview.

## Setup

1. Clone and install: `git clone <repo-url> neffi && cd neffi && pnpm install --frozen-lockfile`
2. Create the development database: in the Neon console, create project `tapcard-dev` (AWS Asia Pacific, Singapore). Do not enable Neon Auth.
3. Configure: `cp .env.example .env.local` (`copy` in cmd.exe), then fill in:
   - `DATABASE_URL`: the pooled connection string (Connect → connection pooling **on**; host contains `-pooler`)
   - `DATABASE_URL_UNPOOLED`: the direct connection string (connection pooling **off**)
   - `BETTER_AUTH_SECRET`: output of `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: `http://localhost:3000`
   - optional `NEXT_PUBLIC_SENTRY_DSN`: Sentry stays disabled without it
4. Migrate: `pnpm db:migrate`
5. Run: `pnpm dev`, then check <http://localhost:3000/api/health> returns `{"status":"ok","db":"ok"}`.

The app refuses to start with missing or invalid configuration and names the variable without printing its value.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm build` | Production build (needs the server env, but never connects to the database) |
| `pnpm check:bundle` | After `build`: fail if a server secret value appears in public build output |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations (uses `DATABASE_URL_UNPOOLED`) |
| `pnpm db:check` | Check migration history consistency |

## Database migrations

PostgreSQL is the source of truth; Neon is replaceable hosting.

1. Change `src/db/schema.ts` (or `pnpm db:generate --custom --name=<name>` for hand-written SQL).
2. `pnpm db:generate`, then **review the SQL** in `drizzle/` and commit it with the schema change.
3. `pnpm db:migrate` against the development database.

There is intentionally no `db:push`: schema changes always go through reviewed, committed migrations, and applied migrations are never edited. `drizzle/0000_foundation_baseline.sql` is a no-op proving the workflow; the domain schema starts in Milestone 2.

## Environments and isolation

| Environment | Database | Where its config lives |
|---|---|---|
| Local development | Neon `tapcard-dev` | `.env.local` (git-ignored) |
| Vercel Preview | Neon `tapcard-dev` | Vercel env vars, Preview scope |
| Production / pilot | Separate production Neon project (not created yet) | Vercel env vars, Production scope only |

Safeguards:

- `src/config/isolation.ts` refuses a production database host outside production, and in production refuses any host not listed in `PRODUCTION_DATABASE_HOSTS`. That list is empty until the production project exists, so a production deployment currently fails closed by design.
- The migration config uses the same guard.
- Database, auth and env modules import `server-only`, so a Client Component importing them fails the build.
- CI runs `check:bundle` so server secret values cannot ship in client bundles or prerendered pages.
- Real customer data is never copied into development or Preview.

## Deploying a Preview (Vercel)

1. Import the GitHub repository in Vercel (Hobby, Node 24.x).
2. Set `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `BETTER_AUTH_SECRET` (and optionally `NEXT_PUBLIC_SENTRY_DSN`) for the **Preview** and **Development** scopes only, using `tapcard-dev` values. Leave `BETTER_AUTH_URL` unset for Preview; it is derived from the branch URL.
3. Leave the **Production** scope empty until the production database exists.
4. Enable "Automatically expose System Environment Variables".
5. Push a branch and check `<preview-url>/api/health` and `<preview-url>/api/auth/ok`.

## Security rules

- Never commit secrets. `.env*` is ignored except `.env.example`, which holds names only.
- Activation codes, OTPs, auth cookies and tokens must never appear in URLs, logs, error messages, analytics, Sentry or browser storage.
- Sentry runs errors-only with personal-data collection disabled and request scrubbing (`src/lib/sentry-scrub.ts`).
- Authorization is always enforced server-side. Hiding UI is not authorization.
