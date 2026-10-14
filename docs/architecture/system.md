# System architecture

Current as of M8. See also [domain model](domain-model.md), the [ERD](../database/erd.md) and the [decision records](../decisions/).

## Shape

One Next.js 16 App Router **modular monolith** (TypeScript, React 19, Tailwind and shadcn/ui) on PostgreSQL. Server Components are the default; Client Components are limited to interactive forms and editors. Mutations are Server Actions that authenticate, authorize and validate (Zod) before calling a domain service. Route Handlers are used only for the auth callbacks, the public form submission endpoint, the vCard download (`/c/{token}/contact`) and health. Image-upload signing is a Server Action. There is no separate API service, queue, cache server or search engine.

| Surface | Routes | Access |
|---|---|---|
| Public | landing, `/activate`, `/c/{token}` (+ `/contact` vCard), `/sign-in` | Anyone. `/activate` needs a code; `/c` shows only what the Card's state allows |
| Customer | `/app/*` (Home, Profiles, Cards, Account, Inbox, setup) | Verified Account |
| Owner | `/admin/*` | Verified Account with role OWNER |
| API | `/api/auth/*`, `/api/forms/{id}/submissions`, `/api/health` | As stated per route |

Admin, customer and operational pages are dynamic, `noindex` and never shared-cached. Pages that read the database call `await connection()` first and export `instant = false`.

## Stack and integrations

| Concern | Choice |
|---|---|
| Database | PostgreSQL (Neon in hosted environments), Drizzle ORM, reviewed forward-only SQL migrations in `drizzle/` |
| Auth | Better Auth with Google and email one-time code; custom Drizzle adapter mapping onto `accounts`, `auth_identities`, `auth_sessions`, `auth_verifications`, `auth_rate_limits`; database-backed rate limits; no passwords or SMS |
| Email | Resend over `fetch` (no SDK), plain text, behind `src/integrations/email`. Sends sign-in and change-email codes and owner notifications for form submissions |
| Media | Cloudinary signed direct uploads (no SDK), raster images only, verified server-side, never stored in PostgreSQL |
| Errors | Sentry, errors only, personal-data collection off, request scrubbing |
| Hosting | Vercel (Node 24); Neon pooled connections for runtime, direct URL for migrations |
| Tests | Vitest with in-process PGlite; two-session concurrency scripts against a disposable loopback PostgreSQL |

## Code layout

- `src/app/` routes: `(public)`, `(customer)/app`, `admin`, `api`. `src/proxy.ts` handles `/c/:token` only.
- `src/modules/<domain>/` server-only domain services that own business rules: `accounts`, `activation`, `activity`, `cards`, `expenses`, `forms`, `inventory`, `orders`, `payments`, `profiles`, plus `search.ts`. See [`src/modules/README.md`](../../src/modules/README.md).
- `src/db/` schema, runtime connection, seed and invariant tests. `src/auth/`, `src/config/` (validated environment and isolation), `src/integrations/`, `src/lib/` (pure helpers).
- Server-only modules start with `import "server-only"`. `src/server-only-boundary.test.ts` lists them, and `pnpm check:bundle` fails CI if a secret value reaches client output.

## Conventions

- UI and actions call domain services; services own rules and persistence. Client Components receive minimal DTOs.
- Hiding UI is never authorization. Actions use `authorize("owner" | "account")`; pages use `requireOwner()` / `requireAccount()`.
- Multi-record changes are one transaction that locks first and re-reads under the lock ([0009](../decisions/0009-database-invariants-and-lock-order.md)). Order writers go through `mutateOrder`: lock the Order (`FOR NO KEY UPDATE`), then items, then DBC Cards, then credentials, set updated-by, and re-settle completion in the same transaction.
- Every meaningful change writes an immutable Activity event in the same transaction.
- Money is integer centavos. Business dates are `date`; timestamps are `timestamptz`; display uses Asia/Manila.
- Select only needed columns, paginate unbounded lists (keyset), and let PostgreSQL aggregate.

## Caching

- `/c/{token}`: the Card is read fresh on every request. Only a published Scene's content is cached, by `(profile, scene, content_version)`; each visible edit bumps `content_version` in its own transaction ([0011](../decisions/0011-fresh-card-state-cached-scene-content.md)). Card routing, enabled flag and publish status are never cached.
- The Proxy decides availability before rendering and forwards a signed, request-only snapshot to the page. Unavailable document requests are rewritten to a generic 404 page.
- Everything else is dynamic.

## Security

- No secret in client bundles, URLs, logs, Sentry or browser storage. Activation codes and OTPs are stored only as keyed HMACs.
- Same-origin form posts (app origin and card origin), per-IP quotas, a honeypot and a body-size cap protect the one public write endpoint. IPs are stored only as HMACs in quota counters.
- Customer-supplied URLs are https only and validated again at render time. No customer HTML, CSS or script.
- Gaps accepted for now: OWNER MFA/step-up, a Content-Security-Policy and tuned rate limits belong to M10.

## Environments

Development and Preview share the `neffi-dev` database; Production is a separate project that does not exist yet and fails closed ([0010](../decisions/0010-environment-isolation.md)). Configuration is validated at startup and names a bad variable without printing its value. Variable names are listed in `.env.example`; procedures are in [operations](../operations.md).
