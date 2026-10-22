# 0014 — Guided setup builds the first Profile; Goal only recommends

**Status:** Accepted (2026-10-21; planned, not implemented). Replaces the three setup purposes (Network, Get Clients, Show My Work) described in [profiles and the public card](../specs/profiles-and-public-card.md). Spec: [profile layouts, appearance and guided setup](../specs/profile-customization-onboarding.md).

## Context

Setup today is two screens (purpose, then essentials) followed by a separate publish page. The purposes seed starter Blocks, including forms the customer did not ask for, and are not stored. Non-technical customers need a guided flow that ends with a usable, published profile rather than a dashboard they must explore.

## Decision

- **Activation stays first.** Claim assigns ownership only, then redirects straight into guided setup for that Card. Setup builds the first Profile one decision at a time: Goal, You, Photo, Contact, Links, Look, Colours, Review, then Done.
- **Goal** is one of `networking`, `freelance`, `business` or `student`, or none ("Not sure yet"). It recommends a layout, orders suggestions and names the first Profile mode. It never restricts a field, layout or block type. It is stored as nullable `profiles.goal`. In V1 it is not editable after setup, and recommendations appear only inside guided setup.
- **No automatic starter content.** Setup creates only what the customer enters or adds; forms are suggested, not created.
- **Explicit saves.** Each step saves on Continue, with no autosave. The Profile is created at the You step as a **Draft** and becomes public only on **Publish** (existing publish rules).
- **Derived resume.** Resume goes to the earliest incomplete required step, derived from existing publish gaps (name → You; contact or content → Contact; none → Review). No setup-progress column is stored.

## Consequences

- One nullable enum column. Existing Profiles get Goal NULL and are never sent back through setup.
- `purpose-options.ts` and `starters.ts` are replaced by one Goal module. Purposes were never stored, so no data maps.
- Notion still lists the three starter goals. This is recorded as [known drift](../README.md#known-drift) for the maintainer to reconcile in Notion.
- Making Goal editable, or using it outside setup, needs a new decision.
