# Neffi Milestone 3 — Authentication & Authorization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use `- [ ]`.

## Context

Milestones 1 and 2 are merged (`main` @ `fa130ef`).
- Better Auth 1.7.7 persists through Drizzle into `accounts` / `auth_identities` / `auth_sessions` / `auth_verifications`.
- `accounts.role` (`customer` | `owner`) exists.
- There are no sign-in methods yet, and `/app` and `/admin` are unprotected placeholders.

M3 lets people sign in with **Google or an emailed one-time code**, and makes the server decide who may enter `/app` and `/admin`. It does this without a second identity model, without weakening the M1/M2 origin and callback protections, and without pulling in M4+ business workflows.

**Stack:** existing only (Next.js 16.4 with `cacheComponents`; Better Auth 1.7.7 incl. the emailOTP plugin and `better-auth/react` client; Drizzle 0.45; PGlite tests). **No new runtime dependency:** Resend is called with `fetch`.

**Spec:** Neffi Locked Plan; Step 2 (account/auth/recovery rules); Step 5 (surfaces, email scope); Step 6 (Better Auth/provider-identity constraints); Step 7 (auth, OTP, sessions, abuse defaults, Resend, production auth settings); Step 8 (M3 deliverables + critical verification); Step 9; AI Build Handoff.

---

## 1. Findings (read-only, 2026-10-10)

**Repository**
- `main` @ `fa130ef` == `origin/main`, clean.
- Migrations `0000`–`0006`.
- 133 tests.
- CI runs lint, typecheck, test, `db:check`, generate-drift, build and `check:bundle` with dummy env.

**Auth code**
- `src/auth/options.ts`:
  - `authOptions({db, secret, baseURL})` with the Drizzle adapter (`user→accounts`, `account→auth_identities`, `session→auth_sessions`, `verification→auth_verifications`);
  - `generateId:"uuid"`;
  - `role` additionalField `input:false`;
  - email/password disabled;
  - origin check pinned on;
  - `trustedOrigins:[baseURL]`.
- `src/auth/server.ts` is server-only.
- `/api/auth/[...all]` uses `toNextJsHandler`.
- Existing tests cover `/ok`, disabled sign-up, no provider, untrusted origin → 403 and untrusted callback → 403. A PGlite adapter round-trip also exists.

**Config:** Zod env parsing that never echoes values. `BETTER_AUTH_URL` is derived from `VERCEL_BRANCH_URL` in Preview. The isolation guard fails closed in production.

**Next.js 16.4 (bundled docs):**
- Middleware is now `proxy.ts`, and it should only do optimistic checks. Secure checks go in a server-only Data Access Layer called close to the data.
- With `cacheComponents`, request reads (`headers`, `searchParams`) need `<Suspense>` or `export const instant = false` (the documented "allow blocking route" fix).
- Layouts don't re-render on client navigation between child pages, so pages must check too.
- `use cache: private` would keep authenticated output in the browser for minutes, so it isn't used for auth.
- `forbidden()` needs an experimental flag, so it isn't used either.

**Better Auth 1.7.7 (installed source; confirmed by an independent review):**
- **emailOTP:**
  - `storeOTP` can be plain, hashed or a custom `{hash}`.
  - The consume is an atomic single-use DELETE … RETURNING.
  - Resends rotate the code and reset attempts.
  - `send-verification-otp` returns `{success:true}` for unknown emails, so nothing leaks about which emails have accounts.
  - Sign-in finds the Account by lowercased email, or creates one with `emailVerified:true`.
  - ⚠ `/email-otp/reset-password` creates a password `credential` identity **even with email/password disabled**. It has to be blocked.
- **OAuth:**
  - An identity resolves by `(providerId, accountId)` first, so a linked Google identity survives an email change.
  - If that misses, it falls back to an email match. `disableImplicitLinking:true` refuses that match with `account_not_linked`.
  - Otherwise it creates a new Account with Google's `email_verified`.
  - `linkSocial` requires the same email and a verified provider email, and returns an ownership conflict if the identity belongs to another Account.
  - OAuth state is a database row plus a signed cookie.
  - Account and identity creation is atomic **only if the Drizzle adapter has `transaction:true`**.
  - Google tokens are stored, and refreshed on every sign-in, unless that is disabled.
- **Google provider:** code flow. The profile is decoded from the token-endpoint `id_token` with no signature check on this path, so tests can mock the token endpoint. Callback is `{baseURL}/api/auth/callback/google`.
- **`disabledPaths`:** exact path match. It can't match parameterised `/reset-password/:token`.
- **Rate limiting:** keyed by IP + path. Database storage uses the `rateLimit` model (`key` unique, `count`, `lastRequest` bigint). Better Auth prunes rows older than its own longest window, so **custom long-window counters can't live in that table**. Rules apply in order: special, then plugin, then `customRules` (last wins). The IP comes from single-value `x-forwarded-for`, which Vercel sets; dev and test fall back to localhost. Server-side `auth.api.*` calls skip the HTTP limiter.
- **Sessions:** reads join the user row (role always fresh) when `cookieCache` is off. Cookies are HttpOnly, SameSite=Lax, and get `Secure` plus the `__Secure-` prefix on https. `/get-session` and `/sign-in/email-otp` return the session token in their JSON.
- **`nextCookies()`:** sets cookies from server actions and route handlers. Inside a Server Component, a refresh mutates the database but can't set the cookie. Plain `RSC: 1` requests skip the refresh; full document loads don't.
- **Telemetry:** off by default.

**Notion:** available. All step pages were re-read today and are unchanged (last edits 01:56–01:58 UTC). Step 9 has no M1/M2 progress entries; not edited.

## 2. Recovered requirements

- **Sign-in:**
  - Google or email OTP; Google optional.
  - **No passwords and no SMS.**
  - A successful OTP both verifies the address and signs in.
  - Normal secure sessions.
- **Identity:**
  - The Account (`accounts.id`) is permanent. Google and email are Authentication Identities.
  - A verified sign-in email resolves to the existing Account.
  - A linked Google identity always resolves to its Account.
  - **A new Google identity whose email matches an existing Account is never silently linked or duplicated.** It needs an additional verification step through the existing verified email.
  - Different verified emails may be separate Accounts; merging them is support-only (M9).
  - An email must be verified before it grants access.
- **OTP:**
  - short-lived, attempt-limited and hashed;
  - about 3 sends per 10 minutes per email, plus a broader IP limit;
  - rate limiting that doesn't rely on one instance's memory.
- **Authorization:**
  - OWNER uses the same Account system, with server-side role checks.
  - MFA/step-up is **M10**.
- **Sessions and output:**
  - exact base URL and trusted origins;
  - Secure, HttpOnly, SameSite cookies;
  - server-side session validation.
  - `/app` and `/admin` stay private, dynamic and noindex.
  - Never put OTPs or tokens in URLs, logs, Sentry or browser storage.
- **Email:** only via Resend, behind an internal service. Idempotent sends, tracking off.
- **Step 8 M3 verification:**
  - customer A can't read or update customer B;
  - a non-owner is denied owner surfaces and mutations;
  - OTP expiry and attempt limits work;
  - no silent duplicate Accounts;
  - logout and invalidation work.

## 3. Scope

**In M3:**
- Google provider.
- emailOTP with HMAC-hashed codes.
- Resend OTP delivery.
- 30-day rolling sessions.
- Refusal of implicit linking, plus an explicit authenticated "Connect Google" (your decision).
- Blocked unused auth routes.
- Database-backed IP limits plus a per-email OTP quota.
- A server-only authorization DAL.
- `/app` and `/admin` gates.
- `/sign-in` and sign-out.
- An owner-grant CLI (your decision).
- Env, docs and CI.
- One forward migration (`0007`).

**Non-goals:**
- Cards, tokens and credentials (M4).
- Activation (M5).
- Account settings: change email, remove Google, sign out other sessions, delete account; and Profiles (M6).
- `/c/{token}` (M7).
- Business admin UI (M8).
- Recovery, consolidation, support, other emails (M9).
- OWNER MFA, CSP, Turnstile, tuning (M10).
- Production DB or deploy.
- `proxy.ts`. Deep-link `next` waits for it, since layouts can't see the pathname.

## 4. Architecture decisions

**A. One auth config, extended.** `authOptions({ db, secret, baseURL, google, sendAuthCode })` adds:
- `socialProviders.google`;
- the `emailOTP` plugin;
- `nextCookies()`, which must be the last plugin;
- `account`, `session`, `rateLimit`, `disabledPaths`, `hooks` and `databaseHooks`;
- `onAPIError.errorURL: "/sign-in"`;
- `telemetry:{enabled:false}`;
- `drizzleAdapter(..., { transaction: true })`, so OAuth Account and identity creation is atomic.

Tests inject the Google credentials and the email sender. There is no second Account model.

**B. Identity resolution:**

| Situation | Result |
|---|---|
| Email OTP, unknown email | New Account, `emailVerified=true`, role customer. The email method *is* `accounts.email`, so there is no identity row. |
| Email OTP, email belongs to an existing Account | That Account. |
| First Google sign-in, no matching email, `email_verified=true` | New Account + `auth_identities(google, sub)`, in one transaction. |
| Google with `email_verified=false`, not yet linked | Refused. `databaseHooks.user.create.before` returns false for any unverified email; the UI shows "Google didn't confirm this email". |
| Google identity already linked | Its Account, even after an email change. Account email and name are not overwritten. |
| New Google identity, email matches an existing Account | Refused → `/sign-in?error=account_not_linked`: "Sign in with an email code, then connect Google". |
| Signed in → "Connect Google" (`/link-social`, `errorCallbackURL:"/app"`) | Links only if Google's email equals the Account email and is verified, and the identity isn't owned by another Account (Better Auth conflict + DB unique index). |

Only error *codes* are shown. Google's `error_description` is never rendered.

**C. Tokens and identifiers stored:**
- `account.updateAccountOnSignIn:false`, plus `databaseHooks.account.create.before`, null Google `accessToken`/`refreshToken`/`idToken`. M3 never calls Google APIs.
- `verification.storeIdentifier:"hashed"` keeps plaintext emails out of OTP identifiers. A compatibility test in Task 4 checks that OAuth state and OTP still resolve; if the option breaks a flow, it's dropped and logged as a ruling.

**D. Abuse controls:**
- **OTP:**
  - `otpLength:6`, `expiresIn:300`, `allowedAttempts:3`;
  - `storeOTP:{ hash: otp => HMAC-SHA256(secret, otp) }`, because plain SHA-256 of a 6-digit code is trivially reversible.
- **Per-IP limits:** `rateLimit:{ enabled:true, storage:"database", window:60, max:100, customRules }` with:
  - `/email-otp/send-verification-otp` 10/min per IP;
  - `/sign-in/email-otp` 10/min per IP.

  Better Auth's default is 3/min, which would lock out people sharing Wi-Fi; brute force is still bounded by 3 attempts per code. Other built-in rules stay. Storage is the new `auth_rate_limits` table.
- **Per-email quota:** a `hooks.before` on `/email-otp/send-verification-otp`:
  - rejects any `type` other than `sign-in` (400), so no verification or password mail can ever be triggered;
  - enforces **3 sends per email per 10 minutes** in its own table, `auth_otp_quotas` (`key` = HMAC(secret, lowercased email) as the primary key, `count`, `window_started_at`). Better Auth's pruning can't touch it. One atomic upsert also deletes rows older than 10 minutes;
  - over the limit returns 429 with a generic message, the same for known and unknown emails.

**E. Exposed routes (allowlist):**
- **Allowed:**
  - `/sign-in/social`;
  - `/callback/:id`;
  - `/link-social`;
  - `/sign-in/email-otp`;
  - `/email-otp/send-verification-otp`;
  - `/sign-out`;
  - `/ok`.
- **Disabled:** everything else, via `disabledPaths`. That includes:
  - every password and reset route;
  - `/update-user`, `/change-email`, `/delete-user*`, `/unlink-account`;
  - `/list-accounts` and `/get-session` (read server-side instead, so the session token isn't served over HTTP);
  - `/error`, since `errorURL` is set;
  - session list and revoke (M6);
  - the email-otp verify, check, change and reset routes.
- **Parameterised route:** `/reset-password/:token` can't be matched by `disabledPaths`, so a `hooks.before` returns 404 for the `/reset-password/` prefix.
- **Upgrade guard:** a test enumerates every endpoint on the instance and asserts each is either allowlisted or 404. A future Better Auth upgrade that adds a route fails CI until it's classified.

**F. Sessions:**
- `expiresIn: 30 days` and `updateAge: 1 day`, rolling; `cookieCache` off, so sign-out and revocation take effect on the next request.
- Cookie defaults: HttpOnly, SameSite=Lax, and Secure with `__Secure-` on https. Local http has no Secure flag.
- **Server renders never mutate the session.** `getViewer` calls `auth.api.getSession({ headers, query:{ disableRefresh:true } })`.
- **Rolling refresh** happens in one server action, `refreshSession()` (`auth.api.getSession({ headers })`); nextCookies sets the cookie there. A tiny client `SessionKeepAlive` in the protected shells calls it once per mount.
- A test proves the cookie `Max-Age` is renewed after the `updateAge` boundary.
- **R5:** session tokens are stored as Better Auth issues them; 1.7.7 has no hashing option.

**G. Authorization DAL** — `src/auth/access.ts`, server-only:
- `getViewer()` is `cache()`-memoized. It returns a narrow `{accountId, email, role}` or null, and treats a non-verified email as no session (defense in depth).
- `requireAccount(area)` redirects to `/sign-in?next=/app` (or `/admin`).
- `requireOwner()` returns `notFound()` for non-owners, so the admin surface isn't revealed.
- `authorize(policy)` is for route handlers and server actions: a typed denial that handlers map to 401/403.
- Policies (`isOwner`, `ownsAccountResource`) live in that file only. There are no string comparisons elsewhere.
- `safeNext(raw)` accepts only paths under `/app` or `/admin`. It rejects `//`, `\`, schemes and encoded forms; anything else becomes `/app`.

**H. Gates and screens:**
- The `/app` and `/admin` layouts **and pages** use `export const instant = false` plus a top-level `await requireAccount()` / `requireOwner()`. There is no Suspense above the gate, so a document request gets a real redirect or 404 before any content.
- Pages check too, because layouts don't re-run on soft navigation.
- `/sign-in` reads `searchParams` and the viewer under `instant = false`. Its client form sits in `<Suspense>`.
- A Task 5 spike confirms that the build accepts this with `partialPrefetching`, and that `notFound()` returns a 404 status.

**I. Email boundary** — `src/integrations/email/`, server-only:
- `sendEmail({to, subject, text})` calls `fetch("https://api.resend.com/emails")` with a Bearer key and a **random** `Idempotency-Key` per send; plain text; no tracking.
- On failure it throws `Error("Email delivery failed")` with no body or code.
- `authCodeEmail(otp)` builds the message.
- Development and Preview send real mail (your decision). Until a domain is verified, Resend's test sender only reaches the Resend account owner's inbox. OTPs are never logged.

**J. Owner grant:**
- `pnpm accounts:set-role <email> <owner|customer>` (`scripts/set-account-role.ts`) goes through `parseMigrationEnv` and the isolation guard.
- In one transaction it finds the Account by lowercased email, updates `role`, and inserts `activity_events{type:'account_role_changed', account_id, note:'<old>→<new>'}`.
- It prints ids only.
- The role is never client-writable: Better Auth replaces a submitted `role` with the default, `/update-user` is disabled, and the create hook forces `customer`.

## 5. Route / access matrix

| Path | Visitor | Customer | Owner |
|---|---|---|---|
| `/`, `/api/health` | ✓ | ✓ | ✓ |
| `/sign-in` | ✓ | → `/app` | → `/app` |
| `/app/*` | → `/sign-in?next=/app` | ✓ own data only | ✓ |
| `/admin/*` | → `/sign-in?next=/admin` | 404 | ✓ |
| allowlisted `/api/auth/*` | ✓ (rate-limited, origin-checked) | ✓ | ✓ |
| other `/api/auth/*` | 404 | 404 | 404 |
| future handlers and actions | `authorize()` → 401 | policy | policy |

**Screens** (minimal, mobile-first):
- `/sign-in`:
  - "Continue with Google";
  - email → "Send code" → 6-digit code → "Sign in", with "Resend code";
  - generic error messages mapped from codes.
- `/app` shell:
  - the signed-in email;
  - linked sign-in methods (read server-side);
  - "Connect Google";
  - "Sign out";
  - an M6 placeholder.
- `/admin` shell: an "Owner area" placeholder and sign-out.

## 6. Files

| Path | Change |
|---|---|
| `src/config/env-schema.ts` (+test) | required `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM` (custom messages, never echoed) |
| `src/db/schema/auth.ts` | `authRateLimits` (`id`, `key` unique, `count`, `lastRequest` bigint) and `authOtpQuotas` (`key` PK, `count`, `windowStartedAt`) |
| `drizzle/0007_auth_abuse_limits.sql` (+meta) | generated forward migration; ERD regenerated |
| `src/auth/options.ts` | §4 A–F |
| `src/auth/otp-quota.ts` | quota upsert/cleanup and HMAC helpers |
| `src/auth/server.ts` | wire env and the Resend sender |
| `src/auth/access.ts` (+test) | DAL, policies, `safeNext` |
| `src/auth/actions.ts` | `"use server"` `refreshSession`, `signOut` |
| `src/auth/client.ts` | `createAuthClient` (`better-auth/react`) + `emailOTPClient()`; public, no secrets |
| `src/integrations/email/resend.ts`, `auth-code.ts` (+tests) | server-only email boundary |
| `src/app/(public)/sign-in/page.tsx`, `sign-in-form.tsx` | sign-in screen |
| `src/app/(customer)/app/layout.tsx`, `page.tsx`, `account-actions.tsx` | gate + minimal shell |
| `src/app/admin/layout.tsx`, `page.tsx` | owner gate + shell |
| `src/components/session-keep-alive.tsx` | calls `refreshSession` once per mount |
| `scripts/set-account-role.ts` + `package.json` | owner grant |
| `scripts/check-client-bundle.mjs` | scan `GOOGLE_CLIENT_SECRET` and `RESEND_API_KEY` |
| `src/server-only-boundary.test.ts` | add `access.ts`, `resend.ts` |
| `.env.example`, `README.md`, `src/modules/README.md`, `ci.yml` | names, runbook, CI dummy values |

**Migration:** exactly one, `0007`. It's additive; `0000`–`0006` are untouched.

## 7. Environment

| Var | Notes |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | One **dev/preview** OAuth client, consent screen in Testing mode with your Google accounts as test users. Redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://neffi-git-feat-m3-auth-iyawnnns-projects.vercel.app/api/auth/callback/google`. Google allows no wildcards. |
| `RESEND_API_KEY` | Dev/preview key, send-only. |
| `AUTH_EMAIL_FROM` | `Neffi <onboarding@resend.dev>` until a domain is verified. SPF/DKIM/DMARC is pre-pilot work. |

- Vercel: set these in Preview and Development only; Production stays empty.
- CI: synthetic dummy values.

## 8. Security invariants (each tested)

1. **Role:** never client-writable. Only the CLI grants OWNER.
2. **Origin and callbacks:**
   - an untrusted Origin with a cookie → 403;
   - untrusted `callbackURL` / `errorCallbackURL` / `newUserCallbackURL` → 403;
   - `next` goes through `safeNext`.
3. **No silent linking:**
   - a same-email new Google identity is refused, with no identity row written;
   - a different-email connect is refused;
   - an identity owned by another Account → conflict;
   - concurrent first callbacks can't leave an orphan Account (transaction).
4. **No passwords:** reset routes disabled (including `/reset-password/:token`), non-sign-in OTP types rejected, and no `credential` row after any flow.
5. **OTP:**
   - stored as HMAC, never the code;
   - single use;
   - the 4th attempt returns `TOO_MANY_ATTEMPTS`;
   - expires after 5 minutes;
   - per-email 3 per 10 minutes, unaffected by Better Auth's pruning;
   - per-IP 10/min;
   - identical responses for known and unknown emails.
6. **Sessions:**
   - a fresh token at every sign-in;
   - sign-out deletes the row;
   - a deleted or expired session gets no access;
   - server renders never mutate the session; the keep-alive renews `Max-Age`;
   - cookie attributes correct per environment;
   - the session token isn't exposed through `/get-session` (disabled).
7. **Authorization:**
   - unauthenticated `/app` → redirect;
   - customer `/admin` → 404 for both layout and page;
   - denials → 401/403;
   - `ownsAccountResource` rejects A→B.
8. **Secrets and logs:**
   - no secrets in client bundles;
   - no OTPs or tokens in URLs, logs or Sentry;
   - no Google tokens persisted;
   - no plaintext email in verification identifiers or quota keys.
9. **Preview:** only `neffi-dev` credentials, with the branch-URL base and origin.

## 9. Test strategy (TDD; HTTP-level through `auth.handler` on PGlite)

**Harness:** `createTestAuth()` builds the real `authOptions` on a fresh PGlite with a capturing `sendAuthCode` and test Google credentials. It mocks `fetch` for `https://oauth2.googleapis.com/token` to return an unsigned `id_token` built from a test profile. It replays the signed state cookie from `/sign-in/social` into `/callback/google`. Requests carry `origin`; each test uses a distinct `x-forwarded-for` so IP limits don't collide.

| File | Proves |
|---|---|
| `email-otp.db.test.ts` | stored value is the HMAC; sign-in creates a verified customer; same-email existing Account resolves; code is single-use; 3 wrong codes then `TOO_MANY_ATTEMPTS`; expiry (fake timers); identical responses for known and unknown emails; per-email 4th send → 429 even after Better Auth prunes its table; non-sign-in type → 400; IP 11th/min → 429 |
| `google.db.test.ts` | authorize URL contains the callback and scopes (no order asserted); new verified → Account + identity, no tokens stored; unverified → refused, no rows; same-email → `account_not_linked`, no identity; changed email after linking → same Account, email unchanged; connect: same email links, different refused, owned elsewhere → conflict |
| `sessions.db.test.ts` | cookie attributes on http and https; sign-out deletes the row; deleted or expired → no viewer; new token per sign-in; refresh after `updateAge` renews DB expiry and cookie `Max-Age`; `disableRefresh` read doesn't mutate |
| `routes.db.test.ts` | enumerated endpoints: allowlisted or 404 (incl. `/reset-password/:token`); `role` in bodies ignored; origin and callback rejections |
| `access.test.ts` | getViewer/require*/authorize with a stubbed session; `safeNext` cases (`//evil`, `https://evil`, `/\evil`, `%2F%2Fevil`, `javascript:`); A≠B policy |
| `integrations/email/*.test.ts` | Resend request shape; random idempotency key; failure leaks no body or code |
| `set-account-role.db.test.ts` | role + activity event in one transaction; unknown email → error, no write |
| env / boundary / bundle | new vars required and not echoed; server-only list; bundle scan covers the new secrets |

Existing auth tests stay green; `PROVIDER_NOT_FOUND` becomes "unknown provider → 404".

## 10. Tasks (dependency order; one commit each, plus review fixes)

- [ ] **0.** Branch `feat/m3-auth` from `main` in this checkout; copy the plan to `docs`; commit.
- [ ] **1. Env:** RED env tests → schema, `.env.example`, CI dummies, bundle-scan vars → `feat(config): Google and Resend auth environment`.
- [ ] **2. Abuse tables:** RED tests (Better Auth database rate limit persists; quota survives pruning) → `authRateLimits`, `authOtpQuotas`, `0007` generated and reviewed, ERD → `feat(db): auth rate-limit and OTP quota storage`.
- [ ] **3. Email boundary:** RED Resend and fake tests → `src/integrations/email` → `feat(email): server-only Resend boundary for auth codes`.
- [ ] **4. Auth config:** RED tests in sub-steps:
  1. OTP;
  2. quota/type hook;
  3. routes allowlist;
  4. Google + linking + token stripping;
  5. `storeIdentifier` compatibility;
  6. sessions and cookies.

  Then `options.ts`, `otp-quota.ts`, `server.ts` → `feat(auth): Google and email OTP sign-in with safe linking and abuse limits`. **Reviewer:** auth-security review of this diff.
- [ ] **5. DAL, gates and screens:** spike first (blocking gates + `/sign-in` under the build; 404 status). Then RED `access.test.ts` → `access.ts`, `actions.ts`, layouts and pages, `/sign-in`, shells, keep-alive, client → `feat(auth): server-side account/owner authorization and sign-in screens`.
- [ ] **6. Owner CLI:** RED → `set-account-role.ts` → `feat(accounts): guarded owner-role CLI`.
- [ ] **7. Docs:** README auth runbook (Google client, Resend, owner grant, Preview limits) and module map → `docs(auth): authentication runbook`.
- [ ] **8. 🔒 HARD STOP — live gate.** Ask you to confirm a `pre-m3` restore branch exists on `neffi-dev` and to approve the live migration. Then:
  - apply `0007`; rerun → no-op;
  - `db:check`;
  - read-only inspection;
  - manual `pnpm dev` checks: OTP to your inbox; Google sign-in; same-email refusal → OTP → Connect Google; sign-out; customer `/admin` → 404; CLI owner grant → `/admin`.
- [ ] **9. Final:** whole-branch review → fixes → fresh-clone verification → report.

  **No push, PR, merge, Vercel or Notion changes without approval.** The Preview check (branch alias + Vercel env) comes after you approve a push.

**Reviewers:** the Task 4 auth-security review and the final whole-branch review only.

## 11. Verification

- `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test` — all green.
- `db:generate` shows no drift; `db:check` passes; `db:erd` shows no diff.
- `build` + `check:bundle` with the real dev env.
- After the gate:
  - `db:migrate` twice;
  - read-only journal (8 rows) and table inspection;
  - the manual flows above.
- After push approval:
  - CI green;
  - Preview at the branch alias (OTP + Google, customer `/admin` → 404);
  - Production env still empty.

## 12. Definition of Done

- Google and email OTP sign-in work for real and are covered by HTTP-level tests.
- No duplicate Account for a verified email.
- Unsafe linking is refused; deliberate Connect Google works.
- No password or credential path exists.
- OTPs are HMAC-stored, single-use, expiring, attempt-limited, IP-limited and per-email-limited, all database-backed.
- Sessions roll for 30 days, are revocable, and use secure cookies on https. Renders don't mutate sessions.
- `/app` requires an Account and `/admin` requires OWNER, checked server-side in layouts and pages.
- The DAL and policies are tested, including A≠B and self-promotion attempts.
- OWNER is granted only by the guarded CLI, with an activity event.
- No Google tokens stored; secrets stay server-only.
- All prior tests and M1/M2 protections stay green.
- `0007` applied to `neffi-dev` after the gate.

## 13. Risks and decisions

**Decided by you:**
- Connect Google in M3.
- Real Resend in development.
- Owner CLI.
- 30-day rolling sessions.

**Planning review (independent, against installed source):** these findings are adopted above:
- H1: separate quota table;
- M1: no render refresh; server-action keep-alive;
- M2: adapter `transaction:true`;
- M3: strip Google tokens, hashed identifiers;
- M4: `/reset-password/:token` hook;
- M5: pages gate too;
- M6: `/sign-in` blocking/Suspense;
- L1: `/get-session` and `/list-accounts` disabled;
- L2: smaller allowlist;
- L3: error-code mapping, link `errorCallbackURL`;
- L4: HMAC OTP;
- L5: test wording, 10/min IP rule;
- L6: emailVerified assertion;
- L7: random idempotency key.

**Risks:**
- **R1 Preview and Google:** only registered branch URLs can finish Google sign-in. OTP works on any Preview URL equal to `BETTER_AUTH_URL`. Preview stays behind Vercel Authentication.
- **R2 Gate build behavior:** spiked in Task 5; the fallback is a Suspense-wrapped gate.
- **R3 IP source:** `x-forwarded-for` is trusted because Vercel sets it.
- **R4 Resend test sender:** reaches only the owner's inbox. A verified domain is needed before the pilot.
- **R5 Session tokens:** stored as issued; there's no hashing option in 1.7.7. Revisit in M10.
- **R6 OTP email under M9:** Step 8 lists "Resend-backed OTP" under M9. M3 ships only the minimal OTP sender it needs; M9 adds the security, recovery and support templates.
- **R7 Empty names:** OTP sign-ups get `accounts.name = ""`. The shells show the email.
- **R8 XSS exposure:** `/sign-in/email-otp` returns the session token in its JSON (Better Auth behavior). Only XSS could read it; CSP is M10.
