# Domain modules

Neffi is one modular monolith. Business rules live in domain modules under `src/modules/<name>/`; UI and server actions call them. Current behavior is described in [PRODUCT.md](../../PRODUCT.md), the [specs](../../docs/specs/) and the [architecture docs](../../docs/architecture/system.md).

| Module | Owns |
|---|---|
| `accounts` | Owner-role operator service; read-only directory (unchanged projection); verified recovery initiation/cancel/completion, secure account and security notices |
| `activation` | Activation code format and HMAC lookup; credential issue, revoke and usable lookup; code check and atomic claim |
| `activity` | `recordActivity` and the `ActivityType` set (immutable history) |
| `cards` | Tokens and URLs; DBC provisioning, NFC check, package match, credential replacement; resolver for `/c/{token}`; customer routing, disable and enable; Sharing QR; legacy manual GRC utilities |
| `expenses` | Manual expenses and the combined cost report (manual, stock and courier costs, each counted once) |
| `forms` | Native Forms, public submission storage and deduplication, owner notification email |
| `inventory` | Stock intake and edits, derived card counts and lists |
| `orders` | Products and pricing, purchasers, order creation and edits, fulfilment, cancellation, derived order facts and totals, system completion, dashboard |
| `payments` | Capped append-only payments and refunds, and reasoned voids |
| `support` | Case lifecycle, assignment, immutable links, notes and queries; Completed-order money corrections, support shipments, Released DBC retirement/replacement, verified reissue/reset |
| `profiles` | Profiles, Scenes, Blocks, publishing, appearance, the public Scene view and cache |
| `search.ts` | Owner global search (limited groups, literal wildcard escaping) |
| `db.ts` | The `Db` type shared by services |

The `support` module also owns public/account intake, source filtering, acknowledgement throttling, deterministic case email and credential blocking ([spec](../../docs/specs/support-and-corrections.md)). Account mutations stay in `accounts`; intake never reuses owner-only case creation or unrestricted Card linking.

Infrastructure outside `modules/`: `src/config` (validated environment, isolation), `src/db` (the only place that opens the database driver), `src/auth` (Better Auth, access checks, pure policy), `src/integrations/email` (Resend, plain text), `src/integrations/media` (Cloudinary signed uploads).

## Conventions

M9B initiate/secure/completion lock case → Account `FOR UPDATE` → recovery (`FOR UPDATE` on completion); cancel skips Account. Resolve locks case then checks pending recovery. Recovery takes no Card/credential locks. Claim/reset `KEY SHARE` and setup `FOR UPDATE` wait on Account without a cycle. Wrong-code completion returns failure so attempts commit; the third cancels. Proof/code snapshots never reach Client Components or logs. Email results are separate best-effort Activity events after the mutation; notice dispatch serializes attempts on Account and does not mutate it.

- Every mutation is one transaction that locks first, re-reads under the lock, and writes its Activity event in the same transaction. Order writers use `mutateOrder`: Order (`FOR NO KEY UPDATE`) → items → DBC Cards → activation credentials, then updated-by and system completion. Support uses case → Order → item (all `NO KEY UPDATE`) → former-owner Account (`KEY SHARE`, if claimed) → DBC Card → credential. Reset uses case → former-owner Account → Card → credential; unclaimed reissue uses case → Card → credential. Account-before-Card matches M6 setup; a changed owner snapshot is refused after locking Card. Support item locks serialize writers while allowing recovery's foreign-key checks. Nested services receive the open transaction. Other card services lock the card row first. See [decision 0009](../../docs/decisions/0009-database-invariants-and-lock-order.md).
- Server-only modules start with `import "server-only"` and are listed in `src/server-only-boundary.test.ts`.
- Server Actions and Route Handlers are public endpoints: authenticate, authorize, validate and rate-limit them server-side.
- Client Components receive minimal DTOs, never raw rows or server config.
- Select only the columns a screen needs; paginate unbounded lists; let PostgreSQL aggregate.
- Keep DBC and GRC behavior distinct ([GRC spec](../../docs/specs/google-review-card.md)), Purchaser separate from Account, and Card ownership separate from Card→Profile routing.
- Never put activation codes, OTPs, tokens or other secrets into URLs, logs, error messages, analytics or browser storage.
