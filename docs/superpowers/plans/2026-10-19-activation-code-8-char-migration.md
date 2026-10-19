# Activation Code 8-Character Migration Audit

**Context.** The packaging now has room for an 8-character code (`N8KF-42PQ`) instead of 16 (`XXXX-XXXX-XXXX-XXXX`). Nothing has gone to production, so this is a clean cutover with no support for the old format. This is a read-only audit and plan. No files, migrations or databases were changed.

---

## 1. Current architecture (traced)

| Stage | Where | Notes |
|---|---|---|
| Generation | `src/modules/activation/code.ts:7-9` | `CODE_LENGTH = 16`, `randomCrockford(16)` |
| Random source | `src/lib/crockford.ts:6` | `crypto.randomInt(32)` per character. Secure and unbiased. |
| Format | `code.ts:11` | `code.match(/.{4}/g).join("-")`. Works for any length that is a multiple of 4. |
| Normalize | `code.ts:14-17` | Uppercases, strips `\s` and `-`, maps O→0 and I/L→1, then requires exactly `CODE_LENGTH` characters from the Crockford alphabet. |
| Store | `code.ts:20`, `credentials.ts:11-18` | Stores only `HMAC-SHA256(secret, "activation:"+code)` as 64 hex characters |
| Issue callers | `cards/dbc.ts:27,64` (provision, replace), `support/cards.ts:~88` (reissue, reset), `scripts/dev-activation-fixture.mts` | All go through `issueActivationCredential` |
| Owner reveal | `admin/inventory/actions.ts:102,155`, `admin/support/[caseId]/actions.ts:167,174` → `admin/inventory/forms.tsx:25-56` | Shown once from React state, with explicit copy-to-clipboard. Never stored. |
| Package match | `admin/inventory/forms.tsx:196` → `actions.ts:139` (`text(64)`) → `dbc.ts:34-48` | Normalizes, then compares lookups in constant time |
| Customer entry | `(public)/activate/activate-forms.tsx` | Client formatter capped at 16, `maxLength=19`, placeholder `XXXX-XXXX-XXXX-XXXX`. **`isComplete` already accepts 8 or 16 (drift).** |
| Check | `activate/actions.ts:28-48` → `activation/claim.ts:18-38` | Per-IP quota, then normalize, then HMAC lookup. Results: invalid, unavailable, yours or claimable. |
| Challenge | `activate/challenge-cookie.ts`, `activation/challenge.ts` | Signed 15-minute cookie holding the credential **id**. It never holds the code. Not affected by length. |
| Claim | `claim.ts:40-61` | Locks the card, marks the credential used only if it is still unused, sets the owner, records Activity |
| Revoke / replace | `credentials.ts:29-36`, `dbc.ts:52-73`, support reissue | Not affected by length |
| Code-shaped content filter | `src/modules/support/credentials.ts` | Used by support intake (message **and name**), owner email bodies, and recovery/secure notes. **This depends on the length (see §4 and §9).** |

## 2. Current format and alphabet (from the code)

- Alphabet: `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, which is Crockford Base32 with 32 symbols (`crockford.ts:4`).
- I, L, O and U are never generated. On input, O→0 and I/L→1 are mapped. U is rejected.
- 16 characters give 16 × log₂32 = **80 bits**, or 2⁸⁰ ≈ 1.21 × 10²⁴ codes.

## 3. Entropy at 8 characters

- With no restriction: 8 × 5 = **40 bits**, 32⁸ = **1,099,511,627,776** codes.
- With the recommended rule of at least one digit and at least one letter from G–Z (see §10): 32⁸ − 22⁸ − 16⁸ + 6⁸ = **1,040,342,466,560** codes (**39.92 bits**). The rule removes 5.4% of the space and costs 0.08 bits.

## 4. Security verdict

Assume N unclaimed codes are outstanding. Each guess has a chance of N / 1.04×10¹² of hitting one. An attacker does not need a particular card; any hit hijacks a sold card.

Today's limit is **20 checks per 10 minutes per IP, using IPv6 /64 buckets** (`actions.ts:16,29`). There is no daily cap and no global cap.

| Scenario | Guesses/day | N=1,000 | N=10,000 |
|---|---|---|---|
| One IPv4 address, current limits | 2,880 | ~0.1% chance per year | ~1% per year |
| One IPv6 /48 (65,536 /64 buckets), current limits | ~1.9×10⁸ | **~18% per day, a hijack in about 5 days** | near-certain within a day |
| Any number of IPs with a **global cap of 100 per 10 minutes** | 14,400 | ~0.5% per year | ~5% per year |

- **With only today's per-IP limits, 8 characters is not safe.** The weakness is the lack of a global ceiling, not the length. A /48 is cheap, and at 16 characters that gap did not matter (about 10⁻¹³ per day).
- **With a global ceiling, 8 characters is acceptable.** The attacker is limited to about 5 million guesses a year, the attack is loud because it blocks real activations, a hijack can be undone through support's ownership reset, and codes are single-use and stay unclaimed only for a short time after release.
- **Other factors:**
  - The code is sealed inside the package, so it is not exposed in transit.
  - Checking a code does not consume it, which is fine.
  - The "unavailable" response reveals that a code exists, including for unsold Ready cards. An attacker could record such a code and claim it after release. This is covered by the global cap; returning "invalid" for codes on unreleased cards is optional hardening that is not needed now.
- **Residual risk:** if both the database and `ACTIVATION_CODE_SECRET` leak, 2⁴⁰ HMACs can be brute-forced offline in minutes and every unclaimed code is exposed (at 80 bits this was impossible). The remedy is the existing one: rotate the secret and reissue unclaimed codes.
- **If you reject a global cap:** the shortest safe length is **12 characters (`XXXX-XXXX-XXXX`)**. Ten characters still gives about a 6% chance per year against a /48 attacker.

## 5. Collision analysis

The unique constraint `activation_credentials_lookup_hmac_unique` covers **every credential ever issued**, including used and revoked ones. So n means total lifetime issues, including replacements.

| Total issued (n) | P(at least one collision) ≈ 1 − e^(−n²/2S) | Chance per new issue at that size |
|---|---|---|
| 1,000 | 4.8×10⁻⁷ | 1×10⁻⁹ |
| 10,000 | 4.8×10⁻⁵ | 1×10⁻⁸ |
| 100,000 | 0.48% | 1×10⁻⁷ |
| 1,000,000 | **38%** | 1×10⁻⁶ |

**Today:** a collision raises Postgres error 23505 inside the provisioning transaction. The whole provision is rolled back, so no duplicate is created and nothing is partly written. The inventory action rethrows it as an unhandled error (`inventory/actions.ts:57-60`). So duplicates can never be created silently today, but a collision is shown to the owner as a crash.

**Change:** in `issueActivationCredential`, use `onConflictDoNothing({ target: lookupHmac })` and generate a new code when no row comes back, up to 5 attempts, then throw. `ON CONFLICT DO NOTHING` does not abort the transaction, so no savepoint is needed. Conflicts on the per-card usable index still raise as before. All four callers get the fix in one place.

## 6. Exact affected files

**Code (5):**
- `src/modules/activation/code.ts`: set the length to 8, add the generator rule, update the 80-bit comment.
- `src/modules/activation/credentials.ts`: add the conflict retry.
- `src/modules/support/credentials.ts`: rewrite the code-shaped content filter.
- `src/app/(public)/activate/actions.ts`: add a daily per-IP quota and a global quota.
- `src/app/(public)/activate/activate-forms.tsx`: formatter, completeness check, placeholder, maxLength, deletion handling.

**Optional (1):** `src/app/admin/inventory/forms.tsx:196` adds `placeholder="XXXX-XXXX"` to the package-match input.

**Tests to update:**
- `src/modules/activation/code.test.ts`
- `src/modules/activation/claim.db.test.ts` (invalid-input list)
- `src/modules/cards/dbc.db.test.ts:165`
- `src/app/(public)/activate/activate-forms.test.tsx`
- `src/app/(public)/activate/actions.test.ts`
- `src/modules/support/domain.test.ts`, `intake.db.test.ts:28`, `email.db.test.ts:39`, `replies.db.test.ts:23`

These test files only need their sample codes changed for consistency, because they would pass either way:
- `src/app/admin/inventory/actions.test.ts`
- `provision-reveal.test.tsx`
- `forms-lifecycle.test.tsx`
- `src/app/admin/support/[caseId]/actions.test.ts:87`

**Docs (3):**
- `docs/decisions/0005-activation-credentials.md`
- `docs/operations.md:144,168`
- `docs/specs/support-and-corrections.md:59,69`

**Checked and not affected by length:**
- `claim.ts`, `dbc.ts`, `support/cards.ts`
- `challenge*.ts`, `sentry-scrub.ts`
- both admin reveal actions (they use `formatActivationCode`)
- schema, all migrations and snapshots, `erd.md`, `seed.ts` (synthetic hex lookup values)
- `scripts/check-*` (synthetic lookup values or the real generator), `dev-activation-fixture.mts`
- `PRODUCT.md`, `cards-and-activation.md`, `README.md`, `.env.example`

Historical `docs/superpowers/**` and `docs/verification/**` are left as they are.

## 7. Database / schema impact

Neffi stores **only the HMAC**: `lookup_hmac text NOT NULL`, with `CHECK ~ '^[0-9a-f]{64}$'`, a unique index, and a partial unique index allowing one usable credential per card. Neither the column type nor any constraint depends on the code length.

- **Schema migration required: NO.**
- **Data migration required: NO.**
- **Dev data reset/reseed recommended: NO.** Seed credentials are synthetic HMACs with no matching code, so nothing changes for them.

## 8. Dev-data strategy

- **Tests (PGlite, loopback):** built from migrations on every run. Nothing to do.
- **Local loopback DB:** rerun `pnpm dev:activation-fixture` to get 8-character codes. Old 16-character codes now fail as "invalid".
- **`neffi-dev` Neon:** no SQL and no reset. The credential guard makes history immutable anyway.
  - Claimed engineering cards are unaffected.
  - For any unclaimed engineering TEST unit with a 16-character label: if it is Blank or Ready, use **Replace credential**, relabel it and match the package again. If it is Released, use support **reissue**.

## 9. Target normalization contract

**Server (authoritative; `normalizeActivationCode`, same algorithm with length 8):** uppercase the input, remove all whitespace and `-`, map O→0 and I/L→1, then require exactly 8 characters from the Crockford alphabet, or return null.
- `N8KF42PQ`, `N8KF-42PQ`, `N8KF 42PQ`, `n8kf42pq` and ` n8kf - 42pq ` all become `N8KF42PQ`.
- 7 characters, 9 characters, the old 16-character form, `U` and punctuation all return null.

**Display:** `formatActivationCode` produces `N8KF-42PQ` with no code change.

**Client (display only; `formatCodeInput`):** uppercase, drop everything outside `[0-9A-Z]` (this also handles pasted en-dashes and other separators), keep the first 8 characters, and insert `-` after the fourth when there are more than 4. No O/I/L mapping on the client; the server does that. The client keeps its own literal `8`, because `code.ts` imports `node:crypto` and cannot go into the client bundle. A round-trip test ties the two together.

**Support content filter (rewrite of `containsActivationCode`).** At 8 characters the current rule, which flags any run of 8 alphabet characters, would reject ordinary text:
- names such as "Jennifer", "Margaret" and "Victoria"
- words such as "activation" and "evidence"; the existing recovery fixture note "Verified purchase evidence" would start failing
- every 8-hex-character support case reference (`caseReference`)

New rule: flag a standalone token that is either 8 characters bare or `XXXX-XXXX`, normalizes to a valid code, **and** in its raw text contains a digit and a letter from G–Z outside I, L, O and U.
- Hex case references never match.
- Plain words never match.
- Every generated code matches, because of the generator rule.

Deliberate gaps, to be documented in the support spec:
- Codes split by a space, because "year 2026" and "card 1234" would otherwise match.
- Codes run together with other characters.

## 10. Generator changes

Keep `randomCrockford(8)` on `crypto.randomInt`. Add rejection sampling: generate again until the code has at least one digit and at least one letter from G–Z. About 5.4% of draws are rejected, so this needs 1.06 draws on average.

Why it is worth it:
- It makes the support filter reliable.
- A code can never look like the 8-digit account recovery code (`\b\d{8}\b`).
- A code can never be a plain all-letter word.

No `Math.random`, no sequence numbers and no timestamps. The HMAC domain (`"activation"`) and the secret stay the same. Add the conflict retry from §5.

## 11. UI / provisioning changes

**`/activate` (`activate-forms.tsx`):**
- Placeholder `XXXX-XXXX`, and `isComplete` becomes exactly 8.
- **Remove `maxLength`.** The browser cuts a paste down to `maxLength` before the formatter runs, so pasting `  N8KF - 42PQ  ` today comes out wrong. The formatter already enforces the limit, and the server truncates input at 64 characters.
- **Replace the `keydown` Backspace handler with `inputType`-based handling in `onChange`.**
  - Android soft keyboards report Backspace as `Unidentified` in `keydown`, so the dash cannot be deleted there today.
  - Delete in front of the dash is also not handled at the moment.
  - New rule: if an edit removes only the separator, `deleteContentBackward` removes the character before it and `deleteContentForward` removes the character after it. The cursor stays where the removed character was.
- Keep the existing cursor-mapping logic, which works for one separator.
- Check `select-none` on the `<input>`: `user-select:none` can block caret placement in iOS Safari. Remove it.

**Owner provisioning, package match, support reissue/reset:**
- No logic changes. `formatActivationCode` already shows `N8KF-42PQ`.
- Reveal-once and clipboard-only-on-click behaviour is unchanged.
- Optionally add the package-match placeholder.

## 12. Testing changes

- **Generation:**
  - 1,000 generated codes are 8 characters, match `^[0-9A-HJKMNP-TV-Z]{8}$`, each contains a digit and a G–Z letter, and are distinct.
  - The output of `formatActivationCode` matches `^[0-9A-Z]{4}-[0-9A-Z]{4}$`.
- **Duplicates (DB test):** mock `generateActivationCode` to return an existing code once. A second, distinct credential is issued. A code that always collides throws after 5 attempts with no row inserted.
- **Normalization:** the five accepted forms in §9; `OOOO-LLLL` mapping; rejection of 7, 9 and 16 characters, `U` and punctuation. In `claim.db.test`, add `"Z".repeat(7)`, `"Z".repeat(9)` and the old 16-character format to the invalid list. The existing O/l round-trip test stays.
- **Activation (existing suites; update the sample code to `N8KF-42PQ`):** valid, invalid, used, revoked, unavailable, already-yours, claim, challenge cookie. New tests:
  - The per-IP-day and global quotas are both consulted before any lookup, in the order IP, IP-day, global.
  - A refusal from any one of them returns `tooMany` without a lookup.
- **UI (happy-dom):**
  - automatic dash, uppercase, paste with spaces and dashes beyond 9 characters, a cap of 8 characters
  - Backspace after the dash and Delete before the dash, simulated with `InputEvent` `inputType`
  - Continue is disabled at 7 characters and enabled at 8
- **Security:**
  - the code never appears in the returned state (existing test)
  - no change to the URL, cookie or storage
  - quota keys are HMACs
- **Support filter:**
  - Blocks a bare code, a hyphenated code, and a code with lowercase or O-for-0.
  - Allows "Jennifer", "Margaret", "activation", "Verified purchase evidence", "abcdef12", "year 2026" and "card 1234".
  - `\b\d{8}\b` recovery-code blocking is unchanged.

## 13. Documentation changes

- **ADR 0005:** revise in place, following the 0003/0006 status-line convention. 8 Crockford characters (~40 bits), shown as `XXXX-XXXX`, at least one digit and one G–Z letter. Add the global and daily ceilings to "rate-limited", and the offline brute-force consequence of a leaked secret plus database.
- **`operations.md:144`:** describe the format and entropy. **`:168`:** list the new limits.
- **`support-and-corrections.md:59,69`:** replace "any-16-character-run" with the new filter rule and its documented gaps.
- **No change:** `PRODUCT.md`, the ERD, `cards-and-activation.md`, the README and Notion.

## 14. Recommended implementation sequence

This follows the usual workflow: Codex implements on a feature branch, with TDD and one commit per step.

1. Generator, length and normalization in `code.ts` and `code.test.ts`.
2. Conflict retry and its DB test in `credentials.ts`.
3. Rewrite the support filter, update `domain.test.ts`, and update the intake, email and replies DB tests.
4. Add the daily and global quotas in `activate/actions.ts` and its tests.
5. Change the `/activate` client in `activate-forms.tsx` and its tests.
6. Update sample codes in the other test files and the optional admin placeholder.
7. Update the docs in §13.
8. Verify:
   - `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm check:bundle`
   - on loopback: `check:claim-concurrency`, `check:provisioning-concurrency`, `check:support-concurrency`
   - `pnpm dev:activation-fixture`, then provision one card in the local admin to confirm the `XXXX-XXXX` reveal
9. Manual check, only what automation cannot show: deleting the dash with Backspace and Delete on a **real Android and a real iOS soft keyboard**.
10. Dev data: handle `neffi-dev` TEST units case by case as in §8.

No migration and no ERD regeneration are needed.

## 15. Rollback

- **Code:** revert the branch commits. There is no migration to undo.
- **Credentials:** any 8-character codes issued in the meantime stay in the table harmlessly. After a revert they are rejected as "invalid" at length 16. Use Replace credential or reissue for any affected TEST unit.
- **Seed and fixtures:** nothing to regenerate. Rerun the local fixture after the revert.
- **Secret:** unchanged; do not rotate it.

## 16. Risks and edge cases

- The global cap lets an attacker block activation for everyone. This is accepted: it is visible, temporary and bounded. Real traffic is far below 600 checks an hour.
- Local development puts every IP in one shared "unknown" bucket. This is unchanged and only affects local use.
- Support filter gaps: space-separated codes and codes run together with other characters are not caught. A false positive can still happen for a hyphenated 4-4 token that contains a digit and a letter (for example `TEST-1234`).
- A leaked secret plus a leaked database exposes all unclaimed codes offline (§4).
- Progressive enhancement: without JavaScript the server still normalizes whatever the user typed. Only spaces and `-` are stripped, so an en-dash would be rejected. This is rare and acceptable.
- Engineering TEST packages carrying 16-character labels must be relabelled before reuse.

## Decisions for approval

| # | Decision | Recommendation | Owner workflow meaning | Risk / consequence | Hard to reverse? |
|---|---|---|---|---|---|
| D1 | Global activation-check ceiling | Keep 20 per 10 minutes per IP, **add 50 per day per IP and 100 per 10 minutes globally**, using the existing `consumeQuota` pattern (as support intake does) | None, unless the site is under attack | Under attack, customers see "Too many tries" | No |
| D2 | Generator rule plus new support filter | Require at least one digit and one G–Z letter; filter on that shape | None | Costs 0.08 bits; space-separated codes are not filtered | No (no stored state) |
| D3 | Collision retry | `ON CONFLICT DO NOTHING`, up to 5 attempts | Provisioning never fails because of a collision | None | No |
| D4 | Dev data | No SQL or reset; handle TEST units through the UI | Relabel any unclaimed TEST packages | None | No |

## 17. Final verdict

**APPROVE `XXXX-XXXX` WITH CONDITIONS.** Forty bits is acceptable for an online, one-time code **only with a global ceiling on checks (D1)**. Without one, a single IPv6 /48 could hijack a card within days. Two more conditions are required:
- **D2:** without it, the support intake, email and recovery filters would reject ordinary names, words and case references.
- **D3:** at large inventory, collisions become likely and would otherwise crash provisioning.

No schema or data migration is needed. If D1 is declined, use **`XXXX-XXXX-XXXX` (12 characters)** instead.
