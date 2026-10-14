# 0001 — Permanent `/c/{token}` indirection

**Status:** Accepted (M4, M7)

## Context

A Digital Business Card (DBC) is a physical NFC tag. Rewriting a tag after sale is impractical, yet customers must be able to change their profile, switch Scenes, move to another Profile, disable a lost card, and have ownership corrected by support.

## Decision

Every DBC gets one permanent, random public URL `<CARD_URL_ORIGIN>/c/<token>`, written to the chip once during provisioning. The token is 26 Crockford Base32 characters (130 bits), unique, never changed (a database guard blocks edits), and never proof of ownership. What the URL shows is decided on the server on every request from the Card's state: ownership, enabled flag, connected Profile and its publish status.

## Rationale

The chip never needs rewriting. Access is revocable (disable, retire). The URL cannot be guessed or enumerated.

## Consequences

- The NFC origin is permanent infrastructure. The final domain must be locked before any customer card is provisioned. Cards written against a development origin are engineering units and are never sold.
- Card state is never cached; only Scene content is (see [0011](0011-fresh-card-state-cached-scene-content.md)).
- Ownership, routing and credentials can change without touching the URL. Support corrections must preserve it.
