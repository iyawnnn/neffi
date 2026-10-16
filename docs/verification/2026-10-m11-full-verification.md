# M11 full verification and M12 handoff

Verified locally on 2026-10-15–16, from post-M10 `origin/main` (`9b8aecf`), on `feat/m11-full-verification`. Execution follows the [canonical M11 plan](../superpowers/plans/2026-10-15-milestone-11-full-verification.md), with explicit user-approved corrections recorded below. Implemented code, schema and existing tests take precedence over historical plan wording.

**Result: local verification passed; Vercel edge observation NOT EXERCISED (access).** T0–T13 are complete, including an approved independent whole-branch review. T10 is closed as an access-limited evidence gap under the plan, not a fresh external pass. Push/PR and merge require separate approvals. M11 does not establish pilot readiness.

## Final gates and evidence classes

U = unit; DB = PGlite integration; J = ordered cross-module PGlite journey; C = real-PostgreSQL concurrency; H = HTTP; B = executor-observed headless browser; X = external platform; P = physical device; CF = carried forward. Automated evidence is never manual acceptance. Synthetic NFC attestations and provider captures are not physical or delivery evidence.

| Gate | Result | Evidence |
|---|---|---|
| T1 unchanged baseline | 157 files / 1,257 tests passed; lint/types/schema/build/bundle green | U, DB, artifact checks |
| T2 empty real PostgreSQL migration | `0000` → `0015`, 16 exact journal timestamps; rerun no-op; Ready check validated | Real PostgreSQL + DB comparator |
| T2 catalog parity | PostgreSQL 18.6 = PGlite 18.3: 27 tables, 16 enums, 150 constraints, 82 indexes, 11 user triggers | Same version-stable SQL; fingerprint SHA-256 `2cd4d22c6630384219613fca0c621da73b3dd3568fdb1e6495577f5d4212030a` |
| T3 shared development | **NOT EXERCISED / CF accepted** by user | CF M10 through `0015`; no shared access |
| T4 authorization sweep | 201 new tests; with 9 existing real-auth tests, 210 passed | U; 85 exports in 16 modules, 80 guarded exports, 5 reasoned public exceptions, 34 protected page/layout modules |
| T5 client import boundary | 19 client roots / 21 tests passed; 359 affected tests in 17 files passed | U/DB; production client chunk inspection |
| T6 Journey A | One ordered real-service provisioning → sale → gift/bulk claim → publish → Form → Inbox chain passed | J; one PGlite DB, no domain mocks |
| T7 Journey B | One ordered recovery → Better Auth new-address sign-in chain passed | J; old session rejected, same Account and business data retained |
| T8 private caching | Signed-in `/app`, `/app/inbox`, `/admin`, `/admin/orders` all 200 | H; each `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` |
| T8 Server Action Origin | Real rendered action ID: foreign Origin rejected (500), zero new cases; correct-Origin positive control 200, exactly one new case | H; no assertion relaxed |
| T9 production browser | 37 green checkpoints; zero CSP DOM events, CSP audit issues and browser console/runtime errors | B; native CDP Chrome, external connections blocked; local email capture and exact dummy Cloudinary response |
| T9 real Inbox prefetch | Two real RSC prefetch requests; unread after viewport and hover waits; click sets `read_at` | B + loopback SQL; M10 R8 prefetch concern resolved for this configuration |
| T10 existing Preview | **NOT EXERCISED (access)** despite user approval: this executor has no Vercel connector/share-link tool | X not obtained; R10 remains M12. No requests, statuses or headers invented |
| T11 full regression | **161 files / 1,481 tests passed**, 95.83 s; lint 0 errors / 10 existing warnings; typecheck passed | U, DB, J |
| T11 schema metadata | `db:check` passed; `db:generate` no changes; `git diff --exit-code drizzle` empty | Artifact checks; no DB connection |
| T11 build and bundle | Production build passed; 221 public files scanned, no server secret values | Fonts-only guarded transport; registry/advisory request denied locally; no package downloads |
| T11 client artifacts | All three corrected editor paths remain free of Zod markers and the empty `Function` probe | Production manifest/chunk inspection |
| T11 concurrency | All six suites passed: **6 / 7 / 4 / 7 / 7 / 27** PASS lines | C; exact per-suite M10 counts, 58 PASS lines (historical “57 scenarios” wording is not the arithmetic total) |
| T11 production HTTP | Complete existing `check-public-http.mts` passed | H; includes foreign-Origin Form POST 403, unavailable document/RSC headers and public-state races |
| History secret scan | No high-confidence credentials, cookies or private keys in added M11 history at T11 | Local scan; synthetic CI values permitted; final history scan repeated before push gate |

T8 and T9 used the exact CI synthetic application values, overriding only the two database URLs to the permitted loopback database under E5. App and Card origins are identical in that configuration, so the browser sweep covers both roles on that origin, not distinct-host cookie behavior. T9 inspected the same application code as the T11 rebuild.

The local ignored ledger is `.superpowers/sdd/2026-10-15-milestone-11-full-verification/progress.md`; task logs, SQL fingerprints, browser JSON and fail-closed wrappers stay beside it and are never committed. No `.env.local`, banned migration/seed command, dependency/lockfile, migration, index or CSP change was used. The loopback servers/browser were stopped and the isolated cluster restored to its original stopped state. Retained fixture data and the existing active Product were preserved. Production, shared development, restore branches and `feat/ui-design-system` were not modified.

## Capability matrix

All cited existing tests ran again in T11. References below identify the owning module/test rather than duplicating already-proven chains.

| Capability / invariant | Final evidence | Result |
|---|---|---|
| Config isolation, server boundaries, no bundled secrets | `config` env/isolation/server-only tests; T11 bundle scan | U / artifact PASS |
| Schema, migration rerun and ERD freshness | `db/migrations.db.test.ts`, ERD tests; T2 parity; T11 drift check | DB / real PostgreSQL PASS |
| Permanent token, credential uniqueness/history, Ready physical-check constraints | Cards/credential/integrity guards; T2 `convalidated`; concurrency | DB / C PASS |
| Deterministic, synthetic seed; no Ready DBC | `db/seed.db.test.ts` (7); no real-PostgreSQL seed run | DB PASS |
| Better Auth, hashed/single-use OTP, expiry/attempt caps, non-enumeration | Auth email-OTP/routes/sessions tests | DB PASS; real-provider CF only |
| Google identity/linking/no stored tokens | Auth Google tests with stubbed provider | DB PASS; final-origin OAuth M12 |
| Session revocation/cookies/account controls | Auth sessions/account-controls; T7 real Better Auth session seam | DB / J PASS |
| Uniform page/action denial before DB/providers | T4 real access layer, throwing recording DB proxy, provider/mutation spies | U PASS |
| Object scoping / IDOR | Manage/lifecycle/scenes/blocks/forms/Inbox/media tests; T6 foreign owner gets null and unchanged `readAt` | DB / J PASS |
| Stock/provision/NFC exact match/package → Ready | DBC tests, provisioning concurrency, T6 real provisioning output | DB / C / J PASS; P CF |
| Activation single winner, generic failure, owner idempotence | `activation/claim.db.test.ts`; credential/claim concurrency; T6 | DB / C / J PASS |
| Starter/Profile/Default Scene/publish/order/safe URL | Profile/scenes/blocks/lifecycle and safe-URL tests; T6 | U / DB / J PASS |
| Fresh Card routing, shown/Default fallback, disable/unpublish/reconnect | `cards/resolve.db.test.ts`, view/proxy/request tests; HTTP races | U / DB / H PASS |
| QR exact Card URL, vCard escaping/no-store/noindex | QR/vCard/contact-route tests; T9 QR rendering; physical decoding CF | U / H / B PASS within scope |
| Form persistence/dedup/caps and owner Inbox | Submissions/Inbox/notify/form-route tests; T6; T9 prefetch/click | DB / J / B PASS |
| Signed profile-scoped raster uploads/caps | Cloudinary unit/media-action tests; T9 synthetic upload attempt | U / B PASS; real-provider CF |
| Mixed DBC/GRC order, price snapshots, derived completion | Orders/totals tests; orders concurrency; T6 partial then final payment | U / DB / C / J PASS; GRC has no Card rows |
| Cancellation boundary | `orders/cancel.db.test.ts` (15,45); orders concurrency | DB / C PASS |
| Payments/refunds/voids append-only and capped | Record/money/support tests; orders/support R1–R3 | DB / C PASS |
| Shipment changes do not reopen completion | Fulfillment/support-shipment tests | DB PASS |
| Derived inventory/expenses; costs counted once | Stock/queries/expenses tests; T6 read-back | DB / J PASS |
| Purchaser differs from Account and Card owner | Directory/purchaser tests; T6 independent purchaser/gift/bulk recipients | DB / J PASS |
| Dashboard/search/immutable Activity | Dashboard/search/record tests; T6 required events and read-back | DB / J PASS |
| M9A retire/reissue/reset/free vs paid replacement | Support cards/money/shipments tests; support concurrency; M9A T16 CF | DB / C PASS |
| Public support unverified contact/dedup/caps/credential detector | Support intake/email/replies tests; C R17/R20; T8 positive control | DB / C / H PASS |
| Recovery proof/rechecks/owner refusal/Account retention | Accounts recovery/Secure Account and support-replies tests; T7 | DB / C / J PASS |
| IPv6 /64/daily quotas and nonblocking cleanup | Client-IP/OTP-quota/forms/intake tests; C R17/R20 | U / DB / C PASS |
| Production CSP/client boundary/private cache/nosniff | Security-header tests; T5; T8; T9; T11 HTTP | U / H / B PASS locally; edge X NOT EXERCISED |
| CSRF/trusted Origin | Auth routes/forms tests; T8 action; T11 forms403 | DB / H PASS |
| Sentry scrubbing and wiring | `lib/sentry-scrub.test.ts` (17), existing one-line instrumentation calls | U PASS; DSN/source maps M12 |
| Single winners, lock order, no deadlock/lost update | Six existing two-session suites, mapped below | C PASS |

Existing seam citations retained from plan §8.3: release → claim, `orders/fulfillment.db.test.ts:94`; cancellation, `orders/cancel.db.test.ts:15,45`; invalid/used/revoked/idempotent codes, `activation/claim.db.test.ts`; shown Scene/disable/unpublish/switch/two Cards/reconnect/hidden Form, `cards/resolve.db.test.ts:34,82,93,101,115,125,136`; after-sale retire/replacement/reissue/reset, `support/cards.db.test.ts:37,66,138`; corrections/shipments/replies, their support DB tests; pending recovery blocks resolution, `support/replies.db.test.ts:11`; recovery attempts/rechecks/Secure Account, `accounts/recovery.db.test.ts:57,90,100,117`; account intake links only owned Cards, `support/intake.db.test.ts`. These historical line anchors are supplemented by filenames/test behavior if lines move.

## Access matrix

| Surface | Signed out | Customer A | B using A's IDs | OWNER | Proof |
|---|---|---|---|---|---|
| Published Card | Public | Owner bar only for A's Card | Public, no controls | No implicit owner bar | Proxy/request/resolve tests, H, B |
| Unavailable Card | Generic404 | Owner-only management response | Generic404 | No implicit ownership | H, DB |
| Activation | Rate-limited check; claim redirects `/activate` | Explicit claim | Generic ownership denial | Same ownership rules | T4, activation tests, T6/T9 |
| Support/recover | Public quota/proof boundary | Own Card links only | No linking of A's Card | Allowed; recovery targets must be customer Accounts | Intake/recovery tests |
| Forms POST | Origin/size/quota boundary | Same | Same | Same | Route tests, H403 |
| `/app/**` | Safe sign-in redirect/401; early parameter rejection may404 | Own objects | Scoped not-found/null; no mutation | Own customer objects only | T4, DB, T6 |
| `/admin/**` | Safe sign-in redirect/401 | 404/403 | 404/403 | Allowed | T4, existing admin tests, B |
| Role changes | No public endpoint | No public endpoint | No endpoint | Operator CLI only | Routes/set-role tests |
| Sessions/recovery | No session | Sign out everywhere | No foreign session control | Verified recovery; owner targets refused | Account controls/recovery, T7 |
| Sign-in destination | `safeNext` boundary | Same | Same | Same | Policy tests |

The sweep freezes 85 named action exports. Five public exceptions have explicit reasons: support intake, proof-guarded recovery, activation code check, start-over and switch-account. The 80 guarded exports retain zero DB/provider/mutation calls for their denied actors; no general redirect allow-list was broadened. Cross-account `openSubmission` returning `null` is the established service contract; its page maps that to not-found.

## Concurrency map

| Risk | Existing suite/scenarios | T11 result |
|---|---|---|
| Retire vs usable credential | Credential, three isolation levels × two orders | 6 PASS |
| Credential staleness/duplication; legacy GRC over-reservation | Provisioning | 7 PASS |
| Double ownership; claim vs revoke | Claim; support R7/R15 | Claim4 PASS |
| Duplicate Profile, ordering, inquiry dedup/hidden Form | Profile | 7 PASS |
| Overpayment, double sale, cancellation/release, completion/refund cap | Orders | 7 PASS |
| After-sale money; void vs correction | Support R1–R3 | Support suite27 PASS |
| Double replacement; reservation | R4–R6 | Included |
| Reset/connect/disable/owner race/FK cycle | R8/R11/R12 | Included |
| Resolve vs correction | R9 | Included |
| Deadlocks/lock order | R10/R18/R19 | Included |
| Recovery races | R13–R16 | Included |
| Intake double submit/quota | R17 | Included |
| Locked expired quota row cannot block cleanup | R20 | Included |

All suites used the exact permitted loopback host/port/database through fail-closed wrappers. No scenario or dependency was added. Per-suite counts are authoritative; 58 PASS lines should not be relabelled as 57.

## Carried-forward register

| Prior evidence | What remains valid / limitations | M11 treatment |
|---|---|---|
| M3 live local auth | Real OTP, Google sign-in/Connect, admin denial and sign-out; later caps/hooks tested separately | CF flows; deployed final-origin OAuth NOT EXERCISED |
| M4 physical, 2026-10-12, iPhone15 Pro Max | Exact NFC write/read/tap, writable tag, package match and replacement; engineering origin only | CF P; synthetic T6 attestations add no physical claim |
| M5 packaged iPhone | Common QR/code/OTP/explicit claim/replay safety; original release used SQL | CF P; T6 proves service release/claim seam, T9 software CSP |
| M6 mobile browser, 390×844 | Real Cloudinary upload/replace/delete and notification/QR isolation | CF browser/provider flows; D1/T9 newly cover editor CSP |
| M7 iPhone and GalaxyS25 | Published/Disabled/Draft NFC, QR, Save Contact and inquiry; engineering origin | CF P; final-origin real chain M12 |
| M8 local S1–S10 + isolated Preview | Owner operations; S11 phone and T20 real-card chain were never exercised | CF; T6/T9 are software evidence only |
| M9A T16, 9/9 | Local support corrections | CF; existing DB/C tests rerun |
| M9B reduced A1/A4 | Preview support submit and owner reply/resolve only | CF; live A6/two-inbox recovery still M12, T7 is J |
| M10 T12 headless | Public Card/support CSP and development HMR | CF B within original routes; T9 extends local coverage |
| M10 shared-development `0015` gate | 16 journal entries, validated Ready check, catalog matched migrations on 2026-10-15 | CF accepted; T2 independently proves fresh local migration/parity; no later schema change |

D1 changes only editor runtime import boundaries/constants; it does not invalidate NFC URL semantics, resolver behavior, validation or the scoped prior physical/provider evidence. No new physical/mobile/QR-decoding/provider-delivery acceptance was performed.

## Findings and residual register

| Item / severity | Status and smallest correction | Owner / follow-up trigger |
|---|---|---|
| M11-D1, minor: three editor client paths retain Zod's caught eval probe | **Resolved**, approved `fd17f08`: data-only constants, compatible re-exports, three client runtime imports; schemas/validation/CSP unchanged. Preserved RED import chains and production chunks; GREEN graph/affected tests/chunks/B sweep/full T11 | Implementer; regression graph remains required. Not an accepted residual |
| M11-V1, minor harness repeatability | **Resolved**, approved `96995a0`: only supporting HTTP Product insert `active=false`; assertions and retained active Product unchanged. Two consecutive gates on the same retained DB passed | Verification fixture; rerun remains safe |
| M11-P1, expectation | **Resolved**, approved exact signed-out `claimAction` → `/activate`; all no-DB/provider/mutation requirements retained | Existing activation tests establish contract |
| M11-P2, expectation | **Resolved**, approved cross-account Inbox service `null`; unchanged `readAt` and no disclosure asserted | Existing Inbox tests/page establish contract |
| M11-E1, execution environment | **Resolved**: Windows sandbox `os.userInfo()` ENOMEM; approved reproduction/targeted/full checks outside sandbox | No product evidence invalidated |
| M11-E2/E3, build transport | **Resolved for local gate**: approved Google Fonts GETs only; optional exact Next advisory request denied locally, registry blocked; no installs/downloads except required fonts | Reapply guarded transport for builds; no dependency/CSP changes |
| Browser/journey helper setup mismatches | **Resolved as fixture/test-only corrections**: required name, ordered ID comparison, established setup route, multipart streaming encoding, blank-Card invariants, owner-bar accessible label and dummy provider response | No weakened assertion or application change; detailed local ledger |
| M10 R1/R3 | **Deferred** MFA/step-up and Turnstile | Product/operations owners: re-confirm at Production setup; team growth or distributed-abuse/cap alerts |
| M10 R2 | **Accepted residual** inline scripts in static CSP | Owners: compatible PPR nonces/stable SRI; no policy widening in M11 |
| M10 R4/R5 | **Accepted residuals** daily email lockout and carrier-IP caps | Owners: support burden/event-scale traffic; Google/Support fallbacks remain |
| M10 R6/R7 | **Accepted residuals** query ceilings/quota cleanup scan | Owners: lists/search >about10k rows, dashboard >about2k Orders, measured p95>500ms; quota rows >about10k |
| M10 R8 | Prefetch subitem **resolved locally** by real T9 B/SQL. Other accepted subitems remain: non-UUID customer500s, Inbox mailto answer validation, unsigned Cloudinary overwrite option, owner-note credential detector | Owners: separate scoped decisions; rerun prefetch after router/cache/navigation changes |
| M10 R9 | **Deferred** source maps and real Sentry proof | Owners: Production setup/M12 |
| M10 R10 | **NOT EXERCISED (access)**: approved Vercel edge/HSTS observation unavailable | Executor with Vercel connector; M12 or next approved accessible Preview |
| M10 R11 | Shared `0015` gate complete historically; **CF accepted**, not rerun | No shared access required; T2 fresh local parity passed |
| M10 R12 | **Accepted residual** Vercel Toolbar blocked intentionally | Never add `vercel.live` for toolbar; distinguish toolbar-only diagnostics |
| Legacy GRC Inventory utility | **Accepted residual** optional utility; not required for commercial Order completion | Product owners; no lifecycle expansion |

No unresolved blocker or important application defect was found in the exercised scope. T10 is an evidence gap, not an edge-header pass or failure. Production remains unconfigured; its expected fail-closed behavior is not deployment verification.

## M12 handoff — required before pilot readiness

1. **Domain and Production.** Lock the final public domain and `CARD_URL_ORIGIN`; enable registrar auto-renew, lock, MFA, DNSSEC and recovery email. Create the separate Production Neon project, register `PRODUCTION_DATABASE_HOSTS`, isolate secrets, apply `0000`–`0015` under separate approval, and rehearse restore/rollback.
2. **Real end-to-end on the final origin.** Provision → real NFC write/read/tap → package match → UI Order release → `/activate` → setup → publish → NFC tap and Sharing QR, using at least one iPhone and one Android. This closes M8 T20/S11. Exercise registered-callback Google OAuth and real email OTP on a production-like origin.
3. **Email.** Verify the Neffi Resend domain with SPF/DKIM/DMARC; observe M9B A6 recovery with two independent inboxes, restricted old-address notices, completion, old-session revocation and new-address sign-in. Verify email-change and security-notice delivery. Synthetic/injected-sender success does not close delivery gates.
4. **Headers and monitoring.** Complete R10: authorized share-link access to the prescribed READY Preview; Preview env names only for Sentry presence; GET `/`, `/sign-in`, `/api/health`, one unknown Card document and same-path RSC. Compare exact production CSP (only configured Sentry ingest origin may differ), nosniff, unavailable404/noindex, cache headers and observed HSTS; no header/config changes to force a pass. Set HSTS only once final-domain HTTPS is ready and observe final-domain CSP/nosniff. Configure a real Sentry DSN, prove scrubbing with test errors and upload source maps (R9). Check Cloudinary production restrictions.
5. **Usability.** Real-phone acceptance of activation and setup; headless desktop evidence does not substitute.
6. **Re-confirm deferred decisions.** MFA/step-up (R1) and Turnstile (R3) remain deferred, subject to their recorded triggers.
7. **Manual Notion reconciliation outside M11.** Correct Step7 “OWNER MFA/step-up enabled”; Locked Plan Step7's proposed TOTP/step-up before commercial launch; Step8 M10 “Must deliver” Turnstile/migration rehearsal; and Step9 M9A/M9B/M10 “not started”. No Notion edits were made.
8. **Carry accepted residuals explicitly.** Preserve R2/R4–R8 remaining items and the optional legacy GRC utility. D1 is resolved, and R8's local prefetch subitem is closed; neither is an unresolved accepted defect.

## Independent review and release gate

T13 independent whole-branch review: **APPROVED, no findings**, by the read-only `code_reviewer` agent `m11_independent_review` on 2026-10-16. It reviewed the complete `9b8aecf..ef1110e` diff, relevant surrounding code, canonical plan and local evidence against §10. It confirmed approved scope, preserved validation/re-exports, test integrity, fail-closed environment guards, honest evidence classes and the T10 access limitation. This final editorial change records that verdict; application/test code is unchanged. A final documentation-delta check and history secret scan precede the release approval request. No push, PR, merge, deployment or external mutation was performed. The next gate is explicit approval to push `feat/m11-full-verification` and open a PR targeting `main`; merge requires separate approval.
