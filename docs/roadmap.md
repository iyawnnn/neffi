# Roadmap and milestone status

Status as of 2026-10-14. Implementation plans for each milestone are kept as history under [`superpowers/plans/`](superpowers/plans/). They are not the current specification. Current behavior is described in [PRODUCT.md](../PRODUCT.md) and [`specs/`](specs/).

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
| **M9A** | Support Cases, corrections to Completed Orders, DBC card corrections, free and paid replacements, shipping exceptions | **Merged (PR #10).** [Plan](superpowers/plans/2026-10-14-milestone-9a-support-and-corrections.md) |
| **M9B** | Public support intake, account-recovery support path, support/security/recovery email | **Local implementation on feat/m9b-public-support-recovery; final software gate pending. Isolated Preview and user acceptance require approval and a verified Resend sender.** [Approved plan](superpowers/plans/2026-10-14-milestone-9b-public-support-recovery-email.md) |
| M10 | Security and performance hardening (OWNER MFA/step-up, rate-limit tuning, CSP, query review) | Later |
| M11 | Full verification | Later |
| M12 | Pilot readiness gate | Later. It cannot pass while any required physical acceptance is pending |

No production deployment exists yet. Neon development is migrated through `0012`. Migrations `0013_support_guards` and `0014_support_intake_recovery` are local-only; shared application requires separate explicit approval, restore points and that order. M9B has not modified Neon, Vercel, live Resend or Production.

## Deliberately deferred

Account deletion or restriction, account merge and Profile moves between Accounts, Settings → Communications, Settings → Business, customer-visible support status, owner-facing order/payment/courier emails, and form-notification retry. Each needs its own plan.

## Release mapping

| Release | Scope |
|---|---|
| V1 (Neffi Core) | Activation, guided setup, Starter Experiences, basic Scenes, focused Blocks and Actions, native Forms, Inbox with email notification, Save Contact, booking URL, simple GitHub link, digital Sharing QR, active-Scene public experience |
| V1.1 | Smart GitHub, temporary Scene expiry (if validated), stronger Project blocks, action analytics, optional file block |
| V1.2 | Google Sheets submission sync with delivery status and retry |
| V2+ | Notion sync, webhooks, Zapier/Make, more Starter Experiences, per-Card Scene override, teams/CRM only after customer evidence |
