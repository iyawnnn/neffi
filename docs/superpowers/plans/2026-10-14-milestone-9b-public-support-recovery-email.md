# Milestone 9B: Public Support, Recovery & Email Implementation Plan

> **Implementation history — not a current specification.** Retained as written for provenance; instructions, names and verification plans below describe that implementation context. Current contracts and superseding decisions are indexed in [the documentation authority map](../../README.md#authority-map); current status is in [roadmap](../../roadmap.md). Earlier GRC lifecycle assumptions are superseded by [0006](../../decisions/0006-grc-simple-commercial-line.md).


> **Status (2026-10-15): T0-T13 implemented and approved; T14 temporary remote resources deleted and verified absent; reduced T15 approved; T16 push/PR authorized; merge requires separate approval.**
> - **Decisions:** D1-D9 were ruled by you. N1 and N2 take the safe defaults you approved.
> - **Audit:** the Opus pre-implementation audit corrections (I1-I9 and related minor items) are applied.
> - **Approved revision:** D9 now permits pre-launch sandbox/injected-sender acceptance. Independent external two-inbox delivery remains a launch gate. Local implementation, T14 teardown and reduced T15 evidence are recorded in the SDD ledger. T16 push/PR is separately authorized; merge and shared-database migration remain gated.
>
> **Method.**
> - The repository, docs, specs, ADRs, M9A code and tests, Notion pages and the Better Auth 1.7.7 email-OTP routes were read first.
> - Claims were verified in code by an independent audit.

**Goal.** Let a customer who is stuck reach Neffi without a Neffi login. "Stuck" covers:
- a lost activation code;
- a card in the wrong account;
- a damaged card;
- being unable to sign in, or having lost email access;
- a suspected compromise.

Every such request feeds the **existing M9A Support Case**. The owners resolve it through controlled, audited actions that send the right email. M9B extends M9A and adds no second support system.

**Spec sources and precedence.** Earlier sources win when they conflict.
1. Merged code, schema and tests.
2. `PRODUCT.md`, `docs/README.md`, `docs/roadmap.md`, `docs/specs/*`, `docs/decisions/*`, `docs/architecture/*`.
3. Notion: the Locked Plan, Steps 5-9, the Page Inventory and the AI Build Handoff.
4. The M9A plan's "M9B outline".
5. The parked UI plan, as UX context only.

The repository wins over Notion.

**Baseline.**
- Latest `main` after PR #10: M9A merged, migrations through `0013_support_guards`, 1,162 tests, 17 support concurrency scenarios.
- Shared Neon dev is at `0012`.
- Production is unconfigured.

---

## 0. Execution protocol

- **Branch and commits:** one branch, `feat/m9b-public-support-recovery`, cut from an up-to-date `main` after approval. One commit per code task. Tests ship with the slice.
- **Ledger:** local and ignored, at `.superpowers/sdd/2026-10-14-milestone-9b-public-support-recovery-email/progress.md`.
  - Evidence observed by you and SQL evidence are recorded separately.
  - Never record codes, OTPs, cookies, tokens, recovery codes or full third-party emails.
- **Next.js docs first:** before writing any Next code, read the relevant guide in `node_modules/next/dist/docs/`. AGENTS.md: this is Next 16 (`cacheComponents`, Server Actions, `after()`, dynamic holes inside static shells).
- **Stop gates:** no Neon, Vercel, live Resend, push, PR or merge without your explicit approval at the stop gates (§11).
- **UI:** functional and small. The parked UI overhaul is not a dependency and is not touched.
- **House error pattern:** M9A services refuse by throwing `SupportError` inside `db.transaction`, which rolls the transaction back. Where a failed attempt must leave a trace (F6 wrong code), the service **returns a result instead of throwing** so the write commits.

## 1. Repository findings

### 1.1 What already exists (do not rebuild)

| Area | Evidence |
|---|---|
| Support Case model | `support_cases` has: type, status (open / waiting_on_customer / resolved), a **NOT NULL** summary, and nullable purchaser, account, order, assignee and **opened_by** links.<br>Related: `support_case_cards`, and enum types including `activation_issue`, `account_recovery`, `ownership_correction`, `defective_card`, `shipping_issue`, `other`.<br>`schema/operations.ts:34-72`. The comment at `:45` already reserves an empty `opened_by_account_id` "for public submissions". Cases are currently deletable (no history guard). |
| Owner case workflow | `src/modules/support/case.ts` and `cards.ts`:<br>• `withCase` locks the case `NO KEY UPDATE` and refuses resolved cases (`:22`).<br>• `openCase` requires an owner actor and defaults the assignee to that owner (`:42-55`).<br>• `linkCaseCard` links any Card, with no ownership check (`:97`).<br>• Also: retire, free replacement, **reissue code**, **reset ownership**, money and shipping corrections. |
| Activity | `recordActivity` is a single insert in the caller's transaction. `actor_account_id` is nullable in the column, with precedent: `accounts/set-role.ts:24` inserts without an actor. The TypeScript input requires it. The case timeline never joins the actor (`support/queries.ts:51`). |
| Auth | Better Auth with Google plus email OTP:<br>• OTP: 5 minutes, 3 attempts, HMAC-stored.<br>• Send limits: 3 per 10 minutes per email, 10 per minute per IP. Generic answers.<br>• `cookieCache` disabled, so sessions are DB-only and deleting `auth_sessions` revokes immediately.<br>• **An OTP sign-in for an unknown email creates a new Account**, because `disableSignUp` is unset (`better-auth/dist/plugins/email-otp/routes.mjs:410-415`). |
| Account locks | `accounts.email` is unique. Profile setup locks the Account `FOR UPDATE`, then the Card (`profiles.ts:45`). Support reset takes Account `KEY SHARE` (`support/cards.ts:19`). Card claim's FK check takes `KEY SHARE`. |
| Customer account controls | `/app/account` can change the sign-in email (re-authentication plus an OTP to the new address), remove Google, and sign out everywhere. **There are no security notification emails.** |
| Email | `src/integrations/email`: Resend over fetch, plain text, `Idempotency-Key` supported. Resend rejects a reused key with a different payload, and keys expire after 24 hours.<br>Three emails exist: sign-in code, change-email code, form notification. |
| Abuse helpers | `consumeQuota`: an atomic **10-minute fixed-window** HMAC-keyed counter in `auth_otp_quotas`. Also `clientIp`, and the form route's honeypot and caps pattern. |
| Activation | Codes are 16-character Crockford strings (`activation/code.ts`). Any credential of a Card the viewer owns returns `yours` and redirects to `/app`. That is the cause of M9A UX finding 8, and it is not a bug. |
| Seed | `src/db/seed.ts` runs `TRUNCATE ... RESTRICT` over an explicit `SEED_TABLES` list, so any new FK table must be added to it. |
| Test patterns | PGlite `*.db.test.ts` with `rollback` and `expectPgError`. Action tests use `vi.mock`. Fake mail comes from `sendAuthCode` capture or an injected `EmailSender`. The concurrency harness is `lockedScenario` with `pg_blocking_pids` in `scripts/check-support-concurrency.mts`. Browser acceptance is a manual matrix checked against read-only SQL. |

### 1.2 Genuine gaps

1. There is no `/support` or any public help route. The "contact Neffi support" strings point nowhere.
2. `support_cases` has no requester contact, message, source or dedupe key. Public intake cannot reuse `openCase` or `linkCaseCard`.
3. There is no support, security or recovery email.
4. There is no recovery path for a customer who has lost **all** sign-in methods. There is also no owner action to revoke another Account's sessions, replace its sign-in email, or unlink Google.
5. No notification is sent for self-service sign-in changes.
6. Support intake has no rate limits, and the existing helpers have no 24-hour throttle.
7. Email idempotency for support effects (Step 8, critical verification #7) was deferred to M9B.

### 1.3 Contradictions found and how they are resolved

| # | Contradiction | Resolution |
|---|---|---|
| C1 | Local `main` is stale (`9594343`); `origin/main` is `d85d511` | T0 updates `main` and verifies the M9A merge first. |
| C2 | Notion Step 9 says M9A is "not implemented" | The repo wins. A Notion reconcile list is delivered at completion. |
| C3 | `accounts-and-access.md:30` says "No Account can be changed from the owner area" | The spec is amended at T12. Mutation is limited to the audited recovery and secure actions. |
| C4 | The M9A outline says "all email"; Step 5 excludes commerce email | M9B email covers only support ack/reply/resolution, the recovery code and security notices. |
| C5 | Step 7 says "Turnstile where justified" | D3: deferred to M10. |
| C6 | The M9A plan baseline said 0011 and 0012 were unapplied | Neon dev is at 0012 (applied 2026-10-14). |
| C7 | M6 sign-in email change was never manually exercised | T15 verifies application behavior; independent external inbox delivery is deferred to the revised D9 launch gate. |
| C8 | UX finding 8 | This is the intentional `yours` branch. Left to the UI overhaul. |

## 2. Scope decisions

### 2.1 Locked by you
- Extend M9A Support Cases.
- Not in M9B:
  - account merge;
  - Profile moves;
  - customer deletion;
  - account freeze, disable or restrict;
  - Card transfer;
  - customer-visible case tracking;
  - Settings → Communications;
  - frontend redesign;
  - Turnstile;
  - activation-code email;
  - an outbox or automatic retry;
  - commerce emails;
  - Production setup;
  - unrelated M10 hardening.

### 2.2 Approved rulings and plan defaults

| # | Status | Rule |
|---|---|---|
| D1 | Ruled | Extend `support_cases` with a source, requester email/name/message and a client dedupe key. Add one table, `account_recoveries`. No separate intake inbox. Spam lands in the queue, and the owner can filter by source. |
| D2 | Ruled | The public email is unverified contact information only. It is never linked to an Account, Order, Card or Profile automatically. The public response is identical whether or not the address exists. One generic acknowledgement per address per 24 hours. |
| D3 | Ruled | Turnstile is deferred to M10. Use a honeypot, size caps, per-IP, per-email and global quotas, and the 24-hour ack throttle. |
| D4 | Ruled | Reissued or reset activation codes are never emailed. The owner sees them once and delivers them out of band. This is enforced server-side on owner replies (F8). |
| D5 | Ruled | Two-step recovery. The owner verifies and initiates, a code goes to the **new** email, and the customer completes at `/support/recover`. The email changes only then, and sessions are revoked. |
| D6 | Ruled | No waiting period. The old address gets notices at start and at completion. |
| D7 | Ruled | "Secure account": revoke sessions, and remove a compromised Google identity where safe. No freeze, disable or restrict. |
| D8 | Ruled | Email results are recorded as Activity events, with deterministic send keys and a manual Resend (not for recovery codes; see F6). No outbox, no automatic retry, no stored bodies. |
| D9 | Revised by user, 2026-10-15 | A verified custom domain is not required for pre-launch M9B development acceptance. Use the existing Resend testing sender only within its supported limits and the existing injected sender for deterministic automated verification. Real delivery from a Neffi-owned domain to two independent external inboxes is a launch gate: **DEFERRED — requires verified Neffi domain**. Email content, recipients, idempotency, failures, recovery state, session revocation and Activity remain required; no security behavior is weakened. Do not fabricate/purchase a domain or change unrelated DNS. |
| N1 | Approved default | If the proposed new email already belongs to any Account, recovery is **refused**, at initiation and at completion. Nothing is deleted, merged or moved, and the case stays open. The owner sees an explanation. The customer is instructed **not to sign in with the proposed new address until recovery completes**, because an email-code sign-in creates a new Account for an unknown email. |
| N2 | Approved default | Public-request personal data is covered by an inline privacy notice on `/support`. **No DELETE-blocking guard is added to `support_cases`.** A broader retention and deletion policy stays deferred. |
| D10 | Plan default | Optional env `SUPPORT_REPLY_TO`. No inbound email-to-case. |
| D11 | Plan default | Security notices: sign-in email changed (old and new), Google connected or removed, signed out everywhere, recovery started and completed, account secured by the owner. |
| D12 | Plan default | Public categories map to existing types:<br>• lost activation code → `activation_issue`<br>• card in wrong account or not found → `ownership_correction`<br>• cannot sign in / lost email or Google → `account_recovery`<br>• damaged or not working → `defective_card`<br>• delivery problem → `shipping_issue`<br>• other → `other`<br>No type editing. |
| D13 | Plan default | The recovery or secure target must be a `customer` Account linked to the case. Owner Accounts are refused. An occupied new email is refused (N1). |

## 3. Scope

### In
1. Public `/support` for signed-out and signed-in visitors.
2. Contextual entry points from:
   - `/activate` unavailable states;
   - `/app/account`;
   - Card detail;
   - `/sign-in`.
3. An intake service that creates Support Cases (source `public` or `account`), with dedupe, quotas, a 24-hour ack throttle and generic responses.
4. Support emails: acknowledgement, owner reply or request for information, resolution notice.
5. Owner case additions:
   - a requester block;
   - Send reply;
   - resolve with a notice;
   - a source filter;
   - email delivery events and Resend.
6. The recovery path (D5), "Secure account" (D7), session revoke and Google unlink services, and `/support/recover`.
7. Security notification emails for the customer's existing self-service changes.
8. Activity on every sensitive action, migration `0014`, tests, concurrency scenarios, docs and browser acceptance.

### Out (explicit)
- Account merge;
- Profile moves;
- customer deletion, restriction or freeze;
- Card transfer;
- a customer case-status portal;
- Settings → Communications;
- inbound email;
- Turnstile (M10);
- OWNER MFA or step-up (M10);
- CSP and rate-limit tuning (M10);
- order, payment, courier or marketing email;
- emailing activation codes;
- an outbox or retry worker;
- Production setup;
- ecommerce or courier automation;
- frontend redesign (M9A UX findings 1-9 stay parked);
- changes to M4, M5 or M7 behaviour or to the A3 DTO;
- `/privacy` and `/terms` pages (launch item, R7).

## 4. Flow specifications

Each flow states: initiator, known identity, verification, disclosure, Support action, email, Activity, failure and retry, and abuse and concurrency.

### F1. Public support request (signed out)
- **Initiator and identity:** anyone. Only the typed email, an optional name, the category and the message (2,000 characters or fewer) are known, and all of it is **unverified**.
- **Verification:** none at intake (D2). The owner verifies before any sensitive action.
- **Disclosure:**
  - The intake path **performs no Account lookup**, which is tested.
  - Every input gets the same success page.
  - Nothing about Accounts, Cards or Orders is ever returned.
- **Action:** a new service, `support/intake.ts`, does **not** call `openCase` or `linkCaseCard`. It inserts one case:
  - status `open`, source `public`;
  - `summary` set to the category label;
  - the free text in `requester_message` only;
  - `assigned_to_account_id` null (unassigned);
  - `opened_by_account_id` null;
  - no links.

  The owner links Account, Order and Card later with the existing M9A controls.
- **Email (ack):**
  - Generic text with the short case reference (the first 8 hex characters of the id).
  - **Never echoes the submitted name or message.**
  - Sent only if no **other** `source = 'public'` case with the same `requester_email` was created in the previous 24 hours. That is checked by a query in the intake transaction, backed by the §6 index.
  - `consumeQuota` is **not** used for this, because its window is 10 minutes.
- **Activity:** `support_case_opened` (actor null, note "public request"), then `support_email_sent` or `support_email_failed`.
- **Failure and retry:**
  - Validation errors show inline and the input is kept.
  - The case is persisted first, so an email failure never fails the request.
  - A double submit returns the same success, via a unique `client_key`.
- **Abuse:**
  - A honeypot: submissions are accepted and silently dropped.
  - Field caps.
  - `consumeQuota` 10-minute caps per IP, per email (HMAC of the lowercased email) and global.
  - A same-origin Server Action.
  - noindex on the result page.
  - The inline privacy notice (N2).

### F2. Signed-in support request and contextual help
- **Identity:** taken from the session, never from a typed email. The case is source `account`:
  - `account_id` is the session Account;
  - `opened_by_account_id` is the session Account;
  - the Activity actor is the session Account;
  - the assignee is null;
  - the summary is the category label.
- **Card from Card detail:** a `cardId` is accepted **only** if `cards.owner_account_id` equals the session Account. Intake checks this in its own transaction and inserts `support_case_cards` with role `affected`, plus `support_case_linked` Activity. It does not use `linkCaseCard`. A foreign or unknown card id is ignored, and the response stays generic.
- **Context links:** links from `/activate` unavailable states carry only a topic (`?topic=activation`), never the code.
- **`/sign-in` link:** links to `/support` without a `next` parameter, so `safeNext` is unchanged.
- **Ack:** goes to the Account's verified email under the same 24-hour rule, keyed on the case's account.

### F3. Lost activation code (unclaimed Card)
- Intake goes through F1 or F2.
- M9A's `reissueActivationCode` is unchanged.
- The code is delivered **out of band** (D4).
- M9B adds the public entry and the case emails. The M9A R-series is unchanged.

### F4. Wrong account or card not found
- Public entry → owner runs M9A `resetCardOwnership` → new code delivered out of band → the customer claims.
- M9B adds only the intake and the case emails.

### F5. Recovery while one sign-in method remains
- Copy on `/support` and `/sign-in` points to the remaining method: Google recovers a lost email, and an email code recovers lost Google.
- No new mechanism.

### F6. Support-controlled recovery (all methods lost), D5
- **Initiator:** an owner, from an open `account_recovery` case linked to the target Account.
- **Verification and owner input:**
  - The owner checks purchase and ownership evidence off-platform.
  - The owner ticks "I verified the requester's claim".
  - The owner writes a verification note (10-300 characters, no secrets).
  - The owner enters the **new email**, lowercased.
  - "Also remove Google sign-in" **defaults to on**.
  - Runbook: if compromise is suspected, run F7 Secure account **first**. Otherwise an attacker with a live session can block completion by changing the email, which triggers the snapshot refusal.
- **Initiate (one transaction; lock order case → Account `FOR UPDATE` → recovery):**
  - **Refuse when:**
    - the case is resolved (via `withCase`);
    - the Account is not role `customer` (D13);
    - the new email (case-insensitive) belongs to any Account (N1);
    - a **live** (unexpired) pending recovery exists for this Account or this new email. The owner must **cancel it explicitly** first.
  - **Auto-cancel:** an **expired** pending row for this Account or new email is auto-cancelled in the same transaction.
  - **Create** an `account_recoveries` row:
    - `pending`;
    - an `old_email` snapshot;
    - `new_email`;
    - `code_hmac` (an 8-digit code, keyed HMAC);
    - `attempts = 0`;
    - `expires_at` = now + 24 hours;
    - `unlink_google`.
  - **Record Activity:** `account_recovery_started`, with account and case subjects.
- **Emails after commit:**
  - The code goes to the **new** address, with idempotency key `recovery-code-<recoveryId>`.
  - A "recovery started" notice goes to the **old** address, best effort.
  - The raw code exists only in memory between commit and send.
  - **A recovery-code email has no Resend.** If it fails (`support_email_failed` is recorded), the owner cancels and initiates a fresh recovery, which gets a new row, a new code and a new key.
- **Customer completion at `/support/recover` (dynamic, noindex):** the customer enters the new email and the code.
  - **Lookup:** the pending row is found by `new_email` without a lock.
  - **Lock order, in one transaction:** **case → Account `FOR UPDATE` → recovery `FOR UPDATE`**. The Account lock is taken directly; changing the unique `email` column needs a `FOR UPDATE` row lock, so no upgrade happens later.
  - **Re-checks:**
    - the case is not resolved;
    - the recovery is still pending and unexpired, with fewer than 3 attempts;
    - the Account's role is still `customer`;
    - the Account's email still equals the `old_email` snapshot;
    - the new email is still free, checked case-insensitively.
  - **Wrong code:** increment `attempts`. The service **returns** a failure instead of throwing, so the increment **commits**. On the **third** wrong attempt it also sets status `cancelled` (consumed) and records `account_recovery_cancelled` with the note "attempts exhausted".
  - **Success:**
    - set `email` and `email_verified = true`;
    - delete the Account's `auth_sessions`;
    - delete the Google `auth_identities` row if `unlink_google`;
    - mark the recovery `completed`;
    - record `account_recovery_completed` (actor null, account and case subjects).
  - **Race:** a `23505` unique violation (a concurrent sign-up took the email) is caught, and the transaction rolls back, with the generic failure.
  - **Every failure** shows the same customer copy.
  - **After success:** completion notices go to the old and new addresses. The customer then signs in with an email code at the new address. Cards, Profiles and Orders are untouched, because the Account id is the same.
- **Resolve interaction:**
  - A case with a **pending** recovery **cannot be resolved**: `setCaseStatus` refuses under the case lock until the owner cancels the recovery.
  - A recovery on a resolved case cannot complete (re-check above).
- **Cancel:** the owner can cancel from the case (case → recovery). Records `account_recovery_cancelled`.
- **State machine:** `pending → completed` or `pending → cancelled`. Both are terminal and immutable.
- **Abuse:**
  - a per-IP `consumeQuota` on `/support/recover`;
  - the per-recovery attempt counter;
  - one pending recovery per Account and per new email (partial uniques).
  - Accepted residual: an attacker who knows a pending new email can burn its attempts; the owner then re-initiates.
- **N1 messaging:** the owner refusal explains that the email belongs to another Account and that merge is unsupported, and the case stays open. The `/support` account-recovery copy, the code email and the recovery page tell the customer not to sign in with the new address before completing.

### F7. Compromised account (D7)
- **Initiator:** an owner, on an open case linked to a `customer` Account, after verification and a confirm checkbox plus note.
- **"Secure account"** (case → Account `FOR UPDATE`):
  - deletes the Account's sessions;
  - optionally deletes the Google identity;
  - sends a notice to the Account email;
  - records Activity `account_sessions_revoked` and, if applicable, `account_google_removed`.
- **Does not** disable the Account or change Cards, Profiles or ownership.
- For a lost mailbox, continue with F6.

### F8. Owner reply, request for information, resolution
- **Recipient (deterministic):**
  - `requester_email` when present;
  - otherwise, the linked Account's **current** email;
  - otherwise, sending is unavailable.
- **Recipient display and change:** the send form shows the recipient. Linking an Account to a public case **never** changes the recipient.
- **"Send reply":**
  - a fixed subject;
  - a body of 2,000 characters or fewer;
  - a hidden attempt id generated at render;
  - sets the case to `waiting_on_customer`.
- **"Resolve":** may include a resolution notice.
- **Server guard (D4):**
  - reply and resolution bodies are rejected when they contain an activation-code-shaped token, meaning any 16-character Crockford run that `normalizeActivationCode` accepts after stripping separators;
  - the owner sees "Remove the activation code; give it to the customer directly".
- **Activity:** `support_email_sent` or `support_email_failed`, with the kind and attempt id but **no body**.
- **Retry:** Resend issues a fresh attempt id. Key: `case-<caseId>-<kind>-<attemptId>`.

### F9. Security notices for self-service changes (D11)
- **Triggers:** after the change commits:
  - email changed: the old address is read before the Better Auth call, and notices go to old and new;
  - Google removed;
  - signed out everywhere;
  - Google connected.
- **Google connected:** only when Google is added to an Account that **already existed**, not on a brand-new Google sign-up. It comes from the Better Auth account `create.after` hook, gated on the user pre-existing.
- **Delivery:** best effort via `after()`. It never blocks or fails the action.
- **Activity:** `security_notice_sent` or `security_notice_failed`, on the Account.

### Notice content rule (F1, F6, F7, F9)
Notices and the ack contain only:
- the event;
- the time;
- the case reference where one exists;
- a "contact support" line.

They **never** contain:
- the other email address;
- a recovery code (the code email to the new address is the only exception);
- an activation code;
- the submitted support name or message.

The subject is fixed, and no user-controlled text goes in any header.

## 5. Architecture

- **Modules:**
  - `support/intake.ts`: public and account intake, dedupe, the ack throttle, the category map, the owned-card link;
  - `support/email.ts`: case email dispatch and result events, the recipient rule, the activation-code guard;
  - `accounts/recovery.ts`: initiate, cancel, complete;
  - `accounts/secure.ts`: secure account;
  - `accounts/security-notice.ts`;
  - plain-text templates as pure functions beside `src/integrations/email`.

  Account mutation stays inside `accounts/`.
- **Routes:**
  - `src/app/(public)/support/page.tsx`: a static shell with viewer-aware prefill in a dynamic `Suspense` hole, plus a submit Server Action;
  - `src/app/(public)/support/recover/page.tsx` plus its action;
  - owner additions in `src/app/admin/support/[caseId]/*`.
- **Lock order** (extends decision 0009 and `src/modules/README.md`):
  - intake: no row locks on existing rows;
  - initiate, secure and cancel: case → Account `FOR UPDATE` (cancel skips the Account) → recovery;
  - completion: case → Account `FOR UPDATE` → recovery;
  - resolve: case → reads pending recovery;
  - none takes a Card or credential lock.
- **Waits, not deadlocks:**
  - Card claim's FK `KEY SHARE`, Support reset's `KEY SHARE` and profile setup's Account `FOR UPDATE` **wait** behind a recovery or secure transaction, and vice versa.
  - No Account→Case or Card→Account→Case path exists, so there is **no cycle**.
- **Caching:** the `/support` shell is static. Submit and `/support/recover` are dynamic and never cached.
- **Config:**
  - optional `SUPPORT_REPLY_TO`;
  - no Turnstile vars;
  - `.env.example` and `env-schema.ts` updated;
  - Production stays fail-closed.

## 6. Database: migration `0014_support_intake_recovery`

This is proposed, plain additive DDL. The final SQL is reviewed at T2, and it is applied nowhere until approved.

- **`support_cases` additions:**
  - new enum `support_case_source` (`owner`, `public`, `account`);
  - `source`: not null, default `owner`;
  - `requester_email`: lowercase CHECK, 254 characters or fewer;
  - `requester_name`: 100 characters or fewer;
  - `requester_message`: 2,000 characters or fewer;
  - `client_key`: uuid.
- **`support_cases` constraints:**
  - CHECK `source <> 'public' OR (requester_email IS NOT NULL AND opened_by_account_id IS NULL)`;
  - unique partial index on `client_key`;
  - index on `(source, status)`;
  - **partial index on `(requester_email, created_at) WHERE source = 'public'`**, for the 24-hour ack query;
  - a **`BEFORE UPDATE` only** trigger using `history_guard('source', 'requester_email', 'requester_name', 'requester_message', 'client_key', 'created_at')`. It runs only on UPDATE, so it never blocks DELETE (N2).
- **Table `account_recoveries`:**
  - columns: `id`, `support_case_id` (FK), `account_id` (FK), `old_email`, `new_email` (lowercase), `code_hmac` (64-hex CHECK), `attempts` (CHECK 0-3), `status` (CHECK in `pending`, `completed`, `cancelled`), `unlink_google`, `expires_at`, `created_by_account_id` (FK), timestamps, `completed_at`, `cancelled_at`;
  - unique partial indexes on `account_id` and on `new_email` WHERE `status = 'pending'`;
  - a guard trigger: `code_hmac`, `old_email`, `new_email`, `account_id`, `support_case_id` and `created_at` are frozen; status may only move `pending → completed` or `pending → cancelled`; `attempts` may only increase while pending; terminal rows are immutable; DELETE is blocked.
- **Unchanged:** existing guards. Activity types are an application union over a text column, so the DB doesn't change for them.
- **Also update:**
  - `SEED_TABLES` in `src/db/seed.ts`: add `account_recoveries`;
  - ERD regeneration and the `erd.db.test.ts` counts (26→27 tables, 15→16 enums);
  - guard tests;
  - `db:check` and `db:generate` clean.
- **Neon:** shared dev is at `0012`. Any shared apply order is `0013` then `0014`, each with its own pre-check, restore point and approval. Remote validation uses only a **temporary Neon branch**.

## 7. Canonical task sequence

| Task | Content | Commit |
|---|---|---|
| **T0** | Update `main`; confirm the M9A merge; cut the branch; set up the ledger; read the Next docs. Originally request D9 domain setup; the user revised D9 on 2026-10-15 to defer owned-domain delivery until launch. | none |
| **T1** | Pure domain:<br>• zod schemas (public form, recovery, reply);<br>• category→type map;<br>• constants;<br>• plain-text templates with notice-content tests;<br>• generic copy, including the N1 instruction;<br>• the activation-code-shaped detector;<br>• a reference helper. | `feat(support): intake schemas and email templates` |
| **T2** | Migration `0014`; schema; ERD; `SEED_TABLES`; guard tests. | `feat(db): support intake and recovery tables` |
| **T3** | Activity: nullable actor in the TypeScript type, new types, system-event rendering; tests. | `feat(activity): system actor and recovery event types` |
| **T4** | `support/email.ts`: dispatch with deterministic keys, result events, the recipient rule and the activation-code guard; fake sender; tests. | `feat(support): case email dispatch` |
| **T5a** | `support/intake.ts`: intake rules (F1/F2 fields, owned-card link, dedupe, quotas, 24-hour ack query); PGlite tests, including a no-Account-lookup assertion. | `feat(support): intake service` |
| **T5b** | The `/support` page and Server Action (signed out and in, honeypot, privacy notice); tests. | `feat(support): public support page` |
| **T6** | Contextual entry points: `/activate` copy and link, `/app/account`, Card detail, `/sign-in` (no `next`); tests. | `feat(app): contextual help links` |
| **T7** | Owner case additions: requester block, Send reply, Resolve with notice, source filter, email events, Resend; **`setCaseStatus` refuses resolve while a recovery is pending**; tests. | `feat(admin): support replies and requester context` |
| **T8a** | `accounts/recovery.ts` initiate and cancel, plus `accounts/secure.ts` (session revoke, Google unlink); refusal tests (owner Account, occupied email, live pending, resolved case). | `feat(accounts): recovery initiation and secure account` |
| **T8b** | Recovery completion: the lock order, the re-checks, committed wrong-attempt increments, third-attempt consumption, the `23505` mapping, session and Google deletion; tests. | `feat(accounts): recovery completion` |
| **T9** | Owner recovery UI (initiate, cancel, secure) and the `/support/recover` page and action; tests. | `feat(support): recovery workflow and completion page` |
| **T10** | Security notices for self-service changes; the gated Google-connected hook; tests. | `feat(auth): security notification emails` |
| **T11** | Concurrency scenarios R13-R19 in `check-support-concurrency.mts`. | `test(support): intake and recovery races` |
| **T12** | Docs (§10). | `docs(m9b): public support, recovery and email` |
| **T13** | Software gate (§9) and an independent whole-branch review. | fixes in separate commits |
| **T14** | **STOP: needs your approval.** Under revised D9, use the supported Resend testing sender. On approval: create a temporary Neon branch from dev, apply `0013` and `0014` there only, and set up a Vercel Preview with an isolated env. Stop before T15; tear down only after acceptance and explicit approval. | none |
| **T15** | **STOP: needs you.** Guided user-observed acceptance on the local production build and the Preview (§8.4); read-only SQL by me. Starts only on explicit user instruction. Revised D9 allows sandbox/injected-sender verification; unsupported real delivery observations remain deferred to launch. | ledger |
| **T16** | Integration: push or PR only after explicit approval. | none |

## 8. Testing strategy

### 8.1 Unit and domain
- Schemas: lengths, email normalisation, the honeypot.
- The category map.
- Templates: fixed subjects, **notice-content rule** (no other address, no codes, no echoed message).
- The activation-code-shaped detector, including separator and case variants.
- The recovery state machine.
- The reference helper.

### 8.2 Integration and DB (PGlite)
- **Migration guards:**
  - the requester CHECK;
  - the UPDATE-only freeze, with **case DELETE still allowed**;
  - the partial uniques;
  - recovery transitions, frozen fields and terminal immutability;
  - the seed with `account_recoveries`.
- **Intake:**
  - the field rules (assignee null, summary = label, `opened_by`, actor);
  - no Account query in the public path;
  - a foreign card is ignored;
  - dedupe;
  - the 24-hour ack rule;
  - quota keys.
- **Recovery:**
  - every refusal: owner Account, occupied email (N1), live pending, resolved case, expired, snapshot mismatch, role changed;
  - expired pending auto-cancelled at re-initiation;
  - **3 wrong codes then the right code fails**, with attempts committed and the third attempt cancelling the recovery;
  - double completion;
  - **resolve refused while pending**;
  - sessions and Google deleted;
  - Cards, Profiles and Orders unchanged;
  - `emailVerified` set;
  - HMAC only;
  - no recovery-code Resend path.
- **Email:**
  - the deterministic recipient;
  - activation-code bodies rejected;
  - exactly one result event per attempt.
- **Server actions:** authorize before calling the service, generic copy, unknown errors rethrown.

### 8.3 Concurrency (extend `check:support-concurrency`)
Expectation: **waiting is allowed. Every scenario must finish with no deadlock and exactly one consistent outcome.**

| Scenario | Race | Required outcome |
|---|---|---|
| R13 | Two simultaneous completions | One wins |
| R14 | Completion vs a self-service email change, simulated by a direct `UPDATE accounts SET email` on the second pool | Either the change lands first (completion is refused by the snapshot) or completion lands first. No lost update |
| R15 | Completion vs a same-Account Card claim | Claim waits or completes; one consistent state |
| R16 | Two initiations for the same Account or the same new email | One pending |
| R17 | Intake double submit with one `client_key` | One case |
| R18 | Completion vs owner `resetCardOwnership` on that Account's Card | Serialised, no deadlock |
| R19 | Completion vs `createProfileFromStarter` (Account `FOR UPDATE` → Card) | No deadlock |

Runs on loopback `neffi_m2_test` only, with real `pg_blocking_pids` waits.

### 8.4 Manual acceptance (you observe; I verify with read-only SQL)

| # | Scenario | You observe |
|---|---|---|
| A1 | Signed-out request | Success page; the case appears in the queue as public and unassigned; one ack (a second request from the same address within 24 hours sends none); a double submit gives one case; a filled honeypot is silently accepted |
| A2 | Signed-in request from Card detail | Account and owned Card pre-linked; a foreign card is not linked |
| A3 | Contextual help | `/activate`, `/app/account` and `/sign-in` link to `/support`; the typed code never appears in a URL |
| A4 | Owner reply and resolve | The email goes to the shown recipient; the case becomes waiting; a body with an activation code is refused; a forced failure shows a failed event and Resend works once |
| A5 | Lost code and wrong account | M9A actions plus M9B intake and resolution mail; the code is delivered out of band |
| A6 | Full recovery | Owner initiates; the code reaches the new inbox; the old inbox gets a notice **without the new address**; the customer completes; old sessions die; Google is removed; Cards and Profiles are intact; sign-in with the new email works.<br>Also covered:<br>• 3 wrong codes consume the recovery;<br>• expired;<br>• occupied email refused, with the N1 copy;<br>• resolving refused while pending;<br>• a resolved case can't complete;<br>• a failed code email requires cancel and re-initiate. |
| A7 | Secure account | Sessions revoked, a notice sent, no data changed |
| A8 | Security notices | Email change, Google remove or connect, and sign out everywhere each send one notice; no notice on a brand-new Google sign-up |
| A9 | Refusals | A customer session cannot reach owner actions; an owner Account is not recoverable; every `/support/recover` failure has identical copy; rate limits answer politely |
| A10 | Phone width | `/support` and `/support/recover` are usable at 390 px |

- **Approved D9 revision (2026-10-15):** T15 may proceed on explicit user instruction without a custom domain. The Resend testing sender supports delivery only to the Resend account owner; do not assume aliases or a second inbox are supported. Existing injected-sender automated tests verify contents, recipient selection, idempotency, failures, recovery transitions, session revocation and Activity without sending real mail. Do not deploy a fake sender or expose codes to work around sandbox limits.
- A1 acknowledgement, A4 reply/resolution/retry, A5 resolution, A6 new-inbox recovery code and old-inbox notice, A7 secure-account notice, and A8 security notices: delivery to unsupported recipients and all independent two-inbox observations are **DEFERRED — requires verified Neffi domain**. Supported account-owner inbox delivery may be observed, but never counts as two-inbox proof.
- A1-A10 application/UI/security behavior remains required. A6 recovery behavior and A8 multi-address notice behavior retain deterministic injected-sender coverage; any manual path that cannot obtain its code through the supported sandbox must be recorded as not observed, with automated evidence separate. No recovery/security rule is relaxed. Launch requires a verified Neffi-owned sender and real two-independent-inbox acceptance, including recovery and email-change notices.
- Observed and SQL evidence are kept separate, and no secrets are recorded.
- **Final user-approved reduced T15 scope (2026-10-15):** A1 basic public submission was observed; A4 core reply/resolution was observed and passed. A6 full live recovery is **DEFERRED — requires verified Neffi domain / independent destination inbox**. A7, A2/A3/A5/A8/A9/A10 and remaining edge subchecks are **NOT MANUALLY EXERCISED — covered by automated/integration/concurrency evidence** where applicable, with evidence limits recorded separately. Real phone usability and other skipped manual outcomes are not proven by rendering tests. This reduced development acceptance is sufficient to request cleanup/T16 approval; it is not a full original-matrix or launch pass. No security rule is weakened and no cleanup/push/PR/merge is authorized by this closure.

### 8.5 Preview and remote
- **Needed for:** supported Resend sandbox delivery, a public route and a Better Auth mutation. Independent external inbox delivery remains the revised D9 launch gate.
- **Where:** a temporary Neon branch only, torn down afterwards. Never `neffi-dev` or Production.

## 9. Final software gate (T13)

- **Checks:**
  - `pnpm lint` on tracked code, 0 errors;
  - `typecheck`;
  - `test` in a CI-equivalent env, excluding `.superpowers/**` and `.pnpm-store/**`; the M9A 1,162 tests stay green;
  - `db:check`;
  - `db:generate` with a clean `drizzle/` diff;
  - `db:erd` committed;
  - `build`;
  - `check:bundle`;
  - all concurrency suites on loopback;
  - a secret scan of new history;
  - a clean `git status`.
- **Independent whole-branch review must prove:**
  - no raw activation or recovery code is persisted or logged;
  - no email enumeration;
  - no Account mutation outside the audited recovery and secure services;
  - owner Accounts are unrecoverable;
  - the notice-content rule holds;
  - no activation code can be emailed;
  - no commerce email;
  - M4, M5 and M7 are untouched;
  - the A3 DTO is unchanged;
  - every sensitive action has Activity.

## 10. Documentation impact (T12)

- `PRODUCT.md`.
- `docs/roadmap.md` (M9B).
- `docs/specs/support-and-corrections.md`.
- `accounts-and-access.md`: amend line 30; document recovery, notices and the N1 rule.
- `cards-and-activation.md`.
- `docs/architecture/system.md` and `src/modules/README.md`: lock order and modules.
- `docs/operations.md`:
  - the `0014` pre-check, applied after `0013`;
  - the new env;
  - a recovery runbook, including "Secure account first if compromise is suspected" and the N1 instructions;
  - the Resend domain requirement.
- A short ADR for the D5 recovery model.
- `README.md`.
- The ERD.

## 11. Stop conditions

- Any change to your locked scope, D1-D9, N1, N2 or the D10-D13 defaults.
- Any contradiction between the plan, the code and Notion (log it as Blocked).
- Any guard change beyond §6.
- Any change to M4 retire or replace, the M5 claim, M6 card actions or the M7 resolver.
- Destructive operations.
- **Any Neon, Vercel, live Resend or Notion action** (T14 needs your approval).
- Migrating `neffi-dev`.
- Widening the A3 DTO.
- Role grants off loopback.
- New dependencies, including Turnstile.
- Anything from §3 Out.
- User evidence (T15).
- Push, PR or merge.

## 12. Definition of Done

1. F1-F9 work through the case workspace and public routes, with Activity on every sensitive action.
2. Public responses disclose nothing about Accounts, and the abuse caps and the 24-hour ack throttle are proven by tests.
3. Recovery completes only with owner initiation plus proof of the new inbox. It refuses resolved cases, occupied emails (N1) and owner Accounts. Wrong attempts commit and the third consumes the recovery. Sessions are revoked.
4. Email effects are idempotent per attempt. Failures never lose a case or block a security change. Notices follow the content rule. No activation code can be emailed.
5. The `0014` guards are proven, and R13-R19 pass alongside the existing 48 scenarios.
6. The T13 gate is green and the independent review is approved. The runnable T15 matrix passes, with observed, SQL and injected-sender evidence kept separate. Unsupported real-delivery observations are explicitly deferred under revised D9 and must pass with a verified Neffi domain before launch.
7. Docs are updated, and the M9A UX findings are recorded as deferred.

## 13. Risks and residuals

- **R1:** there is no owner MFA or step-up before recovery (M10). Mitigated by proof of the new inbox and by the notices.
- **R2:** Neffi does not yet own its public domain. Revised D9 permits pre-launch sandbox acceptance; real delivery from a Neffi-owned domain to two independent external inboxes remains a launch gate.
- **R3:** an unverified public email can receive one ack per 24 hours.
- **R4:** there is no Account disable, so a compromised mailbox holder keeps access until the swap (D7). The mitigation is to secure the account first.
- **R5:** there is no automatic email retry. Owners Resend case and notice emails, and recovery codes require re-initiation.
- **R6:** spam can enter the owner queue.
- **R7:** `/privacy` and `/terms` don't exist while personal data is collected. Covered by the inline notice for now (N2), and a launch item.
- **R8:** Neon dev still lacks `0013`. The shared apply is a separate approval.
- **R9:** an occupied new email (often an accidental self-created Account) blocks recovery (N1). Resolving it would need merge or deletion, both deferred.
- **R10:** an attacker who knows a pending new email can burn its 3 attempts. The owner re-initiates.

## 14. Recommended workflow after approval

1. T0 is complete. The original D9 domain request is superseded by the user-approved 2026-10-15 pre-launch sandbox ruling.
2. One agent task at a time, with a per-task review. The ledger stays local.
3. T13: independent review.
4. T14: stop for Neon, Vercel and Resend approval.
5. T15: guided acceptance, one scenario at a time.
6. T16: push or PR only on explicit approval.
