# Recovery Code 8 → 6 Digit Audit

> **Implementation history — not a current specification.** Retained as written for provenance; instructions, names and verification plans below describe that implementation context. Current contracts and superseding decisions are indexed in [the documentation authority map](../../README.md#authority-map); current status is in [roadmap](../../roadmap.md). Earlier GRC lifecycle assumptions are superseded by [0006](../../decisions/0006-grc-simple-commercial-line.md).


**Context.** The proposal is to shorten the support-assisted recovery code from 8 digits to 6. That would match the 6-digit sign-in code and fit six boxes on mobile. This is a read-only audit traced from the current code, including the uncommitted segmented input on `/support/recover`. No files, migrations or data were changed.

**Key finding.** Guessing a recovery code can only complete the recovery that was already approved: the Account moves to the new address the owner entered. Nothing in the completion step lets an attacker choose a different destination. So a correct guess gives an attacker **no access**. The code proves the customer controls the approved new inbox. It is not the factor that protects the Account.

---

## 1. Current implementation (traced)

| Stage | Where | Detail |
|---|---|---|
| Generator | `src/modules/accounts/recovery.ts:37` | `String(randomInt(100000000)).padStart(8, "0")`, using `node:crypto` `randomInt`. Uniform and unbiased (it rejects out-of-range draws). Leading zeros are kept. |
| HMAC | `recovery.ts:17` | `recoveryLookup = hmacHex(secret, "account-recovery", "<rowId>:<code>")`, with `env.betterAuthSecret` |
| Storage | `db/schema/operations.ts:77,88`, `drizzle/0014:8,19,53` | `code_hmac text NOT NULL`, CHECK `^[0-9a-f]{64}$`, and a trigger that blocks any change to it. **No raw code and no length is stored.** |
| Owner start | `admin/support/[caseId]/actions.ts:95-99` → `initiateRecovery` | Requires OWNER, a confirmation, a 10–300-character note, a customer Account, an unused new email, and no live pending recovery. The owner never sees the code. |
| Delivery | `recovery.ts:59`, `support-templates.ts:23-25` | Emailed only to the new address: "Your one-time recovery code is {code}. It expires in 24 hours." No resend. |
| Validation | `modules/support/domain.ts:17` | `recoveryCompletionSchema.code = z.string().trim().regex(/^\d{8}$/)` |
| Rate limit | `(public)/support/recover/actions.ts:13`, `domain.ts:22` | `consumeQuota` keyed on `recovery-ip` by IP (IPv6 grouped by /64), **10 per 10 minutes**, applied before parsing |
| Lookup | `recovery.ts:81` | An unlocked select **by `new_email` with status pending**. The partial unique index allows at most one such row. |
| Comparison | `recovery.ts:90-91` | Under lock order case → Account → row: rechecks expiry, `attempts < 3`, the old-email snapshot and that the new email is unused, then `sameLookup` (`timingSafeEqual`) |
| Attempts | `recovery.ts:92-95` | A wrong code adds 1 and the update commits. The third cancels the row and records Activity "attempts exhausted". |
| Success | `recovery.ts:97-101` | One transaction: `email = row.newEmail`, verified, all sessions deleted, Google optionally removed, row completed, Activity recorded |
| UI | `(public)/support/recover/recovery-form.tsx` (uncommitted) | `RecoveryCodeSlots`: one hidden real input with `pattern [0-9]{8}`, length 8, `aria-label "8-digit recovery code"`, and 8 boxes in a 4+4 layout. Submit is enabled at `code.length === 8`. |
| Secret filter | `modules/support/credentials.ts:9` | `containsStoredCredential = activation code shape OR /\b\d{8}\b/`. Applied to intake message and name (`intake.ts:17`) and to recovery and secure notes (`recovery.ts:35`, `secure.ts:17`). Owner email bodies only use the activation filter (`email.ts:18,38`). |

## 2. Exact affected files

**Code**
- `src/modules/accounts/recovery.ts:37`: generator.
- `src/modules/support/domain.ts:17`: schema becomes `^\d{6}$`.
- `src/modules/support/credentials.ts:9`: filter (see §12).
- `src/app/(public)/support/recover/recovery-form.tsx`: 6 boxes, using the shared component.
- `src/app/(public)/sign-in/sign-in-form.tsx`: switch its local `OtpSlots` to the shared component.
- **New:** `src/components/code-slots.tsx` (see §11).

**Tests and scripts** (8-digit samples and patterns)
- `src/modules/support/domain.test.ts:20-26,58,61-62`
- `src/modules/accounts/recovery.db.test.ts:25,27,46,87`
- `src/journeys/recovery-to-sign-in.db.test.ts:41,43,83,85`
- `src/app/(public)/support/recover/actions.test.ts:11,15,23`
- `src/app/(public)/support/recover/recovery-form.test.tsx:44,61,69,103,121,142-144` (untracked)
- `src/modules/support/intake.db.test.ts:28`
- `scripts/check-support-concurrency.mts:256`

**Docs**
- `docs/decisions/0012-support-controlled-account-recovery.md:7` ("eight-digit")
- `docs/specs/support-and-corrections.md:71` ("eight digits") and `:73` (filter rule)
- `PRODUCT.md:75` ("eight-digit")

**Checked and unaffected**
- Schema, migrations, trigger and ERD: HMAC only.
- Seed and fixtures: the seed leaves `account_recoveries` empty.
- Email template: takes the code as a value.
- `/support/recover/page.tsx`, `page.test.tsx`, `operations.md`, `accounts-and-access.md`, `system.md`.
- Sentry scrubbing, the owner UI and `queries.ts`: `code_hmac` is never selected.

## 3. Security comparison

| | 8 digits | 6 digits |
|---|---|---|
| Possible codes | 10⁸ | 10⁶ |
| Chance per recovery with 3 guesses | 3×10⁻⁸ | **3×10⁻⁶** |
| What a correct guess gives an attacker | Moves the victim to the victim's own new inbox | Same |
| For comparison, public sign-in code | n/a | 6 digits, 3 attempts per code, but new codes can be requested freely: about 30 guesses per email per day, and a hit gives **full Account access** |

## 4. Online guessing analysis (real controls)

- **Attempt limit per row:** 3 wrong guesses in total for each recovery row, counted on the row and not per IP. The third cancels it for good. Spreading guesses across many IPs or IPv6 ranges gives **no extra guesses**; it only gets around the 10 per 10 minutes per IP, which doesn't matter because the row cap is 3.
- **New guesses need a new row:** each requires an OWNER to verify a support case and start recovery again. An attacker cannot create rows.
- **Prerequisite:** the attacker must know the exact pending new email, which is private. Probing gives no signal: a missing row, a wrong code, an expired row and a quota refusal all return the same `RECOVERY_FAILURE`. So pending recoveries cannot be listed. The only leftover hint is timing: a pending row takes a transaction. That needs the email anyway and is unchanged by code length.
- **Per issued recovery:** at most a 3×10⁻⁶ chance that a blind guesser completes it. Even if every recovery Neffi ever issues (say 1,000) were attacked, the expected number of successes is 0.003, and each one gives the attacker nothing (§5).

## 5. Threat model

| Threat | Changed by 8 → 6? |
|---|---|
| Attacker knows the victim's old email | No. The code goes only to the new inbox; the old address gets a notice. |
| Attacker knows the approved new email | Barely. 3 guesses per row (3×10⁻⁶), and success **moves the Account to the victim's own inbox** |
| Attacker controls the approved new inbox | No. They receive the code whatever its length; support verification is the defence. |
| Attacker intercepts the support conversation | No. The code never passes through support (emailed directly, never shown to the owner). |
| Guessing codes | No meaningful change (above) |
| Guessing from many IPs | No. The cap is per row, not per IP |
| Repeated recovery restarts | No. Each needs an owner to act |
| Replayed code | No. Status is terminal and the trigger keeps it immutable |
| Expired code | No. Rechecked under lock |
| Concurrent attempts | No. Row `FOR UPDATE`; R13 already covers it |
| Listing pending recoveries | No. One generic failure for everything |
| Blocking a recovery with 3 wrong guesses | No. It doesn't depend on length; the owner starts again |
| **New, only edge case** | A blind guess that succeeds completes a recovery the customer hasn't finished. Their sessions and Google are revoked and the email moves to the address they asked for. It's a nuisance, not a takeover. At 3×10⁻⁶ per row it is negligible. |

## 6. Rate-limit assessment

**The current controls are enough. Add nothing.**
- A global quota, a quota per recovery, or stronger IPv6 grouping would protect against a risk that a correct guess doesn't create.
- The 3-guess cap on each row already bounds guessing regardless of IP.

## 7. Support approval as a security factor

A public 6-digit sign-in code is the *only* factor and grants access by itself. A recovery code is a second factor that comes after:
- a human owner verifying ownership outside Neffi,
- a confirmation and an audit note,
- an unused destination fixed by the owner,
- a matching old-email snapshot,
- a 24-hour single-use window.

The code only answers one question: "does the person controlling the approved inbox want to finish?" Owning the code alone never decides who owns the Account. That is why 6 digits is safe here, even though the same length with weaker surrounding controls would not be.

## 8. Database and schema impact

Only `code_hmac` (64 hex characters) is stored. There is no length constraint, no index on the code, and no raw value. The trigger only freezes the column. The row ID is mixed into the HMAC, so 6-digit codes cannot collide across rows.

- **Schema migration required: NO.**
- **Data migration required: NO.**
- **Dev data reset required: NO.**

## 9. Dev-data handling

- Any pending dev recovery with an 8-digit code fails the new `^\d{6}$` check and returns the generic failure. It cannot complete.
- Handle these with the existing UI: the owner presses **Cancel**, then starts recovery again to get a 6-digit code. Rows past their expiry are cancelled automatically at the next start.
- No SQL, no reset, no backward compatibility. Production accepts only 6 digits.

## 10. Generator design

`String(randomInt(1_000_000)).padStart(6, "0")`, which gives **000000–999999**. Export it as `generateRecoveryCode` in `recovery.ts` so it can be tested.
- **Full 10⁶ space.** Starting at 100000 would throw away 10% of codes for no reason.
- **Leading zeros are clear.** Every digit has its own box, and the email is plain text. The sign-in code (Better Auth `generateOTP`) can also start with 0, so behaviour stays consistent.
- `crypto.randomInt` already avoids modulo bias. Never `Math.random`.
- The HMAC domain and the secret are unchanged.

## 11. UI and component strategy: B, a shared input primitive

`OtpSlots` in `sign-in-form.tsx:20-96` and `RecoveryCodeSlots` in `recovery-form.tsx` are almost identical: one hidden real input, a numeric keyboard, `one-time-code`, digits only and capped, decorative boxes, and the same error and active styling. At 6 digits the only differences are `aria-label`, `aria-describedby` and the optional `inputRef`.

- **Extract** `src/components/code-slots.tsx`, exporting `CodeSlots({ value, onChange, disabled, hasError, label, describedBy, inputRef? })`.
  - Length is fixed at 6, with no length prop (YAGNI).
  - Keep `id/name="code"`, `inputMode="numeric"`, `autoComplete="one-time-code"`, `pattern="[0-9]{6}"`, `maxLength={6}`, `slice(0, 6)`.
  - Keep the sign-in layout: 6 columns, 52px cells, which already fit at 320px.
- **Callers:**
  - Sign-in passes `label "6-digit verification code"`, `describedBy={hasError ? "code-error" : undefined}` and its ref.
  - Recovery passes `label "6-digit recovery code"` and `describedBy "recovery-code-help"`. Its submit button is enabled when the email is not empty and `code.length === 6`.
- **No coupling between credential systems.** The component knows nothing about Better Auth or recovery; each form keeps its own action, schema and expiry text.
- Paste, Backspace and Delete work natively, because there is a single real input.

## 12. Support-filter impact (important)

Swapping `\b\d{8}\b` for `\b\d{6}\b` would **block ordinary support text**, such as amounts ("paid 150000"), reference fragments and dates like `191026`. The current 8-digit rule **already has a false positive**:
- Support case references are the first 8 hex characters of a UUID and appear in emails as "Case: 1234abcd".
- About 2.3% of them, (10/16)⁸, are all digits.
- A customer quoting that reference back in `/support` is refused today. Dates like `20261019` are also refused.

**Recommended rule:** flag a standalone 6-digit number only when a code word comes just before it.

```
/\b(?:code|otp|pin|passcode)\b[^\d\n]{0,20}\b\d{6}\b/i
```

- **Blocked:** "my recovery code is 123456", "Code: 123456", "OTP 123456". Accidental pastes of 6-digit sign-in codes are now caught too, which they are not today.
- **Allowed:** "paid 150000", "20261019", "Case: 12345678", "year 2026", phone numbers.
- **Drop the 8-digit rule.** No 8-digit credential exists any more.
- **Deliberate gaps, to document:** a bare code with no code word, a code written with spaces, and a code placed before the word ("123456 is my code"). They are accepted because a leaked recovery code has almost no value (§5) and the alternative blocks normal messages.
- The activation-code filter and the owner email-body filter are unchanged.

## 13. Test changes

- **Generator** (`recovery.db.test.ts`): 2,000 calls of `generateRecoveryCode()` all match `^\d{6}$`, at least one starts with `0`, and there are no `Math.random` imports.
- **Schema** (`domain.test.ts`): `123456` passes; `12345`, `1234567`, `12345678`, `abcdef` and `12 3456` are rejected.
- **Recovery** (`recovery.db.test.ts`, the journey test, `actions.test.ts`):
  - Change the capture patterns to `\b\d{6}\b` and the samples to `123456`.
  - Keep the existing tests: wrong code adds an attempt, the third cancels, expired, resolved, snapshot, occupied, replay, the completion transaction, and a 23505 rollback.
  - Add: an 8-digit code against a pending row returns the generic failure and **does not add an attempt** (the schema rejects it first).
- **Concurrency:** update the pattern in `check-support-concurrency.mts:256`. R13–R19 are otherwise unchanged.
- **UI:**
  - `recovery-form.test.tsx`: 6 boxes, `aria-label "6-digit recovery code"`, `inputMode numeric`, pasting `"12-34 56 78"` gives `123456`, a cap of 6, Backspace, and the submit button disabled at 5 and enabled at 6 with an email.
  - New `code-slots.test.tsx`: one real input and 6 boxes marked `aria-hidden`.
  - `sign-in-form.test.tsx` passes unchanged.
- **Security:** the code is not in returned state (`actions.test.ts`) or in the old-address notice; no `localStorage` or `sessionStorage`; the quota key is an HMAC. All existing; update the samples.
- **Filter** (`domain.test.ts`, `intake.db.test.ts:28`):
  - Blocks the "code/otp/pin" phrasings.
  - Allows "paid 150000", "20261019", "Case: 12345678", "call 0917 123 4567".
  - Recovery and secure notes refuse "Recovery code 123456".

## 14. Documentation changes

- **ADR 0012:7:** "eight-digit" becomes "six-digit". Add one sentence explaining why 6 is safe: the destination is fixed at start, attempts are capped per row, and starting requires an owner.
- **`support-and-corrections.md:71`:** "eight digits" becomes "six digits". **`:73`:** replace the "standalone eight-digit" filter wording with the code-word rule and its documented gaps.
- **`PRODUCT.md:75`:** "eight-digit" becomes "six-digit".

## 15. Implementation sequence (Codex, feature branch, TDD)

1. Failing tests: generator, schema, filter and the 8-digit rejection.
2. Generator: `generateRecoveryCode` in `recovery.ts`. Schema: `^\d{6}$` in `domain.ts`.
3. Filter rewrite in `credentials.ts`, plus the intake, notes and domain tests.
4. Extract `CodeSlots` and switch sign-in to it (no change in behaviour; sign-in tests stay green).
5. Switch `/support/recover` to `CodeSlots`, with 6-character submit gating and its tests.
6. Update the 8-digit samples and patterns in the remaining tests, the journey test and the concurrency script.
7. Docs (§14).
8. Run `pnpm test`, `typecheck` and `lint`, then `check:support-concurrency` on loopback.
9. Manual check: the 6-box layout on a real phone at 320–390px, including paste and one-time-code autofill. Cancel any pending dev recovery and start again.

## 16. Risks and edge cases

- The filter is narrower: a bare 6-digit code pasted into intake with no code word is accepted. This is accepted, because the code has little value and expires.
- A pending 8-digit dev recovery left uncancelled fails and blocks its case from being resolved until an owner cancels it, as today.
- Some email clients turn 6-digit numbers into phone links. The text is plain, and the code is unchanged when copied.
- If code completion is ever changed to let the customer **choose** the destination email, or if codes become resendable without an owner, this analysis no longer holds and must be redone.

## 17. Final verdict

**APPROVE 6 DIGITS WITH CONDITIONS.**
- A correct guess cannot take over an Account: it only moves the Account to the inbox the owner approved. Guessing is capped at 3 per owner-approved row whatever the attacker's IPs (3×10⁻⁶), and 6 digits is strictly safer here than Neffi's existing 6-digit sign-in code.
- Conditions:
  - **C1:** replace the numeric filter with the code-word rule and drop the 8-digit rule. Never `\b\d{6}\b`.
  - **C2:** keep the per-row 3-attempt cancel, the fixed destination, owner-only starts and no resend exactly as they are.
- No schema, data or dev reset. Handle pending dev rows with Cancel and start again.

**Locked decisions (approved 2026-10-19):**
- Move support-assisted recovery from 8 digits to 6.
- Allow leading zeros (000000–999999).
- Keep generation based on `crypto.randomInt`.
- Keep the 3-attempt cancellation on each recovery row.
- Keep recovery start owner-only.
- Keep the approved new-email destination fixed when recovery starts.
- Keep the no-resend behaviour.
- Replace the broad numeric secret filter with the approved code-word rule. **Do not** use a blanket `\b\d{6}\b` filter.
- No schema migration, no data migration, no support for old 8-digit codes.
- Cancel and restart pending development recoveries through the existing UI.
- Extract and reuse a shared 6-box code input for sign-in and support recovery, if the implementation matches the plan.
