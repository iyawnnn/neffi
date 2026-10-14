# 0006 — Google Review Card is a simple commercial line

**Status:** Accepted (M8 amendment A7, 2026-10-13). **Supersedes** the earlier M4/M8 design in which a GRC went through Card reservation, NFC verification and release as part of order fulfilment.

## Context

That lifecycle was over-engineered. A GRC is a tag carrying a direct Google review link, with no Neffi account, profile, activation or `/c/{token}`.

## Decision

A GRC is an ordinary Order line with an optional branch label and an optional HTTPS review URL, both only references. Obtaining the Place ID, generating the review link (for example with ReviewJet), writing the tag and testing it are manual operations outside Neffi. Neffi records the sale, price, payments and delivery (Hand over, or a courier shipment). A GRC-only order needs no Card rows. The M4 manual GRC utilities still exist but are independent of Orders.

## Consequences

GRC completion is exact payment plus commercial delivery. No GRC state machine, NFC evidence or Place ID/ReviewJet integration is built unless a later decision changes this. See the [GRC spec](../specs/google-review-card.md).
