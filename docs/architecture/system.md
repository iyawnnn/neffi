# System architecture

For current engineering milestone status, see [the roadmap](../roadmap.md). See also [domain model](domain-model.md), the [ERD](../database/erd.md) and the [decision records](../decisions/).

## Shape

One Next.js 16 App Router **modular monolith** (TypeScript, React 19, Tailwind and shadcn/ui) on PostgreSQL. Server Components are the default; Client Components are limited to interactive forms and editors. Mutations are Server Actions that authenticate, authorize and validate (Zod) before calling a domain service. Route Handlers are used for the auth callbacks, the public form submission endpoint, the vCard download (`/c/{token}/contact`), OWNER-only records search (`/admin/search/records`) and health. Image-upload signing is a Server Action. There is no separate API service, queue, cache server or search engine.

| Surface | Routes | Access |
|---|---|---|
| Marketing | `/`, `/product`, `/pricing`, `/guide`, `/help`, `/privacy`, `/terms` | Anyone ([marketing UI](marketing-ui.md)) |
| Public | `/activate`, `/c/{token}` (+ `/contact` vCard; unavailable cards rewrite to `/c-unavailable`), `/sign-in`, `/support`, `/support/recover` | Anyone. `/activate` needs a code; `/c` shows only what the Card's state allows |
| Customer | `/app/*` (Home, Profiles, Cards, Account, Inbox, setup) | Verified Account |
| Owner | `/admin/*` | Verified Account with role OWNER |
| API | `/api/auth/*`, `/api/forms/{id}/submissions`, `/api/health` | As stated per route |
| Development previews | `/dev/*` (email, profile, appearance, setup and admin previews) | Local development only; 404 in every other environment |

Admin, customer and operational pages are dynamic, `noindex` and never shared-cached. Pages that read the database call `await connection()` first and export `instant = false`.

**Owner area.** `/admin` uses its own shell (`src/app/admin/admin-frame.tsx`, `shell.tsx`): grouped navigation from `nav-sections.ts` (Overview, Operations, Service, System) as a sidebar on desktop and a menu sheet on small screens, an account menu, and a command palette with quick actions and records search. Admin routes provide `loading.tsx` skeletons. Submit buttons show a pending state through the shared `Button` `loading`/`loadingText` props (`src/components/ui/button.tsx`). The customer app's conventions are in [customer UI](customer-ui.md).

## Stack and integrations

| Concern | Choice |
|---|---|
| Database | PostgreSQL (Neon in hosted environments), Drizzle ORM, reviewed forward-only SQL migrations in `drizzle/` |
| Auth | Better Auth with Google and email one-time code; custom Drizzle adapter mapping onto `accounts`, `auth_identities`, `auth_sessions`, `auth_verifications`, `auth_rate_limits`; database-backed rate limits; no passwords or SMS |
| Email | Resend over `fetch` (no SDK), behind `src/integrations/email`. Every message is a content model rendered once by `renderEmail` into table-based HTML plus a generated plain-text alternative (no remote fonts, tracking or scripts). Auth codes, form notifications, support acknowledgement/reply/resolution, one-time recovery codes and restricted security notices; no commerce email |
| Media | Cloudinary signed direct uploads (no SDK), raster images only (the Profile photo/logo and the optional Showcase cover), verified server-side, never stored in PostgreSQL |
| Errors | Sentry, errors only, personal-data collection off, request scrubbing |
| Hosting | Vercel (Node 24); Neon pooled connections for runtime, direct URL for migrations |
| Tests | Vitest with in-process PGlite; two-session concurrency scripts against a disposable loopback PostgreSQL |

## Code layout

- `src/app/` routes: `(marketing)` (the public marketing site, including `/`), `(public)`, `(customer)/app`, `admin`, `api`. `src/proxy.ts` handles `/c/:token` only.
- `src/modules/<domain>/` server-only domain services that own business rules: `accounts`, `activation`, `activity`, `cards`, `expenses`, `forms`, `inventory`, `orders`, `payments`, `profiles`, `support`, plus `search.ts`. See [`src/modules/README.md`](../../src/modules/README.md).
- `src/db/` schema, runtime connection, seed and invariant tests. `src/auth/`, `src/config/` (validated environment and isolation), `src/integrations/`, `src/lib/` (pure helpers).
- Server-only modules start with `import "server-only"`. `src/server-only-boundary.test.ts` lists them, and `pnpm check:bundle` fails CI if a secret value reaches client output.

## Conventions

- UI and actions call domain services; services own rules and persistence. Client Components receive minimal DTOs.
- Hiding UI is never authorization. Actions use `authorize("owner" | "account")`; pages use `requireOwner()` / `requireAccount()`.
- Multi-record changes are one transaction that locks first and re-reads under the lock ([0009](../decisions/0009-database-invariants-and-lock-order.md)). Order writers go through `mutateOrder`: lock the Order (`FOR NO KEY UPDATE`), then items, then DBC Cards, then credentials, set updated-by, and re-settle completion in the same transaction.
- Support writers lock case (`NO KEY UPDATE`) → Order (`NO KEY UPDATE`) → item (`NO KEY UPDATE`) → former-owner Account (`KEY SHARE`, if claimed) → DBC card (`UPDATE`) → credential. Reset uses case → former-owner Account → card → credential; unclaimed reissue uses case → card → credential. Account-before-Card matches M6 setup; the locked Card must still match the owner snapshot. Support item locks serialize writers while permitting recovery's foreign-key checks, avoiding a Card/item cycle. Nested services share the open transaction using savepoints.
- Every meaningful change writes an immutable Activity event in the same transaction; Support mutations include `support_case_id`.
- Money is integer centavos. Business dates are `date`; timestamps are `timestamptz`; display uses Asia/Manila.
- Select only needed columns, paginate unbounded lists (keyset), and let PostgreSQL aggregate.

## Caching

- `/support` has a static help/privacy shell with a viewer-aware form behind Suspense. Submit and `/support/recover` are uncached request-time paths; no Account data enters shared static output.

- `/c/{token}`: the Card is read fresh on every request. Only a published Scene's content is cached, by `(profile, scene, content_version)`; each visible edit bumps `content_version` in its own transaction ([0011](../decisions/0011-fresh-card-state-cached-scene-content.md)). Card routing, enabled flag and publish status are never cached.
- The Proxy decides availability before rendering and forwards a signed, request-only snapshot to the page. Unavailable document requests are rewritten to a generic 404 page.
- Other operational and customer data remains dynamic.

## Security

M9B recovery locks case → Account `FOR UPDATE` → proof; it never locks Card/credential rows. Resolve checks pending recovery under the case lock. Wrong attempts commit as returned failures; the third cancels. Occupied addresses and owner targets are refused, and no business records move. See [0012](../decisions/0012-support-controlled-account-recovery.md). Public support adds HMAC quotas, honeypot, bounded fields and an indexed 24-hour acknowledgement rule. Notices expose only event/time/reference/support guidance, and email attempts record opaque result events without bodies. No outbox or automatic retry is introduced.

- No secret in client bundles, URLs, logs, Sentry or browser storage. OTPs and recovery codes are stored only as keyed HMACs. Activation codes are stored as a keyed HMAC plus, while usable, an AES-256-GCM envelope that only an OWNER can reveal, with every reveal audited ([0016](../decisions/0016-retrievable-encrypted-activation-credentials.md); key handling in [operations](../operations.md#activation-code-key-custody)).
- Same-origin checks, bounded fields, body caps and HMAC quotas protect public writes. Intake/forms use honeypots; recovery completion also has a per-proof attempt counter. IPs are stored only as HMACs in quota counters.
- Customer-supplied URLs are https only and validated again at render time. No customer HTML, CSS or script.
- M10 enforces static CSP/nosniff, daily HMAC quotas (IPv6 /64), non-blocking quota cleanup and shared Sentry SQL-parameter scrubbing. Inbox cursors retain database timestamp microseconds. OWNER MFA/step-up remains deferred until team growth or Production setup; Turnstile awaits distributed-abuse evidence. No speculative indexes were added.

## Environments

Development and Preview share the `neffi-dev` database; Production uses the separate `neffi-production` project and accepts only its registered host; an empty allowlist fails closed ([0010](../decisions/0010-environment-isolation.md)). Configuration is validated at startup and names a bad variable without printing its value. Variable names are listed in `.env.example`; procedures are in [operations](../operations.md).
