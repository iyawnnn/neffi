# Domain modules

Neffi is one modular monolith. Business rules live in domain modules under `src/modules/<name>/`; a module's folder is created when its first real code arrives (no empty scaffolding).

| Module | Owns | First milestone |
|---|---|---|
| `accounts` | Account, Authentication Identity, OWNER role | 2 (schema), 3 (behavior) |
| `cards` | Physical Card, permanent `/c/{token}`, Card→Profile routing, disable/re-enable | 4 |
| `activation` | Activation Credential lifecycle, code-first claim | 4 (credentials), 5 (claim) |
| `profiles` | Profile, Profile Link, publish state | 6 |
| `orders` | Product, Customer/Purchaser, Order, Order Item, Shipment | 8 |
| `payments` | Payment, Refund (separate history records) | 8 |
| `inventory` | Stock Purchase, derived Card-state counts | 4, 8 |
| `support` | Support Case and controlled recovery actions | 9 |
| `expenses` | Manual Expense; reporting combines canonical Stock Purchase / Shipment costs | 8 |
| `notifications` | EmailService boundary (Resend) | 9 |
| `activity` | Activity Event history | 2 |

Infrastructure boundaries outside `modules/`:

- `src/config` — validated environment (`env.ts` is server-only) and environment isolation.
- `src/db` — the only place that touches the database driver (`index.ts` is server-only).
- `src/auth` — Better Auth server instance (`server.ts` is server-only).
- Provider integrations (MediaService/Cloudinary, EmailService/Resend) get their own server-only boundary when introduced.

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

The seed and ERD are developer tooling, not domain APIs. Live M2 migration/reset on `tapcard-dev` requires the Task 9 restore-point confirmation and explicit approval described in the [database workflow](../../README.md#database-migrations).

## Rules

- UI, Server Actions and Route Handlers call domain services; domain services own business rules and persistence.
- Server Actions and Route Handlers are public endpoints: authenticate, authorize, validate and rate-limit them server-side. Hiding UI is never authorization.
- Client Components receive minimal DTOs, never raw database rows or server config.
- Select only the columns a screen needs; paginate unbounded lists; let PostgreSQL aggregate; use real transactions for multi-record invariants (e.g. Card claim).
- Keep DBC and GRC behavior distinct, Purchaser separate from Account, and Card ownership separate from Card→Profile routing.
- Never put activation codes, OTPs, tokens or other secrets into URLs, logs, error messages, analytics or browser storage.
