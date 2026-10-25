# 0004 — Package activation QR vs card Sharing QR

**Status:** Accepted

## Context

Two different QR codes exist and are easy to confuse.

## Decision

- **Activation QR**: printed on the common package insert, identical for every package, always opens `/activate`, and never contains a code. The secret is the unique per-Card activation code on a label inside the sealed package.
- **Sharing QR**: printed as a sticker on the back of the physical card, opening its owner's public digital profile through the same permanent `/c/{token}` URL as NFC. It is also available digitally for a claimed, connected Card (downloadable SVG), so it creates no second identity.
- The maintainer locked physical card-back Sharing QR stickers on 2026-10-25. This supersedes the earlier digital-only physical-product plan; it does not change activation or URL routing.

## Consequences

Scanning the activation QR never identifies a Card or a Profile. The Sharing QR and an NFC tap land on the same route and show the same state.
