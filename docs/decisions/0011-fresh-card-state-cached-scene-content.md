# 0011 — Fresh Card state; cached Scene content; public pages are noindex

**Status:** Accepted (M7)

## Decision

Every `/c/{token}` request reads the Card fresh (one indexed lookup), so disable, retire and ownership changes take effect on the next tap. Only a published Scene's content is cached, under `(profile, scene, content_version)`. Every visitor-visible edit bumps `content_version` in its own transaction.

Unavailable states (unknown, unclaimed, disabled, no Profile, Draft, Unpublished) give visitors one generic 404 that leaks no reason or account data. Public and operational pages are `noindex`. `/c` is not aggressively IP-throttled because NFC taps share networks.

## Consequences

Card routing and publish status must never be added to the cache key. Customer search indexing is a future, separately planned decision.
