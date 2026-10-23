# Milestone 11: Full Verification — Verification Plan

> **Implementation history — not a current specification.** Retained as written for provenance; instructions, names and verification plans below describe that implementation context. Current contracts and superseding decisions are indexed in [the documentation authority map](../../README.md#authority-map); current status is in [roadmap](../../roadmap.md). Earlier GRC lifecycle assumptions are superseded by [0006](../../decisions/0006-grc-simple-commercial-line.md).


> **Canonical path:** `docs/superpowers/plans/2026-10-15-milestone-11-full-verification.md`. It is saved uncommitted on `main`; Codex commits it as T0.
> **Status:** revised after the independent audit of 2026-10-15, which raised B1, I1–I5 and M1–M7, all applied. D1 was ruled by the user on 2026-10-15: integrated PGlite journey tests, no Playwright. Not executed.
> **Roles:** Codex is the sole implementer. Claude plans, reviews and guards scope.
> **For agentic workers:** follow §0 exactly. This is a verification milestone, so new code is **tests only**. Application code changes happen only through the §11 defect protocol, after user approval.

## Context

M11 answers one question: **does the complete Neffi system through M10 work correctly, consistently and securely, without regression, as one integrated product?** It does not decide pilot readiness; that is M12.

The repository already holds strong evidence:
- **157 Vitest files / 1,257 tests**, as reported at the M10 final gate (`t13-tests.log`). All of them run in CI on PGlite migrated from zero.
- **Six real-Postgres two-session concurrency suites**, run on loopback only and not in CI. `docs/operations.md` counts 57 scenarios. The M10 summary log shows PASS lines per suite: credential 6, provisioning 7, claim 4, profile 7, orders 7, support 27.
- **A fetch-based HTTP/header check**, `scripts/check-public-http.mts`. It isn't wired into `package.json` and doesn't run in CI.
- **Physical acceptance** for M4, M5 and M7, plus **browser acceptance** for M6, M8, M9A, M9B and M10.

What is still missing is proof of a few seams:
- Two cross-module chains that no existing test runs on real service output:
  - provisioning → sale → claim → setup → publish → public Form → Inbox;
  - support recovery → Better Auth sign-in.
- A uniform denial sweep over every page and server action.
- The `/app` and `/admin` client pages under the production CSP.
- The two M10 residuals: R8, Inbox mark-read on prefetch, and R10, Vercel edge headers.

M11 fills only those gaps. It re-runs the existing gates, carries valid evidence forward and hands the rest to M12.

### Verified baseline (2026-10-15)

**Git**
- `origin/main` is `9b8aecf` (the PR #12 merge, M10). Its tree is identical to `d34fcdb` (`git diff d34fcdb origin/main` is empty).
- **Local `main` is stale at `88b4a5f` (PR #11).** The untracked copy of `docs/superpowers/plans/2026-10-15-milestone-10-security-performance-hardening.md` in the main checkout is byte-identical to the committed file, and it blocks a fast-forward.
- Other untracked paths (`.pnpm-store/`, `public/`, `src/fonts/`) belong to other work. Never delete or add them.

**Local environment**
- The main checkout has a `.env.local` that targets shared Neon dev. The existing worktrees have none.
- `drizzle.config.ts:6` and `scripts/seed-dev.ts:12` call `process.loadEnvFile(".env.local")` when that file exists, and the seed guard accepts any non-production host. §0 rules out this risk.

**Database**
- Migrations run `0000`–`0015`, with 16 journal entries.
- The ERD (`docs/database/erd.md:7`) records: 27 tables, 16 enums, 150 constraints, 82 indexes, 11 triggers, 6 trigger functions.
- `cards_dbc_ready_checks_recorded` is validated. The PGlite test `src/db/migrations.db.test.ts` asserts it.
- Shared Neon dev (`neffi-dev`) was verified through `0015` on 2026-10-15 by M10. Its ledger file `0015-schema-verification.json` records `catalogMatchesCommittedMigrations: true`.
- The M10 restore branches `m10-pre-legacy-dbc-correction-20261015` and `m10-pre-0015-20261015` are retained. Do not touch them.

**Deployments**
- Production is unconfigured. Vercel deployments of `main` end in `ERROR` because they fail closed while `PRODUCTION_DATABASE_HOSTS` is empty. This is expected.
- Preview `dpl_4gW2jadtHwx83gNrMQ4h47oPyZvQ` is READY at `d34fcdb`, so its code equals merged main.
  - URL: `neffi-l44w2evpi-iyawnnns-projects.vercel.app`.
  - Team: `team_8dKm0VtKvoK17iHDIoP6AXqa`. Project: `prj_ZvMsro2JQSchBRiYWRXu5aHzjNRG`.
  - It is behind Vercel Authentication.

**Parked work**
- `feat/ui-design-system` is parked. Never check it out, merge, rebase or modify it.

### Source of truth
1. Implemented code, schema, migrations and tests.
2. `docs/decisions/`, `PRODUCT.md`, `docs/specs/`, `docs/architecture/`, `docs/roadmap.md`.
3. Notion (Business Hub, AI Build Handoff, Locked Plan, Steps 5–9), for product intent only.
4. Historical milestone plans.
5. Old execution notes and ledgers. These are evidence, not specification.

When Notion conflicts with the repository, the repository wins. Notion drift is recorded in §13 and never edited.

---

## 0. Execution protocol and environment safety

### Worktree and ledger
- **Worktree and branch:** create `.worktrees/m11-full-verification` on `feat/m11-full-verification`, cut from `main` after the fast-forward to `origin/main` (T0).
- **Ledger:** `.superpowers/sdd/2026-10-15-milestone-11-full-verification/progress.md`, kept local and git-ignored.
  - Never `git add -f` it, and never make a ledger-only commit.
  - Logs, browser JSON, SQL output, fingerprints and helper scripts all live in the same folder.

### Environment safety (mandatory, enforced by construction)
- **E1 — no `.env.local` in the worktree.** The M11 worktree must never contain `.env.local`; never copy it in. T0 asserts that it is absent, and every ledger helper script refuses to run when it is present.
- **E2 — CI-safe synthetic environment.** Every worktree command uses the synthetic, non-secret values from the `env:` block of `.github/workflows/ci.yml`: lint, typecheck, test, `db:check`, `db:generate`, build, `check:bundle`.
  - Store those exact values in the ledger as `ci-env.ps1` (or `ci-env.sh`) and load them into the shell before each command.
  - With them, `DATABASE_URL*` points at `ep-ci-dummy.example.invalid`, so any accidental database connection fails to resolve.
- **E3 — loopback-only real Postgres.** Commands that need a real database go only through ledger wrapper scripts. Each wrapper:
  1. deletes every inherited `DATABASE_URL*` and `PG*` variable from `process.env` before connecting;
  2. builds its connection URL from constants;
  3. throws unless the hostname is exactly `127.0.0.1`, the port is `55432`, and the database name is one of the names it is allowed to use;
  4. never calls `process.loadEnvFile`.
- **E4 — two commands are banned in M11:** `pnpm db:migrate` and `pnpm db:seed`. Both load `.env.local` through `drizzle.config.ts` or `scripts/seed-dev.ts`. Migrations run through the `drizzle-orm` migrator inside an E3 wrapper, the way `scripts/check-orders-concurrency.mts:53` does.
- **E5 — fixed loopback environments for servers.** The existing concurrency scripts (loopback-guarded, never loading `.env.local`), `check-public-http.mts`, and any local `next start` run with E2's synthetic environment. Only `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are overridden, both to the loopback database. A wrapper asserts the resolved host before it spawns anything.

### Per task
1. Expand the checklist in the ledger.
2. For new tests: write them, run them, and confirm they **pass against unchanged application code**. A failing new test is a *finding*; go to §11. Do not change the test to make it pass.
3. Run the targeted checks.
4. Update the ledger: Status, Commit, Checks, Result, Evidence class.
5. Commit with the exact message given.

### Resumption
- Read the ledger, `git log` and §6.
- The next task is the lowest-numbered one without `Status: complete`.
- If git shows a task's commit but the ledger has no entry for it, re-run that task's checks and record `complete (recovered)`.

### Next.js docs first (AGENTS.md)
Before T4 and T9, read these in `node_modules/next/dist/docs/`:
- the Server Actions security material;
- `01-app/02-guides/prefetching.md`.

### House patterns
- Database helpers: `createTestDb`, `rollback`, `expectPgError` (`src/db/testing.ts`).
- Auth helpers: `createTestAuth` (which exposes `db`), `signInWithEmail` (`src/auth/test-auth.ts`).
- Mock only external providers inside journeys: the email sender and Cloudinary.

## Global constraints

**No new code beyond tests**
- No new dependencies. No Playwright, Cypress, jsdom or testing-library. `typescript` is already a dev dependency and is the only parser used.
- No new migrations, indexes, CSP sources, MFA, Turnstile, nonce CSP, WAF/SIEM/KMS or feature work.
- No application code change without an approved §11 defect.

**No external or shared-data writes**
- No Neon, Vercel, Resend, Cloudinary, Sentry, Notion, push, PR or merge action without its stop-point approval (§9).
- No migration, seed, reset or write on shared dev or Production.

**Evidence**
- Evidence never contains any of these:
  - activation codes, OTPs or recovery codes;
  - cookies, session tokens or full Card tokens;
  - database URLs with credentials, or IPs;
  - images that show any of these.
- Synthetic fixtures are never physical evidence.
- Skipped checks are recorded as **NOT EXERCISED**. Unchanged prior evidence is recorded as **CF** (carried forward). Neither is ever recorded as a fresh pass.
- Report results by their real evidence class:

| Class | Meaning |
|---|---|
| U | unit test |
| DB | PGlite integration test |
| J | journey test (PGlite, cross-module) |
| C | real-Postgres concurrency suite |
| H | HTTP check |
| B | executor-observed headless browser |
| X | external platform observation |
| P | physical device |
| CF | carried forward from an earlier milestone |

Automated results are never called "manual acceptance".

## Review focus (risks no existing test exercises; each has an owning task)

1. **A page or server action whose guard regresses silently.** Nine admin pages and several customer action exports have no denial test today. Owned by **T4**.
2. **A client module whose runtime imports reach Zod.** Building a Zod object schema probes `Function("")`. Zod caches that probe per realm (`zod/v4/core/util.js:218`, `schemas.js:1167`), and a strict CSP reports it. Owned by **T5**, confirmed by **T9**.
3. **The provisioning → sale → claim → setup → publish → public Form → Inbox chain on real service output.** Owned by **T6**.
4. **Support recovery followed by Better Auth email-code sign-in at the new address.** It must resolve the same Account and invalidate the old session. Owned by **T7**.
5. **Inbox mark-read under real Next 16 router prefetch (M10 R8), and Vercel edge headers (M10 R10).** Owned by **T9** and **T10**.

---

## 1. Scope

### In
- Re-running every existing automated, DB, concurrency and HTTP gate.
- A loopback-only fresh-migration gate.
- Optional read-only verification of shared dev.
- An authorization sweep.
- A static guard over the client-module import graph.
- **Two** journey tests.
- Two HTTP observations: the cache boundary and Server Actions from a foreign Origin.
- A headless CSP sweep that includes a real router prefetch check.
- The single R10 Preview observation.
- Reconciling status docs.
- The verification report and the M12 handoff.

### Out
- The parked UI overhaul.
- MFA, TOTP, passkeys and step-up.
- Turnstile and nonce CSP.
- Production bootstrap and production migration.
- The verified email domain and two-inbox recovery.
- Source maps.
- Speculative indexes and performance work.
- Account deletion and merge.
- Teams and organizations.
- Ecommerce and subscriptions.
- Courier APIs.
- SEO.
- Physical or customer pilot work.
- Wiring the concurrency or HTTP suites into CI.
- A real-Postgres seed run. Seed validity is already proven by `src/db/seed.db.test.ts`.
- A new Sentry wiring test. `src/lib/sentry-scrub.test.ts` already asserts the hooks that `sentryOptions` wires, and the instrumentation entry points are one-line calls.
- Notion edits.
- Resurrecting the GRC Card lifecycle.

---

## 2. Verification matrix

"Re-run" means the existing gate is re-run in T1. "Cite" means an existing test already proves the chain; it is re-run and cited in the report, and no duplicate is written.

| Capability | Invariant to prove | Current evidence | M11 action | Pass evidence |
|---|---|---|---|---|
| Config and environment isolation | A bad environment fails closed; Preview can't reach a production host; no secret reaches the client bundle | U `env-schema`, `isolation`, `server-only-boundary`; CI `check:bundle` | Re-run | Green T1 |
| Schema and migrations | `0000`–`0015` apply from empty; journal has 16 entries; a second run is a no-op; ERD matches schema; no drift | DB `migrations`, `erd`; CI `db:check` and the `db:generate` diff | **T2** loopback migrate twice plus a version-stable fingerprint; **T3** optional | 16 rows; no-op; fingerprint equal |
| DB invariants and triggers | Token is permanent; one usable credential per Card; history is immutable; Ready requires the physical checks | DB `cards`, `credentials`, `integrity-guards`, `*-guards` | Re-run; T2 verifies `convalidated` on real Postgres | Green |
| Seed | Synthetic, deterministic, no Ready DBC | DB `seed.db` (7) | Re-run (no real-Postgres seed run) | Green T1 |
| Better Auth and email OTP | Code is hashed, single-use, valid 5 min, 3 attempts; caps apply; no enumeration | DB `email-otp`, `routes`, `sessions`; CF M3/M5 | Re-run | Green T1 |
| Google auth | No silent linking; identity is stable; no tokens stored | DB `google` (stubbed provider); CF M3/M5 | Re-run. Real OAuth on the final origin is M12 | Green T1 |
| Sessions | Database-backed; sign-out and expiry revoke; cookies HttpOnly, Lax, Secure | DB `sessions`, `account-controls` | Re-run; **T7** covers revocation through recovery | Green |
| Route and action authorization | Signed-out → sign-in; customer → 404/403 on admin; no implicit OWNER access to customer data | U `access`, `policy`; per-file tests (partial) | **T4** sweep | Green |
| Object ownership (IDOR) | Another Account's ids → not_found | DB `manage`, `lifecycle`, `scenes`, `blocks`, `forms`, `inbox`, `media-actions` | Cite; **T6** adds one representative Inbox check | Green |
| DBC provisioning | Token issued once; code shown once and stored as HMAC only; NFC check is an exact match; package match → Ready | DB `dbc`; C provisioning; P M4 (CF) | **T6** feeds real provisioning output into the sale | J green |
| Activation and claim | Generic failures; single winner; atomic; idempotent for the owner | DB `claim` (13); C claim, credential; `fulfillment.db:94`; P M5 (CF) | Cite; **T6** gift and bulk claims on real released Cards | J green |
| Profiles, Scenes and publish | Publish requires a Default Scene; fallback works; ordering is dense; URLs are safe | DB `profiles`, `scenes`, `blocks`, `lifecycle`; U `safe-url` | **T6** covers starter setup → publish; other behaviour cited | J green |
| Card → Profile routing and `/c` | Card state is fresh; shown Scene / Default fallback; disable, unpublish and reconnect take effect; unavailable states don't leak | DB `resolve.db:34,82,93,101,115,125,136`, `view`; U `proxy`, `request`; H; P M7 (CF) | Cite; **T6** resolves the published Card | J and H green |
| Sharing QR and vCard | Exact Card URL; escaping; no-store and noindex | U `qr`, `vcard`; route `contact`; P M6/M7 (CF) | Re-run | Green T1 |
| Forms, Inbox and notifications | Submission persisted first; deduplicated; capped; Inbox scoped to the owner | DB `submissions`, `inbox`, `notify`; forms route | **T6** public submit → Inbox; **T9** real prefetch | J green; unread after prefetch |
| Cloudinary media | Signed, profile-scoped ids; raster formats only; caps | U `cloudinary`; A `media-actions`; CF M6 | **T9** (CSP with dummy credentials) | 0 violations |
| Orders and completion | Price snapshot; completion derived; GRC is a commercial line only | DB orders; U `totals`; C orders | **T6** mixed DBC + GRC order, partial then final payment, through the public services | J green |
| Cancellation boundary | Returns Reserved Cards; preserves money; refused after release | DB `cancel.db:15,45`; C orders | Cite | Green T1 |
| Payments, refunds and voids | Append-only; capped; voids require a reason | DB `record`, `money`; C orders, support R1–R3 | Cite | Green T1 |
| Shipments | Status changes after completion without reopening the Order | DB `fulfillment`, support `shipments` | Cite | Green T1 |
| Inventory and expenses | Counts are derived; each cost counted once | DB `stock-*`, `queries`, `expenses` | **T6** reads back after the chain | J green |
| Purchaser ≠ Account | Never auto-linked | DB `directory`, `purchasers` | **T6** (gift and bulk) | J green |
| Dashboard, search and Activity | Values derived by Postgres; search escaped; events immutable | DB `dashboard`, `search`, `record` | **T6** reads back | J green |
| Support corrections (M9A) | Retire; free replacement is not a sale; paid replacement is a new Order; reissue; reset keeps the URL | DB `support/cards.db:37,66,138`, `money`, `shipments`; C R4–R12; CF M9A T16 | Cite | Green T1 |
| Public `/support` | Unverified contact never links; deduplicated; capped; code-shaped text blocked | DB `intake`, `email`, `replies`; C R17, R20; CF M9B | Cite | Green T1 |
| Recovery and Secure Account | Owner verification; 3 wrong codes cancel; pending recovery blocks resolution; Account preserved | DB `recovery.db:57,90,100,117`, `replies.db:11`; C R13–R16 | Cite; **T7** recovery → Better Auth sign-in | J green |
| Quotas and rate limits | Keys on IPv6 /64; daily caps; cleanup uses SKIP LOCKED outside the transaction | U `client-ip`; DB `otp-quota`, forms route, `intake`; C R17, R20 | Re-run | Green |
| CSP, nosniff and cache boundary | Production policy has no eval and no wildcards; headers present on every route class; private pages are not shared-cacheable | U `security-headers`; H; B M10 T12 (`/c`, `/support`) | **T5** static guard; **T8** cache headers; **T9** sweep; **T10** Vercel edge | Green / observed |
| CSRF and Origin | Trusted origins; forms check Origin; Server Actions reject a foreign Origin | DB `routes`; forms route; H forms 403 | **T8** foreign-Origin action POST | Rejected |
| Sentry sanitization | No SQL parameters, cookies, body or PII; hooks wired | U `sentry-scrub` (17, includes `sentryOptions` wiring) | Re-run; the one-line instrumentation calls (`instrumentation.ts:6`, `instrumentation-client.ts:4`) are recorded from a code read | Green T1 |
| Concurrency and lock order | Single winners; no deadlock; no lost update | C, 6 suites (§4) | Re-run | Per-suite counts equal M10 |

## 3. Carried-forward evidence register

These code paths are **unchanged since `01af098` (M7)**: `src/proxy.ts`, `src/app/(public)/c/**`, `src/modules/cards/{resolve,request,qr}.ts` and `src/modules/profiles/**`. There have been no dependency changes since M7.

| Evidence | What it proved | Later changes that touch it | Still valid? | M11 re-test |
|---|---|---|---|---|
| M3 live auth (local, `neffi-dev`) | Real Resend OTP; real Google sign-in and Connect; `/admin` denial; sign-out | OTP caps, security-notice hooks, /64 quota keys (all DB-tested) | Yes for the flows. Real OAuth on a deployed origin was never proven | None. Real OAuth is M12 |
| M4 physical (2026-10-12, iPhone 15 Pro Max) | Exact NFC URL write, read and tap; tag writable; package match → Ready; credential replacement | Lock and product helpers; `0015` (one legacy fixture only) | Yes. The tags encode a Tailscale engineering origin | None. The final origin is M12 |
| M5 packaged card (iPhone) | Common QR → `/activate` → code → OTP → explicit claim; atomic; replay-safe; nothing stored client-side | Help link; quota keys; auth hooks; CSP; M8 UI release added (the physical test released via SQL) | Yes for the claim. The release → claim seam is proven by `fulfillment.db:94` | **T6** (J); **T9** (`/activate` and `/sign-in` under CSP) |
| M6 browser (390×844) | Resend notification; real Cloudinary upload, replace and delete; Sharing QR decodes; isolation | CSP added (Cloudinary origins coupled by test) | Flows yes. Editors never observed under CSP | **T5**, **T9** |
| M7 physical (iPhone + Galaxy S25) | Published, Disabled and Draft taps; NFC and QR use the same URL; Save Contact; form submit; CDN matrix | Global CSP and nosniff; form caps | Yes. Resolver, Proxy and caching unchanged; `/c` form passed under CSP in M10 T12 | **T10** edge headers only |
| M8 local S1–S10 + isolated Preview | Owner operations without DB intervention | M9A, M10 caps | Yes. S11 (phone) and T20 (real-card chain) were never run | **T6** covers the chain in software; the phone check is M12 |
| M9A T16 (9/9) | Support corrections end to end (local) | M9B intake; M10 caps and cleanup | Yes | None. Cite support DB tests and C R1–R12 |
| M9B reduced (A1, A4 on Preview) | Signed-out support submit; owner reply and resolve | M10 caps; cleanup order; `f912af0` | Yes. Live A6 recovery is M12 | **T7** (J) |
| M10 T12 (headless Chrome) | No CSP violations on the `/c` form, signed-out `/support`, or dev HMR | None | Yes, for those routes only | **T9** extends coverage |
| M10 shared-dev gate (`0015-schema-verification.json`) | Live catalog matches committed migrations; journal 16; Ready check validated | None (no schema change since) | Yes | **T3** optional; CF by default |

**No physical, mobile or QR re-test in M11.** No later change touches NFC URL semantics or the resolver. The real end-to-end run on the final origin is an M12 gate.

## 4. Concurrency map (re-run only; no new scenarios)

| Business risk | Existing proof |
|---|---|
| A retired Card keeps a usable activation code | `check:db-concurrency` (credential suite: 3 isolation levels × 2 orders) |
| Duplicate or stale credentials; GRC over-reservation | `check:provisioning-concurrency` |
| Two owners for one Card; claim vs. revoke | `check:claim-concurrency`; support R7, R15 |
| Duplicate Profile; corrupt ordering; duplicate inquiry; submission to a hidden form | `check:profile-concurrency` |
| Overpayment; DBC sold twice; cancel vs. release or handover; double completion; refund over the cap | `check:orders-concurrency` |
| After-sale over-refund; void vs. correction | support R1–R3 |
| Double replacement; replacement vs. reservation | R4–R6 |
| Reset vs. connect or disable; owner changed concurrently; FK cycle | R8, R11, R12 |
| Resolve vs. correction | R9 |
| Deadlocks and lock order | R10, R18, R19 |
| Recovery races | R13–R16 |
| Intake double submit; quota consumption | R17 (plus PGlite logical bursts) |
| A locked, expired quota row blocks intake | R20 |

No real single-winner gap was found. Secure Account racing a recovery completion only deletes sessions and unlinks Google; both are idempotent, so the invariants hold.

## 5. Access matrix

| Surface | Signed-out | Customer A | Customer B on A's objects | OWNER | Proof |
|---|---|---|---|---|---|
| `/c/{token}`, published | Public view | Public view; owner bar if A owns it | Public view, no controls | Public view, no implicit owner bar | U `proxy`, `request`; H; P M7 |
| `/c`, unavailable | Generic 404 | Generic, plus "Manage" for the owner | Generic | Generic | H; DB `resolve` |
| `/activate` (check, claim) | Check is rate-limited; claim → sign-in | Claims own Card | A's Card → generic failure | Same as customer | A `activate`; DB `claim`; J T6 |
| `/support`, `/support/recover` | Allowed (quota) | Links only A's Cards | Can't link A's Cards | Allowed | DB `intake`; A recover |
| Forms POST | Origin, quota and size checks | Same | Same | Same | Forms route |
| `/app/**` pages and actions | Redirect / 401 | Own objects only | not_found | Own objects only | **T4**; DB scoping; J T6 |
| `/admin/**` pages and actions | Redirect / 401 | 404 / 403 | 404 / 403 | Allowed | **T4**; admin action loops |
| Role change | n/a | No endpoint | n/a | CLI only | DB `routes`, `set-role` |
| Sessions and recovery | n/a | Sign out everywhere | n/a | Owner-initiated recovery; owner Accounts refused | DB `account-controls`, `recovery`; J T7 |
| Post-sign-in redirect | `safeNext` | Same | Same | Same | U `policy` |

---

## 6. Canonical task sequence

| Task | Content | Commit |
|---|---|---|
| **T0** | Preflight in the main checkout. (1) `diff` the untracked M10 plan against `git show origin/main:<path>`. If identical, remove it; if different, copy it outside the repo first. (2) Fast-forward `main` to `origin/main`, then confirm `9b8aecf`. (3) Create worktree `.worktrees/m11-full-verification` on `feat/m11-full-verification`. (4) Assert `.env.local` is absent (E1). (5) Copy this plan in and commit it. (6) Create the ledger, plus `ci-env.*` (E2) and the E3 wrapper skeleton. (7) Read the Next docs (§0). Leave `.pnpm-store/`, `public/`, `src/fonts/`, the parked branch and the other worktrees untouched. | `docs(m11): full verification plan` |
| **T1** | Baseline gate on **unchanged** code (§7.1). Compare against M10: 157 files / 1,257 tests; per-suite concurrency PASS lines 6/7/4/7/7/27; HTTP check pass. Any red → §11. | none (ledger) |
| **T2** | Loopback fresh-migration gate (§7.2). | none (ledger) |
| **T3** | **Optional. STOP: needs approval.** Read-only check of shared dev (§7.3). If it isn't run, record it as CF from M10. | none |
| **T4** | Authorization sweep (§8.1). | `test(auth): sweep every page and server action for access denial` |
| **T5** | Client-module import-graph guard (§8.2). The expected RED goes through §11 before any commit. | `test(security): guard client modules against runtime Zod imports` (or bundled with the approved fix) |
| **T6** | Journey JA, provision → Inbox (§8.3). | `test(journeys): provision a card through sale, claim, publish and inbox` |
| **T7** | Journey JB, recovery → sign-in (§8.3). | `test(journeys): support recovery keeps the account for the new sign-in` |
| **T8** | HTTP observations (§7.4). | none (ledger) |
| **T9** | Headless CSP sweep plus a real prefetch check (§7.5). | none (ledger) |
| **T10** | **STOP: needs approval.** R10 Preview edge observation (§7.6). | none |
| **T11** | Final gate. Re-run all of §7.1 **only if application code changed** after T1. Otherwise run lint, typecheck, test, build and `check:bundle` only. | fixes only via §11 |
| **T12** | Docs (§12). | `docs(m11): full verification report and M12 handoff` |
| **T13** | Independent whole-branch review (§10). | fixes via §11 |
| **T14** | **STOP.** Push and PR only after explicit approval. Merge needs a separate approval. | none |

**Ordering notes**
- T1 and T2 come before any new test, so existing regressions are attributed correctly.
- T4–T7 are independent of each other.
- T8 and T9 share one loopback production build.
- T3 and T10 run whenever approval arrives, without blocking the other tasks.

## 7. Gates

### 7.1 Automated software gate (T1, T11)

Run under the E2 environment, in the worktree, with no `.env.local`:
- `pnpm lint` (0 errors), `pnpm typecheck` and `pnpm test`, all green. Exclude `.superpowers/**` and `.pnpm-store/**`.
- `pnpm db:check`, then `pnpm db:generate` followed by `git diff --exit-code drizzle`. Neither command connects to a database, and E2 makes a connection impossible anyway.
- `pnpm build`, then `pnpm check:bundle`.
- All six concurrency suites, with `DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test`. The scripts guard for loopback themselves and never load `.env.local`. Compare per-suite PASS lines with the M10 `t13-concurrency-summary.log`.
- `scripts/check-public-http.mts` against a loopback `next build && next start` on `neffi_m7_http_diagnostic`, set up per E5. Reuse the invocation recorded in the M10 ledger (the `run-local.mjs` / `prepare-http.mjs` pattern) and copy it into the M11 ledger.
- A secret scan of M11 history before T14.

### 7.2 Loopback fresh-migration gate (T2)

**Wrapper:** `m11-fresh-migrate.mjs`, a ledger-local E3 wrapper that is never committed. Its skeleton is fixed:

```js
import { existsSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

if (existsSync(".env.local")) throw new Error("refuse: .env.local present");
for (const key of Object.keys(process.env)) if (/^(DATABASE_URL|PG)/.test(key)) delete process.env[key];
const ADMIN = new URL("postgres://postgres@127.0.0.1:55432/postgres");
const TARGET = new URL("postgres://postgres@127.0.0.1:55432/neffi_m11_fresh");
for (const url of [ADMIN, TARGET]) {
  if (url.hostname !== "127.0.0.1" || url.port !== "55432") throw new Error("refuse: not loopback");
}
if (TARGET.pathname !== "/neffi_m11_fresh") throw new Error("refuse: unexpected database");
// ADMIN: DROP DATABASE IF EXISTS neffi_m11_fresh; CREATE DATABASE neffi_m11_fresh;
// TARGET: migrate(db, { migrationsFolder: "drizzle" }) twice, then the checks below; ADMIN: DROP DATABASE.
```

**Checks:**
1. **Empty database to `0015`.** After the first run, `drizzle.__drizzle_migrations` has 16 rows. Their `created_at` values equal the `when` values in `drizzle/meta/_journal.json`, in order.
2. **No-op rerun.** After the second run, the row count is still 16 and the fingerprint (step 4) is unchanged.
3. **Ready check validated.** `pg_constraint.convalidated = true` for `cards_dbc_ready_checks_recorded`.
4. **Version-stable fingerprint.** Compute it with the same SQL against this database and against a PGlite database migrated from zero by a ledger script that mirrors `src/db/testing.ts`. Record both server versions. It consists of:
   - table names in `public`;
   - for each column: table, name, `format_type`, `attnotnull`. Defaults are excluded;
   - each enum's name with its labels in order;
   - constraints with `contype IN ('p','u','f','c','x')`, as table, name, type and `pg_get_constraintdef`. Type `'n'` is excluded, because PG18+ records NOT NULL constraints there;
   - indexes, as table, name and `pg_get_indexdef` with the schema prefix removed;
   - user triggers, as table, name and function.
5. **Comparison rules.** Any difference in the sets of names is a finding (§11). A difference only in definition-text formatting is normalized and recorded. Also confirm the counts that use the same definition as `erd.md:7`: 27 tables, 16 enums, 82 indexes and 11 triggers.
6. **Cleanup.** Drop `neffi_m11_fresh`.

**Explicitly not done:** a real-Postgres seed run (see Scope "Out"), and `pnpm db:migrate` (rule E4).

### 7.3 Shared-dev read-only check (T3; optional; STOP, needs approval)
- **Default:** carry forward the M10 gate (`0015-schema-verification.json`, run the same day against an identical tree). Record it as **CF (M10)**.
- **If the user asks for a fresh check:** read-only access to `neffi-dev` (`icy-waterfall-99201276`, branch `br-empty-brook-az2mixh7`).
  - Wrap everything in `BEGIN TRANSACTION READ ONLY; … ROLLBACK;`.
  - Queries: the journal count and `created_at` values, `convalidated`, the §7.2 fingerprint, and `SELECT count(*) FROM cards WHERE kind='dbc' AND state='ready' AND (nfc_verified_at IS NULL OR package_matched_at IS NULL)`, which must return 0.
  - Expect the fingerprint to equal T2's for version-stable facts.
  - Never write, migrate, seed or touch the restore branches.
- **If it isn't run:** record **NOT EXERCISED (CF M10)**. Never record it as a failure.

### 7.4 HTTP observations (T8, loopback production build per E5)
1. **Cache boundary.** Make signed-in GETs of `/app`, `/app/inbox`, `/admin` and `/admin/orders`. `Cache-Control` must not be shared-cacheable: no `public` and no `s-maxage`. Record the exact header values.
2. **Foreign-Origin Server Action.** Take a real action ID from a rendered page, such as the `/support` form, and POST it with `Origin: https://evil.example`. Next must reject it with no side effect: no new support case row. The same POST with the correct Origin is the positive control.
3. **Forms POST.** Confirm the §7.1 HTTP check still asserts 403 for a foreign-Origin forms POST.

**Prefetch is not simulated over raw HTTP.** It is observed in T9 with the real Next 16 router.

### 7.5 Headless CSP sweep and real prefetch (T9)

**Method** (the same as M10 T12):
- Local headless Chrome driven over native CDP; no new dependency.
- A loopback `next build && next start`, set up per E5, with synthetic fixtures.
- CDP request interception allows only loopback and `data:` requests.
- `RESEND_API_KEY` and the Cloudinary credentials are E2 dummy values, so nothing external can happen. CSP is enforced before interception, so any violation is still observed.
- Sign-in uses intercepted email codes, which never appear in evidence. The owner role is set with `accounts:set-role`, run under E5 against loopback only.

**Pass condition:** zero `securitypolicyviolation` events, zero CSP audit issues and zero console errors on each page and interaction.

**Pages and interactions** (one visit per route class):

| Route | Interaction |
|---|---|
| `/sign-in` | Request a code |
| `/activate` | Enter an invalid code, then a synthetic valid code from `dev:activation-fixture` (E5); claim |
| `/app` | Home |
| `/app/setup/<card>` | Create a Profile from a starter |
| `/app/profiles/<id>` and its appearance page | Open the image picker, choose a local PNG, and let the upload attempt run |
| `/app/profiles/<id>/scenes/<scene>` | Add and save a Link block, move it, save the form editor |
| `/app/cards/<id>` | Confirm the QR shows; disable, then re-enable |
| `/app/inbox` | Open a message |
| `/app/account` | Visit |
| `/admin` and `/admin/search?q=…` | Visit; run a search |
| `/admin/inventory/cards/<id>` | Provision a card; show the reveal panel |
| `/admin/orders/new` and `/admin/orders/<id>` | Create an order; record a payment |
| `/admin/support/<id>` | Add a note |
| Published `/c/<token>` | Visit as the owner (owner bar) |

Run the sweep on both origins: the app origin and `CARD_URL_ORIGIN`.

**Real router prefetch (M10 R8).** Run this before the `/app/inbox` message-open step above:
1. Seed one unread submission for Account A on loopback.
2. Load `/app/inbox` signed in as A, with that message's `<Link>` in the viewport. Record every network request over CDP, including its `rsc`, `next-router-prefetch` and `next-router-segment-prefetch` headers. Wait for the network to go idle, at least 5 s.
3. Hover the link (a pointer move only) and wait for idle again.
4. Read `form_submissions.read_at` on loopback. It **must be NULL**. Record whether any prefetch request for `/app/inbox/<id>` occurred; it is valid either way.
5. **Positive control:** click the link. After render, `read_at` must be set.

A non-NULL `read_at` after step 4 is a §11 finding.

This is **executor-observed browser evidence (B)**, not user acceptance.

### 7.6 R10 Vercel Preview edge observation (T10; STOP, needs approval)
- **Target:** the existing READY Preview `neffi-l44w2evpi-iyawnnns-projects.vercel.app` (`d34fcdb`, code identical to `9b8aecf`). No push, no deployment, and no environment, project or protection change.
- **Access:** create a temporary share link with `get_access_to_vercel_url` (it expires within 23 h). The session that has Vercel MCP access does this. Then make GET-only `curl -sD -` requests with the share cookie.
- **Requests:**
  - `/`
  - `/sign-in`
  - `/api/health`
  - `/c/<random 26-character unknown token>` as a document request
  - the same `/c` path as an RSC request (`rsc: 1` plus the router state tree)
- **Expected CSP:** compute it from `src/config/security-headers.ts` for the production phase, using the Preview's actual Sentry configuration:
  - with Vercel approval, list Preview environment variable *names* only and check whether `NEXT_PUBLIC_SENTRY_DSN` is present;
  - if it is, `connect-src` must contain exactly one extra origin, and that origin must be a Sentry ingest origin;
  - every other directive must equal the unit-tested production policy.
- **Record for each response:** status, CSP, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (observed only), `Cache-Control` and `X-Robots-Tag`.
- **Pass:**
  - CSP and nosniff are present on all five responses;
  - both unavailable responses return 404 with noindex;
  - HSTS is recorded as observed.
- **Rules:**
  - The unknown-token lookup is a single read on shared dev.
  - Never change application code because of Vercel edge headers.
  - A CSP missing from an edge-handled response is a §11 finding.
- **If access is unavailable:** record **NOT EXERCISED (access)** and hand it to M12. Ignore Vercel Toolbar violations (M10 R12).

## 8. New tests (tests only; each must pass on unchanged code unless §11 applies)

### 8.1 Authorization sweep — `src/app/access-sweep.test.ts` (T4)

**What it relies on:**
- The current guards in `src/auth/access.ts:17–35`. `requireAccount`, `requireOwner` and `authorize` all call the module-internal `getViewer`, which is `cache`-wrapped and calls `auth.api.getSession` with `next/headers`.
- Page guards are the first statement of each page, for example `admin/orders/page.tsx:13`, `admin/customers/page.tsx:10` and `app/inbox/[submissionId]/page.tsx:13`.
- Admin and customer layouts guard too.
- So **`@/auth/access` stays real**, and the session boundary underneath it is mocked, following `src/auth/access.test.ts:3–15`.

**Mocks:**

| Module | Mock |
|---|---|
| `@/auth/server` | `{ auth: { api: { getSession } } }`. `getSession` returns per-case fixtures: `null`, a verified customer, or a verified owner, shaped as in `access.test.ts:19` |
| `next/headers` | `headers()` returns `new Headers()`; `cookies()` returns a minimal empty store |
| `react` | **Partial mock:** `{ ...actual, cache: fn => fn }`, so pages keep `Suspense` and the rest of React, and no memoized viewer leaks between cases |
| `next/navigation` | `redirect` and `notFound` throw tagged errors (`REDIRECT <url>`, `NOT_FOUND`) |
| `next/server` | `connection` is a no-op |
| `next/cache` | Revalidation functions are no-ops |
| `@/db` | `{ db: proxy }`. The proxy records **any** property access or call into a `touched` log, then throws |
| `@/config/env` | `{ env: parseServerEnv(<the ci.yml synthetic values>) }`. This uses the real schema with the CI values, so modules that read config at import time load without secrets |
| `@/integrations/email/sender`, `@/integrations/media/cloudinary` | Recording functions that must never be called |

**Discovery:** `import.meta.glob` over:
- the 16 `src/app/**/actions.ts` files, which are every `"use server"` module under `src/app`;
- every `page.tsx` and `layout.tsx` under `src/app/admin/**` and `src/app/(customer)/app/**`.

**Actions.** For every export of each module, call it with `(undefined, new FormData())`, which matches the `useActionState` shape the actions use, or with `(new FormData())` where its arity is 1. Expected results:

| Case | Expected result |
|---|---|
| Signed-out, any guarded export | Throws `REDIRECT /sign-in?next=…` or returns a non-success value (an error or denial) |
| Customer on `admin/**` | Returns or throws a denial |
| Every case | The `touched` log is empty, and the provider mocks were never called |

**Public allow-list.** Each entry carries a one-line reason. These are the only public entries:
- `(public)/support/actions.ts`: anonymous intake, quota-guarded;
- `(public)/support/recover/actions.ts`: proof-guarded and quota-guarded;
- the non-claim exports of `(public)/activate/actions.ts`, with names verified at execution: code check (IP quota), start over, switch account.

`src/auth/actions.ts` is outside the glob; it only touches the caller's own session. **Any new export in a guarded file fails the sweep until it is classified.**

**Pages and layouts.** Invoke the default export with `params: Promise.resolve({ <each dynamic key>: "00000000-0000-4000-8000-000000000001", token: "<26 Crockford characters>" })` and `searchParams: Promise.resolve({})`. Expected results:

| Route | Signed-out | Customer |
|---|---|---|
| `admin/**` | `REDIRECT /sign-in?next=/admin` | `NOT_FOUND` |
| `/app/**` | `REDIRECT /sign-in?next=/app`, or `NOT_FOUND` if a parameter check comes before the guard | Not swept (positive paths are already covered) |

In every case `touched` must be empty. A page that can't be invoked generically gets an explicit case in the same file; never skip it silently.

**Expected:** green. A red is a guard defect; go to §11.

### 8.2 Client-module import-graph guard — `src/app/client-import-graph.test.ts` (T5)

**Why a static check.** A runtime `Function` stub can't attribute probes to individual modules:
- Zod's `allowsEval` is `cached()` once per realm (`zod/v4/core/util.js:218`) and read when an object schema is constructed (`schemas.js:1167`).
- Zod is an externalized dependency, so `vi.resetModules` does not reset it.
- `vi.mock` is hoisted with static paths and can't be applied to globbed modules.

The existing single-module runtime test `src/app/(public)/support/support-form.csp.test.tsx` is **kept unchanged**. Vitest isolates each file, which is why it works.

**Design.** Use only TypeScript's parser (`typescript` is already a dev dependency):
1. **Roots:** every file under `src` whose first statement is `"use client"`. There are 19 today.
2. **Edges:** walk runtime imports breadth-first with `ts.createSourceFile`:
   - include `import` declarations, unless the clause is `import type` or every named specifier is type-only and there is no default or namespace binding;
   - include side-effect imports, `export … from` that is not type-only, and dynamic `import()`;
   - resolve `@/` to `src/`, plus relative paths with the extensions `.ts`, `.tsx`, `/index.ts` and `/index.tsx`.
3. **Leaves:** bare specifiers are recorded and not followed. Files whose first statement is `"use server"` are leaves, because the client only receives action references.
4. **Assertion:** no bare `zod` or `zod/*` specifier is reachable from any root.
5. **Failure message:** names the root and the full chain, for example `image-upload.tsx → modules/profiles/rules.ts → zod`.

**Precision safeguard.** The bundler drops a value import that is used only in types, so the static check is conservative. Before any RED chain is treated as defect M11-D1, confirm it in one of two ways:
- the route's production client chunk contains Zod (inspect it the way the M10 `support-csp-investigation.md` did); or
- T9 observes the eval violation on that route.

An unconfirmed chain is recorded as a test-precision finding and needs the user's decision. It is never allow-listed silently.

**Expected RED (candidate M11-D1, minor).** Three chains, all confirmed by reading the code:
- `app/profiles/[profileId]/image-upload.tsx` → `@/modules/profiles/rules` (Zod import at line 1; `z.object` at line 31; `ACCENTS` used at runtime);
- `scenes/[sceneId]/block-forms.tsx` → `@/modules/profiles/block-content` → `./rules` (`LINK_KINDS` used at runtime);
- `scenes/[sceneId]/form-editor.tsx` → `@/modules/forms/config` (`z.strictObject` at line 15; `FORM_FIELDS` used at runtime).

**Flow:**
1. Do not commit a red test. Record it in the ledger and STOP (§11).
2. If the user approves the fix, commit the fix and this test together (§11). The likely fix mirrors `f912af0`: data-only modules, compatible re-exports, client imports only the data.
3. If the user declines, it becomes an accepted residual. Commit the test with an explicit, commented exception list containing exactly those three edges.

### 8.3 Journeys — `src/journeys/*.db.test.ts` (T6, T7)

**Scope rule.** A journey covers only a seam that **no existing test chains on real service output**. Everything else is cited, not rewritten. These chains are already proven and are cited in the report:

| Chain | Proof |
|---|---|
| Release → claim | `orders/fulfillment.db.test.ts:94` |
| Cancellation boundary | `orders/cancel.db.test.ts:15,45` |
| Invalid, used, revoked and idempotent codes | `activation/claim.db.test.ts` |
| Shown Scene, disable, unpublish, scene switch, two Cards, reconnect, hidden form | `cards/resolve.db.test.ts:34,82,93,101,115,125,136` |
| After-sale retire, replacement, reissue and wrong-account reset | `support/cards.db.test.ts:37,66,138` |
| Money corrections, shipments and replies | `support/money`, `shipments`, `replies` DB tests |
| Pending recovery blocks resolution | `support/replies.db.test.ts:11` |
| Recovery wrong attempts, rechecks and Secure Account | `accounts/recovery.db.test.ts:57,90,100,117` |
| Signed-in intake links only own Cards | `support/intake.db.test.ts` |

These are also covered by the concurrency suites and by the M9A T16 carried-forward evidence.

**Rules for both journeys:**
- One `createTestDb()` per file, or `createTestAuth().db` for JB.
- Ordered steps share state. Do not roll back between steps.
- Base actors may be inserted the way existing DB tests insert them: the OWNER and customer Accounts, the active products, and JB's pre-owned Card and Profile.
- **Every state transition under test goes through the public domain services.** Do not call internal helpers such as `settleOrderCompletion`. Completion must result from the payment and hand-over services (`order.ts:61` settles it internally).
- Mock only the email sender and Cloudinary. Raw codes stay in memory and are never printed.

**JA, T6 — `provision-to-inbox.db.test.ts`.** One ordered chain:

1. **Stock and provisioning.**
   - `receiveStock`: 2 DBC with a purchase cost.
   - For each Card: `provisionDbc` (keep its raw code in memory), then `recordNfcCheck` with the exact Card URL, then `matchPackage`.
   - Both Cards are now Ready.
2. **Mixed order and payment.**
   - `createOrder` for a new Purchaser P with no Account: 2 DBC lines plus 1 GRC line with an `https` review URL.
   - Set pickup with `updateOrderDetails` if the Order's defaults require it.
   - `reserveDbcCards` for both Cards.
   - Record a **partial** payment with `recordPayment`.
   - `handOverOrder`. The Order must still be **In Progress**, because a balance remains.
   - Record the **remaining** payment with `recordPayment`. Read the Order back with `getOrderDetail` / `loadOrderFacts`: it must be **Completed**.
   - The GRC line has no Card rows.
3. **Claims.**
   - `checkActivationCode` and `claimCard`: Account A claims Card 1 (a gift), and Account C claims Card 2 (bulk).
   - Purchaser P is linked to neither Account.
4. **Setup, publish and public resolve.**
   - `createProfileFromStarter` for A on Card 1 with the `get_clients` purpose, whose starter includes the `project_inquiry` Form.
   - `publishProfile`.
   - `resolvePublicExperience(token1)` must be available, show the Default Scene, and contain the Form block.
5. **Public Form submission.**
   - `submitForm` (the public service) with valid answers.
   - `listInbox` for A shows the message, unread.
   - `openSubmission` by C for that message returns `not_found`.
6. **Owner read-back.**
   - `dashboard()`: In Progress = 0, outstanding = 0, stock shows 2 Released and 0 Ready.
   - `expenseReport` counts the stock cost exactly once.
   - `search()` finds the order number and Card 1's token.
   - Activity for the chain contains the provisioning, payment, release or handover, and claim events. Read the exact type names from the activity enum at execution time.

**JB, T7 — `recovery-to-sign-in.db.test.ts`.** One ordered chain on `createTestAuth()` and its `db`:

1. **Old sign-in.** A signs in with `signInWithEmail` at the old address, which gives session S1. A owns a released, claimed Card and a published Profile, inserted as pre-state.
2. **Recovery.**
   - The OWNER opens an account-recovery case linked to A.
   - `initiateRecovery` to an unused address. Take the code from the sender-mock text, as `recovery.db.test.ts:25` does.
   - `completeRecovery` must return `ok`.
3. **Assertions.**
   - S1 is rejected: `auth.api.getSession` with S1's cookie returns `null`.
   - `signInWithEmail` at the **new** address returns a session whose user id **equals A's id**, and no new Account row is created.
   - The Card's owner is still A, the Profile is still A's, and `resolveCard(token)` is still available.

**Final journey count: two files, JA and JB, each one ordered chain.**

---

## 9. Stop points (explicit user approval required)

1. T3: any shared-dev access, even read-only.
2. T10: the Vercel share link, the env-name listing and the GETs.
3. Any §11 application-code fix.
4. T14: push and PR. Merge is approved separately.
5. Any other Neon, Vercel, Resend, Cloudinary, Sentry, Notion or Production action, or any provider mutation.
6. Any scope change, new dependency, migration, CSP widening, or touch of the parked branch.
7. Any contradiction between this plan and the code. Log it as **Blocked** and ask.

## 10. Independent whole-branch review (T13) must confirm

- **Diff contents:** only `src/app/access-sweep.test.ts`, `src/app/client-import-graph.test.ts`, `src/journeys/*.db.test.ts` and docs, plus approved §11 fixes with their RED evidence.
- **Nothing new beyond that:** no dependency, migration, index or CSP source.
- **Test integrity:** no mocks of Neffi domain modules inside journeys; no skipped or `.todo` tests; no weakened existing assertions.
- **Allow-lists and exception lists** are minimal, and each entry carries a reason.
- **Environment safety:** no `.env.local` in the worktree; nothing ran `db:migrate` or `db:seed`; the E3 wrappers are recorded in the ledger.
- **Evidence hygiene:** no secrets or codes in fixtures, the ledger or docs. Evidence classes are honest, and nothing is called manual acceptance.
- **Untouched:** Production and the parked branch.

## 11. Defect protocol

For each finding:

1. **Classify severity.**

   | Severity | Covers |
   |---|---|
   | Blocker | Authorization or privacy leak, double ownership, secret leak, data integrity |
   | Important | A broken core flow, or a wrong derived money or state value |
   | Minor | Non-functional issues, such as a caught CSP probe or doc drift |
   | Accepted residual | Anything the user explicitly agrees to accept |

2. Reproduce it, and record the minimal reproduction in the ledger.
3. Name the prior evidence it invalidates (§3).
4. Capture RED evidence: a failing test kept **uncommitted**, or an HTTP or browser capture.
5. Propose the smallest correction, then **STOP for approval**.
6. After approval, commit the fix together with its test: `fix(<area>): <defect>`.
7. Re-run only the affected checks and their regression neighbours. T11 runs the full §7.1 gate again. Re-run a concurrency suite only if the fix touches its locked paths.
8. Restart broader M11 work only if the defect invalidates a broad assumption.
9. Never fix unrelated issues opportunistically. Log them as residuals.

**Pre-identified candidate: M11-D1 (minor).** Three editor client modules reach Zod at runtime (§8.2). The likely fix mirrors `f912af0`. Behaviour, validation and schemas would not change. It still needs approval after RED and confirmation.

## 12. Documentation and deliverables (T12)

**Durable, in Git:**
1. This plan, committed at T0.
2. **`docs/verification/2026-10-m11-full-verification.md`.** One report containing:
   - the final verification matrix, with results and evidence classes, and the citations from §8.3;
   - the carried-forward register;
   - the access matrix;
   - the concurrency map;
   - the defect and residual register (severity, status, owner, trigger);
   - the M12 handoff (§13).
3. **Status reconciliation, limited to stale lines:**
   - `docs/roadmap.md`: the M10 row becomes merged (PR #12), and the M11 row shows the result.
   - `PRODUCT.md`: the header becomes "through Milestone 10", and "PR #12 awaits merge approval" is dropped.
   - `docs/README.md`: "Current" becomes M1–M10 merged and shared dev through `0015`, plus an authority-map row for `docs/verification/`.
   - `docs/operations.md`: the R8 and R10 outcomes, a note that `check-public-http.mts` is a manual loopback gate, and the E1–E4 environment-safety rules for local verification.

**Local only (the ledger folder, never committed):** the ledger, logs, browser JSON, SQL output, fingerprints, `ci-env.*` and the wrapper scripts.

**Never anywhere:** codes, OTPs, cookies, tokens, credentialed URLs, inbox contents or IP addresses.

## 13. M12 handoff (exact; passing M11 does not mean pilot-ready)

**Domain and Production**
- Lock the final public domain and `CARD_URL_ORIGIN`, with registrar hardening: auto-renew, lock, MFA, DNSSEC, recovery email.
- Create the Production Neon project and set `PRODUCTION_DATABASE_HOSTS`. Keep secrets separated. Apply `0000`–`0015` on Production, and rehearse restore and rollback.

**Real end-to-end on the final origin**
- Provision cards on the final origin, then run **one real end-to-end**: provision → NFC → package → UI Order release → `/activate` → setup → publish → NFC tap and Sharing QR.
- Use at least one iPhone and one Android. This also closes M8 T20 and S11.
- Real Google OAuth on a production-like origin with its callback registered, plus a real email OTP.

**Email, headers and monitoring**
- Verified Resend domain (SPF, DKIM, DMARC).
- Two-independent-inbox recovery (M9B A6), plus email-change and security-notice delivery.
- HSTS once the domain's HTTPS is ready. Observe CSP and nosniff on the production domain.
- Sentry DSN, test errors that prove scrubbing, and source-map upload (M10 R9).
- Check the Cloudinary production restrictions.

**Usability**
- Real-phone acceptance of mobile activation and setup.

**Decisions to re-confirm**
- MFA and step-up remain deferred (R1).
- Turnstile remains deferred (R3).

**Notion reconciliation (manual, outside M11)**
- Step 7 checklist: "OWNER MFA/step-up enabled".
- Locked Plan, Step 7: "should add TOTP MFA/step-up … before commercial launch".
- Step 8 M10 "Must deliver": Turnstile and migration rehearsal.
- Step 9 records for M9A, M9B and M10 still say "not started".

**Accepted residuals carried forward**
- M10 R2 and R4–R8: non-UUID 500s, the Inbox `mailto:` link, unsigned Cloudinary overwrite, the owner-note detector, and the quota cleanup index.
- The legacy optional GRC Inventory utility. Order completion doesn't depend on it.
- M11-D1, if it is declined.

## 14. Definition of Done

- [ ] Every capability in §2 has evidence recorded with its class; nothing is unaccounted for.
- [ ] The §7.1 gate is green. T1 matches M10: 157 / 1,257 tests (plus the new M11 tests at T11), the same per-suite concurrency PASS counts, and an HTTP check pass.
- [ ] §7.2: an empty loopback database reaches `0015` with 16 rows, the second run is a no-op, and the version-stable fingerprint equals PGlite's. No `.env.local`, `db:migrate` or `db:seed` was involved.
- [ ] §7.3 is recorded as CF (M10) or as a matching read-only fingerprint.
- [ ] The T4 sweep is green. JA and JB are green. T5 is green after the approved D1 fix, or D1 is an accepted residual with its exact exception list.
- [ ] §7.4 passes: private pages are not shared-cacheable, and the foreign-Origin action is rejected.
- [ ] §7.5 passes: zero CSP violations (or each one handled under §11), and the message stays unread after a real prefetch while the click sets `read_at`.
- [ ] §7.6 is observed, or recorded as NOT EXERCISED with a reason and handed to M12.
- [ ] Physical and manual evidence is reconciled per §3. No physical re-test is required.
- [ ] No unresolved blocker or important defect. Accepted residuals are explicit and agreed by the user.
- [ ] The report and status docs are committed, and the independent review approved them.
- [ ] Untouched: Production, shared-dev data, the restore branches and `feat/ui-design-system`.
- [ ] The M12 handoff (§13) is in the report.

## 15. Planning self-review (post-audit)

**Audit findings**
- **B1 (canonical file missing):** resolved. This file is saved at the canonical path, uncommitted.
- **I1 (eval guard can't attribute probes):** resolved. The runtime `Function`-probe sweep is replaced by the static import-graph guard (§8.2). It attributes each chain to its root, treats `"use server"` files as leaves, needs build or browser confirmation before RED counts as a defect, and keeps the existing `/support` runtime test.
- **I2 (sweep mocked the wrong layer):** resolved. `@/auth/access` stays real. The sweep mocks `@/auth/server`, `next/headers`, a partial `react` `cache`, `@/db` (a recording proxy) and `@/config/env` (parsed from the CI values), following `access.test.ts`.
- **I3 (real-Postgres steps could reach shared dev):** resolved. Rules E1–E5 apply: no `.env.local`, CI synthetic environment, loopback-only wrapper with variables cleared and a host assertion, a ban on `db:migrate` and `db:seed`, and no real-Postgres seed run. The migration proof still covers empty → `0015` plus a no-op rerun.
- **I4 (prefetch was simulated with guessed headers):** resolved. Prefetch is now observed with the real Next 16 router in headless Chrome, with the click as positive control.
- **I5 (journeys duplicated existing chains):** resolved. There are two journeys (JA, JB) covering only unproven seams, and the existing chains are cited.
- **M1–M7:** applied.
  - Baseline counts corrected.
  - Fingerprint limited to version-stable facts.
  - T3 optional, carried forward by default.
  - Sentry wiring test removed.
  - Preview CSP computed from the Preview's configuration.
  - Worktree uses the CI environment.
  - No direct `settleOrderCompletion` calls.

**Overall checks**
- **Duplication:** none planned. Gates are re-run, existing chains are cited, and there are no new concurrency scenarios.
- **Feature creep:** none. Only tests and docs change, and the one candidate fix is gated.
- **M12 leakage:** none. Production, the domain, real OAuth, real email, real NFC and HSTS policy all sit in §13.
- **Manual acceptance:** zero user-performed checks.
- **Safety:** Production can't be reached. Shared dev is only touched read-only, optionally, behind a stop. The parked branch is untouched.
