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
2. After explicit approval to modify Vercel, set `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `ACTIVATION_CODE_SECRET`, `CARD_URL_ORIGIN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` (and optionally `NEXT_PUBLIC_SENTRY_DSN`) for the **Preview** and **Development** scopes only, using `neffi-dev` values. Keep the activation secret consistent with issued development credentials. `CARD_URL_ORIGIN` must use HTTPS in Preview; localhost is permitted only in development. Preview/test-origin cards remain engineering-only; lock the final long-lived origin before any customer/pilot provisioning. Leave `BETTER_AUTH_URL` unset for Preview; it is derived from the branch URL.
3. Leave the **Production** scope empty until the production database exists.
4. Enable "Automatically expose System Environment Variables".
5. After explicit push approval, push a branch and check `<preview-url>/api/health` and `<preview-url>/api/auth/ok`. Complete the auth Preview checks below; keep Vercel Authentication enabled.

## Database migrations

PostgreSQL is the source of truth; Neon is replaceable hosting.

1. Change the relevant file in `src/db/schema/` (or `pnpm db:generate --custom --name=<name>` for hand-written SQL).
2. `pnpm db:generate`, then **review the SQL** in `drizzle/` and commit it with the schema change.
3. Run `pnpm test`, `pnpm db:check`, and `pnpm db:erd`; commit the regenerated ERD with any migration change. Separate custom SQL statements with `--> statement-breakpoint` so PGlite and the live migrator apply the same sequence.
4. After the live-database approval gate, run `pnpm db:migrate` against the development database. Running it again should make no changes.

There is intentionally no `db:push`: schema changes always go through reviewed, committed migrations, and applied migrations are never edited. `drizzle/0000_foundation_baseline.sql` stays permanent; Migrations `0001`–`0015` are all committed (accounts/auth, commerce, inventory/profiles, operations, integrity guards, credential serialization, auth abuse limits and cleanup, card provisioning, scenes/forms, profile content version, owner operations). CI generates the schema and rejects a diff in `drizzle/`.

**Live-database gate.** Applying pending migrations, running roles or resets on `neffi-dev`, or any other live change needs a confirmed restore point (Neon branch or snapshot) and explicit approval; approval for one change does not authorize another. Do not migrate or reset restore branches. After approval, migrate twice (the second run must be a no-op) and inspect the journal. Shared Neon development is migrated through `0015_validate_dbc_ready_checks` as of 2026-10-15: the 16-entry journal, validated `cards_dbc_ready_checks_recorded` constraint and unchanged 27-table / 16-enum schema were verified. See the completed 0015 gate below for the legacy-data correction and retained restore points. The production database is not created or configured, and Production is untouched.

**Recovery:** Drizzle has no down migrations. Before applying migrations to a shared database, keep a restore branch or snapshot. Recover with that restore point or a reviewed forward migration. There is no automated destructive rollback.

### Migration 0015 gate and verified shared-development state

`0015_validate_dbc_ready_checks` contains only `ALTER TABLE "cards" VALIDATE CONSTRAINT "cards_dbc_ready_checks_recorded";`. It was applied successfully to shared Neon development on 2026-10-15 after the separately approved correction below. For any database still through `0014`, confirm the target, journal and restore point before separately approved application, then run:

```sql
SELECT count(*) FROM cards
WHERE kind = 'dbc' AND state = 'ready'
  AND (nfc_verified_at IS NULL OR package_matched_at IS NULL);
```

The count must be zero. Any non-zero result is a STOP; never invent physical evidence. After explicit approval, apply `0015`, verify `pg_constraint.convalidated = true` and the 16-entry migration journal, then rerun to prove a no-op. Production remains untouched and unconfigured.

**Completed shared-development gate (2026-10-15).** The initial pre-check found one legacy synthetic seed Card, `00000000-0000-4000-8000-000000000071`, incorrectly left Ready before M4. Read-only investigation found no NFC or package-match evidence; the current seed represents it as Blank. After separate approval and a restore point, a guarded update changed exactly that Card from Ready to Blank, with only the normal `updated_at` change. Both `nfc_verified_at` and `package_matched_at` remained NULL; no physical evidence or historical Activity event was fabricated. All other Cards, including the three synthetic Released fixtures, and unrelated data remained unchanged. The rerun pre-check returned **0**. Migration `0015` then succeeded; the journal advanced from 15 entries through `0014` to **16 entries through `0015`**, and `cards_dbc_ready_checks_recorded` now has **`convalidated = true`**. The migrator rerun was a no-op. Data checksums were unchanged by migration; the schema remains **27 tables / 16 enums**, with the live catalog matching committed migrations.

**Retained M10 restore points:** `m10-pre-legacy-dbc-correction-20261015` (`br-silent-unit-az9a0u53`, before correction) and `m10-pre-0015-20261015` (`br-curly-recipe-azdl7qft`, after correction and before migration). Both were verified ready and remain retained. Do not migrate, reset or delete them without separate approval.

## Browser security headers

Every response receives an enforced static Content-Security-Policy and `X-Content-Type-Options: nosniff` from `src/config/security-headers.ts` via Next config. The policy preserves Cache Components/PPR: scripts and styles allow inline content; images allow self, data and Cloudinary delivery; connections allow self, Cloudinary upload and only the configured Sentry DSN origin. Embedding this app in a frame, plugins and base URL overrides are blocked, and form actions are same-origin. Inline scripts remain an accepted limitation; reconsider nonces when compatible with PPR or stable SRI is available.

Only `PHASE_DEVELOPMENT_SERVER` adds `unsafe-eval`; production permits no eval, WebSocket scheme or wildcard source. No extra dev WebSocket source is configured. M10 T12 headless evidence covered published Card submission, signed-out Support submission after the pure-category-module Zod fix, and dev HMR WebSocket/hot edit, with zero CSP violations. M11 T9 extends production coverage to authenticated editors/customer/admin interactions: 37 green headless checkpoints, zero CSP events/audit issues/console errors after the approved data-only editor import correction. These are automated observations, not manual acceptance. Add a dev-only WebSocket source only after an observed block. Vercel Toolbar (`vercel.live`) is intentionally unsupported and blocked; do not widen the policy for it. M11 T10 Vercel edge/HSTS observation was approved but **NOT EXERCISED (access)** because the executor had no Vercel share-link connector. R10 remains for M12/next approved accessible Preview: observe normal pages and unavailable Card document/RSC responses without changing headers to force a pass.

To allow a genuinely required origin, update the shared policy and its exact-policy and integration coupling tests after scope approval. Do not put DSN credentials or paths in CSP. Sentry exceptions and console messages strip Drizzle `params:` tails; raw console arguments are dropped. Source-map upload remains deferred to Production setup / M12.

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

M11 local verification uses stricter environment rules (E1–E4): the verification worktree contains no `.env.local`; every software gate loads the exact synthetic CI values; real-PostgreSQL wrappers first clear inherited `DATABASE_URL*`/`PG*`, construct their URL from constants and fail closed unless the host is exactly `127.0.0.1`, port `55432`, and database is the wrapper's exact permitted target; and `db:migrate`/`db:seed` are banned in that workflow. Fresh migrations use the Drizzle migrator API inside the guarded wrapper. E5 local servers retain the CI values with only the pooled/direct database URLs overridden to the approved loopback target. Never infer shared-data authorization from a synthetic/local gate. Keep wrappers/logs in the ignored local ledger, never in Git.

`scripts/check-public-http.mts` is an operator-invoked loopback HTTP gate, not wired into CI or `package.json`. Run it against a production build/start under E5 with its exact loopback database guard. Its synthetic supporting Product is inactive so retained active catalog fixtures do not prevent repeat runs; existing assertions remain intact. M11 passed it twice consecutively on the same retained database and again at the final full gate. See the [M11 report](verification/2026-10-m11-full-verification.md) for the fresh migration, HTTP, concurrency and browser evidence.

Tests and `db:erd` need no live database credentials. `db:generate`/`db:check` load the migration configuration but do not connect. PGlite verification does not replace gated verification on Neon. No live migration, seed/reset or other schema/data change is authorized without that approval.

`pnpm check:db-concurrency` runs the two-session retirement/credential-issuance regression under READ COMMITTED, REPEATABLE READ and SERIALIZABLE. It requires a disposable local PostgreSQL database named `neffi_m2_test`, with `DATABASE_URL_TEST` targeting `127.0.0.1`; it never loads `.env.local` and refuses Neon. The check applies migrations and inserts synthetic fixtures, so use an isolated database. PGlite and the credential-free CI suite cannot exercise independent concurrent sessions. Usable-credential issuance writes the parent card without changing its values, serializing retirement and making stale snapshots reject with a serialization failure; future domain transactions must retry such failures.

## Authentication runbook

Use a single development/Preview Google OAuth **web** client. Keep its consent screen in Testing mode and add the intended Google accounts as test users. Register these exact redirect URIs; Google accepts no wildcard:

- `http://localhost:3000/api/auth/callback/google`
- the Preview branch alias callback (`https://<branch-alias>.vercel.app/api/auth/callback/google`), registered exactly

Use a development/Preview Resend key with send-only permission. Until a sender domain is verified, set `AUTH_EMAIL_FROM` to `Neffi <onboarding@resend.dev>`; this test sender reaches only the Resend account owner's inbox. Domain verification and SPF/DKIM/DMARC are required before the pilot. Mail contains plain text with a random idempotency key per delivery; codes and provider responses are never logged.

At `/sign-in`, choose Google or request a six-digit email code. Codes expire after five minutes, work once and allow three failed attempts; they are stored as keyed HMACs. Sends are limited to three per email per ten minutes, ten per email per 24 hours, fifty per IP per 24 hours and ten per IP per minute; code submissions also have a ten-per-minute IP limit. App per-IP keys use the IPv6 /64 network; IPv4-mapped addresses share the plain IPv4 key. Limits persist in PostgreSQL. Known and unknown emails receive the same send response. Passwords, SMS and account-settings endpoints are disabled.

Only the exact exposed auth paths create IP counters; arbitrary paths and blocked reset-token paths return 404 without adding counters. New traffic to allowed paths removes counters older than the longest active window (60 seconds) using the `last_request` index. Active counters and separate app quotas are preserved. App quotas use fixed windows starting at the first hit, retain rows for 24 hours, and reject windows longer than that retention. Cleanup skips locked rows; support runs cleanup before its transaction and disables cleanup within quota upserts. Google sign-in retains Better Auth's three-per-ten-second IP limit; other allowed paths retain their existing limits. Keep the cleanup bound aligned when adding longer-window rules or upgrading auth plugins.

A successful email code verifies the address and resolves its existing Account or creates a customer. A linked Google identity resolves its permanent Account even if the provider email changes. A new Google identity matching an existing Account is refused: sign in with an email code, then use **Connect Google** in `/app`. Linking requires a verified matching email and refuses an identity already owned by another Account. Google tokens are not persisted. Different verified emails may represent separate Accounts; merging is a deferred support exception (not planned in M9A).

Sessions roll for 30 days, with renewal after one day through a server action called by the protected shell. Server rendering reads without refreshing; authorization reads the current database role without a cookie cache. Sign-out deletes the session, and expired/deleted sessions lose access. Cookies are HttpOnly and SameSite=Lax, plus Secure on HTTPS. `/get-session` is disabled over HTTP; the email-code sign-in response still contains Better Auth's session token. Static CSP and nosniff are enforced (see Browser security headers). OWNER MFA/step-up is deferred while the team is 2–3 trusted people; revisit at team growth or Production setup.

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

Local tests use fresh PGlite databases and mocked Google/Resend responses; they send no mail and need no live database. CI supplies synthetic auth configuration, checks migration drift and scans public bundles for secret values. A local build requires the auth variables; synthetic CI values prove compilation but cannot verify delivery or OAuth setup.

At an approved live check, test OTP to the permitted inbox, Google sign-in, same-email refusal followed by OTP and Connect Google, sign-out, customer denial at `/admin`, then the owner grant and owner access. After separate push/Vercel approval, repeat at the registered branch alias. Other Preview URLs support OTP only when their origin matches the configured base URL; Google works only with a registered callback. Preview uses development credentials and stays behind Vercel Authentication. Application Production remains untouched.

Accepted abuse limits: another person can consume an email's send quota or invalidate its outstanding code; delivery failures also consume quota. Defaults allow up to nine incorrect guesses across three sends per ten minutes. An email daily cap can deny email-code access for up to 24 hours; Google and Support remain fallbacks. M10 uses daily caps instead of Turnstile. Add Turnstile to OTP send only if distributed abuse causes TOO_MANY_REQUESTS spikes or Resend quota alerts. Shared carrier IPs can hit daily caps; tune the constants if pilot traffic warrants it.

## Physical card provisioning

OWNER-only screens at `/admin/inventory` receive stock, provision Digital Business Cards (DBC), manage the legacy manual Google Review Card (GRC) utility, and show derived card counts. `/c/{token}` is the public card page; customer activation is described under Activation checks below.

**Configuration.** `CARD_URL_ORIGIN` is a bare origin (no path, query or hash; https outside development). The NFC value written for a DBC is exactly `<CARD_URL_ORIGIN>/c/<token>`. Cards provisioned while it points at a development origin are **engineering test units and must never be sold.** Before any pilot or commercial DBC is provisioned, lock the final long-lived NFC domain and change `CARD_URL_ORIGIN` to it. `ACTIVATION_CODE_SECRET` keys the HMAC stored for each activation code; changing it makes every issued, unclaimed code unverifiable, so treat it like a database credential and do not rotate it casually.

**Tokens and codes.** The permanent public token is 26 Crockford Base32 characters (130 bits), issued once and never changed. It is public and is not proof of ownership. The activation code is 8 Crockford characters (~39.92 bits) shown as `XXXX-XXXX`, containing at least one digit and one non-hex G-Z letter (excluding I, L, O and U); only its keyed hash is stored. The raw code appears once, in the response of the Provision or Replace action, and is never persisted, logged or placed in a URL. If a response is lost, use **Replace credential**.

**DBC lifecycle.**

1. **Receive stock** creates a stock purchase and N Blank cards. M8 adds optional purchase and inbound-shipping costs on that purchase.
2. **Provision** (card page) gives a Blank card its permanent token and its first credential and shows the code once. The card stays Blank and is shown as *in provisioning*; that label is derived, not a new state.
3. **Write and test the NFC tag** with NFC Tools on a real phone: *Write, Add a record, URL/URI*, paste the exact URL shown on the card page, *Write*; then *Read* it back. Do not use *Lock tag* or set a password; the tag must stay writable. Tap the tag with a real phone (Android with NFC on, or an iPhone XS or later) and confirm it recognises the tag and tries to open that exact address. A matching tag opens the card page, which shows the generic unavailable page until the card is claimed and published. Then record the NFC check with the address you read back and the three confirmations. The server checks that the read-back address is exactly the card's URL.
4. **Match the package.** Pack the matched Card with the common activation insert containing the static `/activate` QR plus its unique printed activation-code label, inside the sealed package; type the code from that package. The server compares it with the card's current credential. This means the OWNER verified that the code physically packaged with this card matches this card. The QR is common, not Card-specific, and never contains the code. The physical insert is part of packing; `/activate` is not needed for this match. A matching code makes the card **Ready**.
5. **Replace credential** is the pre-release fix for a lost or mismatched unused code: it revokes the old code, issues a new one, returns a Ready card to Blank and requires the package to be matched again. It never restores a used or revoked credential and does not apply once a card is Released. Lost-code and wrong-account cases after release are planned in M9A.

**GRC.** GRCs never get a token, credential, owner or profile, and Orders never use Card rows for them ([GRC spec](specs/google-review-card.md)). The owners prepare each tag by hand. Optionally, the legacy M4 utility in Inventory can **Reserve** a Blank card against an open GRC item that has a review URL and spare quantity, record the NFC check after writing and reading back the URL, and **Retire** it. Nothing in order fulfilment depends on this utility.

**Retire** removes a Blank, Ready or reserved-GRC card that failed or must not be sold. It revokes any unused credential, keeps all history, and a retired reserved GRC stops counting against its order item so a replacement can be reserved.

**Physical evidence.** `nfc_verified_at` and `package_matched_at` exist only after a real physical check. A DBC cannot be Ready without both (a database constraint), and issuing any new usable credential clears the package match. The development seed contains no Ready DBC and no physical evidence by design; only isolated automated tests and disposable loopback activation fixtures use synthetic timestamps. Never record a check you did not perform, including on `neffi-dev`.

**Migration 0009.** Adds the two columns and `cards_dbc_ready_checks_recorded`, created `NOT VALID` so a pre-M4 development row that was seeded as Ready (with no physical evidence) is not given invented timestamps. New and updated rows are still checked, and a database migrated from zero has no legacy rows. The constraint is now validated locally and in shared development through `0015_validate_dbc_ready_checks`; see the completed 0015 gate above. Migration 0009 also replaces the `activation_credentials_guard` function; the serialization with retirement from `0006` is unchanged.

**Physical acceptance.** Real-hardware acceptance of provisioning, packaged-card activation and the public tap passed on 2026-10-12 (M4, M5) and later for M7; see [the roadmap](roadmap.md). Repeat it for any new card batch or origin change, using engineering cards labelled TEST: write the exact URL with NFC Tools, read it back identical, tap it on a real phone, confirm the tag is still writable, record the NFC check, match the package, and confirm Ready. Record device, date and card id, never a code or a photo showing one. Engineering cards written against localhost or another development origin must never be sold. Customer and pilot packages must use the common activation insert, the unique printed code label for the exact Card inside the sealed package, and the final long-lived origin.

## Activation checks

The customer flow is `/activate` → activation code → sign in with Google or email code if needed → **Add to my account** → `/app`. Only Released DBCs can be claimed; owners release cards from an Order. Claiming assigns ownership, consumes the credential and records Activity atomically. `/app` lists owned cards **Ready to set up** as the resumable M6 handoff; activation creates no Profile or Scene.

An accepted code sets the 15-minute `neffi_activation` cookie (`HttpOnly`, `SameSite=Lax`, `Path=/activate`, secure over HTTPS). It contains only a signed opaque credential reference and expiry, never the activation code. Checks allow 20 attempts per 10 minutes and 50 per 24 hours per IP (IPv6 /64), then 100 per 10 minutes globally. IP and daily IP quotas are charged before the global quota. Claims allow 10 attempts per Account per 10 minutes, using the existing HMAC-keyed quota counters.

`pnpm check:claim-concurrency` proves single-winner claims using `DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test` only. `pnpm dev:activation-fixture` creates synthetic claimable and unavailable cases and prints their synthetic codes for private local browser acceptance. It requires a loopback `DATABASE_URL` and the same `ACTIVATION_CODE_SECRET` as the dev server; it never loads `.env.local` itself and must never target Neon. Its synthetic Ready timestamps are software test inputs, never evidence of physical acceptance.

Run `DATABASE_URL=<loopback> pnpm dev` with the process environment overriding `.env.local` so browser acceptance uses the disposable local database. Google requires the registered localhost OAuth callback and email sign-in requires a real controlled inbox. Do not copy codes, OTPs or cookies into logs or acceptance records. Real packaged-card acceptance passed on 2026-10-12 (M4, M5) and M7 physical NFC acceptance later passed; these fixtures are software inputs and never count as hardware evidence.

## Customer-experience checks

`pnpm check:profile-concurrency` proves duplicate-safe setup, dense block ordering and submission deduplication against the disposable `DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test` only. It applies migrations and creates synthetic fixtures; never run it against Neon.

With a local dev server using a loopback database and a Published Profile showing a Form, run `DATABASE_URL=<loopback> pnpm dev:form-submission`. It never loads `.env.local`, refuses non-loopback database/app hosts and Neon, and prints only HTTP status codes. `APP_ORIGIN` defaults to `http://localhost:3000`; `VISITOR_EMAIL` can be a controlled reply address. It sends synthetic name/message/question answers and a fixed synthetic phone so Required Phone works. `--repeat-key` submits the same message twice: expect `201 201` and one new Inbox message. Notification delivery uses the dev server's email configuration; real inbox acceptance is manual.

## M10 forms and Inbox limits

Public form POSTs keep their ten-per-IP/ten-minute ceiling and add thirty per IP per 24 hours, keyed by IPv6 /64 (IPv4-mapped addresses normalize to IPv4). Form notification attempts are capped at fifty per Profile per 24 hours; another Profile on the same Account has a separate allowance. A capped notification leaves the stored submission visible in Inbox with no `notified_at`, without retry. Inbox keyset cursors carry the database timestamp text so microseconds survive; displayed dates are unchanged.

## Performance and deferred hardening

No speculative indexes or query refactors were added. Revisit lists/search above about 10k rows, dashboards above about 2k orders, or measured p95 above 500 ms: owner outstanding-order scans, date/ID casts and substring search, unindexed created-at sorts, role lookup, unread aggregates and support-detail query rounds are the known ceilings. Add a quota cleanup timestamp index only above about 10k quota rows.

Non-UUID customer paths returning 500, Inbox mailto answer validation, unsigned Cloudinary overwrite and owner-note credential detection remain deferred. M11 T9 closed the local mark-read prefetch concern: two real Next router prefetch requests left `read_at` NULL after viewport/hover idle waits; clicking set it. Repeat after router/cache/navigation changes. Recovery security and M4/M5/M7 behavior are unchanged.

## Concurrency suites

Six two-session suites run against a disposable loopback PostgreSQL only (`DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test`; never Neon, and not run in CI): `check:db-concurrency`, `check:provisioning-concurrency`, `check:claim-concurrency`, `check:profile-concurrency`, `check:orders-concurrency` and `check:support-concurrency`. Each applies migrations and creates synthetic fixtures. The five earlier suites cover 31 scenarios. M10 support covers R1–R20 (26 scenarios), totaling 57 across all six. R20 proves that a locked expired quota row does not block support intake cleanup. All use loopback only.

## M9B support, recovery and email runbook

**Choose the recovery path.** If the customer still controls the current sign-in email, send them to `/sign-in?next=/app/account`: sign in with the existing email code or linked Google, then change the email in Account settings and verify the new address. Both change-email steps require a session created within 15 minutes. Other active sessions are revoked after the change and notice scheduling; the current session stays. If revocation fails, the email is already changed and the UI directs the customer to sign out everywhere. Change-email mail is capped at 3 per Account and target address per 10 minutes and 10 each per 24 hours, using private HMAC keys. Occupied target addresses receive no email and the same generic response.

Use support-assisted recovery when the customer lost access to the current inbox. `/support` offers both choices and the recovery topic; customers with an approved recovery code complete at `/support/recover`. Neffi emails the code only to the approved new address, never a recovery link. If the customer regains the old inbox and changes email themselves, the pending recovery fails its old-email snapshot check: cancel it before resolving the case. No recovery schema or data migration is required.

Migration `0014_support_intake_recovery` adds public/account intake fields, indexes and an UPDATE-only freeze, plus immutable recovery history. The seed's explicit cleanup includes `account_recoveries`; synthetic seeds leave that table empty. Run `db:check`, clean `db:generate`, `db:erd`, PGlite guard/seed tests and loopback concurrency before any external gate. Never run a seed on shared data.

At the M9B gate on 2026-10-15, the approved application of `0013` then `0014` passed the documented pre-checks, separate restore-point gates, schema/journal checks and both no-op reruns. Shared development has since advanced through `0015`; see the completed gate above. The pre-0013 and pre-0014 shared-development restore branches are retained; do not migrate, reset or delete them without approval. For a database that has not yet received `0014`, its additive pre-check must confirm no conflicting objects exist:

```sql
SELECT to_regclass('public.account_recoveries') AS existing_recovery_table;
SELECT typname FROM pg_type WHERE typname = 'support_case_source';
```

Expect null and no rows before first application. Existing cases receive source `owner` and null contact fields. After application, inspect migration journal, new constraints/indexes/triggers and 27-table/16-enum ERD; do not rewrite applied SQL.

Recovery procedure: open/link a customer recovery case, verify the claim off-platform, and **Secure account first if compromise is suspected**. Record a 10–300-character note without secrets. Enter an unused address and leave Google removal on unless appropriate evidence supports keeping it. Explain that the customer must not sign in with the new address before completing: OTP signup creates Accounts, and occupied addresses are refused (merge/deletion is unsupported). Live pending proofs need explicit cancellation. Code mail cannot be resent; failed delivery needs cancellation and new initiation. Three wrong codes cancel the proof. A pending proof blocks resolution; resolved cases cannot complete.

Case email recipient is requester contact first, then current linked Account email. Owners see it before sending; contact remains unverified even after linking. Never email activation codes. Reply/resolution retries require body re-entry and a fresh attempt; no bodies or provider errors are stored. Recovery notices use saved address snapshots. Verify Activity result events separately from real inbox receipt; a successful API call is not user-observed delivery.

Optional `SUPPORT_REPLY_TO` is validated as an email. For pre-launch M9B acceptance, the user revised D9 on 2026-10-15: use `Neffi <onboarding@resend.dev>` only within Resend sandbox limits (the Resend account owner inbox), and use the existing injected sender for deterministic automated verification. Do not deploy a fake sender or weaken recovery/security behavior. Delivery to unsupported recipients and all real two-independent-inbox observations are **DEFERRED — requires verified Neffi domain**. Once Neffi owns its public domain, verify the sender and complete those observations before launch. Domain purchases and unrelated DNS changes are not authorized.

**T14 stop:** after explicit approval only, create a temporary Neon branch from dev, run pre-checks and apply `0013` then `0014` there, provision a dedicated Vercel Preview with isolated pooled/direct URLs and dev/Preview auth/media secrets, trusted auth/card origins and the supported testing sender under revised D9. Confirm OAuth callback allow-list if Google is exercised. Never use shared dev or Production. T15 starts only on explicit user instruction. It is guided user-observed acceptance with read-only SQL and injected-sender evidence recorded separately and no codes/tokens in evidence. Application behavior (content, recipients, idempotency, failures, recovery state, session revocation and Activity) remains required. A1/A4/A5/A6/A7/A8 delivery observations outside sandbox support are deferred under revised D9; supported inbox receipt is never two-inbox proof. Tear down temporary resources afterwards under approval. Push, PR and merge remain separate approvals.

**Approved M9B acceptance record (2026-10-15).** Under revised D9 and the user-approved reduced manual scope, A1 basic signed-out support submission and A4 owner reply/resolution passed user observation; separate read-only SQL confirmed case state and email Activity. A6 full live recovery and independent-inbox delivery are **DEFERRED — requires verified Neffi domain / independent destination inbox**. A7, A2/A3/A5/A8/A9/A10 and remaining subchecks are **NOT MANUALLY EXERCISED — covered by automated/integration/concurrency evidence**, where applicable. The prior software gate passed 1,227 tests and 56 loopback concurrency scenarios; these are not manual passes. Real phone usability, Google Connect callback configuration and the exact delivered A1 subject remain unverified. No unresolved application defect was identified in the exercised flows; this is reduced development acceptance, not launch readiness.

**Launch gate remains open:** once Neffi owns its public domain, verify the Resend sender and observe full recovery using two independent external inboxes: code to the unused destination, restricted notices to the old inbox, completion, session revocation and sign-in at the new address. Verify email-change/security notice delivery as well. Do not bypass occupied-email or owner-account restrictions, expose recovery codes, or weaken security to accommodate the sandbox.

**Cleanup:** after acceptance approval, the dedicated temporary Vercel project, deployments, alias and acceptance-only configuration, plus the temporary Neon acceptance and pre-migration restore branches, were deleted and verified absent. That acceptance teardown did not modify shared development or Production. In the subsequent separately approved gate on 2026-10-15, shared development was migrated through `0014` and verified ready for M9B. Production remains untouched and unconfigured; any future shared migration still requires its own approval. Local evidence is retained outside Git.

Notion reconciliation remains manual: mark M9A merged, record M9B implementation, approved reduced T15 acceptance and verified temporary-resource teardown, and keep the parked UI findings and out-of-scope work deferred. No Notion edit was performed.

## Owner business operations checks

Migration `0012_owner_operations` adds payment and refund void metadata, reasoned-void CHECKs, a one-way void guard and the one-active-product-per-kind index; its pre-check is `SELECT kind FROM products WHERE active GROUP BY kind HAVING count(*) > 1` returning no rows. Local production-like acceptance uses `next build && next start` against a loopback database seeded with synthetic fixtures and an owner role set with `accounts:set-role` on that database only. For remote validation, use a temporary Neon branch and a dedicated Vercel Preview (Vercel Authentication on), approved step by step, torn down afterwards, and never touching `neffi-dev` or Production; this is how M8 was validated.

## Support and corrections checks

Migration `0013_support_guards` freezes `refunds.support_case_id`, requires a nonblank reason on case-linked refunds, and preserves case-card link history. Before any separately approved shared apply, run:

```sql
SELECT count(*) FROM refunds
WHERE support_case_id IS NOT NULL
  AND (reason IS NULL OR trim(reason) = '');
```

The result must be zero. Never rewrite applied migrations; use a reviewed forward fix. Shared development is verified through `0015_validate_dbc_ready_checks` as of 2026-10-15. Do not seed/reset a shared database or invent a restore-branch name.

For M9A, run `corepack pnpm check:support-concurrency` with `DATABASE_URL_TEST=postgresql://postgres@127.0.0.1:55432/neffi_m2_test`. It applies migrations, checks a no-op rerun and demonstrates real lock waits for R1–R9. The database must be disposable and loopback, never Neon. Run the existing five suites as well. Local production-like browser acceptance uses `corepack pnpm build` and `corepack pnpm start` against separate synthetic loopback fixtures. Follow the approved M9A plan’s acceptance matrix; keep observed browser evidence separate from read-only SQL evidence. Never record activation codes, OTPs, cookies or tokens. No Preview, remote resources, emails or production action are part of M9A verification.
