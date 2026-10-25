# Pre-launch production-readiness audit: 2026-10-25

## Release verdict

**READY WITH KNOWN RISKS**

No automated or software launch blocker was found. The audit fixed one product defect and one test-harness defect, both on `chore/prelaunch-production-audit` and neither yet deployed. **MANUAL HARDWARE ACCEPTANCE REQUIRED** before launch: see [the physical checklist](prelaunch-physical-acceptance.md). This verdict does not mean the product is free of defects. It records what was tested and how.

## Environment

| Item | Value |
|---|---|
| `main` audited | `5491fe36bd619d423f3cd3ac46e4a6d692adb7b9`. The tree was clean and matched `origin/main` after fetch |
| Audit workspace | Detached clean worktree `.worktrees/prelaunch-audit` (no `.env.local`), later the branch `chore/prelaunch-production-audit` |
| Software gate environment | The exact synthetic CI values from `.github/workflows/ci.yml` |
| Database isolation | A fresh, disposable PostgreSQL 18.6 cluster created for this audit, bound only to `127.0.0.1:55432`, with trust auth. Databases: `neffi_m2_test` (concurrency), `neffi_e2e` (browser E2E), `neffi_m7_http_diagnostic` (HTTP gate). Every script's loopback/no-Neon guard passed. No Neon database, production data or real card was touched |
| App under test | `next build` then `next start` (production mode) on `127.0.0.1:3100` and `:3001`. Only the database URLs and the two origins were overridden to loopback |
| External calls | An audit-only preload captured Resend email into a local file and refused every other non-loopback `fetch`. No real email was sent |
| Browser | Playwright (Chromium) driven externally. No framework or dependency was added to the repository; the M11 decision D1 ("no Playwright in repo") is preserved |
| Production smoke | `https://getneffi.com`, read-only GETs only, plus read-only Vercel env metadata and runtime logs |

Note: a pre-existing development server (not started by this audit) was listening on `[::]:3000`. One read-only GET of `/sign-in` reached it before the audit moved to an explicit `127.0.0.1:3100` origin. Nothing was written through it and it was left running.

## Automated verification

Fresh runs from the first audit pass. "Final" below is commit `9ae92d7`, before the owner-operations follow-up. The shipping verification below records the complete branch.

| Command | Baseline (`5491fe3`) | Final (audit branch) |
|---|---|---|
| `corepack pnpm install --frozen-lockfile` | exit 0 (39.7 s) | exit 0 |
| `corepack pnpm lint` | exit 0: 0 errors, 17 existing warnings (102 s) | exit 0: 0 errors, 17 warnings (88 s) |
| `corepack pnpm typecheck` | exit 0 (57 s) | exit 0 (19 s) |
| `corepack pnpm test` | exit 0: **239 files / 2,534 tests** (154 s) | exit 0: **239 files / 2,536 tests** (146 s) |
| `corepack pnpm db:check` | exit 0 | exit 0 |
| `corepack pnpm db:generate` + `git diff --exit-code -- drizzle` | exit 0, "No schema changes" | exit 0 |
| `corepack pnpm build` (includes the PSGC check) | exit 0 (61 s). One warning: `metadataBase` not set | exit 0 (72 s, after `rm -rf .next`) |
| `corepack pnpm check:bundle` | exit 0: 419 public files, no server secret values | exit 0: 419 files, none |
| `git diff --check` | exit 0 | exit 0 |
| Six loopback concurrency suites (`check:{db,provisioning,claim,profile,orders,support}-concurrency`) | **55/58**. `profile` failed 3 (harness defect, see Bug 1) | **58/58** (6 + 7 + 4 + 7 + 7 + 27) |
| `scripts/check-public-http.mts` (operator HTTP gate, production build) | Passed 2 of 2 consecutive runs | Passed 2 of 2 consecutive runs |

## E2E matrix

Browser evidence ran against the production build with synthetic accounts `audit-a…f@example.test` and the repository's `dev:activation-fixture` cards. "DB" means a read-only SQL check on the loopback database.

| Flow | Result | Evidence |
|---|---|---|
| Email auth | **PASS** | Code sent; wrong code refused with a generic message; correct code signed in and honoured `next=/app/account`; the session survived navigation; the cookie is HttpOnly and SameSite=Lax; sign-out cleared it; anonymous `/app` routes ended on sign-in without leaking the email. **Reused code** → HTTP 400 with no session. Expiry, three attempts, quotas and hashing: `email-otp.db.test.ts` |
| Google auth | **MANUAL EXTERNAL-PROVIDER CHECK REQUIRED** | Config inspected: tokens nulled on identity create and update, implicit linking off, `trustedOrigins` = base URL. Callback and linking covered by `google.db.test.ts` (11 tests). Production `BETTER_AUTH_URL` and Google variables exist (values not decrypted). A live OAuth round-trip was not automated; the earlier maintainer confirmation is carried forward |
| Activation | **PASS** | Anonymous `/activate` → code accepted → `neffi_activation` cookie (HttpOnly, Lax, path `/activate`, 15 min, opaque, no code) → signed in on the activation screen → "Add to my account" → `/app/setup/<card>`. DB: owner = signer, 1 used credential, 0 usable, 1 `card_claimed` |
| Activation reuse | **PASS** | Owner re-entering the used code → `/app` (no second claim). Another account and anonymous → generic "This code can't be used." Revoked, unsold and used-elsewhere fixtures → generic message. Invalid → generic message. Client-bypassing malformed input caused no server error. No code in the URL, DOM or cookie |
| Activation race | **PASS (3 of 3)** | Two browsers signed in as different accounts clicked "Add to my account" simultaneously for the same code, 3 times (including a reissued-credential card). Each time one landed in setup and the other got `notice=unavailable`. DB: exactly one owner, claim event and used credential per card. `check:claim-concurrency` 4/4 |
| Ownership isolation | **PASS** | B requesting 8 of A's private pages plus 2 `/admin` routes → not-found, no A data. B's real requests intercepted with A's IDs swapped in: card settings, identity, unpublish and appearance → 404, and A's card, profile and blocks fingerprint unchanged. A's Inbox delete request captured and replayed with B's session → refused (generic error, row still present). Setup-action ownership: unit tests (no UI path once setup is done) |
| Profile setup | **PASS** | Goal → You (name required, error and focus on field; Draft created) → Photo skipped (optional) → Contact (requires at least one method; bad email, website and `javascript:` refused; sign-in email pre-filled and replaceable) → Links (`javascript:` refused; LinkedIn saved) → Look (Classic default, Editorial chosen) → Style (Light + Ink default, 8 accents, Dark + Ocean chosen) → Review → Publish → Done. Back and reload preserved saved choices. Cover upload/Cloudinary not exercised |
| Draft / publish | **PASS** | Draft → generic 404. Published → 200. Edit → visitors saw it, token unchanged, content version advanced. Unpublish → page and vCard 404. Republish → 200 |
| Permanent card URL | **PASS** | Valid published 200; nonexistent and bad tokens 404; disabled 404; draft and unpublished 404; owner of a disabled card sees "Manage this card" only. `noindex, nofollow`; `Cache-Control: private, no-store`. The HTTP gate also covers deleted scenes and cache-version misses |
| Package QR | **PASS (software) / MANUAL HARDWARE** | The app generates no Package QR (ADR 0004: common printed insert to `/activate`). `/activate` reveals no card or profile. The printed insert needs the physical check |
| Sharing QR | **PASS (software) / MANUAL HARDWARE** | The live card-page QR's SHA-256 (`0a0f0b2d…`) equals uqr's symbol for exactly `http://127.0.0.1:3100/c/<token>` and differs from `/activate`'s. It still matched after profile edits. The download equals the image. The printed card-back sticker needs the physical check |
| Card on/off | **PASS (3 cycles)** | UI switch with confirm dialog → visitors 404 (so the Sharing QR, which encodes the same URL, is also off); vCard 404; turning it on → 200. Activity: `card_disabled` / `card_enabled`. Cross-account toggle refused (above) |
| Public profile | **PASS** | Only public fields shown; the sign-in email and activation code are absent from the page and vCard; XSS probes in name, headline and bio rendered as text with no dialog; external links `target=_blank rel="noopener noreferrer"`; `tel:` and `mailto:`; vCard holds the public contact only. Classic is the default and Editorial plus Dark/Ocean was rendered; the full layout and accent combinations rely on existing renderer tests. Booking was not exercised |
| Visitor contact | **PASS** | Required fields enforced natively; a bad email bypassing the client was refused by the server; a valid message stored once; the notification went only to the owner's sign-in address; the owner Inbox shows the script text inert; B cannot view, list or delete it; the owner deleted it (row gone). Honeypot present. Foreign-Origin POST → 403 (HTTP gate). Rate limits: DB tests |
| Support / recovery | **PASS** (after Bug 2 fix) | Anonymous support request stored and acknowledged; valid-format activation code and 6-digit recovery code in the message were refused before persistence; a bogus recovery code failed generically with no session. Expiry, reuse, three attempts, identity preservation and owner/occupied refusals: `recovery.db.test.ts` and `recovery-to-sign-in.db.test.ts`. Owner-initiated recovery was not run in the browser |
| Pricing / order path | **PASS** | Production Pricing: ₱799; "any applicable shipping fee … confirmed before payment"; Facebook link is `facebook.com/p/Neffi-61595507571192/`; no checkout route. Help: GCash, Maya, MariBank, GoTyme, bank transfer; COD "Not at the moment". Terms agrees. All 5 gallery WebPs return 200 with meaningful alt text and labelled thumbnails |
| Lost / damaged copy | **PASS** | No free replacement, Lost Mode, tracking, remote wipe or insurance claims on any page. Help and Terms separate "lost card" from "damaged or defective" |
| Responsive / a11y smoke | **PASS with LOW notes** | 17 pages × {320, 360, 390, 430, 1440} = 85 combinations: no horizontal page overflow, no unnamed controls, no unlabelled inputs, no missing alt, no broken images. Logical tab order with visible focus on sign-in, activate and support; the mobile "More" menu closes on Escape |

## Security findings

No Critical, High or Medium security findings were confirmed.

- **Secrets:** the bundle scan found no server secret value in 419 public files. Production secrets are Vercel "sensitive" values, and none were decrypted.
- **Activation code:** never seen in the URL, DOM, cookie or support records. Code-shaped text is refused by support intake.
- **Authorization:** every tested cross-account read or mutation was refused server-side (see the matrix).
- **Redirects:** `safeNext` limits redirects to `/app`, `/admin` and `/activate` (unit-tested).
- **`/dev/*`:** 404 in production, locally and live.
- **XSS:** no injection on the public profile, review or Inbox.
- **LOW:** Vercel flags the **Preview** `CLOUDINARY_API_KEY` as `readable-secret` (encrypted but not "sensitive"). This is provider hygiene only, not Production.

## Database findings

- `db:check` is clean and `db:generate` produces no Drizzle diff.
- 19 migrations applied to each fresh loopback database.
- Claim single-winner semantics hold under real two-session concurrency and in the live two-browser race.
- Each claimed card ended with exactly one used credential and zero usable ones.
- Ownership-scoped deletes and updates (the Inbox, card and profile mutations) matched zero foreign rows.
- No Production data was modified.

## Production smoke (read-only)

- **Pages:** Home, Product, Pricing, Guide, Help, Sign in, Activate, Privacy, Terms, Support and Recover all return 200.
- **Redirects:** `www` → apex 308; http → https 308.
- **404s:** unknown and invalid `/c/` tokens, unknown paths and `/dev/*` all return 404.
- **Health:** `/api/auth/ok` and `/api/health` return 200.
- **Protected routes:** anonymous `/app` and `/admin` stream a 307 redirect to sign-in, with `noindex`.
- **Headers:** CSP, HSTS and nosniff are present.
- **Images:** all gallery images load.
- **Public profile:** skipped, because no dedicated Production demo fixture exists.
- **Runtime logs:** Vercel production logs showed the Bug 2 error on every `/support` request and no other errors in the window.

## Manual hardware checks still required

**MANUAL HARDWARE ACCEPTANCE REQUIRED.** Run all 10 checks in [prelaunch-physical-acceptance.md](prelaunch-physical-acceptance.md):
- iPhone and Android taps;
- the correct profile opening;
- the Sharing QR and Package QR;
- an edit appearing without an NFC rewrite;
- card off and back on;
- a thick or metal case;
- QR fallback without NFC.

None was performed by this audit.

## Bugs found and fixed

**Bug 1: profile concurrency harness no longer tested the insert-boundary recheck (test-only).**
- **Symptom:** `check:profile-concurrency` failed 3 of 7 scenarios with "submission must finish its read and wait at the insertion boundary".
- **Root cause:** `b011d5d` switched the harness to `createProfileFromSetup` (no starter blocks) and added a *Contact* form, which requires a message. The recheck scenarios submit an empty message, so validation returned early and never reached the insert being tested. The old starter used the *Connect* preset, where the message is optional.
- **Fix:** the harness preset is set back to `connect`.
- **Verification:** RED 3 of 7 on clean `main`, GREEN 7 of 7, and 58/58 in the final run. Application code is unchanged.

**Bug 2: `/support` logged a Next.js error on every request (MEDIUM, live in Production).**
- **Symptom:** `Route "/support": Next.js encountered the unstable value crypto.randomUUID() while prerendering` on every load, locally and in Vercel production logs. The page still worked and per-visitor keys were unique, but every visit wrote a false error on the support and recovery path, burying real failures.
- **Root cause:** the server component generated the per-visitor dedup `clientKey` without first opting into request time.
- **Regression test:** `support/page.test.tsx`, "the per-visitor client key is generated at request time…". It went RED for the expected reason (`connection()` never called).
- **Fix:** `await connection()` before generating the key, the same pattern as `support/recover/page.tsx`, inside the existing `<Suspense>`.
- **Verification:** GREEN (support suite 20/20); rebuilt production server gave 0 errors over 11 loads; keys still unique; browser submission works; full gates pass. **Production keeps logging until this branch is merged and deployed.**

**Coverage added:** `cards/[cardId]/page.test.tsx` now proves that the Sharing QR shown and downloaded is the symbol of exactly the card's `/c/<token>` URL, never `/activate`. A mutation of the page made it fail.

## Known risks

1. **Physical hardware and live provider acceptance are pending:** NFC taps, the printed QRs, real Google OAuth, Cloudinary upload/crop/replace and Showcase cover. These are unchanged from the [roadmap](../roadmap.md) gates.
2. **The Bug 2 fix is not deployed.** Production `/support` keeps logging an error per visit until it is merged.
3. **Account deletion copy differs from the Privacy draft** (policy, MEDIUM). `/app/account` says "Permanently remove your account and all associated data" and links to `/support?topic=account-deletion`. Privacy 07 says to email `privacy@getneffi.com` and that some data may be retained. This is a copy and owner decision, so it was not changed.
4. **Privacy and Terms are drafts** (`noindex`), awaiting the owner's legal review per the roadmap.
5. **LOW:** Help's lost-card answer omits that the owner can turn the card off (Terms says so).
6. **LOW:** Pricing says "any applicable shipping fee" while Help and Terms say shipping is charged separately.
7. **LOW:** `/product` and `/guide` contain extra `<h1>` elements from the embedded sample profile ("Mika Santos").
8. **LOW:** a `metadataBase` build warning (no Open Graph tags are emitted); the Preview Cloudinary key is flagged `readable-secret`.
9. **Not exercised in the browser:** the Booking block, owner-initiated recovery, every layout × mode × accent combination, rate-limit exhaustion and an actual expired-OTP wait (all covered by unit or DB tests).

## Exact files changed in the first audit pass

- `scripts/check-profile-concurrency.mts` (Bug 1)
- `src/app/(public)/support/page.tsx` (Bug 2 fix)
- `src/app/(public)/support/page.test.tsx` (Bug 2 regression test)
- `src/app/(customer)/app/cards/[cardId]/page.test.tsx` (Sharing QR contract test)
- `docs/testing/prelaunch-physical-acceptance.md` (new)
- `docs/testing/prelaunch-production-audit.md` (this report)

## First-pass test totals

- **Tests:** 239 files / 2,536 tests passed.
- **Lint:** 0 errors, 17 warnings.
- **Concurrency:** 58/58 scenarios.
- **HTTP gate:** 4 of 4 runs passed (2 on baseline, 2 on final).
- **Activation race:** 3 of 3 single-winner.
- **Card off/on:** 3 of 3 cycles.
- **Responsive smoke:** 85 page/width combinations.
- **Other gates:** build, bundle scan, `db:check`/`db:generate`/Drizzle diff and `git diff --check` all clean.

## Addendum: owner operations (2026-10-25)

The E2E above did **not** exercise the owner UI. Its cards came from `pnpm dev:activation-fixture`, which inserts Released DBC rows directly into the disposable database and issues codes through `issueActivationCredential`. The claimable fixtures have no NFC or package-match record. `/admin/inventory` was never opened as an owner. The Package QR was never scanned: the browser navigated straight to `/activate`.

A follow-up owner audit found that `/admin/inventory/cards/{id}` showed the NFC URL but **no Sharing QR**, so the card-back sticker could only be produced after a customer claim. It now shows a Sharing QR, built by the same `qrSvgDataUri(cardUrl(…))` the customer page uses, with **Download QR (SVG)** and **Copy URL**. It is hidden for retired cards and is covered by `src/app/sharing-qr-parity.test.tsx` (admin QR = customer QR = QR of the NFC URL). The human walkthrough is [prelaunch-human-operations-acceptance.md](prelaunch-human-operations-acceptance.md).

The owner-operations follow-up also changes:

- `src/app/admin/inventory/cards/[cardId]/page.tsx`
- `src/app/admin/inventory/cards/[cardId]/page.test.tsx`
- `src/app/sharing-qr-parity.test.tsx`
- `docs/testing/prelaunch-human-operations-acceptance.md`

Together with the six first-pass files above, these are the complete ten-file release batch.

## Shipping verification (2026-10-25)

Fresh full-suite verification of `a870c17` passed **240 files / 2,538 tests**. Full lint passed with 0 errors and the same 17 existing warnings; TypeScript and schema/journal checks passed with no generated migration changes. All six concurrency suites passed **58/58 scenarios** against a newly created disposable loopback PostgreSQL cluster, including all seven profile checks and all four claim races. This is fresh software evidence, not a manual owner-UI or physical-card acceptance result.

The production build, 1,642-locality snapshot check and 419-file public-bundle secret scan also passed. The canonical `scripts/check-public-http.mts` gate passed against the production build and a separate fresh loopback diagnostic database. Five additional Support GETs returned HTTP 200 with no streamed error fallback and five distinct request keys; the local server emitted no crypto/prerender error. The OWNER/customer/NFC QR parity test passed again independently. No real email, production database mutation, production card provisioning or physical acceptance was performed during shipping verification.

## Launch blockers

No automated/software launch blockers found.

**MANUAL HARDWARE ACCEPTANCE REQUIRED.** Separately, the owner's legal review of Privacy/Terms and the live Google/Cloudinary provider checks remain open.
