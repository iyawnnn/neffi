# 0002 — Purchaser, Account, Card and Profile are separate

**Status:** Accepted (Steps 2/4, M2, M8)

## Context

People buy cards for others (gifts), and companies buy in bulk. A buyer is not necessarily the person who will use the card.

## Decision

Four concepts stay distinct and are never linked automatically:

- **Purchaser**: the commercial buyer on an Order. A name is enough.
- **Account**: the authenticated digital identity.
- **Card**: the physical item. Its *ownership* (`owner_account_id`) is set only by a secure claim.
- **Profile**: the content workspace. A Card's *routing* (`profile_id`) is separate from its ownership. A composite foreign key keeps the Card's owner equal to its Profile's owner.

## Rationale

Gifts, bulk orders and later ownership corrections work without special cases. Names or emails that look alike never merge records.

## Consequences

- Paying for a card never grants ownership; activation does.
- Account merge and Profile moves are support-controlled exceptions, not self-service.
- Owner screens show Accounts only through a minimal read-only projection (see [accounts and access](../specs/accounts-and-access.md)).
