# 0005 — Activation credentials are one-time and HMAC-only

**Status:** Accepted (M4, M5)

## Decision

- A code is 16 Crockford characters (80 bits), shown as `XXXX-XXXX-XXXX-XXXX`. Only its keyed HMAC (`ACTIVATION_CODE_SECRET`) is stored. The raw code is revealed once to the owner who issued it and is never persisted, logged or put in a URL.
- A Card has at most one *usable* credential (unused and not revoked). A credential becomes used (claimed) or revoked exactly once and is never restored. Database triggers enforce this.
- Checking a code does not consume it. Claim is one transaction: lock the Card, mark the credential used, set the owner, record Activity. A short-lived signed cookie carries only an opaque credential reference between code entry and sign-in.
- Failures are generic, and checks and claims are rate-limited.

## Consequences

Rotating `ACTIVATION_CODE_SECRET` makes every unclaimed code unverifiable. Lost-code and wrong-account cases after release need a controlled support action (planned in M9A) that issues a new credential for the same Card.
