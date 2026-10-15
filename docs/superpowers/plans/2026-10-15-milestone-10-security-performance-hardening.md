# Milestone 10: Security & Performance Hardening — Implementation Plan

> **Canonical path:** `docs/superpowers/plans/2026-10-15-milestone-10-security-performance-hardening.md`. It is saved uncommitted and survives the T0 checkout of `main`; Codex commits it as T0.
> **Status:** planning complete; D1 and D2 ruled by the user on 2026-10-15. User corrections applied: T12 is minimal and browser-only; dev HMR/WebSocket is verified under the CSP; hex IPv4-mapped coverage is added. The independent Opus audit's findings I1–I3 and M1–M9 are applied. Not implemented. Codex is the sole implementer.

## Context

M10 is the smallest hardening pass before M11 Full Verification. The repository was audited for weaknesses that exist today:
- browser headers;
- abuse limits;
- query paths;
- authorization.

Only findings with a concrete flow, a practical risk and a small fix are in scope. Everything else is recorded as "no change required" or as a deferred residual with its trigger.

**Product decision (locked by the user): no OWNER MFA, TOTP, passkeys or step-up in M10.** The admin side is run by 2–3 trusted people. The audit found no requirement that forces MFA. The existing authorization controls are correct (§1.4), and recovery is owner-initiated with proof of a new inbox. MFA and step-up are recorded as deferred (§10).

**Baseline (verified 2026-10-15).**
- `origin/main` = `88b4a5f` "Merge pull request #11", so **M9B is merged**.
- Local `main` is 21 commits behind (it sits at `d85d511`, PR #10).
- The working tree is on the merged `feat/m9a-support-corrections` branch, with untracked `.pnpm-store/`, `public/`, `src/fonts/` and an older copy of the M9B plan. The M9B plan is already committed on `origin/main`, so that untracked copy blocks a fast-forward until it is moved aside.
- This audit read a `git archive origin/main` snapshot.
- Migrations run through `0014_support_intake_recovery`. The shared Neon dev database is at `0014`, and Production is unconfigured.
- M9B gate: 1,227 tests and 56 loopback concurrency scenarios.

**Source precedence:**
1. Code, schema and tests.
2. Specs, ADRs and docs.
3. Approved decisions.
4. Historical plans.
5. Notion.

---

## 0. Execution protocol

- **Branch:** `feat/m10-security-performance-hardening`, cut from `main` after it is fast-forwarded to `origin/main`. One commit per code task, with tests in the same commit.
- **Ledger:** `.superpowers/sdd/2026-10-15-milestone-10-security-performance-hardening/progress.md`. It is local and git-ignored: never `git add -f` it and never make a ledger-only commit. Never record codes, OTPs, cookies, tokens or IPs.
- **Per task:**
  1. Expand the task's checklist in the ledger.
  2. RED: write the test and watch it fail.
  3. GREEN: implement until it passes.
  4. Run the targeted tests.
  5. Update the ledger.
  6. Commit with the exact message given.
- **Resumption:** read the ledger, `git log`, and this plan's §5. Continue from the first task without a commit.
- **Next.js docs first** (AGENTS.md), read from `node_modules/next/dist/docs/`:
  - `01-app/02-guides/content-security-policy.md`;
  - `01-app/03-api-reference/05-config/01-next-config-js/headers.md`;
  - the `proxy` docs.
- **House patterns:**
  - Keep `consumeQuota` as the single quota primitive.
  - Quota keys stay domain-separated HMACs (`hmacHex`).
  - Public refusals stay indistinguishable from success where they already are.
  - Refusals inside `submitSupportRequest` return instead of throwing, so earlier counter increments commit.

---

## 1. Repository findings

### 1.1 Browser headers and CSP

- **No CSP and no security headers exist.** `next.config.ts` has no `headers()`, there is no `vercel.json`, and `src/proxy.ts` (matcher `/c/:token`) sets only `no-store`/`noindex` on its RSC 404.
- **Why a nonce CSP is out:** Next 16 docs (`content-security-policy.md` lines 38, 391–397) say a nonce CSP requires dynamic rendering for every page and is **incompatible with PPR**. `cacheComponents: true` enables PPR. So a nonce CSP would also force the Proxy onto every route and drop static shells (D1).
- **What the browser actually needs:**

| Need | Source |
|---|---|
| `script-src` | `'self'` plus `'unsafe-inline'` (Next inline Flight data); dev also needs `'unsafe-eval'`. No `next/script`, no third-party scripts, no `dangerouslySetInnerHTML`, no iframes. |
| `style-src` | `'self' 'unsafe-inline'`. Server-rendered `style=` attributes appear in `scene-view.tsx:16,23,36,41,50`, `public-form.tsx:66` and `image-upload.tsx:64`. |
| `img-src` | `'self' data: https://res.cloudinary.com`. The QR is `data:image/svg+xml` (`modules/cards/qr.ts:4`); Cloudinary images use plain `<img>`. |
| `connect-src` | `'self' https://api.cloudinary.com` (direct signed upload, `image-upload.tsx:27`), plus the **origin of `NEXT_PUBLIC_SENTRY_DSN`** when it is set. There is no Sentry tunnel. |
| `font-src` | `'self'` (`next/font/google`, self-hosted at build). |
| `form-action` | `'self'`. Only Server Actions, a same-origin JSON fetch, and a GET search form. |
| Framing | Nothing needs it, so `frame-ancestors 'none'`. |

- **Google OAuth** is a same-origin call followed by a top-level navigation. No Google script or frame is loaded.
- **Cards can live on a second origin.** `CARD_URL_ORIGIN` may differ from `BETTER_AUTH_URL`. The public form posts to a relative URL, so `'self'` holds on both origins.
- **Permissions-Policy:** no camera, microphone or location is used, and there is no third-party content or frame. A Permissions-Policy header adds no practical protection, so it is **not added**.
- **Referrer-Policy:** the browser default `strict-origin-when-cross-origin` already applies, and outbound card links use `rel="noopener noreferrer"`. **Not added.**
- **X-Frame-Options:** superseded by `frame-ancestors`. **Not added.**
- **HSTS:** Vercel sets it by default. **Not added in the app.** Observe it on the next approved Preview.
- **`X-Content-Type-Options: nosniff`:** cheap and global. It is already set on the vCard route. **Added.**

### 1.2 Abuse protection (verified in code)

| Endpoint | Today | Verdict |
|---|---|---|
| OTP send | Better Auth: 10/60s per IP (DB-backed, IPv6 masked to /64). App: 3/email/10 min (`otp-quota.ts`). Sign-in type only. Same response for known and unknown emails. | **Gap:** no daily ceiling. One IP can trigger about 14k emails a day to arbitrary addresses, which exhausts the shared Resend budget and reputation and breaks email sign-in for everyone. One email can take 9 guesses per 10 minutes indefinitely. |
| OTP verify | 10/60s per IP, 3 attempts per code, keyed-HMAC codes | Sufficient. The daily send cap also bounds guessing. |
| `/activate` check and claim | 20/IP/10 min before lookup. 80-bit codes. Signed 15-minute cookie. 10 claims per Account per 10 min under a row lock. | Sufficient. Only the IPv6 issue applies. |
| `/support` | Honeypot, size caps, `clientKey` dedupe, global 100 / IP 5 / email 3 per 10 min, ack once per 24 h | **Bug** (see below), plus no daily ceiling. |
| `/support/recover` | 10/IP/10 min, owner-initiated, 8 digits, 3 committed attempts then cancel | Sufficient. M9B's accepted risk stands: anyone who knows the pending new email can burn its attempts. |
| `POST /api/forms/[formId]/submissions` | Origin allowlist, 10/IP/10 min, 16 KB body, honeypot, dedupe, one Resend-idempotent notification per submission | **Gap:** no daily ceiling and no cap on notification emails. |

The support bug: `src/modules/support/intake.ts:22` consumes **global** first, then IP, then email. A refusal returns instead of throwing, so the global increment commits. One source can therefore exhaust the 100-per-10-minute global cap, and genuine requests are then dropped silently behind the generic success message.

**IPv6 bug (all app per-IP limits).** `src/lib/client-ip.ts` returns the full address. Every app per-IP quota (activation, support, recovery, forms) treats each of the 2^64 addresses in one /64 as a separate client, so one IPv6 connection bypasses them all. Better Auth's own limiter already masks to /64.

**Client IP source on Vercel.** `x-vercel-forwarded-for` falls back to `x-forwarded-for`, and both are overwritten by Vercel. That is correct; do not proxy DNS through Cloudflare.

**Quota storage.**
- `consumeQuota` is a single atomic upsert, which is concurrency-safe.
- Every call deletes rows older than a **hardcoded 10 minutes**, so a longer window is impossible today.
- The window is fixed, starting at the first hit.
- **The cleanup can deadlock (existing, rare).** `submitSupportRequest` calls `consumeQuota` several times inside one transaction, and each call's `DELETE` locks the expired rows it removes.
  - Transaction A's cleanup can lock an expired row and then wait on a quota row held by transaction B (for example, a shared email key).
  - B's next cleanup then waits on the expired row A holds.
  - Postgres aborts one of them with `40P01`, and that support request fails.
  - Even if the cleanup skips locked rows, an upsert inside a support transaction still waits on another transaction's uncommitted delete of that key's expired row. For example, an expired global row deleted by A blocks B, while A waits on B for a shared email row. So `SKIP LOCKED` alone is not enough.
  - Fixed in C3: the cleanup moves outside the support transaction and skips locked rows. The transactional quota upserts then run without any cleanup `DELETE` locks held.

**Turnstile (D2: not added).** Daily caps close the practical gaps (email-budget exhaustion, notification floods, long-horizon guessing) with no new dependency and no CSP widening. Turnstile stays the next step if real distributed abuse appears, and would go on the OTP send first.

### 1.3 Query and database performance

**Hot path `/c/{token}` — no change required.** All lookups use primary keys or unique indexes:
- Proxy: `resolveCard` on `cards_public_token_unique`, run in parallel with the session lookup.
- Page: a warm tap is a revision check, the cached view, then a second revision check, about 3 queries.

The paired revision checks are deliberate fail-closed guards (ADR 0011, `profiles/view.ts:57`) and are M7-guarded. Do not touch them for a one-query saving.

**Owner and customer paths — no change required at current scale.** Owner screens have 2–3 users, and the data is pilot-sized (hundreds of rows). Every list is either keyset-paginated with `LIMIT` or bounded by product limits. Known ceilings, recorded in §10 with the trigger for revisiting:
- dashboard "outstanding" scans every in-progress or completed order;
- the expense report casts `spent_on::text`, which defeats `expenses_spent_on_idx`;
- search casts `orders.number::text` and `cards.id::text` and uses `ILIKE '%…%'` without trigram indexes;
- the unfiltered orders, support and cards lists sort without a `(created_at, id)` index;
- `orderAssignees` scans accounts by role;
- support case detail runs about 28 queries over 4 rounds against a 10-connection pool;
- unread counts aggregate all submissions;
- `caseLinkOptions` runs on every case view.

**No new indexes in M10.** Every candidate is speculative at current volume. No redundant index is removable: each `(id, x)` unique index backs a composite foreign key.

**Real bug: Inbox pagination skips messages.** `listInbox` builds its cursor with `Date#toISOString()`, which keeps milliseconds only (`app/(customer)/app/inbox/page.tsx:18`, `modules/forms/submissions.ts:55`). Rows that share the last row's millisecond but have smaller microseconds are skipped. `modules/inventory/queries.ts:20-22` already documents and solves exactly this by carrying the database's text timestamp. **Fixed in M10** by reusing that approach.

**Migration 0009 commitment.** `cards_dbc_ready_checks_recorded` was created `NOT VALID`, and the comment at `drizzle/0009_card_provisioning.sql:5` says "Milestone 10 runs VALIDATE CONSTRAINT". No later migration does it. **Done in M10** as `0015`. The PGlite migration from zero has no legacy rows. Applying it to the shared dev database is a separate, gated approval.

### 1.4 Authorization and security audit

**Validated as correct; no change:**
- **Owner pages and actions:** every admin page calls `requireOwner`, and every admin Server Action calls `authorize("owner")` itself. Layouts are not relied on.
- **Customer actions:** every one calls `authorize("account")` and scopes by `accountId` in its module (`lockOwnedProfile`, `lockOwnedCard`, `ownedBlock`, `ownedScene`, `forms.ts:14-16`, `submissions.ts:74`). No form-supplied ID is used unscoped.
- **Redirects:** `safeNext` (`auth/policy.ts:33-45`) also feeds Google's `callbackURL`.
- **User URLs:** `safe-url.ts` allows https only and rejects credentials. It is enforced on write and on render, so `javascript:` is blocked. Review URLs have a DB CHECK plus a Zod check.
- **CSRF:**
  - Better Auth uses `trustedOrigins: [baseURL]` and pins `disableOriginCheck: false`.
  - Server Actions use Next's default same-origin check.
  - The forms API checks `Origin`.
  - Cookies are HttpOnly and SameSite=Lax.
- **Enumeration:** OTP send, support and recovery all return generic responses.
- **Caching of private data:** the only `"use cache"` is the public scene view, keyed by profile, scene and version, holding only visible fields. Owner and customer pages render per request.
- **Uploads:** signed `public_id`, formats and dimensions, plus a byte, format and size re-check at confirm.
- **Sessions:** revocation on recovery and secure-account.

**Real gap, fixed in M10: SQL parameters reach Sentry.**
- Drizzle 0.45 `DrizzleQueryError` messages contain `Failed query: <sql>\nparams: <values>` (`node_modules/drizzle-orm/errors.js:12`).
- `scrubEvent` (`src/lib/sentry-scrub.ts`) scrubs request, contexts and user, but **not `event.exception.values[].value`**.
- Any query error, including a 22P02 from a non-UUID path segment on customer pages, ships parameter values to Sentry. Those values include emails, form answers, HMACs and account IDs.
- **A second path: console breadcrumbs.** `@sentry/node` 11.6 enables `consoleIntegration()` by default (`build/cjs/sdk/index.js:40`). Next logs server errors with `console.error`, so the same `Failed query … params: …` text becomes a breadcrumb. `scrubBreadcrumb` only strips URL query strings.
- One fix in the shared scrubber, applied to both exception values and breadcrumbs, covers every caller.

**Minor, deferred (§10):**
- non-UUID path segments return 500 instead of 404 on 11 customer pages;
- the Inbox `mailto:` uses an unvalidated "Email"-labelled answer;
- `overwrite:false` is not part of the Cloudinary signature (impact limited to the user's own image);
- owner free-text notes are not run through the activation-code detector (owners are trusted).

---

## 2. Decisions

| # | Decision | Ruling | Owner-workflow meaning | Consequence / risk | Hard to reverse? |
|---|---|---|---|---|---|
| D1 | CSP strength and rollout | **Static CSP, enforced immediately** (user, 2026-10-15) | None visible. A broken page would show on your own local and Preview runs; there are no customers yet. | `script-src` keeps `'unsafe-inline'`, so XSS protection is partial (React escaping stays the main XSS defense). Clickjacking, plugin, `<base>` and form-hijack protection, and connect/img origin restrictions are real gains. | No (one config block) |
| D2 | Abuse: Turnstile vs. daily caps | **Daily caps, no Turnstile** (user, 2026-10-15). Caps: OTP 10/email/day and 50/IP/day; support 20/IP/day; forms 30/IP/day; form notification email 50/Profile/day. | A customer who requests more than 10 codes a day must use Google or Support. Form submissions past 50 a day still reach the Inbox, but without an email. | Someone who knows a victim's email can block that victim's email-code sign-in for up to 24 h (today 10 min). Google and Support remain. Shared carrier IPs (CGNAT) could hit the per-IP caps at very high pilot volume. The numbers are constants and easy to tune. | No (constants) |
| A1 | MFA / step-up | **Deferred** (user-locked) | No change | R1 in §10 | — |
| A2 | Performance indexes | **None in M10.** Record ceilings and triggers | No change | Revisit at the §10 triggers | — |
| A3 | Sentry source-map upload (deferred to "M10" in a `next.config.ts` comment) | **Defer to Production setup / M12.** It needs `SENTRY_AUTH_TOKEN` in Vercel and a configured Production; it is not security or performance work. Update the comment. | Stack traces in Sentry stay minified | Slower debugging until Production setup | No |
| A4 | Validate `cards_dbc_ready_checks_recorded` | **`0015` custom migration** (the documented M10 commitment) | None | Applying it to shared dev needs its own approval with the pre-check, and fails if a legacy invalid row exists | Schema-level, but forward-only and additive |

**Stop condition:** any change to D1, D2 or A1–A4 needs the user.

---

## 3. Scope

### In
1. App per-IP quotas key on the IPv6 /64 network.
2. Support intake consumes per-source quotas before the global quota.
3. `consumeQuota` supports per-key windows, including 24 hours. Quota cleanup skips locked rows and runs outside the support transaction.
4. Daily caps (D2) on OTP send, support, form submissions and form notification emails.
5. A static enforced CSP plus `X-Content-Type-Options: nosniff` on every response.
6. The Sentry scrubber strips SQL parameters from exception messages and console breadcrumbs.
7. The Inbox cursor keeps microseconds.
8. Migration `0015` validates the 0009 constraint.
9. Docs, and stale "M10" comments.

### Out (explicit)
- OWNER MFA, TOTP, passkeys, step-up;
- Turnstile;
- new indexes and query refactors;
- Sentry source maps;
- nonce CSP;
- Permissions-Policy, Referrer-Policy, X-Frame-Options and app-level HSTS;
- account merge, deletion, freeze or restriction, and Profile moves;
- customer-visible support status;
- Settings → Communications and Settings → Business;
- owner commerce emails and form-email retry;
- UI redesign (the parked UI overhaul stays separate);
- ecommerce and courier automation;
- Production setup, Neffi email-domain purchase and setup, two-inbox launch acceptance;
- M11, M12;
- any Neon, Vercel, Resend or Notion action;
- the M7 resolver and revision checks;
- M4 and M5 behavior, which stays untouched except for the per-IP quota keys (C1);
- M6 behavior, except exactly where C5 (form notification cap) and C8 (Inbox cursor) list a change;
- Vercel Toolbar support on Preview: its resources are intentionally blocked by the CSP (R12).

---

## 4. Change specifications

### C1. `clientIp` masks IPv6 to /64 — `src/lib/client-ip.ts`
- Keep the header order: `x-vercel-forwarded-for`, then the first `x-forwarded-for` value, then `"unknown"`.
- IPv4 is returned unchanged.
- IPv4-mapped IPv6 returns the IPv4 address, in both its dotted form (`::ffff:a.b.c.d`) and its hex form (`::ffff:c000:0280`, also written `0:0:0:0:0:ffff:c000:280`). The hex form is detected after expansion (the first five hextets are 0 and the sixth is `ffff`), so a mapped address is never treated as an ordinary IPv6 /64.
- Any other IPv6 address is expanded and its first four hextets are kept, giving a canonical /64 string.
- `@better-auth/core`'s `normalizeIP` is not a direct dependency and must not be added. Use `node:net` `isIP` plus a few lines.
- **Affects:** every per-IP app quota (activation, support, recovery, forms). Existing IPv6 counters re-key once at deploy, which is harmless.
- **Tests (`client-ip.test.ts`):**
  - two addresses in the same /64 produce the same value;
  - different /64s produce different values;
  - compressed and expanded forms produce the same value;
  - dotted mapped IPv4 `::ffff:192.0.2.128` returns `192.0.2.128`;
  - hex mapped IPv4 `::ffff:c000:0280` and `0:0:0:0:0:ffff:c000:280` both return `192.0.2.128`, and equal the plain IPv4 key;
  - existing IPv4 and `unknown` cases still pass.

### C2. Support quota order — `src/modules/support/intake.ts:22`
- New order: `support-ip` (10 min), then `support-ip-day`, then `support-email`, then `support-global`.
- The global quota is charged only once per-source checks pass.
- **Lock order:** the upserts take quota key types in one fixed sequence (IP, IP per day, email, global), and keys from different domains can never collide. The upserts alone therefore cannot form a lock cycle. The busy global row is now locked last, which shortens how long it is held.
- **Remaining deadlock source:** the cleanup `DELETE` inside the transaction. C3 (T3) removes it by pruning before the transaction, not this reordering.
- R17 in `check-support-concurrency.mts` (lines 292–297) still serializes on the global or shared-email row after the reorder. Re-point it only if it fails, and keep its intent: two intakes for one `clientKey` serialize, producing one case and one acknowledgement.
- **Test (PGlite):** one IP sends many fresh-`clientKey` requests until refused. A different IP and email then still create a case. This fails today.

### C3. Per-key windows — `src/auth/otp-quota.ts`
- Signature: `consumeQuota(db, key, limit, now = new Date(), { windowMs = 10 min, prune = true } = {})`.
  - Existing callers pass no options, so their behavior (10-minute window, prune on every call) is unchanged.
  - Keys are domain-separated, so a key always has one window.
- **Invariant:** `windowMs > QUOTA_RETENTION_MS` throws, so a longer future window fails loudly instead of being silently cut short by the cleanup.
- **Upsert:** on conflict, if the row's `window_started_at <= now - windowMs`, reset `count = 1, window_started_at = now`; otherwise `count + 1`. It stays a single atomic statement, unchanged in kind.
- **Cleanup: a new exported helper, `pruneQuotas(db, now)`.** `consumeQuota` calls it first when `prune` is true.
  - It deletes rows older than `QUOTA_RETENTION_MS = 24 h`, the longest window.
  - It skips rows that another transaction has locked, instead of waiting on them (§1.2):
    ```sql
    DELETE FROM auth_otp_quotas
    WHERE key IN (
      SELECT key FROM auth_otp_quotas
      WHERE window_started_at <= $1
      FOR UPDATE SKIP LOCKED
    );
    ```
    Written with Drizzle's `sql` template, as today.
  - A skipped row is removed by a later call. In the meantime it does no harm: its key's own upsert resets an expired window.
- **Support intake (`src/modules/support/intake.ts`):**
  - `submitSupportRequest` calls `pruneQuotas(db, now)` **before** `db.transaction(...)`. That prune autocommits, so no deleted quota row is still locked while the transaction takes its quota locks.
  - Every `consumeQuota` call inside the transaction passes `{ prune: false }`. The C5 `support-ip-day` call passes `{ windowMs: 24 h, prune: false }`.
  - The C2 order, the HMAC keys, the limits and the refusal shapes are unchanged.
  - Other callers (OTP hook, activation, recovery, forms, form notification, email change, media signing) run outside transactions and keep the default `prune: true`.
- No migration; table growth is still bounded.
  `ponytail:` cleanup is a seq scan on `auth_otp_quotas`. Add a `window_started_at` index if the table exceeds about 10k rows.
- **Tests (`otp-quota.db.test.ts`):**
  - **RED:** a key with `windowMs = 24 h` still counts after more than 10 minutes, and is refused past its limit within 24 hours. Today the hardcoded 10-minute cleanup deletes its row and the count restarts.
  - **RED:** `windowMs` above `QUOTA_RETENTION_MS` throws.
  - **Regression (already passes today; it must keep passing):** a 10-minute key starts a new window after 10 minutes, now via the reset path, because its row is retained.
  - rows older than 24 hours are deleted, both by `pruneQuotas` and by a default `consumeQuota`;
  - `{ prune: false }` leaves expired rows in place and still counts correctly;
  - existing OTP quota tests stay green.
- **RED test, no cleanup inside the support transaction (PGlite, support intake test):**
  - wrap the transaction handle so every statement it executes is recorded;
  - run `submitSupportRequest` and assert the recorded in-transaction statements contain no `DELETE FROM auth_otp_quotas`;
  - assert that an expired quota row present beforehand has been removed by the time the transaction starts;
  - this fails today, because each in-transaction `consumeQuota` deletes.
- **Concurrency (loopback, new scenario R20 in `check-support-concurrency.mts`):**
  - set up an expired `auth_otp_quotas` row, older than 24 hours, with a key unrelated to the operation under test;
  - session A opens a transaction and holds that row with `SELECT … FOR UPDATE`;
  - session B runs a support intake, which calls `consumeQuota` several times, under a statement timeout;
  - B must complete and create its case without waiting. Its pre-transaction `pruneQuotas` skips the locked row, which still exists while A holds it;
  - after A commits, the next prune deletes the row.
  - This is RED today: the current `DELETE` waits on A's lock, so B hits the timeout.
  - The atomic-upsert behavior of R17 stays green.
- **Why the deadlock is gone:** the cleanup moves outside the support transaction and skips locked rows, so the transactional quota upserts run without cleanup `DELETE` locks. The upserts alone follow the fixed C2 key order and cannot form a cycle. R20 proves the skip, and the PGlite test proves there is no in-transaction `DELETE`. Together they rule out the §1.2 sequence, so no extra loopback scenario is needed.

### C4. Daily OTP caps — `src/auth/options.ts` before-hook
- After the existing type and email checks, consume in this order:
  1. `otp-ip-day` with `clientIp(ctx.request?.headers ?? ctx.headers)`, limit 50 per 24 h. That is the same request-header shape Better Auth's own middleware reads (`better-auth/dist/api/middlewares/origin-check.mjs:97`); confirm against the installed 1.7.7 types;
  2. the existing `otp-email` limit, 3 per 10 min;
  3. `otp-email-day`, limit 10 per 24 h.
- Any refusal raises the same generic `TOO_MANY_REQUESTS`.
- Code sends reach this hook over HTTP from `authClient`, so request headers are present. If Codex finds a server-side caller without headers, stop and ask rather than letting it share the `unknown` bucket.
- Constants live next to `OTP_EMAIL_LIMIT`.
- **Tests (`email-otp.db.test.ts`, fake sender):**
  - the 11th send in a day for one email is refused, and no email is sent;
  - known and unknown emails get an identical refusal shape;
  - the 51st send from one IP across distinct emails is refused;
  - the existing 10-minute behavior is unchanged.
- **Test hygiene:** existing and new tests that send codes to many emails must set controlled, distinct `x-forwarded-for` values (unique /64s for IPv6). Otherwise they fail by accident on the new 50-per-IP daily cap rather than on the behavior under test. Only the 51st-send test shares one IP on purpose.

### C5. Daily caps for support and forms
- **Support:** `support-ip-day` = 20 per 24 h. Add `ipDay: 20` to `SUPPORT_LIMITS`. The value is consumed inside the C2 order.
- **Forms route** (`api/forms/[formId]/submissions/route.ts`): after the 10-minute IP check, add `form-ip-day` = 30 per 24 h, returning the same `429 rate_limited`.
- **Form notification** (`modules/forms/notify.ts`):
  - After the `notifiedAt` check, consume `form-notify-profile` keyed by `profileId`, 50 per 24 h. Select `profileId` in the existing join.
  - Over the cap: skip sending and leave `notifiedAt` null. The submission is already stored, which keeps the D12 contract.
  - Pass the HMAC secret in.
- **Tests:**
  - support: the 21st request in a day from one IP is not stored;
  - forms: the 31st POST from one IP in a day returns 429;
  - notification: the 51st submission to one Profile is stored and visible in the Inbox, with no email sent;
  - another Profile is unaffected.

### C6. CSP and nosniff
- **New pure module `src/config/security-headers.ts`** (no `server-only`, no env import). It exports `securityHeaders({ dev, sentryDsn })`, which returns `[{ key, value }]`.
- **The policy, joined with `; `:**
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline'`, plus `'unsafe-eval'` only in dev (Next 16 CSP guide, dev section)
  - `style-src 'self' 'unsafe-inline'`
  - `img-src 'self' data: https://res.cloudinary.com`
  - `font-src 'self'`
  - `connect-src 'self' https://api.cloudinary.com`, plus the Sentry DSN origin when the DSN is set
  - `object-src 'none'`
  - `base-uri 'none'`
  - `form-action 'self'`
  - `frame-ancestors 'none'`
- Also emit `X-Content-Type-Options: nosniff`.
- **`next.config.ts`:**
  - add `headers()` with source `/:path*`, using `securityHeaders({ dev, sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN })`;
  - update the source-map comment per A3.
- **Dev detection:**
  - Use the Next build phase, not `NODE_ENV`: `dev` is true only when `phase === PHASE_DEVELOPMENT_SERVER` (from `next/constants`).
  - Export the config as a phase function, `(phase) => …`, wrapping the existing `withSentryConfig` call. Confirm against the installed `next` and `@sentry/nextjs` docs and types that a function config is supported there; if it is not, use the equivalent supported mechanism and record it in the ledger.
  - Why: `bin/next` keeps any preset `NODE_ENV` (`NODE_ENV = NODE_ENV || defaultEnv`) and only warns, so a shell-level `NODE_ENV=development` during `next build` would otherwise ship `'unsafe-eval'` to production.
- **Proxy-returned responses (conditional fallback):**
  - Next's local server adds `next.config` headers before the Proxy and merges them into Proxy-returned responses, including the bare `/c` RSC 404 and the rewrite (`next/dist/server/lib/router-utils/resolve-routes.js:56, 446-447, 515-523`). So **`src/proxy.ts` is expected to need no change.**
  - Add headers in the Proxy only if the HTTP check proves a response lacks them, and then from the same module.
  - Vercel's edge routing is a separate path: observe it on the next approved Preview (R10).
- **Development HMR check (part of T6, by the implementer):**
  - run `pnpm dev` against a loopback DB and open any page with DevTools;
  - confirm the HMR WebSocket (`/_next/…` under Turbopack) connects, an edit hot-reloads, and the console shows no CSP violation;
  - CSP Level 3 lets `'self'` match same-host `ws:`, so no extra source is expected;
  - **only if the dev server is actually blocked**, add the minimal dev-only source (for example `ws://localhost:*`) inside the `dev` branch of `securityHeaders`, and record the observed violation in the ledger;
  - the production policy is never widened;
  - if the implementer cannot drive a browser, this check moves to T12 as one item.
- **Unit test (`security-headers.test.ts`):**
  - every directive is present;
  - no `'unsafe-eval'` and no `ws:`/`wss:` source in production;
  - the Sentry origin appears only when a DSN is set, and is the DSN's origin with no key or path;
  - no wildcard sources.
- **Cloudinary coupling test** (in `security-headers.test.ts`, or next to the existing `cloudinary.test.ts`). This replaces any manual Cloudinary check:
  - the origin of the upload ticket URL (`cloudinary.ts:28`, `https://api.cloudinary.com/v1_1/<cloud>/image/upload`) is in the production `connect-src`;
  - the origin of the image URL (`cloudinary.ts:57`, `https://res.cloudinary.com/<cloud>/…`) is in the production `img-src`.
  - Both hosts are hardcoded, and CSP checks only the destination origin, so this is deterministic.
- **HTTP check:** extend `scripts/check-public-http.mts` (loopback production build) to assert the CSP and nosniff headers on:
  - `/`, `/sign-in`, `/support`, `/activate`;
  - a published `/c/<token>`, an unavailable `/c/<token>` (both the document and the RSC 404);
  - `/api/health`;
  - a 403 from `/api/forms/<id>/submissions`.
- The same check asserts that the served production policy contains no `'unsafe-eval'`, no `ws:`, no `wss:` and no wildcard source (`*`, or any `*.` host).

### C7. Sentry scrub for exceptions and console breadcrumbs — `src/lib/sentry-scrub.ts`
**Requirement:** no SQL parameter value may reach Sentry through exceptions or console breadcrumbs.

- **One helper, `stripQueryParams(text)`, used by every path.** It replaces everything from a `params:` marker to the end of the string with `params: [scrubbed]`. This matches Drizzle's `DrizzleQueryError` format (`drizzle-orm/errors.js:12`). Do not create a second sanitizer.
- **`scrubEvent`:** apply the helper to every `event.exception.values[].value`. That includes linked causes, which Sentry adds as extra values.
- **`scrubBreadcrumb`:**
  - apply the helper to `breadcrumb.message`;
  - for `category === "console"`, drop `breadcrumb.data.arguments`, since the raw logged values (the error object or string) live there;
  - the existing URL stripping of `url`, `from` and `to` stays.
- Keep the SQL text: it is parameterized and carries no values.
- **RED tests (`sentry-scrub.test.ts`):**
  - an event whose exception value is `Failed query: select … \nparams: a@b.test,…` comes out without `a@b.test`;
  - a console breadcrumb whose `message` is `Failed query: select … \nparams: a@b.test,…`, with `data.arguments` holding the same text, comes out with `a@b.test` in neither `message` nor `data`;
  - the existing scrub tests stay green.

### C8. Inbox cursor — `modules/forms/submissions.ts` and `app/(customer)/app/inbox/page.tsx`
- Reuse the `listCards` approach (`inventory/queries.ts:20-25`): select `created_at::text` for the cursor and validate it with the same strict regex.
- Use the existing cursor regex directly, without a new abstraction. Moving it to a small shared helper next to the Inventory one is acceptable only if both callers use it.
- An invalid `before` is ignored, as today.
- The page keeps building the "Show older" link with `encodeURIComponent`. The text form contains a space and `+`, which must survive the round trip.
- **RED test (PGlite, `inbox.db.test.ts`):** insert 22 submissions where rows 20–22 share one millisecond with distinct, nonzero microseconds, row 20 having the largest. Page 1 plus page 2 return all 22 exactly once. This fails today.
- **RED page test (`inbox/page.test.tsx`).** Today it builds the expected cursor with `date.toISOString()` (lines 10–19). Rewrite it to prove that:
  - the "Show older" link carries the database-text cursor, microseconds included, encoded with `encodeURIComponent`;
  - a database-text cursor is accepted and passed to `listInbox` unchanged;
  - malformed cursors are still ignored, now including a millisecond-only ISO string.

### C9. Migration `0015` — validate 0009
- Create it with `pnpm db:generate --custom --name=validate_dbc_ready_checks`. The file contains:
  ```sql
  ALTER TABLE "cards" VALIDATE CONSTRAINT "cards_dbc_ready_checks_recorded";
  ```
- Regenerate the ERD; it should not change.
- **Tests:** the migrate-from-zero test applies `0015`. A guard test asserts the constraint is now validated (`pg_constraint.convalidated = true`).
- **Shared-dev pre-check** (documented, not run in M10):
  ```sql
  SELECT count(*) FROM cards
  WHERE kind = 'dbc' AND state = 'ready'
    AND (nfc_verified_at IS NULL OR package_matched_at IS NULL);
  ```
  It must return 0. A non-zero result is a stop: never invent physical evidence.

---

## 5. Canonical task sequence

| Task | Content | Commit |
|---|---|---|
| **T0** | Diff the untracked M9B plan copy against `origin/main`'s committed version. If they differ, keep a copy outside the repo; then move it aside so the fast-forward can proceed. Fast-forward `main` to `origin/main` and confirm `88b4a5f` (PR #11). Cut the branch. Commit this plan. Set up the ledger. Read the Next docs listed in §0. | `docs(m10): security and performance hardening plan` |
| **T1** | C1, IPv6 /64 client IP | `fix(abuse): key app quotas on the IPv6 /64 network` |
| **T2** | C2, support quota order. Run `check:support-concurrency`; re-point R17 only if it fails. | `fix(support): charge per-source quotas before the global quota` |
| **T3** | C3, all RED first against the current cleanup:<br>• per-key quota windows and the retention invariant;<br>• the `{ prune }` option and the `pruneQuotas` helper with `SKIP LOCKED`;<br>• support intake pruning before its transaction and passing `prune: false` inside it;<br>• the no-in-transaction-`DELETE` PGlite test;<br>• loopback scenario R20.<br>Run `check:support-concurrency`. | `feat(abuse): per-key quota windows and non-blocking quota cleanup` |
| **T4** | C4, daily OTP caps, with distinct-IP test hygiene | `feat(auth): daily sign-in code caps` |
| **T5** | C5, daily support, form and notification caps. **Re-run `check:support-concurrency`**, because `support-ip-day` joins the intake lock sequence. | `feat(abuse): daily caps for support, forms and form notifications` |
| **T6** | C6: CSP and nosniff via the Next phase, unit test, Cloudinary coupling test, HTTP check extension (headers plus forbidden-source assertions), dev HMR check, A3 comment. The Proxy is changed only if the HTTP check requires it. | `feat(security): content security policy and nosniff headers` |
| **T7** | C7, Sentry scrub for exceptions and console breadcrumbs | `fix(observability): strip SQL parameters from Sentry exceptions and breadcrumbs` |
| **T8** | C8, Inbox cursor (DB test and page test) | `fix(inbox): keep microseconds in the pagination cursor` |
| **T9** | C9, migration `0015` | `feat(db): validate the DBC ready-checks constraint` |
| **T10** | Docs (§8) and stale comments (`admin/layout.tsx:13` MFA line, `.env.example:54`) | `docs(m10): security and performance hardening` |
| **T11** | Software gate (§7) and independent whole-branch review | fixes in separate commits |
| **T12** | **STOP, needs the user.** The minimal two-step local production-build browser pass (§6.4). Starts only on explicit instruction. No Cloudinary or other external action. | ledger only |
| **T13** | Push and PR only after explicit approval. Merge needs separate approval. | none |

T1→T2→T3→T4/T5 are ordered:
- C4 and C5 depend on C3 (windows) and C1 (IP keys);
- T3's R20 scenario runs against the post-T2 intake order;
- T5 extends that order, so the support concurrency suite runs at T2, T3 and T5.

T6–T9 are independent of each other.

---

## 6. Testing strategy

### 6.1 Unit
- `client-ip.test.ts` (C1)
- `security-headers.test.ts` (C6), including the Cloudinary coupling test
- `sentry-scrub.test.ts` (C7): exception values and console breadcrumbs
- `inbox/page.test.tsx` (C8): the database-text cursor

### 6.2 DB / integration (PGlite)
- `otp-quota.db.test.ts` (C3): the 24-hour window, the retention invariant, the regression, `pruneQuotas`, and `prune: false`
- support intake test (C3): no quota `DELETE` inside the intake transaction
- `email-otp.db.test.ts` (C4), with distinct controlled IPs
- support intake tests (C2, C5)
- forms route and `notify.db.test.ts` (C5)
- `inbox.db.test.ts` (C8)
- migrations and guard tests (C9)

**Security-negative cases:**
- IPv6 rotation within a /64 is refused;
- an IPv4-mapped address (dotted or hex) shares the plain IPv4 quota key;
- a single-source support flood cannot starve another requester;
- the 11th daily code for one email sends nothing and is indistinguishable for known and unknown emails;
- a notification-capped submission still lands in the Inbox;
- no SQL parameter value in Sentry exception values or console breadcrumbs;
- a `windowMs` longer than retention throws;
- no `'unsafe-eval'`, `ws:`/`wss:` source or wildcard in the production CSP, checked both by the unit test and in the served production headers.

### 6.3 Concurrency
Both of these change locking inside the intake transaction:

- **C2 (lock order).** Re-run `check:support-concurrency` (R1–R19) on loopback after T2. R17 must still serialize two intakes for one `clientKey`.
- **C3 (cleanup).** The cleanup moves outside the support transaction and skips locked rows, so the transactional quota upserts run without cleanup `DELETE` locks. The proof has two parts:
  - new loopback scenario **R20** (§4 C3): a transaction holding an expired quota row does not block a concurrent support intake, because the pre-transaction prune skips the locked row. RED against the current cleanup;
  - the PGlite test (§4 C3, §6.2): the intake transaction issues no quota `DELETE`.

  The C3 upsert stays one atomic statement, so it needs no scenario of its own.

The suite runs at T2, T3 and T5 (T5 adds `support-ip-day` to the lock sequence), and all six suites run at the gate. The M10 total is 56 + 1 = 57 scenarios.

### 6.4 Browser (T12; only what automation cannot prove)
**Not repeated manually:**
- **Proven by automation:**
  - header presence and exact policy on every route class (`check-public-http.mts`, C6);
  - policy contents (unit test).
- **Not governed by CSP, so there is nothing to observe:**
  - Google sign-in is a top-level navigation;
  - click-triggered clipboard writes need no grant, since no Permissions-Policy is set;
  - other pages and flows that use only same-origin scripts and fetches are covered by steps 1–2 below.
- **Cloudinary:** both hosts are hardcoded, and CSP checks only the destination origin, so the C6 coupling test proves it. There is no manual upload.

**What only a browser can prove** is that the app's real runtime raises no CSP violation on each origin. That covers Next's hydration and Flight scripts, Server Action fetches, and client-only Base UI styles. T12 is therefore two steps on a local `next build && next start`, against a disposable loopback DB with synthetic fixtures, with DevTools open. Pass condition: no CSP violation in the console.
1. **Card origin, public runtime:** open a published `/c/<token>` and submit its form. This covers static-shell hydration plus a same-origin fetch.
2. **App origin, Server Action runtime:** submit `/support` once while signed out. The app and card origins can differ (`BETTER_AUTH_URL` vs `CARD_URL_ORIGIN`).

The dev HMR check moves here only if T6 could not run it (§4 C6).

Record observed evidence separately from any SQL. Never record codes or cookies.

### 6.5 Performance verification
Run on the loopback DB at the gate and record the plans in the ledger:
- `EXPLAIN` the `/c` hot-path statements (`resolveCard`, the revision check) and confirm index use;
- `EXPLAIN` the new Inbox keyset query.

No other query work.

---

## 7. Final software gate (T11)

**Checks:**
- `pnpm lint` (0 errors), `typecheck`, `test` (all green, excluding `.superpowers/**` and `.pnpm-store/**`);
- `db:check`, `db:generate` with a clean `drizzle/` diff, `db:erd` committed;
- `build`, `check:bundle`;
- all six concurrency suites on loopback;
- `check-public-http.mts` against a loopback production build;
- a secret scan of new history;
- a clean `git status`.

**The independent whole-branch review must confirm:**
- no MFA or Turnstile code;
- no new dependencies;
- no new indexes;
- the M4, M5 and M7 resolver and revision checks are untouched;
- public refusals are unchanged in shape (no enumeration);
- all quota keys are HMACs;
- the production CSP has no `'unsafe-eval'`, `ws:`/`wss:` source or wildcard, and any dev-only source is backed by a recorded observed violation;
- dev detection uses the Next phase, not `NODE_ENV`;
- `src/proxy.ts` is unchanged unless the HTTP check proved a header gap;
- `0015` contains only `VALIDATE CONSTRAINT`;
- no SQL parameters reach Sentry through exceptions or console breadcrumbs, through the one shared helper;
- the quota cleanup uses `SKIP LOCKED` and runs before, never inside, the support transaction (`prune: false` inside it); the upsert is still one atomic statement;
- docs match the code.

---

## 8. Documentation impact (T10)

- **`docs/operations.md`:**
  - auth limits paragraph: add the daily caps, and replace "stronger anti-abuse measures are M10 work" with the D2 outcome and the Turnstile trigger;
  - activation and forms limits: note the /64 keying;
  - a new short "Browser security headers" section: the CSP, how to add an origin, the phase-based dev allowance, and that Vercel Toolbar is intentionally blocked (R12);
  - Concurrency suites paragraph: 57 scenarios, with R20 (non-blocking quota cleanup);
  - `0015` pre-check and gate;
  - Migration 0009 paragraph: "validated by 0015";
  - session paragraph: MFA/step-up deferred.
- `docs/roadmap.md`: change the M10 row to the delivered scope and note that MFA/step-up and Turnstile are deferred.
- `PRODUCT.md:73`.
- `docs/specs/accounts-and-access.md:34`.
- `docs/specs/support-and-corrections.md:51,57`: daily IP cap and Turnstile deferred.
- `docs/architecture/system.md:62`.
- `docs/database/erd.md`, only if regenerated.
- Comments in `src/app/admin/layout.tsx:13`, `next.config.ts:22` and `.env.example:54`.

No ADR: these are tuning and bug fixes inside existing designs.

---

## 9. Stop conditions

- Any change to D1, D2 or A1–A4, or to the scope in §3.
- Any contradiction between this plan and the code: log it as Blocked in the ledger and ask.
- Any Neon, Vercel, Resend, Cloudinary, Sentry, Notion or Production action.
- Adding `vercel.live` or any other Vercel Toolbar source to the CSP.
- Applying `0015` to shared dev.
- A non-zero `0015` pre-check anywhere.
- New dependencies.
- Touching the M7 resolver or revision checks, M5 claim semantics, or recovery semantics.
- CSP needing any source beyond §4 C6. Stop and ask; do not widen silently.
- User evidence (T12).
- Push, PR or merge.

---

## 10. Definition of Done and residual risks

**Done when:**
1. C1–C9 are implemented, with their RED→GREEN tests in the same commits.
2. The T11 gate is green and the independent review is approved.
3. The two-step T12 browser pass shows zero CSP violations (or T12 is explicitly waived by the user).
4. `check:support-concurrency` passes R1–R20, and the other five suites stay green.
5. Docs are updated; MFA/step-up, Turnstile and source maps are recorded as deferred with triggers.

**Deferred residuals (with triggers):**
- **R1, no OWNER MFA/step-up.** Revisit when the owner team exceeds the 2–3 trusted people or at Production setup.
- **R2, CSP `script-src 'unsafe-inline'`.** Revisit when Next supports nonces with PPR, or `experimental.sri` becomes stable.
- **R3, Turnstile.** Add to OTP send if daily caps are hit by distributed abuse (visible as `TOO_MANY_REQUESTS` spikes or Resend quota alerts).
- **R4, per-email daily cap enables a 24 h email-code lockout.** Google and Support remain. Tune `OTP_EMAIL_DAILY_LIMIT` if it becomes a support burden.
- **R5, CGNAT.** Shared carrier IPs may hit per-IP daily caps at event-scale traffic. The caps are constants.
- **R6, query ceilings in §1.3.** Revisit any list or search above about 10k rows, a dashboard above about 2k orders, or measured p95 above 500 ms. Trigram indexes and `(created_at, id)` indexes are the first candidates.
- **R7, quota cleanup seq scan.** Add an index on `auth_otp_quotas(window_started_at)` above about 10k rows.
- **R8, smaller items:**
  - non-UUID segments return 500 instead of 404 on customer pages (the C7 scrub stops their data reaching Sentry);
  - the Inbox `mailto:` uses the "Email"-labelled answer;
  - `overwrite:false` is unsigned for Cloudinary;
  - owner notes are not run through the activation-code detector;
  - Inbox mark-read happens on GET render (verify there is no prefetch side effect in M11).
- **R9, Sentry source maps.** At Production setup.
- **R10, Vercel edge headers.** The local server applies the headers to Proxy responses: the Next source shows it, and the C6 HTTP check proves it. Vercel's edge routing is a separate path. On the next approved Preview (not part of M10), observe the CSP and nosniff on:
  - a normal or static page;
  - an unavailable `/c/<token>`, both the document and the RSC 404.

  Observe the HSTS default at the same time.
- **R11, shared-dev `0015`.** A separate approval with the pre-check.
- **R12, Vercel Toolbar on Preview.** Its `vercel.live` scripts and frames are blocked by the CSP. That is intentional and unsupported. Never add `vercel.live`. During M11, disable the toolbar for the project or ignore toolbar-specific violations. Any other violation is a real finding.
