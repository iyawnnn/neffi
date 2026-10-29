# 0005 — Activation credentials are one-time and HMAC-only

**Status:** Accepted (M4, M5; 2026-10-19 revision). Supersedes the earlier development code format. **Partially superseded by [0016](0016-retrievable-encrypted-activation-credentials.md) (2026-10-26):** usable codes are now also stored as an encrypted envelope and can be revealed again by an OWNER. Code format, one usable credential, non-consuming checks, atomic claim and the rate limits below remain in force.

## Decision

- A code is 8 Crockford characters (~39.92 bits), shown as `XXXX-XXXX`, with at least one digit and one non-hex G-Z letter (excluding I, L, O and U). Only its keyed HMAC (`ACTIVATION_CODE_SECRET`) is stored. The raw code is revealed once to the owner who issued it and is never persisted, logged or put in a URL.
- A Card has at most one *usable* credential (unused and not revoked). A credential becomes used (claimed) or revoked exactly once and is never restored. Database triggers enforce this.
- Checking a code does not consume it. Claim is one transaction: lock the Card, mark the credential used, set the owner, record Activity. A short-lived signed cookie carries only an opaque credential reference between code entry and sign-in.
- Failures are generic. Checks are limited to 20 per 10 minutes and 50 per 24 hours per IP (IPv6 /64), plus 100 per 10 minutes globally. IP and daily IP quotas are charged before the global quota. Claims remain limited to 10 per Account per 10 minutes.

## Consequences

Rotating `ACTIVATION_CODE_SECRET` makes every unclaimed code unverifiable. Lost-code and wrong-account cases after release need a controlled [support action](../specs/support-and-corrections.md) that issues a new credential for the same Card.

The global ceiling bounds distributed guessing; an attacker can temporarily exhaust it and block legitimate activations. If both the database and activation secret leak, the ~40-bit space permits offline brute force. Rotate the secret and reissue unclaimed codes after such a compromise. Issuance retries lookup collisions up to five times; exhaustion fails the transaction without partial card changes.
