# Neffi Account Recovery Architecture Audit

> **Implementation history — not a current specification.** Retained as written for provenance; instructions, names and verification plans below describe that implementation context. Current contracts and superseding decisions are indexed in [the documentation authority map](../../README.md#authority-map); current status is in [roadmap](../../roadmap.md). Earlier GRC lifecycle assumptions are superseded by [0006](../../decisions/0006-grc-simple-commercial-line.md).


**Context.** We want two recovery paths: a self-service path for customers who still control their current email, and the existing support path for those who don't. This audit checks that idea against the code: Better Auth 1.7.7 (the installed source was read, so no public docs were needed), `src/auth/options.ts`, `src/modules/accounts/recovery.ts` and `secure.ts`, `/app/account`, `/support` and `/support/recover`, migrations 0001, 0007 and 0014, and ADR 0012. It is read-only: no files, migrations or databases were changed.

**Headline:** most of the self-service path already exists. Signing in with an email code proves control of the current email. `/app/account → Change sign-in email` then verifies the new email with a code sent there and commits the change. What is missing is three safety gaps in that flow and clear signposting. No new recovery flow, OTP purpose, table or migration is needed.

---

## 1. Current authentication architecture

**Sign-in**
- Methods are Google, or a 6-digit email code through Better Auth's `emailOTP` plugin (`options.ts:203-211`). Passwords are off.
- The code lasts 5 minutes, allows 3 attempts, is stored as `hmacHex(secret,"otp",code)`, and the stored identifier is hashed.
- Each verify consumes the code atomically, so a code cannot be replayed. Every send replaces the previous code.

**Creating Accounts**
- Signing in by email code with an **unknown email creates an Account**: `disableSignUp` is unset (`routes.mjs:411-421`).
- The hook `user.create.before` refuses `emailVerified !== true` and forces the role `customer` (`options.ts:169-174`).

**HTTP routes and quotas**
- Only `type:"sign-in"` codes can be requested over HTTP (`options.ts:153`).
- Every other Better Auth route is disabled over HTTP, including change-email, revoke-sessions and unlink (`options.ts:30-63`). The same functions can still be called from the server through `auth.api.*`.
- Sign-in sends are limited to 50 per IP per day, 3 per email per 10 minutes and 10 per email per day, using HMAC-keyed `consumeQuota` (`otp-quota.ts:28`, IPv6 grouped by /64 in `client-ip.ts`). There is also 10 per IP per minute at the HTTP layer.
- Known and unknown emails get the same response.

**Google**
- `disableImplicitLinking`, `allowDifferentEmails:false`.
- A new Google sign-in whose email matches an existing Account is refused (`account_not_linked`). Linking is only possible while signed in, and only with the same email.
- A linked Google identity is matched by Google's account ID, so it still reaches the Account if Google's email changes.
- No Account can sign in only through Google: an email code always works for `accounts.email`.

**Sessions**
- Sessions last 30 days and renew daily, with no cookie cache, so revocation takes effect on the next request.
- `freshAge` is the Better Auth default of 1 day. Today only Google removal (`unlinkAccount`) enforces it.

**Schema**
- `accounts.email` has a plain `UNIQUE` that is **case-sensitive** (`0001:11`). Lowercase is enforced only in code: Better Auth lowercases, and recovery compares with `lower()`.
- Other tables: `auth_identities` (Google rows only), `auth_sessions`, `auth_verifications`, `auth_otp_quotas`.

**Email change today, at `/app/account`** (`account/actions.ts:30-49`)
- It calls `auth.api.requestEmailChangeEmailOTP` then `changeEmailEmailOTP`. The code goes to the **new** address only.
- It is limited to 3 per Account per 10 minutes.
- An address already in use silently gets no email, with the same success response (`routes.mjs:663-666`).
- Notices go to both the old and new addresses.
- It does **not** send a code to the current email, and does **not** revoke other sessions.
- The request runs through `sensitiveSessionMiddleware`, which does not check session age. So the `STALE` message, which expects a 403, **can never appear**: a 29-day-old session, or a stolen one, can change the email.

## 2. Current support-recovery architecture

Owner side (`/admin/support/[caseId]` → `initiateRecovery`, `recovery.ts:33-65`):
- Requires an active `account_recovery` case linked to a **customer** Account, a confirmation checkbox, and a verification note of 10–300 characters with no secrets in it.
- The new email is lowercased and must not be in use by any Account (case-insensitive).
- Only one recovery can be pending per Account, and one per new email (partial unique indexes). Expired rows are cancelled automatically when a new recovery starts.
- Locks the case `NO KEY UPDATE`, then the Account `FOR UPDATE`.

Customer side (`/support/recover` → `completeRecoveryAction` → `completeRecovery`, `recovery.ts:77-111`):
- Rate-limited to 10 per IP per 10 minutes. Looks up the pending row by new email.
- Locks case → Account `FOR UPDATE` → recovery row.
- Rechecks: case active, row pending and unexpired, attempts < 3, customer role, the old-email snapshot equals the current email, and the new email is still unused.
- Then compares the code HMAC in constant time.
- On success, in **one transaction**:
  - sets `email` and `emailVerified=true`
  - deletes **all** sessions
  - deletes Google if `unlink_google` (default on)
  - marks the row completed
  - records anonymous Activity
- After the commit, notices go to the old and new addresses.
- Every failure returns one generic message. A 23505 race also returns the generic failure, with nothing written.

"Secure account" revokes all sessions and optionally Google, without changing the email.

## 3. Current recovery-code lifecycle

| Property | Implementation |
|---|---|
| Created by | The server, when an owner starts recovery. The owner **never sees** the code. |
| Format | 8 digits, `randomInt(1e8)` |
| Storage | `hmacHex(secret,"account-recovery","<id>:<code>")` only. The row ID is bound into the MAC, and a CHECK enforces 64 hex characters. |
| Delivery | Emailed by Neffi **to the new address only**, with idempotency key `recovery-code-<id>`. The old address gets a "recovery started" notice. |
| Expiry | 24 hours |
| Attempts | 3. The third wrong code cancels the recovery. A wrong attempt is returned (not thrown), so the counter commits. |
| Single use | Status moves from `pending` to `completed`. A trigger makes finished rows immutable and blocks DELETE. |
| Revocation | The owner can cancel. There is no resend: cancel and start again. |
| Audit | Activity for started, sent or failed, cancelled and completed. Never contains the code. |
| Leakage | The code never appears in a URL (the email only gives the path as text), in returned state, in logs or in storage. Sentry scrubbing covers request bodies, queries and SQL parameters. |

## 4. Problems with the current model

1. **Signed-in email change is the weakest link.** A session of any age, including a stolen one, can move the Account to an attacker's inbox. Other sessions survive, and the `STALE` copy is unreachable.
2. **The change-email quota only counts per Account.** There is no daily cap and no per-target cap, so a single Account can send about 432 codes a day to someone else's address.
3. **Customers aren't told which path to use.** `/support` tells everyone with access problems to "continue account recovery", and claims "you were sent a recovery link". **No link is ever sent.** Nothing directs people who still have their email to the much simpler sign-in-then-change route.
4. Minor issues:
   - An expired pending recovery is never cancelled when someone tries to complete it, so it keeps blocking the case from being resolved until an owner cancels it.
   - Anyone who knows the pending new email can cancel a recovery with 3 wrong codes. This only blocks recovery temporarily; it cannot take over the Account.
   - The uncommitted `page.tsx` no longer uses `RECOVERY_INSTRUCTION`, so its wording can drift from the email and `/support`.

## 5. Self-service recovery feasibility

**Feasible today with existing parts. Building a separate `/recover` OTP flow is not recommended.**
- A dedicated flow would need a new purpose-scoped code ("recover" without account creation). It would re-implement what sign-in already provides, with the same enumeration protection, quotas and hashing, and add a second public surface that sends codes and must be kept from creating Accounts.
- With sign-in, a typo in the current email creates an empty Account. That is existing, documented sign-in behaviour, and the signposting copy reduces it. With `disableSignUp` it would *instead* tell visitors which emails have Accounts.
- Order of steps: prove the old email (sign in) → enter the new email → prove the new email (code) → commit. That is exactly what the user asked for, and it does not invent a business rule.

## 6. Better Auth compatibility

- **Supported directly:** `changeEmail` (enabled), `requestEmailChangeEmailOTP` and `changeEmailEmailOTP`, which recheck that the new email is unused before committing. Also `revokeOtherSessions` and `revokeSessions`, which can be called from the server even though their HTTP routes are disabled.
- **`changeEmail.verifyCurrentEmail` exists in 1.7.7** (`routes.mjs:649-651`). It needs an `email-verification` code for the current address, which the before-hook blocks over HTTP. Turning it on would mean allowing a second code type. Requiring a recently created session gets the same proof (the user just signed in with a code to that address, or with Google) without that, so it is not recommended now.
- **Session age:** not enforced by `requestEmailChangeEmailOTP` (it uses `sensitiveSessionMiddleware`). It must be checked in our server action from `session.createdAt`.
- **Provider records:** email-code sign-in has no identity row, so nothing needs relinking. The Google row is matched by Google's account ID and stays valid after an email change.
- **Custom recovery state:** none needed for self-service. Support recovery keeps `account_recoveries`.

## 7. Option comparison

| | A: support only | **B: self-service + support fallback** | C: self-service only | D: new dedicated `/recover` code flow |
|---|---|---|---|---|
| Security | Strong, but signed-in change stays weak | Strong once the §8 gaps are closed | Locks out people who lost their inbox | Second code surface; risk of creating Accounts |
| UX | Slow; needs a human for every case | Fast for most people | Dead end for people who lost their inbox | Duplicates sign-in |
| Complexity | None | Small (3 hardening changes, copy) | Small | High (new OTP purpose, state, tests) |
| Support burden | High | Low | Shifts to impossible cases | Low |
| Takeover risk | Unchanged | Lower than today (fresh session + revoke others) | Same as B | New surface |
| Duplicate-Account risk | Present (signing in at new address) | Reduced by signposting | Same as B | Same as B |
| Better Auth fit | n/a | Native | Native | Partly custom |
| Maintenance | Low | Low | Low | High |

## 8. Recommended architecture

**Option B, built from what already exists: sign in, then change email. Keep `/support/recover` for people who lost their inbox.** Changes:
- **H1, recent-session requirement for email change.** In `requestEmailChangeAction` *and* `confirmEmailChangeAction`, read the session (`auth.api.getSession`) and refuse if `session.createdAt` is older than **15 minutes** (decision D1). Return the existing `STALE` copy with a link to `/sign-in?next=/app/account`. Remove the 403 check for email change, which can never fire.
- **H2, sign out other devices on success.** After `changeEmailEmailOTP` succeeds, call `auth.api.revokeOtherSessions({ headers })`. Schedule the `email_changed` notice **before** revoking, so a revoke failure cannot stop it. The current session stays: it just proved both the old and new email.
- **H3, change-email quotas.** Keep 3 per Account per 10 minutes. Add 10 per Account per day, plus 3 per 10 minutes and 10 per day per **target email** (HMAC keys `email-change-day`, `email-change-target`, `email-change-target-day`), using the same calls as sign-in in `options.ts:159-161`.
- **H4, signposting.** See §17.
- Support recovery keeps its logic. Copy and visual fixes are in §18. Optionally, at completion, cancel a pending row that has expired (it is already locked) so it stops blocking the case.

## 9. Self-service user journey (A: still has access to current email)

1. On `/sign-in` or `/support`, they choose "I can still get into my email" and land on `/sign-in?next=/app/account`.
2. They enter their **current** email and the 6-digit code. Both known and unknown emails get the same response. This gives a fresh session.
3. In `/app/account → Change sign-in email` they enter the new email, and a code goes to the new email. If that email belongs to another Account, no code is sent and nothing reveals why.
4. They enter the code. Better Auth checks the email is still unused, then updates `email` and `emailVerified`. Other sessions are revoked, and notices go to the old and new addresses.
5. If their session is older than 15 minutes, they see "sign out and sign in again" with a sign-in link.

## 10. Support-assisted user journey (B: lost access to current email)

1. On `/support`, they choose "I can't get into my email" and send the form with the Account access topic, giving an unverified contact email.
2. An owner verifies ownership outside Neffi, then starts recovery for an unused new email. Neffi emails the 8-digit code to that address and a "recovery started" notice to the old one.
3. The customer **must not sign in at the new address yet**. They go to `/support/recover` and enter the new email and the code.
4. Their email changes, all sessions and (by default) Google are revoked, and notices go to both addresses. They then sign in with a code at the new address, back into the same Account.

**Other journeys:**
- **C, active session wants to change email:** this is journey A from step 3, with the recent-session requirement. An old session gets the "sign in again" link.
- **D, new email already belongs to another Account:**
  - Self-service: no code arrives (the silent refusal). The copy on the code step hints that the address may be mistyped or unavailable.
  - Support: starting recovery is refused with `email_taken`. They choose another address. Merging is a documented non-goal.
- **E, support recovery code expired:** the generic failure appears. The customer contacts support, and the owner starts a fresh recovery, which cancels the expired row automatically.
- **F, started support recovery, then regained the original email:** they can sign in with the old email, because it is still current until completion, and use self-service. The pending recovery then fails the old-email snapshot check and can never complete. The owner cancels it and resolves the case. If the "recovery started" notice was a surprise, the owner uses **Secure account**.

## 11. Email verification strategy

- **Old email:** proven by signing in with a code, or by a Google identity already linked, at most 15 minutes earlier.
- **New email:** always proven by a code sent to the new address before anything is committed. **Never** prove anything by sending a code to an arbitrary new address alone: the self-service flow requires an authenticated session, and the support flow requires an owner to start it.
- **Edge cases:**
  - Case: inputs are lowercased in both flows, and recovery compares with `lower()`. Better Auth compares the lowercased input.
  - Invalid: Zod rejects it with the "valid email" message.
  - Already pending in another recovery: self-service does not check `account_recoveries`. It would succeed, and that recovery would later fail with the generic error, so the owner starts again. This is low risk; see open question Q2.

## 12. Enumeration and rate-limit strategy

- **No new public lookup.** Sign-in already responds identically for known and unknown emails. Change-email silently refuses addresses in use. `/support/recover` gives one generic failure for everything.
- **Keep** the sign-in limits (IP/day, email/10-minute, email/day, IP/minute), the recovery limit of 10 per IP per 10 minutes, and the 3-attempt counter on each row.
- **Add H3** to stop email-bombing from inside an Account.
- **No global recovery quota needed.** Brute force on an 8-digit code is capped at 3 tries per row, a chance of 3×10⁻⁸. Repeated cancelling by an attacker only blocks recovery temporarily and the owner can restart; revisit if it is seen in practice.
- **IPv6:** keep the /64 grouping.

## 13. Session strategy

| Path | On success |
|---|---|
| Self-service change | **Revoke all other sessions and keep the current one** (H2). It has just proven both emails. |
| Support recovery | **Revoke all sessions, force a fresh sign-in at the new address**, and remove Google by default (unchanged). The customer has no trusted session. |
| Secure account | Revoke all sessions, optionally remove Google (unchanged) |

All three notify the affected addresses and never include codes or the other address.

## 14. Transaction and data-integrity design

- **Support recovery (already correct):** email, `emailVerified`, deleting sessions, deleting Google, completing the row and Activity all happen in one transaction under case → Account → recovery locks. A unique-email race rolls the whole thing back. Notices go after the commit, best-effort, deduplicated through Activity.
- **Self-service:** Better Auth's `updateUser` is a single-row write guarded by the unique constraint. H2's revoke runs after that write and is **not** in the same transaction. That is acceptable: the email change is the security-critical write, and a failed revoke leaves an error with the email already changed and the notice already scheduled. The user can use "Sign out everywhere". Wrapping Better Auth in our own transaction would mean bypassing it, which isn't worth it.
- **Recovery racing self-service:** concurrency check R14 already shows the snapshot check makes recovery fail safely after any other email change.

## 15. Threat model

| Threat | Mitigation |
|---|---|
| Attacker knows the victim's email | Sign-in needs the inbox code; recovery needs owner approval plus the code at the new inbox |
| Attacker controls a proposed new email | Self-service needs a recent authenticated session; support needs owner verification outside Neffi. The new inbox alone proves nothing. |
| Stolen or old session cookie | **H1** (15-minute window) plus the old-address notice and Secure account. Today this is open. |
| Support conversation intercepted | The code is emailed only to the new inbox and is never shown to the owner or put in the case. Notes refuse 8-digit strings. |
| Recovery-code brute force | 3 attempts per row (3×10⁻⁸) plus 10 per IP per 10 minutes |
| Reused code | Status is terminal and a trigger keeps it immutable. Sign-in codes are consumed atomically. |
| Stale approval | 24-hour expiry, plus the old-email snapshot check at completion |
| New email already registered | Refused in both flows; no merge |
| Google identity collision | Google is matched by its account ID; Google sign-in with a matching email is refused; recovery removes Google by default |
| Signing in at the new address before completing | Creates an Account in the way, which recovery refuses. Mitigated by the warning on `/support/recover` and the new signposting. Support then picks another address. |
| Login racing recovery | Recovery locks the Account and checks the snapshot. A sign-in session is created normally, then deleted by completion. |
| Session changes email while a recovery is pending | The snapshot no longer matches, so recovery fails safely (R14) and the owner cancels |
| Concurrent recoveries | Partial unique indexes plus row locks; R13 and R16 |
| Email bombing | H3 plus the existing sign-in and intake quotas |

## 16. Database and schema impact

None of the suggested new tables (`recovery_requests`, `email_change_requests` and so on) is needed. `account_recoveries` and `auth_verifications` cover both paths.

- **Schema migration required: NO.**
- **Data migration required: NO.**
- Optional and deferred: a CHECK on `accounts.email` (`= lower(email)`). Not needed, because every writer lowercases.

## 17. Route and UI architecture

**No new route.** Self-service recovery *is* `/sign-in` followed by `/app/account`, and `safeNext` already allows `/app/account`.

- **Where people choose:** the existing account-access `RecoverySection` on `/support` (`support/page.tsx:38-62`) becomes a two-way choice:
  - **"I can still get into my email"**: "Sign in with a code sent to your current email, then change your sign-in email in Account." Links to `/sign-in?next=/app/account`.
  - **"I can't get into my email"**: "Contact support. After verifying it's you, we'll email a recovery code to your new address." Links to the support form with the recovery topic.
  - **"Already have a recovery code?"**: links to **Complete recovery** at `/support/recover`.
  - The existing "don't sign in at the new address yet" warning (`RECOVERY_INSTRUCTION`) stays.
- **Sign-in page:** relabel the existing "Having trouble signing in? Get help" link as "Lost access to your email?", pointing at that section on `/support`.
- **`/app/account` change-email copy:**
  - Add "Other devices will be signed out" and the hint about missing codes.
  - The `STALE` state shows a "Sign in again" link.
- `/support/recover` keeps its name and purpose.

## 18. `/support/recover` copy accuracy

| Current or proposed text | Accurate? | Note |
|---|---|---|
| "Verified by support" (completed) | Yes | The owner verified the request and started recovery |
| "Enter recovery details" / "Access restored" | Yes | |
| "Do not sign in with your new email yet…" | Yes | Should reuse `RECOVERY_INSTRUCTION` instead of the paraphrase |
| `/support`: "or you were sent a **recovery link**" | **No** | Only a code is ever emailed. Remove "link". |
| Proposed: "Enter the new email and recovery code Neffi support sent after approving your recovery request." | Mostly | More precise: "…the recovery code **emailed to your new address** after Neffi support approved your request." |
| Proposed field help: "This code is sent after Neffi support verifies and approves your recovery request." | Yes | Add: "It expires after 24 hours." Optionally add that three wrong tries cancel it. |
| Proposed: "Haven't received a recovery code? Contact support →" | Yes | There is no resend; the owner cancels and starts again |

Visual changes, for Codex to make later:
- **Completed step:** from `bg-brand/10 text-brand border-brand/25` to a neutral treatment (`bg-subtle text-foreground border-border` with a Check icon).
- **Current step:** `bg-brand text-white` is already correct.
- **Upcoming step:** already muted.
- **CTA:** replace the className overrides with `variant="action"`. This keeps white text and the Vermilion background, consistent with the support form.
- **Shield icon:** the Vermilion tint is chrome. Make it neutral, following the visual direction rule.

## 19. Required tests

Self-service (`account/actions.test.ts`, `auth/account-controls.db.test.ts`):
- **Recent session (H1):**
  - Requesting with a session older than 15 minutes returns `STALE` and sends nothing.
  - Confirming with a stale session also refuses.
  - A fresh session succeeds.
- **Revoking sessions (H2):**
  - After a successful change, a second session for the same Account is gone and the current one is still valid.
  - A failed code revokes nothing.
  - The notice is scheduled before the revoke.
- **Quotas (H3):**
  - The daily per-Account cap.
  - Per-target 10-minute and daily caps, counted across two Accounts.
  - Keys are HMACs.
- **Existing coverage, keep and assert:**
  - A new email that is in use gets no email and the same response.
  - Correct code → email and `emailVerified` set.
  - The code cannot be replayed.
  - 3 wrong attempts → `TOO_MANY_ATTEMPTS`.
  - Expiry.
  - A linked Google identity survives the change and still signs in to the same Account.
  - A concurrent change to the same target lets only one through (23505 → generic).
- **Unknown-email privacy on sign-in:** the existing test `email-otp.db.test.ts:135`.

Support recovery: existing coverage is already complete (`recovery.db.test.ts`, `recovery-to-sign-in.db.test.ts`, `intake-recovery-guards.db.test.ts`, checks R13–R19). Add:
- A self-service change while a recovery is pending → completion fails generically and the row stays pending.
- If the optional expired-row cancellation is built, a test for it.

Security / UI:
- `/support` copy has no "recovery link"; the two-way choice and the link targets render.
- `/support/recover` renders `RECOVERY_INSTRUCTION` and the new field help.
- No code ever appears in a URL, returned state or storage. Existing tests cover this; extend them to the new copy.

## 20. Documentation impact

- **`docs/specs/accounts-and-access.md`** (Identity rules, Recovery): the recent-session window, revoking other sessions, the new quotas, and the two-way choice.
- **`docs/specs/support-and-corrections.md`** (Account recovery): the signposting, and the optional expired-row cancellation.
- **ADR 0012:** add a consequence: self-service sign-in-then-change is the primary path, and support recovery is for lost inboxes.
- **`PRODUCT.md:69-73`:** one sentence on the self-service path.
- **`docs/operations.md`**, M9B recovery runbook: for customers who still have their inbox, point them to self-service.

## 21. Implementation sequence (Codex, feature branch, TDD, one commit per step)

1. **H1:** a recent-session helper in `account/actions.ts` (read `session.createdAt` through `auth.api.getSession`), used in both email-change actions. Tests.
2. **H2:** `revokeOtherSessions` after a successful change, with the notice scheduled first. DB test.
3. **H3:** change-email quotas, reusing `consumeQuota` and `hmacHex`. Tests.
4. **Signposting:** the two-way choice on `/support`, the sign-in help link, and the `/app/account` copy. Page tests.
5. **`/support/recover`:** copy and visual changes (§18). Page tests.
6. Optional: cancel an expired pending recovery at completion. DB test.
7. Docs (§20).
8. Verify: `pnpm test`, `typecheck`, `lint`, then `check:support-concurrency` on loopback. Manual check only for what automation can't show: one real inbox, journey A end to end.

## 22. Risks and open questions

- **D1:** the recent-session window: **15 minutes** (recommended; email change is the most powerful thing a customer can do), or Better Auth's default `freshAge` of 1 day (looser, and matches Google removal).
- **D2:** revoke other sessions on a self-service change: **yes** (recommended).
- **D3:** the two-way choice inside the existing `/support` section, with **no new route** (recommended), or a separate `/recover` page.
- **Q1:** should an Account linked to Google count as proof of the old email? A recent Google sign-in proves the Google identity, not the inbox. I recommend accepting it: it already gives full Account access. `verifyCurrentEmail` stays available if you want inbox proof specifically.
- **Q2:** should self-service refuse a new email reserved by another Account's pending recovery? Deferred: it is low risk, and that recovery fails safely.
- **Residual risks:**
  - A session stolen less than 15 minutes ago can still change the email. The old-address notice and Secure account limit the damage.
  - Mistyping the current email at sign-in creates an empty Account. This is existing behaviour.

## 23. Final recommendation

**ADD SELF-SERVICE + KEEP SUPPORT FALLBACK**, built from the existing sign-in and change-email flow instead of a new recovery code flow.
- The repository already does verify old email → enter new → verify new → commit, through Better Auth's native `changeEmail`, with enumeration-safe responses, hashed single-use codes and notices to both addresses.
- A separate `/recover` code flow would duplicate sign-in and add a second public code-sending surface that must be kept from creating Accounts.
- The real gaps are: email change accepts sessions of any age, it leaves other sessions signed in, its quotas only count per Account, and customers aren't told which path to use. H1–H4 close them with no schema or data migration.
- Support recovery stays as it is, apart from copy, for customers who lost their inbox. Its transaction, locks, code lifecycle and audit trail are already sound.

**Approved decisions (2026-10-19):**
- **D1:** a 15-minute recent-session requirement for self-service email change.
- **D2:** after a successful self-service email change, revoke all other sessions and keep the current verified session.
- **D3:** keep the two-way recovery choice inside the existing `/support` page. No new `/recover` route.
