# Operations runbooks

Procedures for setting up, migrating, deploying, provisioning and verifying Neffi. For what the product does, see [PRODUCT.md](../PRODUCT.md) and [`specs/`](specs/). Gate wording below comes from earlier milestones; the rule it expresses still applies, namely **no live database change on a shared database without explicit approval and a restore point**.

## Environments and isolation

| Environment | Database | Where its config lives |
|---|---|---|
| Local development | Neon `neffi-dev` | `.env.local` (git-ignored) |
| Vercel Preview | Neon `neffi-dev` | Vercel env vars, Preview scope |
| Production / pilot | Separate production Neon project (not created yet) | Vercel env vars, Production scope only |

Safeguards:

- `src/config/isolation.ts` refuses a production database host outside production, and in production refuses any host not listed in `PRODUCTION_DATABASE_HOSTS`. That list is empty until the production project exists, so a production deployment currently fails closed by design.
- The migration config uses the same guard.
- Database, auth and env modules import `server-only`, so a Client Component importing them fails the build.
- CI runs `check:bundle` so server secret values cannot ship in client bundles or prerendered pages.
- Real customer data is never copied into development or Preview.

## Deploying a Preview (Vercel)

1. Import the GitHub repository in Vercel (Hobby, Node 24.x).
2. After explicit approval to modify Vercel, set `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `ACTIVATION_CODE_SECRET` and `CARD_URL_ORIGIN` (and optionally `NEXT_PUBLIC_SENTRY_DSN`) for the **Preview** and **Development** scopes only, using `neffi-dev` values. Keep the activation secret consistent with issued development credentials. `CARD_URL_ORIGIN` must use HTTPS in Preview; localhost is permitted only in development. Preview/test-origin cards remain engineering-only; lock the final long-lived origin before any customer/pilot provisioning. Leave `BETTER_AUTH_URL` unset for Preview; it is derived from the branch URL.
3. Leave the **Production** scope empty until the production database exists.
4. Enable "Automatically expose System Environment Variables".
5. After explicit push approval, push a branch and check `<preview-url>/api/health` and `<preview-url>/api/auth/ok`. Complete the auth Preview checks below; keep Vercel Authentication enabled.

## Database migrations

PostgreSQL is the source of truth; Neon is replaceable hosting.

1. Change the relevant file in `src/db/schema/` (or `pnpm db:generate --custom --name=<name>` for hand-written SQL).
2. `pnpm db:generate`, then **review the SQL** in `drizzle/` and commit it with the schema change.
3. Run `pnpm test`, `pnpm db:check`, and `pnpm db:erd`; commit the regenerated ERD with any migration change. Separate custom SQL statements with `--> statement-breakpoint` so PGlite and the live migrator apply the same sequence.
4. After the live-database approval gate, run `pnpm db:migrate` against the development database. Running it again should make no changes.

There is intentionally no `db:push`: schema changes always go through reviewed, committed migrations, and applied migrations are never edited. `drizzle/0000_foundation_baseline.sql` stays permanent; Migrations `0001`–`0012` are all committed (accounts/auth, commerce, inventory/profiles, operations, integrity guards, credential serialization, auth abuse limits and cleanup, card provisioning, scenes/forms, profile content version, owner operations). CI generates the schema and rejects a diff in `drizzle/`.

**Live-database gate.** Applying pending migrations, running roles or resets on `neffi-dev`, or any other live change needs a confirmed restore point (Neon branch or snapshot) and explicit approval; approval for one change does not authorize another. Do not migrate or reset the restore branches (`pre-m2`, `pre-m3`). After approval, migrate twice (the second run must be a no-op) and inspect the journal. Migrations `0011` and `0012` (and `0009`, `0010`) have not been applied to any shared Neon database as of this writing; verify the pre-checks in the relevant plan first (for example, `0012` requires at most one active product per kind).

**Recovery:** Drizzle has no down migrations. Before applying migrations to a shared database, keep a restore branch or snapshot. Recover with that restore point or a reviewed forward migration. There is no automated destructive rollback.

## Synthetic development seed

**`db:seed` is a reset, not an additive import.** One transaction truncates only the 26 explicitly listed domain/auth tables in `public` (including M3 abuse counters), restarts identities, and inserts synthetic fixtures with stable fixture IDs. It bypasses row-history triggers deliberately. It uses `RESTRICT`, so an unlisted referencing table aborts the entire reset rather than being cascade-truncated. The migration journal and unrelated tables stay intact. A reset also deletes real development sign-ins, sessions and role audit history; it requires separate live approval.

The CLI and the exported seed function both require `VERCEL_ENV=development`, with `NODE_ENV` unset or `development`, and validate `DATABASE_URL_UNPOOLED` through the existing isolation guard. Missing/blank environment markers, Preview, Production, test and unknown contexts are refused. Explicit development selects the operation's context; verify that the direct URL belongs to the intended development database before invoking it.

After a restore point exists and the live reset is approved, run:

```sh
VERCEL_ENV=development pnpm db:seed
```

PowerShell: set `$env:VERCEL_ENV = "development"`, run `pnpm db:seed`, then `Remove-Item Env:VERCEL_ENV` when finished. Do not set this marker in `.env.local` or a Preview/Production environment.

Fixtures cover owners/customers, commercial history, DBC/GRC lifecycle, profiles, support, expenses and activity. Emails use `@example.test`. Credential lookup values are synthetic 64-character hex values with no corresponding activation code. The CLI prints row counts only. Run twice to verify stable counts and fixture IDs; generated row IDs and default audit timestamps are not fixture identifiers.

## Local database verification

`pnpm test` applies all committed migrations from zero to isolated, in-process PGlite databases. The invariant tests assert PostgreSQL error codes/constraint names and use rollback/savepoints. Seed tests prove repeatability, environment refusal and reset boundaries. The ERD freshness test regenerates the catalog in memory and compares it with `docs/database/erd.md`.

Tests and `db:erd` need no live database credentials. `db:generate`/`db:check` load the migration configuration but do not connect. PGlite verification does not replace gated verification on Neon. No live migration, seed/reset or other schema/data change is authorized without that approval.

`pnpm check:db-concurrency` runs the two-session retirement/credential-issuance regression under READ COMMITTED, REPEATABLE READ and SERIALIZABLE. It requires a disposable local PostgreSQL database named `neffi_m2_test`, with `DATABASE_URL_TEST` targeting `127.0.0.1`; it never loads `.env.local` and refuses Neon. The check applies migrations and inserts synthetic fixtures, so use an isolated database. PGlite and the credential-free CI suite cannot exercise independent concurrent sessions. Usable-credential issuance writes the parent card without changing its values, serializing retirement and making stale snapshots reject with a serialization failure; future domain transactions must retry such failures.

## Authentication runbook

Use a single development/Preview Google OAuth **web** client. Keep its consent screen in Testing mode and add the intended Google accounts as test users. Register these exact redirect URIs; Google accepts no wildcard:

- `http://localhost:3000/api/auth/callback/google`
- the Preview branch alias callback (`https://<branch-alias>.vercel.app/api/auth/callback/google`), registered exactly

Use a development/Preview Resend key with send-only permission. Until a sender domain is verified, set `AUTH_EMAIL_FROM` to `Neffi <onboarding@resend.dev>`; this test sender reaches only the Resend account owner's inbox. Domain verification and SPF/DKIM/DMARC are required before the pilot. Mail contains plain text with a random idempotency key per delivery; codes and provider responses are never logged.

At `/sign-in`, choose Google or request a six-digit email code. Codes expire after five minutes, work once and allow three failed attempts; they are stored as keyed HMACs. Sends are limited to three per email per ten minutes and ten per IP per minute; code submissions also have a ten-per-minute IP limit. Limits persist in PostgreSQL. Known and unknown emails receive the same send response. Passwords, SMS and account-settings endpoints are disabled.

Only the exact exposed auth paths create IP counters; arbitrary paths and blocked reset-token paths return 404 without adding counters. New traffic to allowed paths removes counters older than the longest active window (60 seconds) using the `last_request` index. Active counters and the separate ten-minute email quota are preserved. Google sign-in retains Better Auth's three-per-ten-second IP limit; other allowed paths retain their existing limits. Keep the cleanup bound aligned when adding longer-window rules or upgrading auth plugins.

A successful email code verifies the address and resolves its existing Account or creates a customer. A linked Google identity resolves its permanent Account even if the provider email changes. A new Google identity matching an existing Account is refused: sign in with an email code, then use **Connect Google** in `/app`. Linking requires a verified matching email and refuses an identity already owned by another Account. Google tokens are not persisted. Different verified emails may represent separate Accounts; merging is support work in M9.

Sessions roll for 30 days, with renewal after one day through a server action called by the protected shell. Server rendering reads without refreshing; authorization reads the current database role without a cookie cache. Sign-out deletes the session, and expired/deleted sessions lose access. Cookies are HttpOnly and SameSite=Lax, plus Secure on HTTPS. `/get-session` is disabled over HTTP; the email-code sign-in response still contains Better Auth's session token. CSP and owner MFA/step-up remain M10 work.

Both protected layouts and pages validate access on the server. `/app` requires a verified Account; `/admin` requires OWNER. Route handlers/actions use `authorize()` for 401/403 denials and explicit ownership checks; OWNER does not implicitly grant access to another customer's private data. Post-sign-in destinations pass through `safeNext()` and stay inside `/app` or `/admin`.

**Navigation status caveat:** Next.js Cache Components streams a static shell with HTTP 200 before a denied navigation's redirect or not-found result arrives. Protected content is withheld, but the initial HTTP status is not 307/404; visitors without JavaScript may see a blank shell. The auth layer does not use the Proxy; `src/proxy.ts` handles only `/c/:token`.

### Owner role operations

After live approval, verify the endpoint belongs to `neffi-dev / production` before each write, then run:

```sh
pnpm accounts:set-role <email> owner
pnpm accounts:set-role <email> customer
```

This operator CLI uses the direct migration URL and existing environment/isolation checks. Production fails closed until a production host is registered. It loads `.env.local` locally, needs no OAuth/Resend credentials, and runs the service under Node's `react-server` condition to preserve its `server-only` import boundary. There is no public role-change endpoint: Better Auth ignores submitted roles, forces new Accounts to customer, and disables `/update-user`.

Email lookup is case-insensitive. Unknown or ambiguous Accounts and invalid roles fail without writes. A locked transaction changes the role and inserts `activity_events` with type `account_role_changed`, the Account ID and note `customer→owner` or `owner→customer`; audit failure rolls the role back. Setting the current role is a no-op with no new event. Success prints the Account ID only (also for a no-op); failure prints a generic diagnostic and exits nonzero without SQL, email or credentials.

### Local and approved live checks

Local tests use fresh PGlite databases and mocked Google/Resend responses; they send no mail and need no live database. CI supplies synthetic auth configuration, checks migration drift and scans public bundles for secret values. A local build requires all four new auth variables; synthetic CI values prove compilation but cannot verify delivery or OAuth setup.

At an approved live check, test OTP to the permitted inbox, Google sign-in, same-email refusal followed by OTP and Connect Google, sign-out, customer denial at `/admin`, then the owner grant and owner access. After separate push/Vercel approval, repeat at the registered branch alias. Other Preview URLs support OTP only when their origin matches the configured base URL; Google works only with a registered callback. Preview uses development credentials and stays behind Vercel Authentication. Application Production remains untouched.

Accepted abuse limits: another person can consume an email's send quota or invalidate its outstanding code; delivery failures also consume quota. Defaults allow up to nine incorrect guesses across three sends per ten minutes. Google is a fallback; stronger anti-abuse measures are M10 work.

## Physical card provisioning

OWNER-only screens at `/admin/inventory` receive stock, provision Digital Business Cards (DBC), manage the legacy manual Google Review Card (GRC) utility, and show derived card counts. `/c/{token}` is the public card page; customer activation is described under Activation checks below.

**Configuration.** `CARD_URL_ORIGIN` is a bare origin (no path, query or hash; https outside development). The NFC value written for a DBC is exactly `<CARD_URL_ORIGIN>/c/<token>`. Cards provisioned while it points at a development origin are **engineering test units and must never be sold.** Before any pilot or commercial DBC is provisioned, lock the final long-lived NFC domain and change `CARD_URL_ORIGIN` to it. `ACTIVATION_CODE_SECRET` keys the HMAC stored for each activation code; changing it makes every issued, unclaimed code unverifiable, so treat it like a database credential and do not rotate it casually.

**Tokens and codes.** The permanent public token is 26 Crockford Base32 characters (130 bits), issued once and never changed. It is public and is not proof of ownership. The activation code is 16 Crockford characters shown as `XXXX-XXXX-XXXX-XXXX`; only its keyed hash is stored. The raw code appears once, in the response of the Provision or Replace action, and is never persisted, logged or placed in a URL. If a response is lost, use **Replace credential**.

**DBC lifecycle.**

1. **Receive stock** creates a stock purchase and N Blank cards. M8 adds optional purchase and inbound-shipping costs on that purchase.
2. **Provision** (card page) gives a Blank card its permanent token and its first credential and shows the code once. The card stays Blank and is shown as *in provisioning*; that label is derived, not a new state.
3. **Write and test the NFC tag** with NFC Tools on a real phone: *Write, Add a record, URL/URI*, paste the exact URL shown on the card page, *Write*; then *Read* it back. Do not use *Lock tag* or set a password; the tag must stay writable. Tap the tag with a real phone (Android with NFC on, or an iPhone XS or later) and confirm it recognises the tag and tries to open that exact address. A matching tag opens the card page, which shows the generic unavailable page until the card is claimed and published. Then record the NFC check with the address you read back and the three confirmations. The server checks that the read-back address is exactly the card's URL.
4. **Match the package.** Pack the matched Card with the common activation insert containing the static `/activate` QR plus its unique printed activation-code label, inside the sealed package; type the code from that package. The server compares it with the card's current credential. This means the OWNER verified that the code physically packaged with this card matches this card. The QR is common, not Card-specific, and never contains the code. The physical insert is part of packing; `/activate` is not needed for this match. A matching code makes the card **Ready**.
5. **Replace credential** is the pre-release fix for a lost or mismatched unused code: it revokes the old code, issues a new one, returns a Ready card to Blank and requires the package to be matched again. It never restores a used or revoked credential and does not apply once a card is Released. Lost-code and wrong-account cases after release are planned in M9A.

**GRC.** GRCs never get a token, credential, owner or profile, and Orders never use Card rows for them ([GRC spec](specs/google-review-card.md)). The owners prepare each tag by hand. Optionally, the legacy M4 utility in Inventory can **Reserve** a Blank card against an open GRC item that has a review URL and spare quantity, record the NFC check after writing and reading back the URL, and **Retire** it. Nothing in order fulfilment depends on this utility.

**Retire** removes a Blank, Ready or reserved-GRC card that failed or must not be sold. It revokes any unused credential, keeps all history, and a retired reserved GRC stops counting against its order item so a replacement can be reserved.

**Physical evidence.** `nfc_verified_at` and `package_matched_at` exist only after a real physical check. A DBC cannot be Ready without both (a database constraint), and issuing any new usable credential clears the package match. The development seed contains no Ready DBC and no physical evidence by design; only isolated automated tests and disposable loopback activation fixtures use synthetic timestamps. Never record a check you did not perform, including on `neffi-dev`.

**Migration 0009.** Adds the two columns and `cards_dbc_ready_checks_recorded`, created `NOT VALID` so a pre-M4 development row that was seeded as Ready (with no physical evidence) is not given invented timestamps. New and updated rows are still checked, and a database migrated from zero has no legacy rows. M10 is expected to validate the constraint. It also replaces the `activation_credentials_guard` function; the serialization with retirement from `0006` is unchanged.

**Physical acceptance.** Real-hardware acceptance of provisioning, packaged-card activation and the public tap passed on 2026-10-12 (M4, M5) and later for M7; see [the roadmap](roadmap.md). Repeat it for any new card batch or origin change, using engineering cards labelled TEST: write the exact URL with NFC Tools, read it back identical, tap it on a real phone, confirm the tag is still writable, record the NFC check, match the package, and confirm Ready. Record device, date and card id, never a code or a photo showing one. Engineering cards written against localhost or another development origin must never be sold. Customer and pilot packages must use the common activation insert, the unique printed code label for the exact Card inside the sealed package, and the final long-lived origin.

## Activation checks

The customer flow is `/activate` → activation code → sign in with Google or email code if needed → **Add to my account** → `/app`. Only Released DBCs can be claimed; owners release cards from an Order. Claiming assigns ownership, consumes the credential and records Activity atomically. `/app` lists owned cards **Ready to set up** as the resumable M6 handoff; activation creates no Profile or Scene.

An accepted code sets the 15-minute `neffi_activation` cookie (`HttpOnly`, `SameSite=Lax`, `Path=/activate`, secure over HTTPS). It contains only a signed opaque credential reference and expiry, never the activation code. Checks allow 20 attempts per IP and claims allow 10 attempts per Account per 10 minutes, using the existing HMAC-keyed quota counters.

`pnpm check:claim-concurrency` proves single-winner claims using `DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test` only. `pnpm dev:activation-fixture` creates synthetic claimable and unavailable cases and prints their synthetic codes for private local browser acceptance. It requires a loopback `DATABASE_URL` and the same `ACTIVATION_CODE_SECRET` as the dev server; it never loads `.env.local` itself and must never target Neon. Its synthetic Ready timestamps are software test inputs, never evidence of physical acceptance.

Run `DATABASE_URL=<loopback> pnpm dev` with the process environment overriding `.env.local` so browser acceptance uses the disposable local database. Google requires the registered localhost OAuth callback and email sign-in requires a real controlled inbox. Do not copy codes, OTPs or cookies into logs or acceptance records. Real packaged-card acceptance passed on 2026-10-12 (M4, M5) and M7 physical NFC acceptance later passed; these fixtures are software inputs and never count as hardware evidence.

## Customer-experience checks

`pnpm check:profile-concurrency` proves duplicate-safe setup, dense block ordering and submission deduplication against the disposable `DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test` only. It applies migrations and creates synthetic fixtures; never run it against Neon.

With a local dev server using a loopback database and a Published Profile showing a Form, run `DATABASE_URL=<loopback> pnpm dev:form-submission`. It never loads `.env.local`, refuses non-loopback database/app hosts and Neon, and prints only HTTP status codes. `APP_ORIGIN` defaults to `http://localhost:3000`; `VISITOR_EMAIL` can be a controlled reply address. It sends synthetic name/message/question answers and a fixed synthetic phone so Required Phone works. `--repeat-key` submits the same message twice: expect `201 201` and one new Inbox message. Notification delivery uses the dev server's email configuration; real inbox acceptance is manual.

## Concurrency suites

Five two-session suites run against a disposable loopback PostgreSQL only (`DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test`; never Neon, and not run in CI): `check:db-concurrency`, `check:provisioning-concurrency`, `check:claim-concurrency`, `check:profile-concurrency` and `check:orders-concurrency`. Each applies migrations and creates synthetic fixtures. M8 passed all five (31 scenarios).

## Owner business operations checks

Migration `0012_owner_operations` adds payment and refund void metadata, reasoned-void CHECKs, a one-way void guard and the one-active-product-per-kind index; its pre-check is `SELECT kind FROM products WHERE active GROUP BY kind HAVING count(*) > 1` returning no rows. Local production-like acceptance uses `next build && next start` against a loopback database seeded with synthetic fixtures and an owner role set with `accounts:set-role` on that database only. For remote validation, use a temporary Neon branch and a dedicated Vercel Preview (Vercel Authentication on), approved step by step, torn down afterwards, and never touching `neffi-dev` or Production; this is how M8 was validated.
