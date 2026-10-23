# Production infrastructure evidence — 2026-10-23

This records a gated infrastructure setup, not public-launch or final acceptance. Starting clean `main`: `77f1935077f9c09486c64fd6657c4598dd7abfa5` (Next.js 16.4.2, PR #31). Code changes are confined to Production database registration, regression tests and operational documentation on `chore/production-environment`, worktree `C:\CodeProjects\neffi\.worktrees\production-environment`.

## Database identity and migration evidence

| Item | Verified value |
|---|---|
| New project | `neffi-production` / `lingering-mountain-71377561` |
| Organization | `org-damp-field-09711506` |
| Region / PostgreSQL | `aws-ap-southeast-1` (Singapore) / 18 |
| Default branch | `production` / `br-damp-tree-aodwri8s` |
| Database / role | `neffi` / `neffi_owner` |
| Direct host | `ep-gentle-cell-aoctmxkt.c-2.ap-southeast-1.aws.neon.tech` |
| Pooled host | `ep-gentle-cell-aoctmxkt-pooler.c-2.ap-southeast-1.aws.neon.tech` |
| Restore branch | `pre-initial-migrations-20261023` / `br-flat-scene-aol9sp19` |
| Restore parent / LSN | `br-damp-tree-aodwri8s` / `0/19C72A0` |
| Final migration | `0018_concerned_patch` |
| Final journal timestamp | `1792654710147` |
| Final migration SHA-256 | `87f59b0bd80999b425924f73b3de5287acb3f3237236767b8bb6ddc76bbf4856` |

Before schema application, the new database had **zero public tables and zero migration-journal tables**. The separate project, branch, database and endpoint were checked through Neon metadata, and the SQL connection confirmed database/role identity. Production's host differs from every inspected `neffi-dev` endpoint; development's configured pooled host is `ep-mute-block-azrjzr69-pooler.c-3.ap-southeast-1.aws.neon.tech`. No development database connection or mutation was performed.

The restore branch was verified **ready** before migration and retained without a compute. It was not migrated, reset or deleted. The guarded operator script fetched the new project's connection string in memory, used certificate-verifying TLS, invoked the existing Drizzle node-postgres migrator, and checked the application's Production isolation guard. No Production connection string was written into a local env file or report.

All 19 committed migrations (`0000`–`0018`) applied. Every stored migration hash and timestamp matched the committed files/journal. The second migrator invocation succeeded and its entire journal matched the first run: **no pending migration / no-op**. No seed/reset ran.

Post-migration read-only verification confirmed:

- 27 public application tables, 19 public enums; every enum's ordered values matched `0018_snapshot.json`.
- Appearance fields `layout`, `color_mode`, `goal`, `accent_color` and all six Showcase cover fields exist.
- `cards_dbc_ready_checks_recorded`, `profiles_cover_complete` and `profiles_cover_bounds` are present and validated.
- The six `0016` social additions are present: Threads, Discord, Reddit, Pinterest, Behance and Dribbble.
- Every one of the 27 application tables has **zero rows**. Only migration metadata was populated; no accounts, sessions, cards, profiles, support cases or demo content were copied/created.

The initial postcheck stopped after both migration invocations had succeeded: the local audit script used `accent` instead of `accent_color` and needed a `text[]` cast for PostgreSQL catalog enum labels parsed by node-postgres. Those audit-only issues were corrected; verification reruns were strictly read-only and did not invoke the migrator again. Migration SQL itself did not fail or change.

## Isolation and local checks

Only the new direct hostname was registered in `PRODUCTION_DATABASE_HOSTS`. Existing normalization covers the pooled spelling, case and trailing dots. No validation or environment boundary was weakened. Regression cases cover Production acceptance, development/Preview rejection, development/unknown-host refusal in Production, and the existing explicit-empty-allowlist fail-closed behavior.

RED: the new registration tests initially produced **5 failures / 14 passes** against the empty allowlist. GREEN: config/isolation tests **55 passed**; focused config, migrations, media and Sentry tests **95 passed**. Full suite: **226 files / 2,438 tests passed**. Type generation and TypeScript passed. Lint: **0 errors, 17 existing warnings**. Migration-history check, locality snapshot check, production build, bundle/secret scan and `git diff --check` passed. The successful build completed in 52 seconds.

The full suite and lint/typecheck/migration-history/build/bundle gates use the exact synthetic CI values; focused tests use synthetic fixtures. No `.env.local` or live database/media/email calls are used by these software checks. The initial worktree build refused a shared `node_modules` junction because Turbopack disallows a symlink outside its filesystem root. Dependencies were then installed locally from the unchanged lockfile/offline cache; no dependency or application configuration change was needed.

## Custom domain and manual Cloudflare gate

The maintainer supplied **`getneffi.com`** as the permanent domain during this task. Cloudflare remains DNS provider/registrar; nameservers remain `venkat.ns.cloudflare.com` and `magnolia.ns.cloudflare.com`.

Existing Vercel project: `neffi` / `prj_ZvMsro2JQSchBRiYWRXu5aHzjNRG`, team `team_8dKm0VtKvoK17iHDIoP6AXqa`. The Git production branch is `main`. Added:

- `getneffi.com` → Production, no redirect.
- `www.getneffi.com` → `getneffi.com`, HTTP **308**.

Vercel accepted ownership (`verified: true`) but reported **`misconfigured: true`, `configuredBy: null`** for both domains. Domain ownership verification is not DNS routing, TLS, deployment or application acceptance.

Exact Vercel recommendations retrieved after attachment on 2026-10-23:

| Type | Cloudflare name | Target/value | Proxy | TTL |
|---|---|---|---|---|
| A | `@` | `216.198.79.1` | DNS only / grey cloud | Auto |
| A | `@` | `64.29.17.1` | DNS only / grey cloud | Auto |
| CNAME | `www` | `e1c150ed2c506cf9.vercel-dns-017.com` | DNS only / grey cloud | Auto |

Both IPv4 addresses are Vercel's rank-1 recommendation; its API says using one is also acceptable. The CNAME target above is rank 1 (the API includes a trailing DNS dot). Vercel requested **no ownership TXT challenge**. Do not use fallback/generic Vercel targets instead. TTL Auto is the chosen Cloudflare setting, not a Vercel-specific TTL requirement. Preserve unrelated email/TXT records; review any existing conflicting A/AAAA/CNAME record before replacing it.

No Cloudflare mutation was performed. External changes stopped at the maintainer's explicit manual-DNS gate. Add these records in Cloudflare, then re-inspect Vercel domain configuration and validate HTTPS. Do not move nameservers.

## Production variables and provider gates

The full classified variable checklist is in [the Production runbook](../operations.md#production-setup-infrastructure-acceptance). At the configuration audit, all existing Neffi app variables were Preview-only; **no Production app variables were configured during this task**. Available local/provider app credentials were designated development/Preview; they were not copied into Production. New auth/activation secrets were not generated prematurely or printed.

Required permanent values:

```text
BETTER_AUTH_URL=https://getneffi.com
CARD_URL_ORIGIN=https://getneffi.com
Google authorized redirect URI=https://getneffi.com/api/auth/callback/google
```

Debug fallback: `https://neffi.vercel.app`. It is not the NFC origin or permanent OAuth callback. Auth trusts the canonical origin, so the fallback does not establish cross-domain sign-in/session acceptance.

Remaining operator/provider work:

1. Configure pooled/direct Production DB URLs in Production scope only, generate new auth/activation secrets directly into the secret store, and supply approved Production Google/Resend/Cloudinary credentials and Sentry DSN. Do not paste secrets into chat or Git.
2. Register the exact Google callback above in Google Console. No Google client was changed; Production OAuth is unverified.
3. Verify the selected Resend sending domain using Resend's exact DNS records for `getneffi.com` (or its approved sending subdomain). No sender mailbox is invented here. The `onboarding@resend.dev` test sender only reaches the account owner's inbox and is not customer-email readiness. No email was sent.
4. Confirm Production Cloudinary account/product-environment credentials, then approve and run the single safe upload/confirm/delivery/replace/remove test. Signed uploads and profile namespaces were inspected/tested locally; **no live Cloudinary request or mutation** was made.
5. Supply the Sentry DSN/dashboard access. After deployment, inspect one controlled exception under environment `production`; ensure cookies/body/query/sensitive headers/auth tokens/OTPs/activation codes are absent. Local scrubber tests passed; no event was sent and ingestion/privacy is not verified against Production. Source-map uploads remain disabled.
6. Verify access protection for the custom Production domain. Existing `ssoProtection.deploymentType=all_except_custom_domains` was retained; this does not prove custom-domain protection. Resolve supported protection before infrastructure acceptance, with no public-launch assumption.
7. Review/integrate the isolation branch into `main` through the established workflow, configure all required Production vars, then deploy that exact `main` SHA. No feature-branch Production deployment is authorized by this record.

No Production deployment was triggered. Deployment URL/status/SHA, Better Auth, public/customer/profile/media smoke tests, live cookie/Origin/cache checks, HTTPS/security-header observation and Sentry ingestion remain **unverified / gated**. Source CSP includes `frame-ancestors 'none'` and `nosniff`; these are not claims about deployed response headers.

## Preserved boundaries and restart

No changes to `neffi-dev`, migrations, schema, application/domain behavior, dependencies, Google credentials, live Cloudinary or existing provider app secrets. No customer cards provisioned, no permanent Vercel card URLs, no customer data, no seed, no announcements/indexing/legal/SEO work. No push, PR, merge or deployment was performed during this task.

First maintainer action: add the three Cloudflare DNS records above (DNS only / Auto), then confirm to resume the domain/HTTPS checks and secure Production credential configuration. Keep customer provisioning blocked until canonical auth/card origin, HTTPS, routing and final acceptance pass.

Local evidence is retained under `.superpowers/production-readiness/` in the root repository (provider identifiers/DNS/restore records) and this worktree (guarded migration script, sanitized schema audit and software-check logs). These paths are ignored and contain no saved provider/DB secret values. Completed source checks and local commit identity should be read from the final handoff and Git; this record does not mark a roadmap milestone complete.
