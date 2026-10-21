# Engineering roadmap and milestone status

Engineering delivery status as of 2026-10-16: milestones, launch gates and deferred engineering scope. This is the only place current engineering milestone status is maintained; the reports in [`verification/`](verification/) and [operations.md](operations.md) keep dated evidence. Notion owns product release direction and priority. Implementation plans for each milestone are kept as history under [`superpowers/plans/`](superpowers/plans/). They are not the current specification; [PRODUCT.md](../PRODUCT.md) and [`specs/`](specs/) describe current behavior.

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
| Profile layouts and guided setup | Classic/Editorial/Showcase, Light/Dark, Goals, guided setup ([spec](specs/profile-customization-onboarding.md)) | Planned. Architecture locked 2026-10-21; implementation not started. [Plan](superpowers/plans/2026-10-21-profile-customization-onboarding.md) |

Production remains untouched and unconfigured. Shared Neon development is migrated through `0015_validate_dbc_ready_checks` as of 2026-10-15: 16 migration entries, validated `cards_dbc_ready_checks_recorded`, and 27 tables / 16 enums. The initial 0015 pre-check found one legacy synthetic Ready Card; its separately approved Ready-to-Blank correction retained NULL physical-verification fields, and the rerun pre-check returned 0. Migration 0015 succeeded and reran as a no-op; both M10 restore points remain retained. See [operations](operations.md#migration-0015-gate-and-verified-shared-development-state). Full recovery acceptance with a verified Neffi-owned sending domain and two independent external inboxes remains a launch gate.

## Deliberately deferred

OWNER MFA/step-up, Turnstile, account deletion or restriction, account merge and Profile moves between Accounts, Settings → Communications, Settings → Business, customer-visible support status, owner-facing order/payment/courier emails, and form-notification retry. Each needs its own plan.

## Product releases

Notion owns product release direction (V1 Neffi Core, V1.1, V1.2, V2+): [Neffi — Locked Plan, Release Direction](https://app.notion.com/p/3f343f7dfcb0812baaf7d8135c038c0f).
