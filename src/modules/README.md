# Domain modules

Neffi is one modular monolith. Business rules live in domain modules under `src/modules/<name>/`; a module's folder is created when its first real code arrives (no empty scaffolding).

| Module | Owns | First milestone |
|---|---|---|
| `accounts` | Account, Authentication Identity, OWNER role | 2 (schema), 3 (behavior) |
| `cards` | Physical Card, permanent `/c/{token}`, Card→Profile routing, disable/re-enable | 4 |
| `activation` | Activation Credential lifecycle, code-first claim | 4 (credential issue/revoke), 5 (claim) |
| `profiles` | Profile/shared identity, Scenes, ordered Blocks/Actions, publish state, native Forms/Form Submissions | 6 |
| `orders` | Product, Customer/Purchaser, Order, Order Item, Shipment | 8 |
| `payments` | Payment, Refund (separate history records) | 8 |
| `inventory` | Stock Purchase, derived Card-state counts | 4, 8 |
| `support` | Support Case and controlled recovery actions | 9 |
| `expenses` | Manual Expense; reporting combines canonical Stock Purchase / Shipment costs | 8 |
| `notifications` | EmailService boundary (Resend), meaningful owner notification email for native Form Submissions; later recovery/support | 6 (forms), 9 (recovery/support) |
| `activity` | Activity Event history | 2 |

Infrastructure boundaries outside `modules/`:

- `src/config` — validated environment (`env.ts` is server-only) and environment isolation.
- `src/db` — the only place that touches the database driver (`index.ts` is server-only).
- `src/auth` — Better Auth configuration and server instance; server-only access DAL, session actions and linked-method reads; pure authorization policy and browser auth client.
- `src/integrations/email/resend.ts` — server-only Resend delivery and auth-code template (M3); recovery/support templates remain M9.
- MediaService/Cloudinary gets its own server-only boundary when introduced.

## Milestone 2 persistence

M2 delivers the shared schema under `src/db/schema/`, reviewed migrations, integrity guards, a development-only synthetic reset, PGlite invariant tests and the generated [ERD/catalog](../../docs/database/erd.md). Domain folders remain uncreated until their behavior arrives; M2 adds no domain services.

| Persistence file | Future module consumers |
|---|---|
| `auth.ts` | accounts; Better Auth already uses these tables through its Drizzle adapter |
| `commerce.ts` | orders, payments |
| `inventory.ts` | inventory, cards, activation |
| `profiles.ts` | profiles |
| `operations.ts` | support, expenses, activity |

Database constraints enforce DBC/GRC separation, matching card/profile owners, credential uniqueness/outcomes and historical lifecycle/money integrity. Later domain services own authentication/authorization, credential generation and claim, URL validation, completion eligibility, cancellation rules, refund limits and support transactions. Balances, payment state and inventory counts stay derived. Stock-purchase and shipment costs remain on their source rows; manual expenses are separate.

The seed and ERD are developer tooling, not domain APIs. Live M2 migration/reset on `neffi-dev` requires the Task 9 restore-point confirmation and explicit approval described in the [database workflow](../../README.md#database-migrations).

## Milestone 3 account behavior

`accounts/set-role.ts` is the server-only operator service used by `scripts/set-account-role.ts`. It locks the case-insensitive Account match and commits the role transition with its immutable activity event; no-op, invalid, unknown and ambiguous cases write nothing. Browser auth cannot grant OWNER. The CLI uses migration environment isolation and requires live approval before use against Neon.

Sign-in, verified identity resolution, safe linking, OTP quotas and session lifecycle live in `src/auth`. `access.ts` checks layouts/pages and authorizes handlers/actions; `policy.ts` holds the pure role/ownership and redirect policies. Customer and owner screens are shells, with no M4+ business behavior. The minimal Resend boundary sends only sign-in codes.

Migration `0007` adds auth abuse storage; forward fix `0008` indexes abandoned IP-counter cleanup. Live changes require the M3 Task 8 restore-point and approval gate; Task 9 whole-branch review follows live verification. The [auth runbook](../../README.md#authentication-runbook-m3) documents provider configuration, role operations, accepted limits and streamed navigation denials.

## Milestone 4 provisioning

`cards/card.ts` (lock, NFC check, retire), `cards/dbc.ts` (provision, package match, credential replacement), `cards/grc.ts` (reserve, eligible items), `activation/credentials.ts` (issue/revoke; HMAC only), `activity/record.ts` and `inventory/{stock-intake,queries}.ts` are server-only services taking a `Db`. Each mutation is one transaction that locks the card row first (`reserveGrc` locks the order item, then the card), re-reads state under the lock and writes its Activity Event in the same transaction. `activation/code.ts` and `cards/token.ts` are pure helpers. Actions in `src/app/admin/inventory/actions.ts` authorize as OWNER, validate with Zod and call the services. M4 does not claim cards, validate codes for customers, resolve `/c/{token}` or create orders; those are Milestones 5, 7 and 8. See the [provisioning runbook](../../README.md#physical-card-provisioning-m4).

## Rules

M6 evolves Profile/shared identity → Scenes → ordered Blocks/Actions through additive migrations, including native Forms/Form Submissions and meaningful owner notification email. Existing Profile Links become Link-type Scene Blocks, not a competing flat public renderer. Scenes belong to Profiles, with Profile-level Theme/Appearance and no Card→Scene override in V1. These capabilities are deferred, not implemented in M4; the public active/default Scene resolver remains M7.

- UI, Server Actions and Route Handlers call domain services; domain services own business rules and persistence.
- Server Actions and Route Handlers are public endpoints: authenticate, authorize, validate and rate-limit them server-side. Hiding UI is never authorization.
- Client Components receive minimal DTOs, never raw database rows or server config.
- Select only the columns a screen needs; paginate unbounded lists; let PostgreSQL aggregate; use real transactions for multi-record invariants (e.g. Card claim).
- Keep DBC and GRC behavior distinct, Purchaser separate from Account, and Card ownership separate from Card→Profile routing.
- Never put activation codes, OTPs, tokens or other secrets into URLs, logs, error messages, analytics or browser storage.
