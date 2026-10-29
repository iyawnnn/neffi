# Domain modules

Neffi is one modular monolith. Business rules live in domain modules under `src/modules/<name>/`; UI and server actions call them. Current behavior is described in [PRODUCT.md](../../PRODUCT.md), the [specs](../../docs/specs/) and the [architecture docs](../../docs/architecture/system.md).

| Module | Owns |
|---|---|
| `accounts` | Owner-role operator service; read-only directory (unchanged projection); verified recovery initiation/cancel/completion, secure account and security notices |
| `activation` | Activation code format and HMAC lookup; credential issue (with encrypted envelope), revoke and usable lookup; owner reveal and legacy-code adoption ([0016](../../docs/decisions/0016-retrievable-encrypted-activation-credentials.md)); code check and atomic claim |
| `activity` | `recordActivity` and the `ActivityType` set (immutable history) |
| `cards` | Tokens and URLs; DBC provisioning, preparation of allocated cards, NFC check, package match, credential replacement, retirement; resolver for `/c/{token}`; customer routing, disable and enable; Sharing QR; legacy manual GRC utilities |
| `expenses` | Manual expenses and the combined cost report (manual, stock and courier costs, each counted once) |
| `forms` | Native Forms, public submission storage and deduplication, owner notification email |
| `inventory` | Stock intake and edits (which also allocates waiting orders), derived card counts, preparation queues and `N-XXXX` inventory references |
| `orders` | Products and pricing (`policy.ts` holds the fixed DBC price and normal payment methods), purchasers, normal paid DBC orders, automatic card allocation, GRC/historical order creation and edits, In person and J&T fulfilment, cancellation, derived order facts and totals, system completion, dashboard |
| `payments` | Capped append-only payments and refunds, and reasoned voids |
| `support` | Case lifecycle, assignment, immutable links, notes and queries; Completed-order money corrections, support shipments, Released DBC retirement/replacement, verified reissue/reset |
| `profiles` | Profiles, Scenes, Blocks, publishing, appearance, the public Scene view and cache |
| `search.ts` | Owner global search (limited groups, literal wildcard escaping) |
| `db.ts` | The `Db` type shared by services |

The `support` module also owns public/account intake, source filtering, acknowledgement throttling, deterministic case email and credential blocking ([spec](../../docs/specs/support-and-corrections.md)). Account mutations stay in `accounts`; intake never reuses owner-only case creation or unrestricted Card linking.

Infrastructure outside `modules/`: `src/config` (validated environment, isolation), `src/db` (the only place that opens the database driver), `src/auth` (Better Auth, access checks, pure policy), `src/integrations/email` (Resend, HTML with a generated plain-text alternative), `src/integrations/media` (Cloudinary signed uploads).

## Conventions

- Every mutation locks and re-reads inside one transaction and writes its Activity event there. Follow the canonical [transaction conventions and lock order](../../docs/architecture/system.md#conventions), with rationale in [0009](../../docs/decisions/0009-database-invariants-and-lock-order.md). Nested services share the transaction. Recovery proof/code snapshots never reach Client Components or logs; email-result events are best-effort after the mutation.
- Server-only modules start with `import "server-only"` and are listed in `src/server-only-boundary.test.ts`.
- Server Actions and Route Handlers are public endpoints: authenticate, authorize, validate and rate-limit them server-side.
- Client Components receive minimal DTOs, never raw rows or server config.
- Select only the columns a screen needs; paginate unbounded lists; let PostgreSQL aggregate.
- Keep DBC and GRC behavior distinct ([GRC spec](../../docs/specs/google-review-card.md)), Purchaser separate from Account, and Card ownership separate from Card→Profile routing.
- Never put activation codes, OTPs, tokens or other secrets into URLs, logs, error messages, analytics or browser storage.
