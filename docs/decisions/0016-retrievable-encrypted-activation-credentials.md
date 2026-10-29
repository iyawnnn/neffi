# 0016 — Usable activation codes are retrievable through an encrypted envelope

**Status:** Accepted and implemented (migration `0021_retrievable_activation_credentials`, PR #50, 2026-10-26). **Supersedes** the storage and one-time-reveal clauses of [0005](0005-activation-credentials.md): "only its keyed HMAC is stored" and "the raw code is revealed once … and is never persisted". The rest of 0005 still applies.

## Context

Under 0005 the owner saw a code once, in the response that issued it. Losing that response, or misprinting a package label, meant replacing the credential even though the card itself was fine. Order-driven preparation ([orders](../specs/orders-and-fulfillment.md)) issues codes when a card is allocated, so the owner may print the label later, on another device.

## Decision

- Each credential keeps its keyed HMAC (`ACTIVATION_CODE_SECRET`). Code checks and claims still use only the HMAC.
- While a credential is unused and unrevoked it also stores `encrypted_code`: AES-256-GCM, written as `v1.<keyId>.<nonce>.<ciphertext>.<tag>`, with the credential id, card id and HMAC as additional authenticated data. Keys come from `ACTIVATION_CODE_ENCRYPTION_KEYS`; `ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID` selects the key for new envelopes. The keys are separate from the HMAC secret.
- A database trigger clears the envelope when the credential is used or revoked and refuses to rewrite an existing envelope. Credentials remain append-only history.
- Only an OWNER can reveal the current code, and only for an unclaimed, non-retired DBC. Each reveal records `activation_code_viewed` with the credential id. A decrypted code must match the stored HMAC before it is shown.
- Credentials issued before `0021` have no envelope. The owner can attach one only by typing the matching package code (`activation_code_adopted`). They cannot be decrypted because no envelope exists.
- Plaintext appears only in the explicit issue or reveal response. It never goes into URLs, logs, email, list payloads, initial page data or browser storage. Support reissue and reset use the same issuance and are retrievable the same way.

## Consequences

Owners can recover a lost label without replacing the credential, and every disclosure is attributable. The database now holds recoverable secrets: someone holding both the database and the keys can read every unused code. Keys need the custody, rotation and restore rules in [operations](../operations.md#activation-code-key-custody). Losing a key leaves its envelopes unreadable; those codes still work for customers but must be re-entered or replaced to be shown again. Rotating `ACTIVATION_CODE_SECRET` still invalidates every unclaimed code, including retrieval, because the envelope is bound to the HMAC.
