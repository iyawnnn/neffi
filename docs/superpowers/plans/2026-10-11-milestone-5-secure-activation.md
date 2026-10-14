# Milestone 5 — Secure Activation & Card Claiming Implementation Plan
> **Historical implementation plan — implemented and merged. This is not the current specification.** Current behavior is in [PRODUCT.md](../../../PRODUCT.md) and [docs/README.md](../../README.md). Where this plan disagrees with them, they win. The Google Review Card order-fulfilment lifecycle described here (Card reservation, NFC verification, release) was superseded by [decision 0006](../../decisions/0006-grc-simple-commercial-line.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is executor-independent: any capable agent (or human) must be able to execute it from repository state alone.

**Goal:** A customer scans the common package QR and enters the activation code on `/activate`. If needed, they sign in with Google or an email code. They then atomically claim exactly one Released Digital Business Card and land in a resumable handoff in `/app`, where M6 setup will begin.

**Architecture:** This extends the existing modular monolith. It adds no new subsystem, no dependency and no migration.
- **Code check:** the code is looked up only by HMAC, through M4 `activationLookup`.
- **Challenge:** a valid check sets a stateless, short-lived, HMAC-signed, HttpOnly cookie that carries only the credential id.
- **Sign-in:** reuses the M3 Better Auth Google and email OTP flows, returning to `/activate`.
- **Claim:** one PostgreSQL transaction. It locks the card row with `FOR UPDATE` (the M4 lock order), conditionally consumes the credential, sets the owner and records a `card_claimed` Activity Event.
- **Rate limits:** reuse the M3 HMAC-keyed quota table.

**Tech stack:**
- Next.js 16.4 App Router: Server Actions, `cookies()`, `export const instant = false`.
- React 19.3 `useActionState`.
- Better Auth 1.7.
- Drizzle 0.45 with PostgreSQL.
- Tests: vitest 5 with PGlite for the database, `react-dom/server` for page tests, and `node-postgres` two-session concurrency scripts.

**Spec:** the source of truth is the Notion workspace "Neffi — Business Hub". All pages were read fresh on 2026-10-11 and none were modified. Planning sources:
- AI Build Handoff — Read First
- Neffi — Locked Plan
- Step 2 — Product Definitions
- Step 3 — Order & Fulfillment
- Step 4 — System Objects
- Step 5 — Admin Pages & Capabilities
- Step 6 — Data Model & Integrity Rules
- Step 7 — Technical Architecture
- Step 8 — Implementation Plan (including the M4 Sequencing & Boundary Clarifications and the Deferred Hardware Acceptance Rule)
- Step 9 — Build & Physical Pilot
- Packaging & Activation Experience
- Mobile-First Design System
- Public Profile Templates

Precedence: Locked Plan → Step 7 → Step 8 → Step 9 → earlier Steps. Where Notion and this plan disagree, stop and raise it (see Change control).

**Baseline:** `main` @ `12cc2934e591c8e35a718c3c674cf53009033e73` (merged M4, contains `97205a0`). M4 status: **Software gate passed — physical hardware acceptance pending.** M5 proceeds under the Deferred Hardware Acceptance Rule.

---

## Execution & resumption protocol (read before every session)

1. **The canonical plan is this file:** `docs/superpowers/plans/2026-10-11-milestone-5-secure-activation.md` on branch `feat/m5-activation`. Copies elsewhere, including chat history and agent-local plan files, are not authoritative.
   - The planner has already done the precondition: created `feat/m5-activation` from `main` @ `12cc293` and committed this plan as `docs(m5): add secure activation implementation plan`. Executors start at Task 1.
   - There are 11 implementation tasks. Each code task ends in exactly one commit with the message given in that task, so `git log` alone shows which tasks were committed.
2. **The handoff is git history plus the local ledger.**
   - The ledger is `.superpowers/sdd/2026-10-11-milestone-5-secure-activation/progress.md`.
   - It stays **local and git-ignored**, through the existing `.git/info/exclude` entry for `.superpowers/`.
   - **Never** `git add -f` it, and never commit it. There are no ledger-only commits.
   - Each task's code commit, using the exact message given in that task, is the durable record in git. The ledger adds the checks, results, executor and rulings.
3. **Before starting any work:**
   - `git switch feat/m5-activation`
   - `git status --short`. It must be clean, since the ignored ledger does not appear. If it is not clean, stop and report.
   - `git log --oneline main..HEAD`
   - Read the whole ledger.
4. **The next task** is the lowest-numbered task without a `Status: complete` entry in the ledger. Never repeat a task that is marked complete.
5. **Recovery:** if `git log` shows a task's commit, using the exact commit message given in that task, but the ledger has no entry for it, for example because the ledger was lost or the session ended before recording:
   - do not redo the task;
   - re-run that task's verification commands;
   - record the entry with `Status: complete (recovered)`.

   Tasks 10 and 11 make no code commit unless a defect fix is needed. If their ledger entry is missing, re-run them; they are verification-only and safe to repeat.
6. **Recording a task:** immediately after each task's code commit, append its entry to the local ledger. Do not commit it. Use this format:
   ```
   ## Task N — <title>
   - Status: complete
   - Commit: <full SHA of the task's code commit | "none (verification only)">
   - Executor: <agent/human identifier>
   - Checks: <each command run> → <pass/fail + counts>
   - Result: <one line>
   - Rulings: <none | decision made and who approved it>
   ```
7. **Ledger bootstrap:** if the ledger file does not exist when Task 1 starts, create it with the header `# SDD ledger — plan: docs/superpowers/plans/2026-10-11-milestone-5-secure-activation.md` and the line `Plan commit: <SHA of "docs(m5): add secure activation implementation plan">`.
8. **Executor handoff:** if execution moves to a different executor, for example from Codex to Claude, the new executor follows steps 3–5. It resumes at the first task without a completion entry and does not rely on chat or context memory.
9. **Stop points that need the user:**
   - Task 10 needs a real Google account and email inbox.
   - Anything touching Neon, Notion, Vercel or Production.
   - Any push or PR.
   - Any deviation from this plan.

   Record each such approval under `Rulings`.
10. **Never record secrets in the ledger:** no activation codes, OTPs, cookies, session tokens or database URLs with passwords.
11. **Change control:** if the code or Notion contradicts this plan, stop, write the conflict in the ledger under a `Blocked` heading, and ask the user. Do not invent a workaround.

---

## 1. Reconciliation findings (code vs. request) — resolved

| Topic | Repository fact | Resolution |
|---|---|---|
| Claimable state | CHECK `cards_owner_only_after_sale`: an owner is allowed only when the state is `released` or `retired`. Released requires `order_item_id`. The release workflow is M8. | **User decision (2026-10-11): only Released DBCs are claimable.** The constraint is not relaxed and there is no temporary M5 release workflow. Development and tests use controlled local Released fixtures. |
| Claim timestamp / claimant | There is no `claimed_at` or `used_by` column. | Claim time is `activation_credentials.used_at` together with the `card_claimed` Activity Event. The claimant is `cards.owner_account_id` and the event's `accountId`. **No migration.** |
| Credential state | Credential state is derived: usable means both `used_at` and `revoked_at` are null. The guard trigger makes `used_at` and `revoked_at` write-once and blocks deletes. | Consume with a conditional `UPDATE … WHERE used_at IS NULL AND revoked_at IS NULL RETURNING`. |
| Lookup and consume services | Only `issueActivationCredential`, `usableCredential(cardId)` and `revokeUsableCredential` exist. | Add `checkActivationCode` and `claimCard` (Task 4). |
| Activity subject account | `recordActivity` input has no `accountId`. The seed's `card_claimed` row sets both `actorAccountId` and `accountId`. | Add an optional `accountId` field (Task 2). |
| Return to activation | `safeNext` allows only `/app` and `/admin`. The sign-in page sends signed-in visitors to `/app` and ignores `next`. | Allow `/activate` and honor `next` (Task 1). |
| App-level rate limit | Better Auth's limiter covers only `/api/auth/*` with 60-second windows. `consumeOtpQuota` is an atomic HMAC-keyed upsert on `auth_otp_quotas` with a 10-minute window. | Extract `consumeQuota` and reuse the table and window, using new key domains (Task 2). |
| Cookie utilities | No jose or iron-session. `hmacHex` exists. | The challenge uses `hmacHex` plus `timingSafeEqual` (Task 3). No dependency. |
| Account restriction | No status column. | Out of scope; this is M9/M10. |
| Routes | No `/activate` and no `/c/[token]`. `/app` is a shell. | Add `/activate` only. `/c/{token}` stays in M7. |
| E2E | No Playwright or E2E framework. | **User decision: scripted manual browser acceptance (Task 10). No `@playwright/test`.** |
| Support page | No `/support`; that is M9. | **User decision: plain support text until M9.** |
| Rendering | `/activate` reads the session and cookie, so it is dynamic. | `export const instant = false`, as on `sign-in/page.tsx`. Step 7 "light shell" is met by a single small Server Component page without heavy client JavaScript. |

## 2. Scope

**In M5:**
- `/activate`: code entry, server-side check, challenge cookie, inline sign-in, identity confirmation, atomic claim and repeat-scan behavior.
- Used-code routing: owner → `/app`; anyone else → safe support copy.
- Rate limits.
- Proof of a single winner under concurrency.
- `/app` Home additions: an "added" status line, a "Ready to set up" list (the M6 handoff and resume point) and an "Activate another Neffi" link.
- A dev fixture script for local Released cards.

**Explicitly not in M5. Reviewers reject any of these:**
- **M6:** Starter Experiences; Profile or identity creation and editing; Profile create or select; Scenes; Blocks; Forms; Form Submissions; Inbox; Theme or appearance; media upload; Sharing QR; Cards pages; Card→Profile routing; disable or re-enable.
- **M7:** `/c/{token}` and any public rendering.
- **M8:** release or reserve flows for DBCs; Orders UI.
- **M9:** `/support`; activation reset or reissue after release; wrong-account correction; account recovery.
- **M10:** Turnstile; limit tuning; `ACTIVATION_CODE_SECRET` rotation.

The Step 8 M5 item "Profile create/select handoff" is satisfied by routing the newly owned Card into `/app` Home under "Ready to set up". M6 attaches its setup entry to that item. M5 writes nothing to `profiles` and never sets `cards.profile_id`.

## 3. Schema / migration impact

**No migration.** The Task 11 gate proves this with `pnpm db:generate && git diff --exit-code drizzle`.

All claim invariants are already enforced by the database:
- unique `lookup_hmac`;
- one usable credential per card (partial unique index);
- write-once `used_at` and `revoked_at` (trigger);
- `activation_credentials_single_outcome`;
- `cards_owner_only_after_sale`;
- `cards_profile_owner_fk`;
- `cards_guard` (released → released or retired only);
- append-only `activity_events`.

**Why there is no challenge table:**
- The credential row is already the single-use state.
- Before a claim, a stolen challenge gives no more than the stolen package code, for at most 15 minutes.
- After a claim, any replay fails because the credential is used.
- A table would only add server-side revocation of a 15-minute cookie, which no threat here requires.

## 4. Final architecture decisions

| ID | Decision |
|---|---|
| D1 | Claimable means a DBC with `kind='dbc'`, `state='released'` and `owner_account_id IS NULL`, plus a usable credential. |
| D2 | Stateless challenge cookie `neffi_activation`. Value: `<credentialId>.<expiresAtMs>.<hmacHex(ACTIVATION_CODE_SECRET, "activation-challenge", "<credentialId>.<expiresAtMs>")>`. Attributes: `HttpOnly`; `SameSite=Lax` (must survive the top-level return from Google; Strict would drop it); `Path=/activate`; `Secure` when `env.authBaseUrl` starts with `https:`; `Max-Age=900`. Expiry is checked from the signed timestamp. The cookie never contains the code, Card id, token or owner. |
| D3 | TTL is 15 minutes: the 5-minute OTP lifetime, plus a resend, plus time to check email. |
| D4 | The claim always runs against the session read at claim time. The confirmation screen shows that identity. Nothing auto-claims on return from sign-in; the customer taps **Add to my account** (a POST Server Action). |
| D5 | Claim transaction (§6): the card row `FOR UPDATE` comes first, matching every M4 card mutation, so lock order is consistent and deadlock-free. |
| D6 | Rate limits use `consumeQuota` on `auth_otp_quotas` with the shared 10-minute window. Check: 20 attempts per client IP, key domain `activation-ip`. Every attempt counts, which also tracks failed attempts, before any database lookup. Claim: 10 per Account, key domain `activation-claim`. Keys are `hmacHex(ACTIVATION_CODE_SECRET, domain, value)`. These are starting values to tune in M10. No Turnstile, per Step 7. |
| D7 | Client IP is the first comma-separated value of `x-vercel-forwarded-for`, else `x-forwarded-for`, else `"unknown"`. This mirrors M3 `ipAddressHeaders`. |
| D8 | Code checks return two outward categories: **invalid** (malformed or unknown) and **unavailable** (used, revoked, not Released, or owned by someone else). The single exception is that a signed-in owner of the code's Card is redirected to `/app`. |
| D9 | Post-claim destination is `/app?added=1`. Home shows "Your Neffi has been added…" and lists owned DBCs with `profile_id IS NULL` under "Ready to set up". That list is the resume point. |
| D10 | Raw code handling: it appears only in the `checkCodeAction` POST body and in the input element's in-memory React state. It never appears in a URL, cookie, action return state, log, `console.*`, Activity note, localStorage or sessionStorage. |
| D11 | Copy uses plain language. The words HMAC, token, OAuth, transaction, challenge, credential and record never appear in UI copy. |

## 5. File map

| File | Action | Task |
|---|---|---|
| `src/auth/policy.ts`, `src/auth/policy.test.ts` | Modify | 1 |
| `src/app/(public)/sign-in/page.tsx` | Modify | 1 |
| `src/auth/otp-quota.ts` | Modify | 2 |
| `src/auth/otp-quota.db.test.ts` | Create | 2 |
| `src/modules/activity/record.ts` | Modify | 2 |
| `src/modules/activation/code.ts`, `code.test.ts` | Modify (export `sameLookup`) | 3 |
| `src/modules/cards/dbc.ts` | Modify (import `sameLookup`; behavior unchanged) | 3 |
| `src/modules/activation/challenge.ts`, `challenge.test.ts` | Create | 3 |
| `src/db/test-fixtures.ts` | Modify (`insertReleasedDbc`) | 4 |
| `src/modules/activation/claim.ts`, `claim.db.test.ts` | Create | 4 |
| `src/modules/cards/owned.ts` | Create | 4 |
| `src/server-only-boundary.test.ts` | Modify | 4, 6 |
| `scripts/check-claim-concurrency.mts`, `package.json` | Create, Modify | 5 |
| `src/app/(public)/activate/challenge-cookie.ts` | Create | 6 |
| `src/app/(public)/activate/actions.ts`, `actions.test.ts` | Create | 6 |
| `src/app/(public)/sign-in/sign-in-form.tsx` | Modify (export `inputClass`) | 7 |
| `src/app/(public)/activate/activate-forms.tsx` | Create | 7 |
| `src/app/(public)/activate/page.tsx`, `page.test.tsx` | Create | 7 |
| `src/app/(customer)/app/page.tsx` | Modify | 8 |
| `src/app/(customer)/app/page.test.tsx` | Create | 8 |
| `scripts/dev-activation-fixture.mts`, `package.json`, `README.md` | Create, Modify | 9 |
| `.superpowers/sdd/2026-10-11-milestone-5-secure-activation/progress.md` | Create and update locally (git-ignored, never committed) | every task |

## 6. Interfaces (exact; later tasks rely on these names)

```ts
// src/auth/otp-quota.ts
export async function consumeQuota(db: QuotaDb, key: string, limit: number, now?: Date): Promise<boolean>;
// existing, unchanged signature:
export async function consumeOtpQuota(db: QuotaDb, secret: string, email: string, now?: Date): Promise<boolean>;

// src/modules/activity/record.ts — ActivityInput gains:  accountId?: string;

// src/modules/activation/code.ts (pure)
export const sameLookup: (a: string, b: string) => boolean;   // constant-time; false on length mismatch

// src/modules/activation/challenge.ts (pure)
export const CHALLENGE_TTL_MS: number;   // 15 * 60_000
export function signChallenge(secret: string, credentialId: string, now?: Date): string;
export function verifyChallenge(secret: string, value: string | undefined, now?: Date): string | null;

// src/modules/activation/claim.ts (server-only)
export type CodeCheck =
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "yours"; cardId: string }
  | { status: "claimable"; credentialId: string };
export function checkActivationCode(db: Db, input: { secret: string; code: string; accountId?: string }): Promise<CodeCheck>;
export type ClaimResult = { status: "claimed" | "already_yours"; cardId: string } | { status: "unavailable" };
export function claimCard(db: Db, input: { credentialId: string; accountId: string }): Promise<ClaimResult>;

// src/modules/cards/owned.ts (server-only)
export type OwnedCard = { id: string; publicToken: string; profileId: string | null };
export function ownedCards(db: Db, accountId: string): Promise<OwnedCard[]>;

// src/db/test-fixtures.ts
export async function insertReleasedDbc(tx: TestTx): Promise<{ card; item; product; stock }>;

// src/app/(public)/activate/challenge-cookie.ts (server-only)
export async function readChallenge(): Promise<string | null>;
export async function setChallenge(credentialId: string): Promise<void>;
export async function clearChallenge(): Promise<void>;

// src/app/(public)/activate/actions.ts ("use server")
export type ActivateState = { error?: string };
export async function checkCodeAction(previous: ActivateState | undefined, data: FormData): Promise<ActivateState>;
export async function claimAction(previous: ActivateState | undefined, data: FormData): Promise<ActivateState>;
export async function switchAccountAction(): Promise<void>;
export async function startOverAction(): Promise<void>;

// src/app/(public)/activate/activate-forms.tsx ("use client")
export function CodeForm(): JSX.Element;
export function ClaimForm(): JSX.Element;
export function SwitchAccountButton(): JSX.Element;
export function StartOverButton(): JSX.Element;
```

**Claim transaction (`claimCard`, exact):**
```ts
export async function claimCard(db: Db, input: { credentialId: string; accountId: string }): Promise<ClaimResult> {
  return db.transaction(async (tx) => {
    const [credential] = await tx
      .select({ cardId: schema.activationCredentials.cardId })
      .from(schema.activationCredentials)
      .where(eq(schema.activationCredentials.id, input.credentialId));
    if (!credential) return { status: "unavailable" };
    // Card row first, like every M4 card mutation, so claim serializes with retire/replace and with other claims.
    const card = await lockCard(tx, credential.cardId);
    if (card.ownerAccountId === input.accountId) return { status: "already_yours", cardId: card.id };
    if (card.kind !== "dbc" || card.state !== "released" || card.ownerAccountId) return { status: "unavailable" };
    const [used] = await tx
      .update(schema.activationCredentials)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.activationCredentials.id, input.credentialId), isNull(schema.activationCredentials.usedAt), isNull(schema.activationCredentials.revokedAt)))
      .returning({ id: schema.activationCredentials.id });
    if (!used) return { status: "unavailable" };
    await tx.update(schema.cards).set({ ownerAccountId: input.accountId }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, { type: "card_claimed", actorAccountId: input.accountId, accountId: input.accountId, cardId: card.id });
    return { status: "claimed", cardId: card.id };
  });
}
```
- **At most one winner:** competing claims queue on the card lock. The second claim re-reads the committed owner.
- **All or nothing:** any error rolls back `used_at`, the owner and the event together. The credential is never consumed without ownership.
- **Isolation:** READ COMMITTED, as in M4. The README's `40001` retry note applies only above READ COMMITTED.

## 7. `/activate` behavior

The page is server-rendered from `getViewer()`, `readChallenge()` and a whitelisted `?notice=`.

| Viewer | Valid challenge | Heading and content |
|---|---|---|
| signed out | no | **Activate your Neffi**. Text: "Enter the activation code inside your package." Then `CodeForm`, then a link "Already activated? Sign in" → `/sign-in?next=/activate`. |
| signed in | no | **Activate another Neffi** if `ownedCards` is non-empty, otherwise **Activate your Neffi**. Text: "Signed in as {email}". Then `CodeForm`, then a link **Go to my Neffi** → `/app`. No auto-redirect. |
| signed out | yes | **Code accepted**. Text: "Sign in or create your account to add this Neffi. No password needed." Then `<SignInForm next="/activate" />`, then `StartOverButton` ("Enter a different code"). |
| signed in | yes | **Add this Neffi to your account**. Text: "You're signed in as {email}." Then `ClaimForm` ("Add to my account"), `SwitchAccountButton` ("Use a different account"), `StartOverButton`. |

| Action outcome | Effect |
|---|---|
| check → `claimable` | `setChallenge(credentialId)`, then `redirect("/activate")` |
| check → `yours` | `redirect("/app")` (no cookie set) |
| check → `invalid` | `{ error: MESSAGES.invalid }` |
| check → `unavailable` | `{ error: viewer ? MESSAGES.unavailable : MESSAGES.unavailableSignedOut }` |
| check → over quota | `{ error: MESSAGES.tooMany }` (no lookup) |
| claim → no session | `redirect("/activate")` (the page shows the sign-in step again) |
| claim → no or expired challenge | `redirect("/activate?notice=expired")` |
| claim → over quota | `{ error: MESSAGES.tooMany }` (challenge kept) |
| claim → `claimed` or `already_yours` | `clearChallenge()`, then `redirect("/app?added=1")` |
| claim → `unavailable` | `clearChallenge()`, then `redirect("/activate?notice=unavailable")` |
| switch account | `auth.api.signOut`, keep the challenge, `redirect("/activate")` |
| start over | `clearChallenge()`, then `redirect("/activate")` |

**Copy (exact strings).**
- `MESSAGES` in `actions.ts`:
  - `invalid`: "We couldn't find that code. Check the label inside your package and try again. If it still doesn't work, please contact Neffi support."
  - `unavailableSignedOut`: "This code can't be used. If you already added this Neffi, sign in to find it. Otherwise, please contact Neffi support for help."
  - `unavailable`: "This code can't be used. Please contact Neffi support for help."
  - `tooMany`: "Too many tries. Please wait a few minutes and try again."
- `NOTICES` in `page.tsx`:
  - `expired`: "For your security, please enter your code again."
  - `unavailable`: `MESSAGES.unavailable` when signed in, `MESSAGES.unavailableSignedOut` when signed out. The page copies these two strings verbatim, because a `"use server"` file can only export async functions.
- `/app`:
  - status: "Your Neffi has been added to your account. Next, you'll set it up."
  - section heading: "Ready to set up"
  - item: "Neffi ending in {last 4 of token} — waiting for setup"
  - link: "Activate another Neffi" when the Account owns a card, otherwise "Activate a Neffi"

## 8. Threat analysis

| Threat | Mitigation | Proven by |
|---|---|---|
| Brute-force guessing | 80-bit codes (16 Crockford chars from `crypto.randomInt`). 20 attempts per IP per 10 minutes, so a single IP needs about 10^17 years to cover the code space. | Task 6 quota test; math |
| Credential enumeration | HMAC-only lookup. Two generic outward categories. No Card, token, owner or partial-match data before authorization. One indexed query on every path. | Tasks 4 and 6 |
| Concurrent claims | Card `FOR UPDATE`, then conditional `used_at`. | Task 5 (real Postgres) |
| Replayed challenge | The credential is consumed at claim; a replay returns `unavailable` or `already_yours`. Signed 15-minute expiry. | Tasks 3, 4 and 6 |
| Stolen challenge cookie | HttpOnly, Secure, `Path=/activate`, 15 minutes, useless without an authenticated session. No stronger than holding the package code briefly. | Tasks 3 and 6 |
| Account switching mid-flow | The claim uses the session read at claim time. The confirm screen shows that identity. Switching is an explicit action. No auto-claim. | Tasks 6, 7 and 10F |
| CSRF | POST-only Server Actions (Next.js Origin check). Activation and session cookies are SameSite=Lax. No GET mutations. | Tasks 6 and 10 |
| Session fixation | Better Auth rotates the session at sign-in. The activation cookie is not an auth credential. | Design (M3) |
| Ownership exposure before claim | `yours` is computed only for the signed-in owner. Other paths never read or render owner or Card data. | Tasks 4 and 7 |
| Consuming a credential before ownership is committed | `used_at` is written only inside the claim transaction that writes the owner. The check never writes. | Task 4 ("checking never writes", rollback test) |
| Code leakage | POST body only. Never echoed or logged. Sentry already strips bodies and cookies (`src/lib/sentry-scrub.ts`). | Tasks 6, 10H and 11 |

## Global Constraints

- **Next.js 16.4.** Before Tasks 6–8, read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`, `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` and `node_modules/next/dist/docs/01-app/02-guides/authentication.md`. Cookies may be set or deleted only in Server Actions or Route Handlers, never during render.
- **Mobile-first at about 390px.** Controls use `h-11` (44px). Use a `max-w-sm` single column inside `<main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">`, matching `src/app/(public)/sign-in/page.tsx`.
- **`/activate` metadata:** `robots: { index: false, follow: false }` and `export const instant = false`.
- **No raw activation code** in any URL, query string, cookie, log, `console.*`, Activity note, action return state, localStorage or sessionStorage.
- **Nothing outside the plan:** no new dependency, no migration, no Neon, Notion, Vercel or Production mutation, and no push or PR.
- **Concurrency and fixture scripts** use loopback PostgreSQL only. They assert `current_setting('neon.project_id', true)` is empty and never load `.env.local`.
- **Server-only modules:** every new one starts with `import "server-only";` and is listed in `SERVER_ONLY_ENTRYPOINTS` in `src/server-only-boundary.test.ts`.
- **Repository style:** terse intent comments only, `MESSAGES` records for copy, `vi.hoisted` mocks, and `rollback(db, …)` database tests.
- **Physical evidence:** never fabricate physical NFC or package evidence.

## Review Focus

1. **A signed-in user enters a code owned by another Account.** Expect the generic signed-in unavailable copy and no owner hint. Covered by Task 4 ("a used code is unavailable to everyone but its owner") and Task 6 (copy table).
2. **Back or refresh after a successful claim.** `/activate` shows code entry because the cookie is cleared. A stale double-tap returns `already_yours` with a single event. Covered by Task 4 (repeated claim), Task 5 (double submit) and Task 10E.
3. **Lowercase, hyphens, spaces and O/I/L look-alikes.** All are accepted. Input over 64 chars is truncated before normalization, and non-string form values become `""`. Covered by Task 4 (spellings) and Task 6 (oversized and Blob input).
4. **The challenge expires while the confirm screen is open.** Expect `notice=expired` and code entry, never a 500. Covered by Task 6 (`readChallenge` → null) and Task 7 (notice rendering).
5. **Google sign-in is cancelled after "Code accepted".** Better Auth returns the user to `/sign-in?error=…`. The cookie (`Path=/activate`, 15 minutes) survives, so reopening `/activate` resumes at "Code accepted". This is known, accepted behavior, verified in Task 10E. Changing it would mean editing the shared `SignInForm` error callback, which M5 does not do.

---

## Task 1: Return to `/activate` after sign-in

**Files:**
- Modify `src/auth/policy.ts` (`safeNext`)
- Modify `src/auth/policy.test.ts`
- Modify `src/app/(public)/sign-in/page.tsx`

**Interfaces:**
- Consumes: `safeNext`, `getViewer`.
- Produces: `safeNext("/activate") === "/activate"`. A signed-in visitor to `/sign-in?next=/activate` is redirected to `/activate`.

- [ ] **Step 1: Write the failing test.** Append inside the existing `describe` block that tests `safeNext` in `src/auth/policy.test.ts`. If no such block exists, add `describe("safeNext activation return", () => { … })`.
```ts
test("returns to /activate after sign-in", () => {
  expect(safeNext("/activate")).toBe("/activate");
});

test.each([
  ["/activate?code=N8KF42PQ7XYZABCD", "/activate"],
  ["/activate/../admin", "/admin"],
  ["/activatex", "/app"],
  ["//evil.example/activate", "/app"],
  ["https://evil.example/activate", "/app"],
])("safeNext(%s) → %s", (raw, expected) => {
  expect(safeNext(raw)).toBe(expected);
});
```
The negative cases `/activatex`, `//evil.example/activate` and `https://evil.example/activate` must keep returning `"/app"`. The existing `safeNext` tests in this file already prove `/app` and `/admin` behavior; keep them unchanged.
- [ ] **Step 2: Verify it fails.** Run `pnpm vitest run src/auth/policy.test.ts`. Expected: FAIL. `expect(safeNext("/activate")).toBe("/activate")` receives `"/app"`. The query-string case fails the same way.
- [ ] **Step 3: Minimal implementation.**
  - In `src/auth/policy.ts`, change the roots array to `["/app", "/admin", "/activate"]`.
  - Change the comment above `safeNext` to: `// Post-sign-in destination. Only paths inside /app, /admin or /activate on this site are honored; everything else (other`.
  - In `src/app/(public)/sign-in/page.tsx`, move `const params = await searchParams;` and the `next` computation above the viewer check, and replace `if (await getViewer()) redirect("/app");` with `if (await getViewer()) redirect(next);`.
- [ ] **Step 4: Verify it passes.** Run `pnpm vitest run src/auth`. Expected: PASS, with all pre-existing auth tests still green.
- [ ] **Step 5: Commit.** `git add src/auth/policy.ts src/auth/policy.test.ts "src/app/(public)/sign-in/page.tsx" && git commit -m "feat(auth): allow returning to /activate after sign-in"`
- [ ] **Step 6: Ledger.** Create the local ledger if it is missing (protocol step 7), then append the Task 1 entry. Do not commit the ledger.

## Task 2: Reusable quota counter and Activity subject account

**Files:**
- Modify `src/auth/otp-quota.ts`
- Create `src/auth/otp-quota.db.test.ts`
- Modify `src/modules/activity/record.ts`

**Interfaces:**
- Produces: `consumeQuota(db, key, limit, now?)`. `consumeOtpQuota` behaves exactly as before. `ActivityInput.accountId?: string`.

- [ ] **Step 1: Write the failing test** in `src/auth/otp-quota.db.test.ts`:
```ts
import { beforeAll, expect, test } from "vitest";
import { createTestDb, type TestDb } from "@/db/testing";
import { consumeQuota, hmacHex, OTP_EMAIL_WINDOW_MS } from "./otp-quota";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const key = (value: string) => hmacHex("k".repeat(40), "activation-ip", value);

test("allows exactly `limit` hits per key within one window", async () => {
  const now = new Date("2026-10-11T00:00:00Z");
  const results = await Promise.all(Array.from({ length: 5 }, () => consumeQuota(db, key("198.51.100.1"), 3, now)));
  expect(results.filter(Boolean)).toHaveLength(3);
});

test("keys are independent", async () => {
  const now = new Date("2026-10-11T01:00:00Z");
  for (let i = 0; i < 3; i++) await consumeQuota(db, key("198.51.100.2"), 3, now);
  expect(await consumeQuota(db, key("198.51.100.2"), 3, now)).toBe(false);
  expect(await consumeQuota(db, key("198.51.100.3"), 3, now)).toBe(true);
});

test("a new window starts after the old one expires", async () => {
  const now = new Date("2026-10-11T02:00:00Z");
  for (let i = 0; i < 4; i++) await consumeQuota(db, key("198.51.100.4"), 3, now);
  expect(await consumeQuota(db, key("198.51.100.4"), 3, new Date(now.getTime() + OTP_EMAIL_WINDOW_MS + 1))).toBe(true);
});
```
- [ ] **Step 2: Verify it fails.** Run `pnpm vitest run src/auth/otp-quota.db.test.ts`. Expected: FAIL. `consumeQuota` is not exported (TypeError: consumeQuota is not a function).
- [ ] **Step 3: Minimal implementation** in `src/auth/otp-quota.ts`. Rename the existing function body to `consumeQuota(db: QuotaDb, key: string, limit: number, now = new Date())`, with `key` replacing the computed HMAC and `limit` replacing `OTP_EMAIL_LIMIT`. Then add:
```ts
export const consumeOtpQuota = (db: QuotaDb, secret: string, email: string, now = new Date()) =>
  consumeQuota(db, hmacHex(secret, "otp-email", email.toLowerCase()), OTP_EMAIL_LIMIT, now);
```
Replace the comment above `consumeQuota` with:
```ts
// Counts one hit for an HMAC key and says whether it is still within `limit`. One atomic upsert, so concurrent
// requests cannot both slip under. Shared by every 10-minute counter (OTP email, activation); keys are
// domain-separated HMACs, never raw emails or IPs, and expired rows are removed in the same pass.
```
In `src/modules/activity/record.ts`, add `accountId?: string;` to `ActivityInput`, after `cardId?: string;`.
- [ ] **Step 4: Verify it passes.** Run `pnpm vitest run src/auth src/modules`. Expected: PASS, including the existing `email-otp.db.test.ts` OTP quota behavior.
- [ ] **Step 5: Commit.** `git add src/auth/otp-quota.ts src/auth/otp-quota.db.test.ts src/modules/activity/record.ts && git commit -m "refactor(auth): share the HMAC-keyed quota counter; allow subject account on activity"`
- [ ] **Step 6: Ledger.** Append the Task 2 entry to the local ledger. Do not commit it.

## Task 3: Signed activation challenge (pure)

**Files:**
- Modify `src/modules/activation/code.ts`, `src/modules/activation/code.test.ts`, `src/modules/cards/dbc.ts`
- Create `src/modules/activation/challenge.ts`, `src/modules/activation/challenge.test.ts`

**Interfaces:**
- Consumes: `hmacHex`.
- Produces: `sameLookup`, `CHALLENGE_TTL_MS`, `signChallenge`, `verifyChallenge`.

- [ ] **Step 1: Write the failing tests.**

  Create `src/modules/activation/challenge.test.ts`:
```ts
import { expect, test } from "vitest";
import { CHALLENGE_TTL_MS, signChallenge, verifyChallenge } from "./challenge";

const SECRET = "s".repeat(40);
const ID = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const OTHER = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const T0 = new Date("2026-10-11T00:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

test("returns the credential id until it expires", () => {
  const value = signChallenge(SECRET, ID, T0);
  expect(CHALLENGE_TTL_MS).toBe(15 * 60_000);
  expect(verifyChallenge(SECRET, value, T0)).toBe(ID);
  expect(verifyChallenge(SECRET, value, at(CHALLENGE_TTL_MS - 1))).toBe(ID);
  expect(verifyChallenge(SECRET, value, at(CHALLENGE_TTL_MS))).toBeNull();
});

test.each([
  ["missing", () => undefined],
  ["empty", () => ""],
  ["garbage", () => "not-a-challenge"],
  ["extended expiry", () => {
    const [id, , signature] = signChallenge(SECRET, ID, T0).split(".");
    return `${id}.${T0.getTime() + 10 * CHALLENGE_TTL_MS}.${signature}`;
  }],
  ["swapped id", () => signChallenge(SECRET, ID, T0).replace(ID, OTHER)],
  ["other secret", () => signChallenge("t".repeat(40), ID, T0)],
  ["non-numeric expiry", () => `${ID}.soon.${"0".repeat(64)}`],
])("rejects %s", (_name, value) => {
  expect(verifyChallenge(SECRET, value(), T0)).toBeNull();
});

test("carries only the opaque id, an expiry and a signature", () => {
  expect(signChallenge(SECRET, ID, T0)).toMatch(/^[0-9a-f-]{36}\.\d+\.[0-9a-f]{64}$/);
});
```
  Append to `src/modules/activation/code.test.ts` (and add `sameLookup` to its import from `./code`):
```ts
test("sameLookup compares in constant time and tolerates length mismatch", () => {
  expect(sameLookup("a".repeat(64), "a".repeat(64))).toBe(true);
  expect(sameLookup("a".repeat(64), "b".repeat(64))).toBe(false);
  expect(sameLookup("a".repeat(64), "a".repeat(63))).toBe(false);
});
```
- [ ] **Step 2: Verify they fail.** Run `pnpm vitest run src/modules/activation`. Expected: FAIL (`./challenge` does not exist; `sameLookup` is not exported).
- [ ] **Step 3: Minimal implementation.**

  In `src/modules/activation/code.ts`, add `import { timingSafeEqual } from "node:crypto";` and:
```ts
// Constant-time comparison of two hex lookup values; unequal lengths are simply unequal.
export const sameLookup = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
```
  In `src/modules/cards/dbc.ts`, delete the local `sameLookup` constant and its `timingSafeEqual` import. Add `sameLookup` to the existing import from `"../activation/code"`.

  Create `src/modules/activation/challenge.ts`:
```ts
import { hmacHex } from "@/auth/otp-quota";
import { sameLookup } from "./code";

// Pure helpers (no server-only, no env): the secret is passed in by the caller.
// Proof that this browser entered a valid code recently. Carries only the credential id, never the code or the Card.
export const CHALLENGE_TTL_MS = 15 * 60_000;

const sign = (secret: string, body: string) => hmacHex(secret, "activation-challenge", body);

export function signChallenge(secret: string, credentialId: string, now = new Date()): string {
  const body = `${credentialId}.${now.getTime() + CHALLENGE_TTL_MS}`;
  return `${body}.${sign(secret, body)}`;
}

export function verifyChallenge(secret: string, value: string | undefined, now = new Date()): string | null {
  const [credentialId, expires, signature] = value?.split(".") ?? [];
  if (!credentialId || !expires || !/^\d+$/.test(expires) || !signature) return null;
  if (!sameLookup(signature, sign(secret, `${credentialId}.${expires}`))) return null;
  return Number(expires) > now.getTime() ? credentialId : null;
}
```
- [ ] **Step 4: Verify it passes.** Run `pnpm vitest run src/modules/activation src/modules/cards/dbc.db.test.ts`. Expected: PASS. M4 `matchPackage` tests unchanged.
- [ ] **Step 5: Commit.** `git add src/modules/activation src/modules/cards/dbc.ts && git commit -m "feat(activation): signed short-lived activation challenge"`
- [ ] **Step 6: Ledger.** Append the Task 3 entry to the local ledger. Do not commit it.

## Task 4: Code check, atomic claim and owned cards (domain)

**Files:**
- Modify `src/db/test-fixtures.ts`
- Create `src/modules/activation/claim.ts`, `src/modules/activation/claim.db.test.ts`, `src/modules/cards/owned.ts`
- Modify `src/server-only-boundary.test.ts`

**Interfaces:**
- Consumes: `normalizeActivationCode`, `activationLookup`, `issueActivationCredential`, `revokeUsableCredential`, `lockCard`, `recordActivity` (with `accountId`), `Db`.
- Produces: `checkActivationCode`, `claimCard`, `ownedCards`, `insertReleasedDbc` (§6).

- [ ] **Step 1: Add the fixture** to `src/db/test-fixtures.ts`, after `insertClaimedCard`:
```ts
// A DBC that was sold but not yet activated: released against an order item, no owner.
export async function insertReleasedDbc(tx: TestTx) {
  const { item, product } = await insertOrderItem(tx, "dbc");
  const stock = await insertStockPurchase(tx);
  const [card] = await tx
    .insert(cards)
    .values({ stockPurchaseId: stock.id, productId: product.id, kind: "dbc", state: "released", orderItemId: item.id, publicToken: syntheticToken() })
    .returning();
  return { card, item, product, stock };
}
```
- [ ] **Step 2: Write the failing tests** in `src/modules/activation/claim.db.test.ts`:
```ts
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { activationCredentials, activityEvents, cards } from "@/db/schema";
import { insertAccount, insertProvisioningDbc, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { ownedCards } from "../cards/owned";
import { checkActivationCode, claimCard } from "./claim";
import { formatActivationCode } from "./code";
import { issueActivationCredential, revokeUsableCredential } from "./credentials";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const SECRET = "s".repeat(40);
async function released(tx: TestTx) {
  const { card } = await insertReleasedDbc(tx);
  const { credentialId, code } = await issueActivationCredential(tx, card.id, SECRET);
  return { card, credentialId, code };
}
const check = (tx: TestTx, code: string, accountId?: string) => checkActivationCode(tx, { secret: SECRET, code, accountId });
const cardRow = async (tx: TestTx, id: string) => (await tx.select().from(cards).where(eq(cards.id, id)))[0];
const credentialRow = async (tx: TestTx, id: string) => (await tx.select().from(activationCredentials).where(eq(activationCredentials.id, id)))[0];
const claimEvents = async (tx: TestTx, cardId: string) =>
  (await tx.select().from(activityEvents).where(eq(activityEvents.cardId, cardId))).filter((event) => event.type === "card_claimed");

describe("checkActivationCode", () => {
  test("accepts every way a person may type the packaged code", () =>
    rollback(db, async (tx) => {
      const { code, credentialId } = await released(tx);
      const inputs = [code, formatActivationCode(code), `  ${formatActivationCode(code).toLowerCase()} `, code.replaceAll("0", "O").replaceAll("1", "l")];
      for (const input of inputs) expect(await check(tx, input)).toEqual({ status: "claimable", credentialId });
    }));

  test.each(["", "ABCD", "Z".repeat(16), "A".repeat(200), "!@#$%^&*()_+{}|:"])("%j is invalid", (input) =>
    rollback(db, async (tx) => {
      await released(tx);
      expect(await check(tx, input)).toEqual({ status: "invalid" });
    }));

  test("an unsold card's code is unavailable, whether in provisioning or Ready", () =>
    rollback(db, async (tx) => {
      const { card } = await insertProvisioningDbc(tx);
      const { code } = await issueActivationCredential(tx, card.id, SECRET);
      expect(await check(tx, code)).toEqual({ status: "unavailable" });
      await tx.update(cards).set({ state: "ready", nfcVerifiedAt: new Date(), packageMatchedAt: new Date() }).where(eq(cards.id, card.id));
      expect(await check(tx, code)).toEqual({ status: "unavailable" });
    }));

  test("a revoked code is unavailable", () =>
    rollback(db, async (tx) => {
      const { card, code } = await released(tx);
      await revokeUsableCredential(tx, card.id);
      expect(await check(tx, code, (await insertAccount(tx)).id)).toEqual({ status: "unavailable" });
    }));

  test("a used code is unavailable to everyone but its owner, who is told it is theirs", () =>
    rollback(db, async (tx) => {
      const { card, code, credentialId } = await released(tx);
      const owner = await insertAccount(tx);
      const other = await insertAccount(tx);
      await claimCard(tx, { credentialId, accountId: owner.id });
      expect(await check(tx, code)).toEqual({ status: "unavailable" });
      expect(await check(tx, code, other.id)).toEqual({ status: "unavailable" });
      expect(await check(tx, code, owner.id)).toEqual({ status: "yours", cardId: card.id });
    }));

  test("checking never writes", () =>
    rollback(db, async (tx) => {
      const { card, code, credentialId } = await released(tx);
      await check(tx, code, (await insertAccount(tx)).id);
      expect((await credentialRow(tx, credentialId)).usedAt).toBeNull();
      expect((await cardRow(tx, card.id)).ownerAccountId).toBeNull();
      expect(await claimEvents(tx, card.id)).toHaveLength(0);
    }));
});

describe("claimCard", () => {
  test("claims atomically: owner, consumed credential and one history event", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      const account = await insertAccount(tx);
      expect(await claimCard(tx, { credentialId, accountId: account.id })).toEqual({ status: "claimed", cardId: card.id });
      expect(await cardRow(tx, card.id)).toMatchObject({ ownerAccountId: account.id, profileId: null, state: "released" });
      const credential = await credentialRow(tx, credentialId);
      expect(credential.usedAt).toBeInstanceOf(Date);
      expect(credential.revokedAt).toBeNull();
      const events = await claimEvents(tx, card.id);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ actorAccountId: account.id, accountId: account.id, note: null });
    }));

  test("a repeated claim by the same account changes nothing", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      const account = await insertAccount(tx);
      await claimCard(tx, { credentialId, accountId: account.id });
      const usedAt = (await credentialRow(tx, credentialId)).usedAt;
      expect(await claimCard(tx, { credentialId, accountId: account.id })).toEqual({ status: "already_yours", cardId: card.id });
      expect((await credentialRow(tx, credentialId)).usedAt).toEqual(usedAt);
      expect(await claimEvents(tx, card.id)).toHaveLength(1);
    }));

  test("a second account cannot claim a claimed card", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      const first = await insertAccount(tx);
      await claimCard(tx, { credentialId, accountId: first.id });
      expect(await claimCard(tx, { credentialId, accountId: (await insertAccount(tx)).id })).toEqual({ status: "unavailable" });
      expect((await cardRow(tx, card.id)).ownerAccountId).toBe(first.id);
    }));

  test("a revoked credential cannot claim", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      await revokeUsableCredential(tx, card.id);
      expect(await claimCard(tx, { credentialId, accountId: (await insertAccount(tx)).id })).toEqual({ status: "unavailable" });
      expect((await cardRow(tx, card.id)).ownerAccountId).toBeNull();
    }));

  test("a card retired after the check cannot be claimed", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      await revokeUsableCredential(tx, card.id);
      await tx.update(cards).set({ state: "retired" }).where(eq(cards.id, card.id));
      expect(await claimCard(tx, { credentialId, accountId: (await insertAccount(tx)).id })).toEqual({ status: "unavailable" });
    }));

  test("an unknown credential id is unavailable", () =>
    rollback(db, async (tx) => {
      expect(await claimCard(tx, { credentialId: randomUUID(), accountId: (await insertAccount(tx)).id })).toEqual({ status: "unavailable" });
    }));

  test("a failure rolls back the whole claim", () =>
    rollback(db, async (tx) => {
      const { card, credentialId } = await released(tx);
      // No such account: the owner foreign key fails after the credential update inside the same transaction.
      await expect(claimCard(tx, { credentialId, accountId: randomUUID() })).rejects.toThrow();
      expect((await cardRow(tx, card.id)).ownerAccountId).toBeNull();
      expect((await credentialRow(tx, credentialId)).usedAt).toBeNull();
      expect(await claimEvents(tx, card.id)).toHaveLength(0);
    }));
});

test("ownedCards lists only the account's own cards", () =>
  rollback(db, async (tx) => {
    const { card, credentialId } = await released(tx);
    const owner = await insertAccount(tx);
    await claimCard(tx, { credentialId, accountId: owner.id });
    expect(await ownedCards(tx, owner.id)).toEqual([{ id: card.id, publicToken: card.publicToken, profileId: null }]);
    expect(await ownedCards(tx, (await insertAccount(tx)).id)).toEqual([]);
  }));
```
- [ ] **Step 3: Verify they fail.** Run `pnpm vitest run src/modules/activation/claim.db.test.ts`. Expected: FAIL (cannot resolve `./claim` and `../cards/owned`).
- [ ] **Step 4: Minimal implementation.**

  Create `src/modules/activation/claim.ts`:
```ts
import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import { lockCard } from "../cards/card";
import type { Db } from "../db";
import { activationLookup, normalizeActivationCode } from "./code";

export type CodeCheck =
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "yours"; cardId: string }
  | { status: "claimable"; credentialId: string };

export type ClaimResult = { status: "claimed" | "already_yours"; cardId: string } | { status: "unavailable" };

// Read-only. Outward answers stay generic; who owns a card is only ever revealed to that owner.
export async function checkActivationCode(db: Db, input: { secret: string; code: string; accountId?: string }): Promise<CodeCheck> {
  const code = normalizeActivationCode(input.code);
  if (!code) return { status: "invalid" };
  const [row] = await db
    .select({
      credentialId: schema.activationCredentials.id,
      usedAt: schema.activationCredentials.usedAt,
      revokedAt: schema.activationCredentials.revokedAt,
      cardId: schema.cards.id,
      kind: schema.cards.kind,
      state: schema.cards.state,
      ownerAccountId: schema.cards.ownerAccountId,
    })
    .from(schema.activationCredentials)
    .innerJoin(schema.cards, eq(schema.cards.id, schema.activationCredentials.cardId))
    .where(eq(schema.activationCredentials.lookupHmac, activationLookup(input.secret, code)));
  if (!row) return { status: "invalid" };
  if (input.accountId && row.ownerAccountId === input.accountId) return { status: "yours", cardId: row.cardId };
  const claimable = !row.usedAt && !row.revokedAt && row.kind === "dbc" && row.state === "released" && !row.ownerAccountId;
  return claimable ? { status: "claimable", credentialId: row.credentialId } : { status: "unavailable" };
}

// (claimCard: paste the exact body from §6 "Claim transaction".)
```
  Paste `claimCard` exactly as written in §6.

  Create `src/modules/cards/owned.ts`:
```ts
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";

export type OwnedCard = { id: string; publicToken: string; profileId: string | null };

// ponytail: capped at 50 for the Home summary; M6's Cards page owns pagination.
export async function ownedCards(db: Db, accountId: string): Promise<OwnedCard[]> {
  const rows = await db
    .select({ id: schema.cards.id, publicToken: schema.cards.publicToken, profileId: schema.cards.profileId })
    .from(schema.cards)
    .where(and(eq(schema.cards.ownerAccountId, accountId), eq(schema.cards.kind, "dbc")))
    .orderBy(desc(schema.cards.updatedAt))
    .limit(50);
  // An owned DBC is always provisioned, so it always has its permanent token (cards_dbc_token_when_provisioned).
  return rows.map((row) => ({ ...row, publicToken: row.publicToken! }));
}
```
  Add `"src/modules/activation/claim.ts"` and `"src/modules/cards/owned.ts"` to `SERVER_ONLY_ENTRYPOINTS` in `src/server-only-boundary.test.ts`.
- [ ] **Step 5: Verify it passes.** Run `pnpm vitest run src/modules src/db src/server-only-boundary.test.ts`. Expected: PASS. All new claim tests and all M2/M4 database tests are green.
- [ ] **Step 6: Commit.** `git add src/db/test-fixtures.ts src/modules/activation/claim.ts src/modules/activation/claim.db.test.ts src/modules/cards/owned.ts src/server-only-boundary.test.ts && git commit -m "feat(activation): HMAC code check and atomic card claim"`
- [ ] **Step 7: Ledger.** Append the Task 4 entry to the local ledger. Do not commit it.

## Task 5: Two-session claim concurrency proof (disposable loopback PostgreSQL only)

**Files:**
- Create `scripts/check-claim-concurrency.mts`
- Modify `package.json`

**Interfaces:**
- Consumes: `claimCard`, `issueActivationCredential`.
- Produces: the npm script `check:claim-concurrency`.

- [ ] **Step 1: Start a disposable cluster** if one is not already running on `127.0.0.1:55432`. Never touch the machine's existing PostgreSQL service. These are Git Bash commands; the binaries on this machine are in `C:\Program Files\PostgreSQL\18\bin`, so adjust `PGBIN` elsewhere.
```bash
PGBIN="/c/Program Files/PostgreSQL/18/bin"; SCRATCH="<executor scratch dir>/pg-m5"
"$PGBIN/initdb" -D "$SCRATCH" -U postgres --auth=trust -E UTF8
"$PGBIN/pg_ctl" -D "$SCRATCH" -o "-p 55432 -c listen_addresses=127.0.0.1" -l "$SCRATCH.log" start
"$PGBIN/createdb" -h 127.0.0.1 -p 55432 -U postgres neffi_m2_test
"$PGBIN/createdb" -h 127.0.0.1 -p 55432 -U postgres neffi_m5_dev
```
  Stop it after Task 11 with `"$PGBIN/pg_ctl" -D "$SCRATCH" stop`.
- [ ] **Step 2: Write the script** `scripts/check-claim-concurrency.mts`. The red-green signal is the script itself: run it before `claimCard` exists and it fails to import. Task 4 already provides `claimCard`, so here the script must pass on the first run. If it fails, that is a real defect in Task 4: fix it there and re-record Task 4 in the ledger.
```ts
// Real-PostgreSQL proof that a card can be claimed at most once. Disposable loopback database only (never Neon,
// never .env.local). PGlite cannot hold two sessions open, so concurrent claims and lock waits are proved here.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../src/db/schema";
import { claimCard, type ClaimResult } from "../src/modules/activation/claim";
import { issueActivationCredential } from "../src/modules/activation/credentials";

const url = new URL(process.env.DATABASE_URL_TEST ?? "");
assert.equal(url.hostname, "127.0.0.1", "Concurrency checks require a disposable loopback database");
assert.equal(url.pathname, "/neffi_m2_test");
assert(["postgres:", "postgresql:"].includes(url.protocol));
assert(![...url.searchParams.keys()].some((key) => ["host", "hostaddr", "port"].includes(key)));

const SECRET = "c".repeat(40);
const clients: pg.Client[] = [];
const pools: pg.Pool[] = [];
const failures: string[] = [];

const connect = async () => {
  const client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  await client.connect();
  await client.query("SET statement_timeout = '15s'");
  clients.push(client);
  return client;
};
const database = () => {
  const pool = new pg.Pool({ connectionString: url.href, max: 2 });
  pools.push(pool);
  return drizzle({ client: pool, schema, casing: "snake_case" });
};
const settle = <T,>(promise: Promise<T>) => {
  const state = { done: false, error: undefined as unknown, value: undefined as T | undefined };
  const finished = promise.then(
    (value) => ((state.done = true), (state.value = value)),
    (error) => ((state.done = true), (state.error = error)),
  );
  return { state, finished };
};
async function check(label: string, run: () => Promise<void>) {
  try {
    await run();
    console.log(`PASS ${label}`);
  } catch (error) {
    failures.push(label);
    console.error(`FAIL ${label}: ${error instanceof assert.AssertionError ? error.message : "database error"}`);
  }
}

try {
  const admin = await connect();
  const { rows: [server] } = await admin.query("SELECT current_setting('neon.project_id', true) AS neon");
  assert(!server.neon, "Concurrency checks must never target Neon");
  const [dbA, dbB] = [database(), database()];
  await migrate(dbA, { migrationsFolder: "drizzle" });

  const [owner, a, b, product, stock, purchaser, order, item] = Array.from({ length: 8 }, () => randomUUID());
  await admin.query("INSERT INTO accounts(id,name,email) VALUES ($1,'Synthetic owner',$4),($2,'Synthetic A',$5),($3,'Synthetic B',$6)", [
    owner, a, b, `${owner}@example.test`, `${a}@example.test`, `${b}@example.test`,
  ]);
  // Inactive so it never disturbs the one-active-product-per-kind rule other checks rely on.
  await admin.query("INSERT INTO products(id,kind,name,price,active) VALUES ($1,'dbc','Synthetic DBC',100,false)", [product]);
  await admin.query("INSERT INTO stock_purchases(id,received_on,created_by_account_id) VALUES ($1,'2026-10-11',$2)", [stock, owner]);
  await admin.query("INSERT INTO purchasers(id,name) VALUES ($1,'Synthetic purchaser')", [purchaser]);
  await admin.query("INSERT INTO orders(id,purchaser_id,created_by_account_id,assigned_to_account_id) VALUES ($1,$2,$3,$3)", [order, purchaser, owner]);
  await admin.query("INSERT INTO order_items(id,order_id,product_id,product_kind,quantity,unit_price) VALUES ($1,$2,$3,'dbc',100,100)", [item, order, product]);

  const releasedCard = async () => {
    const cardId = randomUUID();
    const token = `CLAIM${randomUUID().replaceAll("-", "").slice(0, 21).toUpperCase()}`;
    await admin.query(
      "INSERT INTO cards(id,stock_purchase_id,product_id,kind,state,order_item_id,public_token) VALUES ($1,$2,$3,'dbc','released',$4,$5)",
      [cardId, stock, product, item, token],
    );
    const { credentialId } = await issueActivationCredential(dbA, cardId, SECRET);
    return { cardId, credentialId };
  };
  const ownerOf = async (cardId: string) => (await admin.query("SELECT owner_account_id AS o FROM cards WHERE id=$1", [cardId])).rows[0].o;
  const claimEvents = async (cardId: string) =>
    (await admin.query("SELECT count(*)::int AS n FROM activity_events WHERE card_id=$1 AND type='card_claimed'", [cardId])).rows[0].n;

  // A holder session takes the card row lock; the claim must wait for it, then act on what the holder decided.
  const blockedClaim = async (cardId: string, credentialId: string, accountId: string, holderWork: (holder: pg.Client) => Promise<void>) => {
    const holder = await connect();
    const { rows: [{ pid }] } = await holder.query("SELECT pg_backend_pid() AS pid");
    await holder.query("BEGIN");
    await holder.query("SELECT id FROM cards WHERE id = $1 FOR UPDATE", [cardId]);
    const pending = settle(claimCard(dbA, { credentialId, accountId }));
    let blocked = false;
    for (const deadline = Date.now() + 5000; !pending.state.done && !blocked && Date.now() < deadline; ) {
      const { rows: [row] } = await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))", [pid]);
      blocked = row.n > 0;
      if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert(blocked && !pending.state.done, "The claim must wait for the card row lock");
    await holderWork(holder);
    await pending.finished;
    if (pending.state.error) throw pending.state.error;
    return pending.state.value as ClaimResult;
  };

  await check("two accounts claiming one card: exactly one wins", async () => {
    const { cardId, credentialId } = await releasedCard();
    const results = await Promise.all([claimCard(dbA, { credentialId, accountId: a }), claimCard(dbB, { credentialId, accountId: b })]);
    assert.deepEqual(results.map((r) => r.status).sort(), ["claimed", "unavailable"]);
    assert.equal(await ownerOf(cardId), results[0].status === "claimed" ? a : b);
    assert.equal(await claimEvents(cardId), 1);
    const { rows: [credential] } = await admin.query("SELECT used_at IS NOT NULL AS used, revoked_at IS NULL AS unrevoked FROM activation_credentials WHERE id=$1", [credentialId]);
    assert(credential.used && credential.unrevoked);
  });

  await check("one account submitting twice at once: one claim, one already-yours", async () => {
    const { cardId, credentialId } = await releasedCard();
    const results = await Promise.all([claimCard(dbA, { credentialId, accountId: a }), claimCard(dbB, { credentialId, accountId: a })]);
    assert.deepEqual(results.map((r) => r.status).sort(), ["already_yours", "claimed"]);
    assert.equal(await ownerOf(cardId), a);
    assert.equal(await claimEvents(cardId), 1);
  });

  await check("a claim waiting on the card lock sees a revocation committed meanwhile", async () => {
    const { cardId, credentialId } = await releasedCard();
    const result = await blockedClaim(cardId, credentialId, a, async (holder) => {
      await holder.query("UPDATE activation_credentials SET revoked_at = now() WHERE id = $1", [credentialId]);
      await holder.query("COMMIT");
    });
    assert.deepEqual(result, { status: "unavailable" });
    assert.equal(await ownerOf(cardId), null);
    assert.equal(await claimEvents(cardId), 0);
  });

  await check("a claim waiting behind a competing owner write that rolls back still wins", async () => {
    const { cardId, credentialId } = await releasedCard();
    const result = await blockedClaim(cardId, credentialId, a, async (holder) => {
      await holder.query("UPDATE cards SET owner_account_id = $2 WHERE id = $1", [cardId, b]);
      await holder.query("ROLLBACK");
    });
    assert.deepEqual(result, { status: "claimed", cardId });
    assert.equal(await ownerOf(cardId), a);
    assert.equal(await claimEvents(cardId), 1);
  });

  assert.equal(failures.length, 0, `${failures.length} claim concurrency checks failed`);
  console.log("All claim concurrency checks passed.");
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  await Promise.all(clients.map((client) => client.end()));
}
```
  In `package.json` `scripts`, add after `check:provisioning-concurrency`:
  `"check:claim-concurrency": "node --conditions=react-server --import tsx scripts/check-claim-concurrency.mts",`
- [ ] **Step 3: Run it.** `DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test pnpm check:claim-concurrency`. Expected: 4 `PASS` lines, then "All claim concurrency checks passed.", exit 0.
- [ ] **Step 4: M4 regression.** Run `DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test pnpm check:provisioning-concurrency` and `… pnpm check:db-concurrency`. Expected: all PASS.
- [ ] **Step 5: Guard check.** Run `DATABASE_URL_TEST=postgres://postgres@db.example.com:5432/neffi_m2_test pnpm check:claim-concurrency`. Expected: an assertion error mentioning a loopback database, with no connection attempted.
- [ ] **Step 6: Commit.** `git add scripts/check-claim-concurrency.mts package.json && git commit -m "test(activation): prove one winner under concurrent claims"`
- [ ] **Step 7: Ledger.** Append the Task 5 entry, including the four PASS labels, to the local ledger. Do not commit it.

## Task 6: Server boundary — challenge cookie and Server Actions

**Files:**
- Create `src/app/(public)/activate/challenge-cookie.ts`, `src/app/(public)/activate/actions.ts`, `src/app/(public)/activate/actions.test.ts`
- Modify `src/server-only-boundary.test.ts`

**Interfaces:**
- Consumes: `authorize`, `getViewer`, `auth.api.signOut`, `db`, `env.activationCodeSecret`, `env.authBaseUrl` (always a string after `parseServerEnv`), `consumeQuota`, `hmacHex`, `checkActivationCode`, `claimCard`, `signChallenge`, `verifyChallenge`, `CHALLENGE_TTL_MS`.
- Produces: everything in §6 under `challenge-cookie.ts` and `actions.ts`.

- [ ] **Step 1: Read the Next.js 16 docs** listed in Global Constraints (cookies and server-actions).
- [ ] **Step 2: Write the failing tests** in `src/app/(public)/activate/actions.test.ts`:
```ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import { hmacHex } from "@/auth/otp-quota";

const SECRET = "s".repeat(40);
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const CREDENTIAL = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const CARD = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const CODE = "N8KF-42PQ-7XYZ-ABCD";
const VIEWER = { accountId: ACCOUNT, email: "a@example.test", role: "customer" as const };
const DB = { sentinel: true };

const m = vi.hoisted(() => ({
  authorize: vi.fn(), getViewer: vi.fn(), signOut: vi.fn(), consumeQuota: vi.fn(), headers: vi.fn(),
  checkActivationCode: vi.fn(), claimCard: vi.fn(), readChallenge: vi.fn(), setChallenge: vi.fn(), clearChallenge: vi.fn(),
}));
vi.mock("@/auth/access", () => ({ authorize: m.authorize, getViewer: m.getViewer }));
vi.mock("@/auth/server", () => ({ auth: { api: { signOut: m.signOut } } }));
vi.mock("@/auth/otp-quota", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/auth/otp-quota")>()), consumeQuota: m.consumeQuota }));
vi.mock("@/db", () => ({ db: { sentinel: true } }));
vi.mock("@/config/env", () => ({ env: { activationCodeSecret: "s".repeat(40) } }));
vi.mock("next/headers", () => ({ headers: m.headers }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("./challenge-cookie", () => ({ readChallenge: m.readChallenge, setChallenge: m.setChallenge, clearChallenge: m.clearChallenge }));
vi.mock("@/modules/activation/claim", () => ({ checkActivationCode: m.checkActivationCode, claimCard: m.claimCard }));

const actions = await import("./actions");

const TOO_MANY = "Too many tries. Please wait a few minutes and try again.";
const form = (code?: string | Blob) => {
  const data = new FormData();
  if (code !== undefined) data.set("code", code);
  return data;
};
const expectRedirect = (promise: Promise<unknown>, url: string) => expect(promise).rejects.toMatchObject({ message: `REDIRECT:${url}` });

beforeEach(() => {
  vi.clearAllMocks();
  m.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }));
  m.consumeQuota.mockResolvedValue(true);
  m.getViewer.mockResolvedValue(null);
  m.authorize.mockResolvedValue({ ok: true, viewer: VIEWER });
  m.readChallenge.mockResolvedValue(CREDENTIAL);
});

describe("checkCodeAction", () => {
  test("is limited per client IP before any lookup", async () => {
    m.consumeQuota.mockResolvedValue(false);
    expect(await actions.checkCodeAction(undefined, form(CODE))).toEqual({ error: TOO_MANY });
    expect(m.consumeQuota).toHaveBeenCalledWith(DB, hmacHex(SECRET, "activation-ip", "203.0.113.9"), 20);
    expect(m.checkActivationCode).not.toHaveBeenCalled();
  });

  test("prefers the platform IP header", async () => {
    m.headers.mockResolvedValue(new Headers({ "x-vercel-forwarded-for": "198.51.100.7", "x-forwarded-for": "203.0.113.9" }));
    m.checkActivationCode.mockResolvedValue({ status: "invalid" });
    await actions.checkCodeAction(undefined, form(CODE));
    expect(m.consumeQuota).toHaveBeenCalledWith(DB, hmacHex(SECRET, "activation-ip", "198.51.100.7"), 20);
  });

  test("a claimable code sets the challenge and reloads /activate", async () => {
    m.checkActivationCode.mockResolvedValue({ status: "claimable", credentialId: CREDENTIAL });
    await expectRedirect(actions.checkCodeAction(undefined, form(CODE)), "/activate");
    expect(m.checkActivationCode).toHaveBeenCalledWith(DB, { secret: SECRET, code: CODE, accountId: undefined });
    expect(m.setChallenge).toHaveBeenCalledWith(CREDENTIAL);
  });

  test("the signed-in owner of a used code goes to their Neffi", async () => {
    m.getViewer.mockResolvedValue(VIEWER);
    m.checkActivationCode.mockResolvedValue({ status: "yours", cardId: CARD });
    await expectRedirect(actions.checkCodeAction(undefined, form(CODE)), "/app");
    expect(m.checkActivationCode).toHaveBeenCalledWith(DB, { secret: SECRET, code: CODE, accountId: ACCOUNT });
    expect(m.setChallenge).not.toHaveBeenCalled();
  });

  test.each([
    ["invalid", null, "We couldn't find that code. Check the label inside your package and try again. If it still doesn't work, please contact Neffi support."],
    ["unavailable", null, "This code can't be used. If you already added this Neffi, sign in to find it. Otherwise, please contact Neffi support for help."],
    ["unavailable", VIEWER, "This code can't be used. Please contact Neffi support for help."],
  ])("%s (viewer %#) returns generic copy and never echoes the code", async (status, viewer, error) => {
    m.getViewer.mockResolvedValue(viewer);
    m.checkActivationCode.mockResolvedValue({ status });
    const state = await actions.checkCodeAction(undefined, form(CODE));
    expect(state).toEqual({ error });
    expect(JSON.stringify(state)).not.toMatch(/N8KF|42PQ|7XYZ|ABCD/);
    expect(m.setChallenge).not.toHaveBeenCalled();
  });

  test("oversized and non-text input are bounded before the lookup", async () => {
    m.checkActivationCode.mockResolvedValue({ status: "invalid" });
    await actions.checkCodeAction(undefined, form("A".repeat(500)));
    expect(m.checkActivationCode.mock.calls[0][1].code).toHaveLength(64);
    await actions.checkCodeAction(undefined, form(new Blob(["N8KF"])));
    expect(m.checkActivationCode.mock.calls[1][1].code).toBe("");
    await actions.checkCodeAction(undefined, form());
    expect(m.checkActivationCode.mock.calls[2][1].code).toBe("");
  });
});

describe("claimAction", () => {
  test("signed out returns to /activate without claiming", async () => {
    m.authorize.mockResolvedValue({ ok: false, denial: { status: 401, error: "unauthenticated" } });
    await expectRedirect(actions.claimAction(undefined, form()), "/activate");
    expect(m.claimCard).not.toHaveBeenCalled();
  });

  test("an expired challenge asks for the code again", async () => {
    m.readChallenge.mockResolvedValue(null);
    await expectRedirect(actions.claimAction(undefined, form()), "/activate?notice=expired");
    expect(m.claimCard).not.toHaveBeenCalled();
  });

  test("is limited per account and keeps the challenge", async () => {
    m.consumeQuota.mockResolvedValue(false);
    expect(await actions.claimAction(undefined, form())).toEqual({ error: TOO_MANY });
    expect(m.consumeQuota).toHaveBeenCalledWith(DB, hmacHex(SECRET, "activation-claim", ACCOUNT), 10);
    expect(m.claimCard).not.toHaveBeenCalled();
    expect(m.clearChallenge).not.toHaveBeenCalled();
  });

  test.each(["claimed", "already_yours"])("%s clears the challenge and hands off to /app", async (status) => {
    m.claimCard.mockResolvedValue({ status, cardId: CARD });
    await expectRedirect(actions.claimAction(undefined, form()), "/app?added=1");
    expect(m.claimCard).toHaveBeenCalledWith(DB, { credentialId: CREDENTIAL, accountId: ACCOUNT });
    expect(m.clearChallenge).toHaveBeenCalledOnce();
  });

  test("unavailable clears the challenge and explains safely", async () => {
    m.claimCard.mockResolvedValue({ status: "unavailable" });
    await expectRedirect(actions.claimAction(undefined, form()), "/activate?notice=unavailable");
    expect(m.clearChallenge).toHaveBeenCalledOnce();
  });
});

test("switching account signs out but keeps the accepted code", async () => {
  await expectRedirect(actions.switchAccountAction(), "/activate");
  expect(m.signOut).toHaveBeenCalledWith({ headers: expect.any(Headers) });
  expect(m.clearChallenge).not.toHaveBeenCalled();
});

test("starting over forgets the accepted code", async () => {
  await expectRedirect(actions.startOverAction(), "/activate");
  expect(m.clearChallenge).toHaveBeenCalledOnce();
});
```
- [ ] **Step 3: Verify they fail.** Run `pnpm vitest run "src/app/(public)/activate/actions.test.ts"`. Expected: FAIL (cannot resolve `./actions`).
- [ ] **Step 4: Minimal implementation.**

  Create `src/app/(public)/activate/challenge-cookie.ts`:
```ts
import "server-only";
import { cookies } from "next/headers";
import { env } from "@/config/env";
import { CHALLENGE_TTL_MS, signChallenge, verifyChallenge } from "@/modules/activation/challenge";

const NAME = "neffi_activation";

// The credential id of a code this browser entered within the last 15 minutes, or null.
export async function readChallenge(): Promise<string | null> {
  return verifyChallenge(env.activationCodeSecret, (await cookies()).get(NAME)?.value);
}

// Lax so it survives the top-level return from Google; scoped to /activate so no other route ever receives it.
export async function setChallenge(credentialId: string): Promise<void> {
  (await cookies()).set(NAME, signChallenge(env.activationCodeSecret, credentialId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/activate",
    secure: env.authBaseUrl.startsWith("https:"),
    maxAge: CHALLENGE_TTL_MS / 1000,
  });
}

export async function clearChallenge(): Promise<void> {
  (await cookies()).delete({ name: NAME, path: "/activate" });
}
```
  Create `src/app/(public)/activate/actions.ts`:
```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authorize, getViewer } from "@/auth/access";
import { consumeQuota, hmacHex } from "@/auth/otp-quota";
import { auth } from "@/auth/server";
import { env } from "@/config/env";
import { db } from "@/db";
import { checkActivationCode, claimCard } from "@/modules/activation/claim";
import { clearChallenge, readChallenge, setChallenge } from "./challenge-cookie";

export type ActivateState = { error?: string };

const CHECKS_PER_IP = 20;
const CLAIMS_PER_ACCOUNT = 10;
const MESSAGES = {
  invalid: "We couldn't find that code. Check the label inside your package and try again. If it still doesn't work, please contact Neffi support.",
  unavailableSignedOut: "This code can't be used. If you already added this Neffi, sign in to find it. Otherwise, please contact Neffi support for help.",
  unavailable: "This code can't be used. Please contact Neffi support for help.",
  tooMany: "Too many tries. Please wait a few minutes and try again.",
};

// Same trusted headers as Better Auth's limiter (src/auth/options.ts); Vercel overwrites both.
const clientIp = (h: Headers) => (h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
const quotaKey = (domain: string, value: string) => hmacHex(env.activationCodeSecret, domain, value);

// The code arrives only in this POST body. It is never echoed back, logged, stored or put in a URL.
export async function checkCodeAction(_previous: ActivateState | undefined, data: FormData): Promise<ActivateState> {
  if (!(await consumeQuota(db, quotaKey("activation-ip", clientIp(await headers())), CHECKS_PER_IP))) return { error: MESSAGES.tooMany };
  const viewer = await getViewer();
  const raw = data.get("code");
  const result = await checkActivationCode(db, {
    secret: env.activationCodeSecret,
    code: typeof raw === "string" ? raw.slice(0, 64) : "",
    accountId: viewer?.accountId,
  });
  if (result.status === "claimable") {
    await setChallenge(result.credentialId);
    redirect("/activate");
  }
  if (result.status === "yours") {
    // A used code whose Card the signed-in Account already owns: take them to their Neffi, never a second claim.
    redirect("/app");
  }
  if (result.status === "invalid") return { error: MESSAGES.invalid };
  // Remaining status: "unavailable" (used elsewhere, revoked, not yet sold, retired).
  return { error: viewer ? MESSAGES.unavailable : MESSAGES.unavailableSignedOut };
}

export async function claimAction(_previous: ActivateState | undefined, _data: FormData): Promise<ActivateState> {
  const authorization = await authorize("account");
  if (!authorization.ok) redirect("/activate");
  const credentialId = await readChallenge();
  if (!credentialId) redirect("/activate?notice=expired");
  const { accountId } = authorization.viewer;
  if (!(await consumeQuota(db, quotaKey("activation-claim", accountId), CLAIMS_PER_ACCOUNT))) return { error: MESSAGES.tooMany };
  const result = await claimCard(db, { credentialId, accountId });
  await clearChallenge();
  redirect(result.status === "unavailable" ? "/activate?notice=unavailable" : "/app?added=1");
}

// Keeps the accepted code so the customer can sign in with the right account and finish.
export async function switchAccountAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/activate");
}

export async function startOverAction(): Promise<void> {
  await clearChallenge();
  redirect("/activate");
}
```
  Add `"src/app/(public)/activate/challenge-cookie.ts"` to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 5: Verify it passes.** Run `pnpm vitest run "src/app/(public)/activate" src/server-only-boundary.test.ts && pnpm typecheck`. Expected: PASS. If `typecheck` reports that `claimAction` lacks a return at the end, keep the code as written: `redirect` returns `never`, which satisfies the return type. Do not add a return statement.
- [ ] **Step 6: Commit.** `git add "src/app/(public)/activate/challenge-cookie.ts" "src/app/(public)/activate/actions.ts" "src/app/(public)/activate/actions.test.ts" src/server-only-boundary.test.ts && git commit -m "feat(activation): code check and claim server actions"`
- [ ] **Step 7: Ledger.** Append the Task 6 entry to the local ledger. Do not commit it.

## Task 7: `/activate` page (mobile-first)

**Files:**
- Modify `src/app/(public)/sign-in/sign-in-form.tsx` (change `const inputClass` to `export const inputClass`)
- Create `src/app/(public)/activate/activate-forms.tsx`, `src/app/(public)/activate/page.tsx`, `src/app/(public)/activate/page.test.tsx`

**Interfaces:**
- Consumes: `getViewer`, `readChallenge`, `ownedCards`, `db`, `SignInForm`, `inputClass`, `Button`, and the four actions.
- Produces: the `/activate` route (§7).

- [ ] **Step 1: Write the failing tests** in `src/app/(public)/activate/page.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ getViewer: vi.fn(), readChallenge: vi.fn(), ownedCards: vi.fn() }));
vi.mock("@/auth/access", () => ({ getViewer: m.getViewer }));
vi.mock("./challenge-cookie", () => ({ readChallenge: m.readChallenge }));
vi.mock("@/modules/cards/owned", () => ({ ownedCards: m.ownedCards }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("./activate-forms", () => ({
  CodeForm: () => <form data-code-form="" />,
  ClaimForm: () => <button>Add to my account</button>,
  SwitchAccountButton: () => <button>Use a different account</button>,
  StartOverButton: () => <button>Enter a different code</button>,
}));
vi.mock("../sign-in/sign-in-form", () => ({ SignInForm: ({ next }: { next: string }) => <div data-sign-in={next} /> }));

import ActivatePage from "./page";

const VIEWER = { accountId: "11111111-1111-4111-8111-111111111111", email: "a@example.test", role: "customer" };
const CARD = { id: "c1", publicToken: "A".repeat(22) + "WXYZ", profileId: null };
const render = async (search: Record<string, string> = {}) =>
  renderToStaticMarkup(await ActivatePage({ params: Promise.resolve({}), searchParams: Promise.resolve(search) } as Parameters<typeof ActivatePage>[0]));
const text = (html: string) => html.replace(/<[^>]+>/g, " ");

beforeEach(() => {
  vi.clearAllMocks();
  m.getViewer.mockResolvedValue(null);
  m.readChallenge.mockResolvedValue(null);
  m.ownedCards.mockResolvedValue([]);
});

test("signed out: code entry with a way to sign in", async () => {
  const html = await render();
  expect(html).toContain("Activate your Neffi");
  expect(html).toContain("Enter the activation code inside your package.");
  expect(html).toContain("data-code-form");
  expect(html).toContain('href="/sign-in?next=/activate"');
  expect(html).not.toContain("Go to my Neffi");
});

test("signed in without cards: activate your Neffi, identity shown, easy way home", async () => {
  m.getViewer.mockResolvedValue(VIEWER);
  const html = await render();
  expect(html).toContain("Activate your Neffi");
  expect(html).toContain("Signed in as");
  expect(html).toContain("a@example.test");
  expect(html).toContain("Go to my Neffi");
  expect(html).toContain('href="/app"');
});

test("signed in with a card: repeat scan offers another activation, no auto-redirect", async () => {
  m.getViewer.mockResolvedValue(VIEWER);
  m.ownedCards.mockResolvedValue([CARD]);
  const html = await render();
  expect(html).toContain("Activate another Neffi");
  expect(html).toContain("data-code-form");
  expect(html).not.toContain("WXYZ");
});

test("signed out with an accepted code: sign in and come back here", async () => {
  m.readChallenge.mockResolvedValue("cred-1");
  const html = await render();
  expect(html).toContain("Code accepted");
  expect(html).toContain('data-sign-in="/activate"');
  expect(html).toContain("Enter a different code");
  expect(html).not.toContain("data-code-form");
  expect(m.ownedCards).not.toHaveBeenCalled();
});

test("signed in with an accepted code: confirm the account that will own it", async () => {
  m.getViewer.mockResolvedValue(VIEWER);
  m.readChallenge.mockResolvedValue("cred-1");
  const html = await render();
  expect(html).toContain("Add this Neffi to your account");
  expect(html).toContain("a@example.test");
  expect(html).toContain("Add to my account");
  expect(html).toContain("Use a different account");
  expect(html).toContain("Enter a different code");
  expect(m.ownedCards).not.toHaveBeenCalled();
});

test.each([
  ["expired", null, "For your security, please enter your code again."],
  ["unavailable", null, "If you already added this Neffi, sign in to find it."],
  ["unavailable", VIEWER, "This code can't be used. Please contact Neffi support for help."],
])("notice %s is shown in a status region", async (notice, viewer, copy) => {
  m.getViewer.mockResolvedValue(viewer);
  const html = await render({ notice });
  expect(html).toMatch(/role="status"/);
  expect(text(html)).toContain(copy.replaceAll("'", "&#x27;"));
});

test("unknown notices render nothing extra", async () => {
  const html = await render({ notice: "<script>alert(1)</script>" });
  expect(html).not.toMatch(/role="status"/);
  expect(html).not.toContain("<script>");
});

test("no technical vocabulary on any screen", async () => {
  const states: [unknown, string | null][] = [[null, null], [VIEWER, null], [null, "cred-1"], [VIEWER, "cred-1"]];
  for (const [viewer, challenge] of states) {
    m.getViewer.mockResolvedValue(viewer);
    m.readChallenge.mockResolvedValue(challenge);
    expect(text(await render())).not.toMatch(/token|challenge|hmac|oauth|credential|transaction/i);
  }
});
```
  Note on apostrophes: `renderToStaticMarkup` escapes `'` as `&#x27;`. Keep the `.replaceAll` in the notice test, or compare against the escaped literal.
- [ ] **Step 2: Verify they fail.** Run `pnpm vitest run "src/app/(public)/activate/page.test.tsx"`. Expected: FAIL (cannot resolve `./page`).
- [ ] **Step 3: Implement `activate-forms.tsx`.**
```tsx
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "../sign-in/sign-in-form";
import { checkCodeAction, claimAction, startOverAction, switchAccountAction } from "./actions";

// The typed code lives only in this component's memory; it is posted, never stored or put in the URL.
export function CodeForm() {
  const [state, formAction, pending] = useActionState(checkCodeAction, undefined);
  const [code, setCode] = useState("");
  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="code">
        Activation code
      </label>
      <input
        id="code"
        name="code"
        required
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={64}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        className={`${inputClass} font-mono uppercase tracking-wider`}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        Continue
      </Button>
    </form>
  );
}

export function ClaimForm() {
  const [state, formAction, pending] = useActionState(claimAction, undefined);
  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending ? "Adding…" : "Add to my account"}
      </Button>
    </form>
  );
}

export function SwitchAccountButton() {
  return (
    <form action={switchAccountAction} className="w-full">
      <Button type="submit" variant="outline" size="lg" className="h-11 w-full">
        Use a different account
      </Button>
    </form>
  );
}

export function StartOverButton() {
  return (
    <form action={startOverAction} className="w-full">
      <Button type="submit" variant="ghost" className="h-11 w-full">
        Enter a different code
      </Button>
    </form>
  );
}
```
- [ ] **Step 4: Implement `page.tsx`.**
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getViewer } from "@/auth/access";
import { SignInForm } from "../sign-in/sign-in-form";
import { db } from "@/db";
import { ownedCards } from "@/modules/cards/owned";
import { ClaimForm, CodeForm, StartOverButton, SwitchAccountButton } from "./activate-forms";
import { readChallenge } from "./challenge-cookie";

export const metadata: Metadata = {
  title: "Activate your Neffi",
  robots: { index: false, follow: false },
};

// Reads the session and the activation cookie, so it renders per request.
export const instant = false;

// Copied from actions.ts MESSAGES: a "use server" file can only export async functions.
const UNAVAILABLE = "This code can't be used. Please contact Neffi support for help.";
const UNAVAILABLE_SIGNED_OUT = "This code can't be used. If you already added this Neffi, sign in to find it. Otherwise, please contact Neffi support for help.";

export default async function ActivatePage({ searchParams }: PageProps<"/activate">) {
  const [viewer, challenge, params] = await Promise.all([getViewer(), readChallenge(), searchParams]);
  const raw = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const notices: Record<string, string> = {
    expired: "For your security, please enter your code again.",
    unavailable: viewer ? UNAVAILABLE : UNAVAILABLE_SIGNED_OUT,
  };
  const notice = raw && Object.hasOwn(notices, raw) ? notices[raw] : undefined;

  let heading: string;
  let body: ReactNode;
  if (challenge && !viewer) {
    heading = "Code accepted";
    body = (
      <>
        <p className="text-center text-muted-foreground">Sign in or create your account to add this Neffi. No password needed.</p>
        <SignInForm next="/activate" />
        <StartOverButton />
      </>
    );
  } else if (challenge && viewer) {
    heading = "Add this Neffi to your account";
    body = (
      <>
        <p className="text-center text-muted-foreground">
          You&apos;re signed in as <span className="break-all font-medium text-foreground">{viewer.email}</span>.
        </p>
        <ClaimForm />
        <SwitchAccountButton />
        <StartOverButton />
      </>
    );
  } else {
    const ownsCards = viewer ? (await ownedCards(db, viewer.accountId)).length > 0 : false;
    heading = ownsCards ? "Activate another Neffi" : "Activate your Neffi";
    body = (
      <>
        <p className="text-center text-muted-foreground">Enter the activation code inside your package.</p>
        {viewer ? (
          <p className="text-center text-sm">
            Signed in as <span className="break-all font-medium">{viewer.email}</span>
          </p>
        ) : null}
        <CodeForm />
        {viewer ? (
          <Link href="/app" className="text-sm font-medium underline underline-offset-4">
            Go to my Neffi
          </Link>
        ) : (
          <Link href="/sign-in?next=/activate" className="text-sm text-muted-foreground underline underline-offset-4">
            Already activated? Sign in
          </Link>
        )}
      </>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{heading}</h1>
        {notice ? (
          <p role="status" className="w-full rounded-lg bg-muted px-3 py-2 text-sm">
            {notice}
          </p>
        ) : null}
        {body}
      </div>
    </main>
  );
}
```
  In `src/app/(public)/sign-in/sign-in-form.tsx`, change `const inputClass =` to `export const inputClass =`.
- [ ] **Step 5: Verify it passes.** Run `pnpm vitest run "src/app/(public)" && pnpm typecheck && pnpm lint`. Expected: PASS. `pnpm typecheck` runs `next typegen`, which generates `PageProps<"/activate">`. If the Link `href` attribute renders differently in the test (for example HTML-escaped), adjust the assertion to the rendered form. Do not change the URL.
- [ ] **Step 6: Commit.** `git add "src/app/(public)/sign-in/sign-in-form.tsx" "src/app/(public)/activate/activate-forms.tsx" "src/app/(public)/activate/page.tsx" "src/app/(public)/activate/page.test.tsx" && git commit -m "feat(activation): mobile /activate page"`
- [ ] **Step 7: Ledger.** Append the Task 7 entry to the local ledger. Do not commit it.

## Task 8: Resume and handoff in `/app`

**Files:**
- Modify `src/app/(customer)/app/page.tsx`
- Create `src/app/(customer)/app/page.test.tsx`

**Interfaces:**
- Consumes: `requireAccount`, `getLinkedMethods`, `ownedCards`, `db`.
- Produces: `/app?added=1` status, a "Ready to set up" list (the M6 attachment point) and an "Activate another Neffi" link.

- [ ] **Step 1: Write the failing tests** in `src/app/(customer)/app/page.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAccount: vi.fn(), getLinkedMethods: vi.fn(), ownedCards: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/auth/methods", () => ({ getLinkedMethods: m.getLinkedMethods }));
vi.mock("@/modules/cards/owned", () => ({ ownedCards: m.ownedCards }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("./account-actions", () => ({ AccountActions: () => <div data-account-actions="" /> }));

import CustomerHome from "./page";

const TOKEN = "A".repeat(22) + "WXYZ";
const render = async (search: Record<string, string> = {}) =>
  renderToStaticMarkup(await CustomerHome({ params: Promise.resolve({}), searchParams: Promise.resolve(search) } as Parameters<typeof CustomerHome>[0]));

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1", email: "a@example.test", role: "customer" });
  m.getLinkedMethods.mockResolvedValue({ google: false });
  m.ownedCards.mockResolvedValue([]);
});

test("after a claim, confirms the Neffi was added", async () => {
  const html = await render({ added: "1" });
  expect(html).toMatch(/role="status"/);
  expect(html).toContain("Your Neffi has been added to your account. Next, you&#x27;ll set it up.");
});

test("lists owned cards waiting for setup without exposing the full card address", async () => {
  m.ownedCards.mockResolvedValue([
    { id: "c1", publicToken: TOKEN, profileId: null },
    { id: "c2", publicToken: "B".repeat(26), profileId: "p1" },
  ]);
  const html = await render();
  expect(html).toContain("Ready to set up");
  expect(html).toContain("Neffi ending in WXYZ");
  expect(html).toContain("Activate another Neffi");
  expect(html).not.toContain(TOKEN);
  expect(html).not.toContain("BBBB");
  expect(m.ownedCards).toHaveBeenCalledWith({}, "a1");
});

test("with no cards keeps the empty-state line and offers activation", async () => {
  const html = await render();
  expect(html).toContain("Your cards and profiles will appear here.");
  expect(html).not.toContain("Ready to set up");
  expect(html).toContain('href="/activate"');
  expect(html).toContain("Activate a Neffi");
});
```
- [ ] **Step 2: Verify they fail.** Run `pnpm vitest run "src/app/(customer)/app/page.test.tsx"`. Expected: FAIL (no status line, list or link).
- [ ] **Step 3: Minimal implementation** in `src/app/(customer)/app/page.tsx`:
  - Add imports: `Link` from `next/link`, `db` from `@/db`, `ownedCards` from `@/modules/cards/owned`.
  - Change the `Promise.all` to `[methods, params, cards] = await Promise.all([getLinkedMethods(), searchParams, ownedCards(db, viewer.accountId)])`.
  - Compute `const waiting = cards.filter((card) => !card.profileId);` and `const added = (Array.isArray(params.added) ? params.added[0] : params.added) === "1";`.
  - Render after the error block, keeping the existing account section and `AccountActions` unchanged:
```tsx
{added ? (
  <p role="status" className="max-w-sm rounded-lg bg-muted px-3 py-2 text-sm">
    Your Neffi has been added to your account. Next, you&apos;ll set it up.
  </p>
) : null}
{waiting.length ? (
  <section className="flex w-full max-w-sm flex-col gap-2 rounded-lg border p-4">
    <h2 className="text-sm font-medium">Ready to set up</h2>
    <ul className="text-sm">
      {/* M6 turns each item into the entry of its guided setup. */}
      {waiting.map((card) => (
        <li key={card.id}>Neffi ending in {card.publicToken.slice(-4)} — waiting for setup</li>
      ))}
    </ul>
  </section>
) : null}
```
  Replace the final paragraph with:
```tsx
{cards.length ? null : <p className="max-w-sm text-center text-sm text-muted-foreground">Your cards and profiles will appear here.</p>}
<Link href="/activate" className="text-sm font-medium underline underline-offset-4">
  {cards.length ? "Activate another Neffi" : "Activate a Neffi"}
</Link>
```
- [ ] **Step 4: Verify it passes.** Run `pnpm vitest run "src/app/(customer)" && pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add "src/app/(customer)/app/page.tsx" "src/app/(customer)/app/page.test.tsx" && git commit -m "feat(app): show newly added Neffi waiting for setup"`
- [ ] **Step 6: Ledger.** Append the Task 8 entry to the local ledger. Do not commit it.

## Task 9: Local-only activation fixture and docs

**Files:**
- Create `scripts/dev-activation-fixture.mts`
- Modify `package.json`, `README.md`

**Interfaces:**
- Consumes: `issueActivationCredential`, `formatActivationCode`.
- Produces: the npm script `dev:activation-fixture`.

- [ ] **Step 1: Write the script** `scripts/dev-activation-fixture.mts`:
```ts
// Local development only: creates synthetic sold-but-unclaimed Digital Business Cards plus the unavailable cases, and
// prints their activation codes for browser acceptance of /activate. Loopback databases only; never Neon, never
// .env.local. Printing codes is acceptable here because they exist only in this disposable database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../src/db/schema";
import { formatActivationCode } from "../src/modules/activation/code";
import { issueActivationCredential } from "../src/modules/activation/credentials";

const url = new URL(process.env.DATABASE_URL ?? "");
assert(["127.0.0.1", "localhost"].includes(url.hostname), "The activation fixture only runs against a loopback database");
assert(["postgres:", "postgresql:"].includes(url.protocol));
assert(![...url.searchParams.keys()].some((key) => ["host", "hostaddr", "port"].includes(key)));
const secret = process.env.ACTIVATION_CODE_SECRET ?? "";
assert(secret.length >= 32, "Set ACTIVATION_CODE_SECRET to the dev server's value");

const pool = new pg.Pool({ connectionString: url.href, max: 2 });
try {
  const { rows: [server] } = await pool.query("SELECT current_setting('neon.project_id', true) AS neon");
  assert(!server.neon, "The activation fixture must never target Neon");
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "drizzle" });

  const [owner, earlierBuyer, purchaser, order, item, stock] = Array.from({ length: 6 }, () => randomUUID());
  const existing = (await pool.query("SELECT id FROM products WHERE kind = 'dbc' AND active LIMIT 1")).rows[0]?.id as string | undefined;
  const product = existing ?? randomUUID();
  if (!existing) await pool.query("INSERT INTO products(id,kind,name,price) VALUES ($1,'dbc','Synthetic DBC',50000)", [product]);
  await pool.query("INSERT INTO accounts(id,name,email) VALUES ($1,'Synthetic fixture owner',$3),($2,'Synthetic earlier buyer',$4)", [
    owner, earlierBuyer, `${owner}@example.test`, `${earlierBuyer}@example.test`,
  ]);
  await pool.query("INSERT INTO stock_purchases(id,received_on,created_by_account_id) VALUES ($1,'2026-10-11',$2)", [stock, owner]);
  await pool.query("INSERT INTO purchasers(id,name) VALUES ($1,'Synthetic purchaser')", [purchaser]);
  await pool.query("INSERT INTO orders(id,purchaser_id,created_by_account_id,assigned_to_account_id) VALUES ($1,$2,$3,$3)", [order, purchaser, owner]);
  await pool.query("INSERT INTO order_items(id,order_id,product_id,product_kind,quantity,unit_price) VALUES ($1,$2,$3,'dbc',10,50000)", [item, order, product]);

  const card = async (state: "released" | "blank", ownerId: string | null = null) => {
    const id = randomUUID();
    const token = `DEVACT${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
    await pool.query(
      "INSERT INTO cards(id,stock_purchase_id,product_id,kind,state,order_item_id,public_token,owner_account_id) VALUES ($1,$2,$3,'dbc',$4,$5,$6,$7)",
      [id, stock, product, state, state === "released" ? item : null, token, ownerId],
    );
    return { id, suffix: token.slice(-4) };
  };
  const issue = async (cardId: string) => formatActivationCode((await issueActivationCredential(db, cardId, secret)).code);
  const rows: { scenario: string; code: string; card: string }[] = [];

  for (const n of [1, 2, 3]) {
    const c = await card("released");
    rows.push({ scenario: `claimable ${n}`, code: await issue(c.id), card: `…${c.suffix}` });
  }
  {
    const c = await card("released");
    const revoked = await issue(c.id);
    await pool.query("UPDATE activation_credentials SET revoked_at = now() WHERE card_id = $1 AND used_at IS NULL AND revoked_at IS NULL", [c.id]);
    rows.push({ scenario: "revoked (unavailable)", code: revoked, card: `…${c.suffix}` });
    rows.push({ scenario: "replacement for that card (claimable)", code: await issue(c.id), card: `…${c.suffix}` });
  }
  {
    const c = await card("blank");
    const code = await issue(c.id);
    await pool.query("UPDATE cards SET state = 'ready', nfc_verified_at = now(), package_matched_at = now() WHERE id = $1", [c.id]);
    rows.push({ scenario: "unsold Ready card (unavailable)", code, card: `…${c.suffix}` });
  }
  {
    const c = await card("released", earlierBuyer);
    const code = await issue(c.id);
    await pool.query("UPDATE activation_credentials SET used_at = now() WHERE card_id = $1 AND used_at IS NULL AND revoked_at IS NULL", [c.id]);
    rows.push({ scenario: "used by another account (unavailable)", code, card: `…${c.suffix}` });
  }
  console.table(rows);
} finally {
  await pool.end();
}
```
  Add `"dev:activation-fixture": "node --conditions=react-server --import tsx scripts/dev-activation-fixture.mts",` to `package.json` `scripts`.
- [ ] **Step 2: Run it** against the Task 5 cluster: `DATABASE_URL=postgres://postgres@127.0.0.1:55432/neffi_m5_dev ACTIVATION_CODE_SECRET=<the dev server's value, never recorded> pnpm dev:activation-fixture`. Expected: a 7-row table and exit 0.
  - Guard check: `DATABASE_URL=postgres://u:p@db.example.com/x ACTIVATION_CODE_SECRET=$(printf 'x%.0s' {1..40}) pnpm dev:activation-fixture` must fail on the loopback assertion without connecting.
  - Do not copy the printed codes into the ledger.
- [ ] **Step 3: README.** In `README.md`, replace the sentence "There is no `/c/{token}` page and no `/activate` flow yet: the public card resolver is Milestone 7 and activation/claim is Milestone 5." with "There is no `/c/{token}` page yet: the public card resolver is Milestone 7. Customer activation is described under Activation below." Then add an `## Activation (Milestone 5)` section covering:
  - the flow (`/activate` → code → sign in if needed → Add to my account → `/app`);
  - only Released DBCs are claimable (M8 releases cards);
  - the 15-minute `neffi_activation` cookie (HttpOnly, Lax, `/activate`) holds only an opaque reference, never the code;
  - limits: 20 checks per IP and 10 claims per Account per 10 minutes;
  - `pnpm check:claim-concurrency` (loopback `neffi_m2_test` only);
  - `pnpm dev:activation-fixture` (loopback only; prints synthetic codes; never point it at Neon);
  - running `DATABASE_URL=<loopback> pnpm dev` for local acceptance.
- [ ] **Step 4: Verify.** Run `pnpm lint && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add scripts/dev-activation-fixture.mts package.json README.md && git commit -m "chore(activation): local-only activation fixture and docs"`
- [ ] **Step 6: Ledger.** Append the Task 9 entry to the local ledger. Do not commit it.

## Task 10: Manual browser acceptance (390 × 844, local Postgres) — user participation required

**Setup:**
- Run `DATABASE_URL=postgres://postgres@127.0.0.1:55432/neffi_m5_dev pnpm dev`. The process environment overrides `.env.local`, so this uses the local database, never Neon.
- `ACTIVATION_CODE_SECRET` must match the value used by the Task 9 fixture.
- Re-run the Task 9 fixture for fresh codes as needed.
- Google needs the existing localhost OAuth client. Email codes go to a real inbox the user controls.

**Who drives:** the executor drives with any available browser automation (for example Playwright MCP) or asks the user to perform each step on a phone or emulated 390px viewport. Record each item as `pass`/`fail` with the device or viewport, and mark it `executor-observed` or `user-reported`. Never record codes, OTPs or cookie values.

- [ ] **A — Signed out, email code:** `/activate`, then enter claimable code 1 in lowercase with extra spaces. Expect "Code accepted", then the email code step, then "Add this Neffi to your account" showing that email. Tap **Add to my account**. Expect `/app?added=1` with the status line and "Neffi ending in …".
- [ ] **B — Signed out, Google:** enter claimable code 2, then **Continue with Google**. Expect a return to `/activate` showing the Google account's email. Add, then expect `/app`.
- [ ] **C — Already signed in:** open `/activate`. Expect "Activate another Neffi", "Signed in as …" and "Go to my Neffi", with no auto-redirect. Enter claimable code 3. Expect the confirm screen with no sign-in, then Add.
- [ ] **D — Used, foreign, revoked, unsold, malformed:**
  - Code 1 entered as its owner goes to `/app`.
  - Code 1 entered as a different account gives the signed-in unavailable copy.
  - Code 1 entered signed out gives the signed-out unavailable copy.
  - The revoked, unsold Ready and used-by-another codes each give unavailable copy.
  - `1234` gives the invalid copy.
- [ ] **E — Interruptions:**
  - After "Code accepted", close the tab and reopen `/activate` within 15 minutes. Expect it to resume at "Code accepted".
  - Delete the `neffi_activation` cookie in devtools, then press **Add**. Expect "For your security, please enter your code again."
  - After a claim, sign out and back in. Expect `/app` to still list the Neffi with no code needed.
  - After a claim, press Back. Expect code entry.
  - Double-tap **Add**. Verify `SELECT count(*) FROM activity_events WHERE type='card_claimed' AND card_id=<card>` returns 1.
  - Start Google from "Code accepted" and cancel. Expect `/sign-in?error=…`. Reopen `/activate` and expect "Code accepted" (known behavior, Review Focus 5).
- [ ] **F — Account switch:** with a challenge while signed in as A, tap **Use a different account**, then sign in as B. Expect the confirm screen to show B. Add. The owner is B.
- [ ] **G — Rate limit:** 21 rapid wrong codes give the too-many copy. Reset afterwards with `DELETE FROM auth_otp_quotas` on the local database only.
- [ ] **H — Leakage:**
  - Network panel: no request URL contains the code.
  - `document.cookie` does not include `neffi_activation` (HttpOnly).
  - In devtools, the cookie value matches `uuid.digits.64hex` with no code.
  - `localStorage` and `sessionStorage` contain no code.
  - Grepping the dev-server stdout for the code finds nothing.
  - `curl -sI http://localhost:3000/activate` shows a non-public `Cache-Control` (`private`/`no-store`/`no-cache`), and the page source has `<meta name="robots" content="noindex, nofollow">`.
- [ ] **I — 390px layout:** no horizontal scroll, every control at least 44px tall, a readable monospace code input, and none of the words token, challenge, HMAC, OAuth, credential or transaction on any screen.
- [ ] **Ledger:** record the Task 10 results in the local ledger with `Commit: none (verification only)`. If any item fails, fix it in the owning task's files with a new failing test first. Commit the fix as `fix(activation): <defect>`, re-run that task's verification and this checklist item, and record the fix SHA and both results in the ledger.

## Task 11: M5 software gate

- [ ] **Step 1: Fresh verification.** Capture pass/fail and counts in the ledger.
```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm db:check
pnpm db:generate && git diff --exit-code drizzle          # proves no migration and no schema drift
pnpm build
pnpm check:bundle
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test pnpm check:db-concurrency
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test pnpm check:provisioning-concurrency
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test pnpm check:claim-concurrency
git grep -nE "console\.(log|info|warn|error|debug)" -- src/modules/activation "src/app/(public)/activate"   # expect no output
git diff --stat main..HEAD -- drizzle src/db/schema                                                         # expect no output
git grep -nE "profiles|profile_id|scenes|/c/\[" -- "src/app/(public)/activate" src/modules/activation ':!*.test.ts' ':!*.test.tsx'   # expect no output (no M6/M7 leakage)
```
  Expected: every command passes and the three grep/diff checks print nothing.
- [ ] **Step 2: Whole-branch review.** Use superpowers:requesting-code-review, or an independent reviewer, against this plan. Required checks:
  - M6/M7/M8/M9 out-of-scope list (§2) respected;
  - claim lock order matches M4 (card first);
  - no raw code in any URL, cookie, state, log or Activity note;
  - customer copy vocabulary (D11);
  - `src/modules/cards/dbc.ts` behavior unchanged apart from importing `sameLookup`;
  - no migration;
  - new server-only modules are listed.

  Fix findings with test-first commits (`fix(activation): …`) and re-run Step 1.
- [ ] **Step 3: Ledger.** Record the gate result and status **"M5 software gate passed — physical packaged-card acceptance pending"** (or the failing items), plus:
  - decisions D1–D11;
  - known limitations: Google cancel lands on `/sign-in`; support is plain text until M9; real claims require M8 release; limits tune in M10.

  This is a local ledger entry only, with no commit.
- [ ] **Step 4: Stop the disposable cluster.** `"$PGBIN/pg_ctl" -D "$SCRATCH" stop`.
- [ ] **Step 5: Stop.** Do not push, open a PR or update Notion without explicit user approval.

## Deferred physical acceptance (not part of the software gate)

When the M4 hardware arrives, first run M4 Task 12. Then, against the then-current integrated system, claim one real sealed package:
- scan the common QR;
- type the printed label code;
- sign in and Add.

Verify that ownership is established and that re-entering the code cannot claim again. That Card must be **Released** first. **Unresolved, decide when the hardware arrives:** either the M8 release flow exists by then, or the user explicitly approves a controlled release of that one Card on the development database. Record evidence without codes. M5 is not fully complete, and M12 cannot pass, until this is done. Never fabricate this evidence.

---

## Self-review record (planner, 2026-10-11)

- **Spec coverage:** every Step 8 M5 deliverable and critical verification item maps to a task:
  - valid code claims once: Tasks 4 and 5;
  - invalid, used and revoked fail generically: Tasks 4 and 6;
  - concurrency: Task 5;
  - failed transaction leaves nothing changed: Task 4;
  - closing before claim keeps the code usable: Tasks 4 and 10E;
  - resume after claim: Tasks 8 and 10E;
  - no code in URL, log or storage: Tasks 6, 10H and 11.

  The Locked Plan and Step 5 repeat-scan and used-code rules are covered by Tasks 4, 6, 7 and 10C/D. The Mobile-First "show current account clearly, simple Switch account" rule is covered by Tasks 7 and 10F.
- **Placeholders:** none. The only bracketed values are runtime inputs: scratch directory, dev secret, SHA, card id.
- **Type consistency:** names in §6 match every task (`checkActivationCode`, `claimCard`, `ownedCards`, `consumeQuota`, `readChallenge`/`setChallenge`/`clearChallenge`, `CodeForm`/`ClaimForm`/`SwitchAccountButton`/`StartOverButton`).
- **M6/M7 leakage:** M5 writes no Profile and sets no `profile_id`. It adds no `/c` route, no Sharing QR and no Cards page. Task 11 greps for these.
- **Remaining unresolved issue:** only the deferred-hardware release path above. It does not block software execution.
