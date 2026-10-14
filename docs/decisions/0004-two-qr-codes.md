# 0004 — Package activation QR vs digital Sharing QR

**Status:** Accepted

## Context

Two different QR codes exist and are easy to confuse.

## Decision

- **Activation QR**: printed on the common package insert, identical for every package, always opens `/activate`, and never contains a code. The secret is the unique per-Card activation code on a label inside the sealed package.
- **Sharing QR**: generated on screen for a claimed, connected Card from its permanent `/c/{token}` URL (downloadable SVG). It encodes exactly what the NFC chip holds, so it creates no second identity.
- Printing a unique QR on the physical card is not part of V1.

## Consequences

Scanning the activation QR never identifies a Card or a Profile. The Sharing QR and an NFC tap land on the same route and show the same state.
