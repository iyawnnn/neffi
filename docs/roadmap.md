# Engineering roadmap and milestone status

Engineering delivery status as of 2026-10-29: milestones, environment state, launch gates and deferred engineering scope. This is the only place current engineering milestone status is maintained; the reports in [`verification/`](verification/) and [operations.md](operations.md) keep dated evidence. Notion owns product release direction and priority. Implementation plans for each milestone are kept as history under [`superpowers/plans/`](superpowers/plans/). They are not the current specification; [PRODUCT.md](../PRODUCT.md) and [`specs/`](specs/) describe current behavior.

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
| M10 | IPv6 /64 quotas, daily caps and safe cleanup, static CSP/nosniff, Sentry SQL-parameter scrubbing, precise Inbox cursors, validation migration 0015 | Merged (PR #12). Software gate and T12 browser acceptance passed. At the time, shared development was verified through 0015 (2026-10-15; current state below) |
| M11 | Full verification | Merged (PR #13). Local full gate passed: 161 files / 1,481 tests, build/bundle, six concurrency suites, HTTP and 37 browser checkpoints. Shared-development evidence carried forward. Vercel edge observation not exercised (no access) and handed to M12. [Report](verification/2026-10-m11-full-verification.md) |
| M12 | Pilot readiness gate | Later. It cannot pass while any required physical acceptance is pending |
| Profile layouts and guided setup | Classic/Editorial/Showcase, Light/Dark, Goals, guided setup, optional Showcase cover ([spec](specs/profile-customization-onboarding.md), [0015](decisions/0015-showcase-cover-image.md)) | Implemented. Architecture locked 2026-10-21; cover added 2026-10-22. T2–T15 and T8a–T8c complete; physical NFC, real-phone and real-Cloudinary acceptance pending. [Plan](superpowers/plans/2026-10-21-profile-customization-onboarding.md) |

## Delivered after M11

| Work | Scope | Status |
|---|---|---|
| Customer experience and navigation | Unified public chrome, branded app navigation dock, desktop navigation, auth page composition, activation code input (#37–#42) | Merged |
| Marketing and legal pages | Guide, Pricing (₱799), Help, Privacy and Terms ([spec](specs/marketing-pages.md)) | Merged 2026-10-25. Reviewed Privacy/Terms remain a launch requirement |
| Transactional email redesign | Content-model emails with plain-text alternative (#47) | Merged |
| Owner operations redesign | Normal paid DBC orders, automatic allocation and Preparing, `N-XXXX` references, In person/J&T fulfilment, retrievable encrypted codes ([orders](specs/orders-and-fulfillment.md), [cards](specs/cards-and-activation.md), [0016](decisions/0016-retrievable-encrypted-activation-credentials.md)); migrations `0019`–`0021` (#50) | Merged 2026-10-26. Local Owner/Admin software acceptance passed on 2026-10-29 against development: dashboard and navigation, Inventory and stock detail, provisioning, code reveal/copy/hide, credential replacement with reload persistence, legacy-code rejection, card-state guards, and 255 targeted tests in 19 files. **Not** physical acceptance: live NFC write/tap, package match to Ready or Reserved, release and claim were not exercised |
| Admin detail pages and UI polish | Order, card and stock detail redesign; button pending states, loading skeletons, mobile navigation (#51–#54) | Merged and deployed |

## Environment state

Verified read-only on 2026-10-29. Update this section after every live migration ([procedure](operations.md#database-migrations)).

| Environment | Neon project / branch / database | Migrations | Restore point before latest change |
|---|---|---|---|
| Development (local, Preview) | `neffi-dev` / `production` (`br-empty-brook-az2mixh7`) / `neondb` | `0000`–`0021` (22 entries) | `pre-dev-0016-0021-20261028` |
| Production | `neffi-production` / `production` (`br-damp-tree-aodwri8s`) / `neffi` | `0000`–`0021` (22 entries) | `pre-owner-operations-redesign-20261026` |

Production serves `https://getneffi.com` from `main` and `/api/health` reports the database healthy. Both environments require the activation-code encryption variables ([key custody](operations.md#activation-code-key-custody)).

## Production and launch gates

Production is deployed at `https://getneffi.com`, separate from `neffi-dev` (migration state above). The permanent origin is configured; infrastructure acceptance does not mean public launch or physical acceptance. See the [post-live acceptance record](verification/2026-10-23-production-acceptance.md) for attributed results and the [initial migration record](verification/2026-10-23-production-readiness.md) for database/restore identity. Earlier M4/M5/M7 physical results and M11 test counts above are historical milestone evidence, not current Production card acceptance.

- **Verified:** domain/HTTPS/www redirect, isolated initial migration, auth health, Google and OTP login, verified sender, both sign-out/session-revocation flows, anonymous protected-route behavior, Sentry delivery/processed privacy, and forwarded-IP trust for the observed direct Vercel ingress. The focused review reported zero confirmed vulnerabilities; this is not a guarantee of absence.
- **Pending provider confirmation:** effective Cloudinary resource-type/original metadata restrictions and Vercel credential separation. Separate environment records alone do not prove distinct credential values.
- **Pending physical/card-dependent acceptance:** genuine internal-card NFC write/read/tap, package-code match (Preparing → Reserved and Blank → Ready), supported release (Hand over and J&T Mark as shipped)/claim, guided setup E2E, live photo/Showcase cover upload/crop/replace/remove, public `/c/{token}` and vCard. Use the [human operations checklist](testing/prelaunch-human-operations-acceptance.md) and the [physical checklist](testing/prelaunch-physical-acceptance.md).
- **Pending confirmation:** the activation-code encryption variable names in Vercel Production, checked by name only. Do not fabricate evidence or provision a customer card to clear these gates.
- **Other launch requirements:** reviewed Privacy/Terms and approved commercial copy remain required. Full recovery acceptance with two independent authorized external inboxes remains unverified. No SEO launch is authorized by these infrastructure results.

The 2026-10-15 shared-development migration observation is retained in [operations](operations.md#migration-0015-gate-2026-10-15-historical-evidence); it is not a statement of a newly queried Development journal. Latest layout/setup implementation and reported local checks are summarized in the [dated implementation evidence](verification/2026-10-23-profile-setup-evidence.md).


## Deliberately deferred

OWNER MFA/step-up, Turnstile, account deletion or restriction, account merge and Profile moves between Accounts, Settings → Communications, Settings → Business, customer-visible support status, owner-facing order/payment/courier emails, and form-notification retry. Each needs its own plan.

## Product releases

Notion owns product release direction (V1 Neffi Core, V1.1, V1.2, V2+): [Roadmap & Delivery](https://app.notion.com/p/3f443f7dfcb0815db681f66c6b0ba06a).
