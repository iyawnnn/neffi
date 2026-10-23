# Engineering roadmap and milestone status

Engineering delivery status as of 2026-10-23: milestones, launch gates and deferred engineering scope. This is the only place current engineering milestone status is maintained; the reports in [`verification/`](verification/) and [operations.md](operations.md) keep dated evidence. Notion owns product release direction and priority. Implementation plans for each milestone are kept as history under [`superpowers/plans/`](superpowers/plans/). They are not the current specification; [PRODUCT.md](../PRODUCT.md) and [`specs/`](specs/) describe current behavior.

| Milestone | Scope | Status |
|---|---|---|
| M1 | Foundation: Next.js 16 app, environment validation and isolation, CI, Sentry baseline | Complete, merged |
| M2 | Database: schema, integrity guards, migrations, synthetic seed, ERD | Complete, merged |
| M3 | Authentication and authorization: Google and email code sign-in, OWNER role, abuse limits | Complete, merged |
| M4 | Physical card provisioning (stock intake, DBC provisioning, NFC check, package match) | Complete, merged. Physical hardware acceptance passed 2026-10-12 |
| M5 | Secure activation (`/activate`, atomic claim) | Complete, merged. Packaged-card acceptance passed 2026-10-12 |
| M6 | Customer mobile experience (guided setup, Profiles, Scenes, Blocks, Forms, Inbox, Cloudinary media, Sharing QR) | Complete, merged |
| M7 | Public NFC / active Scene experience (`/c/{token}`) | Complete, merged. Physical NFC acceptance passed |
| M8 | Owner business operations (Orders, payments, fulfilment, inventory, expenses, customers, dashboard, search, Settings) | Complete, merged (PR #8). Local acceptance and isolated Preview acceptance passed. The optional real-card chain (T20) and the physical-phone scenario were not run |
| M9A | Support Cases, corrections to Completed Orders, DBC card corrections, free and paid replacements, shipping exceptions | Merged (PR #10). [Plan](superpowers/plans/2026-10-14-milestone-9a-support-and-corrections.md) |
| M9B | Public support intake, account-recovery support path, support/security/recovery email | Merged (PR #11). Software gate and independent review passed. Reduced manual acceptance approved: A1 basic and A4 core passed, A6 deferred, remaining manual checks not exercised. [Approved plan](superpowers/plans/2026-10-14-milestone-9b-public-support-recovery-email.md) |
| M10 | IPv6 /64 quotas, daily caps and safe cleanup, static CSP/nosniff, Sentry SQL-parameter scrubbing, precise Inbox cursors, validation migration 0015 | Merged (PR #12). Software gate and T12 browser acceptance passed. Shared development verified through 0015 (16-entry journal, Ready-check constraint validated) |
| M11 | Full verification | Merged (PR #13). Local full gate passed: 161 files / 1,481 tests, build/bundle, six concurrency suites, HTTP and 37 browser checkpoints. Shared-development evidence carried forward. Vercel edge observation not exercised (no access) and handed to M12. [Report](verification/2026-10-m11-full-verification.md) |
| M12 | Pilot readiness gate | Later. It cannot pass while any required physical acceptance is pending |
| Profile layouts and guided setup | Classic/Editorial/Showcase, Light/Dark, Goals, guided setup, optional Showcase cover ([spec](specs/profile-customization-onboarding.md), [0015](decisions/0015-showcase-cover-image.md)) | Implemented. Architecture locked 2026-10-21; cover added 2026-10-22. T2–T15 and T8a–T8c complete; physical NFC, real-phone and real-Cloudinary acceptance pending. [Plan](superpowers/plans/2026-10-21-profile-customization-onboarding.md) |

## Production and launch gates

Production is deployed at `https://getneffi.com`, separate from `neffi-dev`, with committed migrations through `0018_concerned_patch`. The permanent origin is configured; infrastructure acceptance does not mean public launch or physical acceptance. See the [post-live acceptance record](verification/2026-10-23-production-acceptance.md) for attributed results and the [initial migration record](verification/2026-10-23-production-readiness.md) for database/restore identity. Earlier M4/M5/M7 physical results and M11 test counts above are historical milestone evidence, not current Production card acceptance.

- **Verified:** domain/HTTPS/www redirect, isolated initial migration, auth health, Google and OTP login, verified sender, both sign-out/session-revocation flows, anonymous protected-route behavior, Sentry delivery/processed privacy, and forwarded-IP trust for the observed direct Vercel ingress. The focused review reported zero confirmed vulnerabilities; this is not a guarantee of absence.
- **Pending provider confirmation:** effective Cloudinary resource-type/original metadata restrictions and Vercel credential separation. Separate environment records alone do not prove distinct credential values.
- **Pending physical/card-dependent acceptance:** genuine internal-card NFC write/read/tap, package-code match, supported release/claim, guided setup E2E, live photo/Showcase cover upload/crop/replace/remove, public `/c/{token}` and vCard. Do not fabricate evidence or provision a customer card to clear these gates.
- **Other launch requirements:** reviewed Privacy/Terms and approved commercial copy remain required. Full recovery acceptance with two independent authorized external inboxes remains unverified. No SEO launch is authorized by these infrastructure results.

The 2026-10-15 shared-development migration observation is retained in [operations](operations.md#migration-0015-gate-and-verified-shared-development-state); it is not a statement of a newly queried Development journal. Latest layout/setup implementation and reported local checks are summarized in the [dated implementation evidence](verification/2026-10-23-profile-setup-evidence.md).


## Deliberately deferred

OWNER MFA/step-up, Turnstile, account deletion or restriction, account merge and Profile moves between Accounts, Settings → Communications, Settings → Business, customer-visible support status, owner-facing order/payment/courier emails, and form-notification retry. Each needs its own plan.

## Product releases

Notion owns product release direction (V1 Neffi Core, V1.1, V1.2, V2+): [Neffi — Locked Plan, Release Direction](https://app.notion.com/p/3f343f7dfcb0812baaf7d8135c038c0f).
