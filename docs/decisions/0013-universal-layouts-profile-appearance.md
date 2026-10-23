# 0013 — Universal layouts are presentations of one Profile model

**Status:** Implemented (2026-10-21). Amends [0003](0003-profile-scene-model.md) and supersedes the "public page renders one ordered list" rule in the [profile mode editor spec](../specs/profile-mode-editor.md). Spec: [profile layouts, appearance and guided setup](../specs/profile-customization-onboarding.md). Amended by [0015](0015-showcase-cover-image.md) (implemented): Appearance also holds an optional cover image that only Showcase renders.

## Context

The public profile has one fixed presentation that is well below the approved marketing quality. Customers need a profile that feels personal without being able to make it look bad, and without content that depends on a template.

## Decision

- **One model.** Profile + Profile modes (Scenes) + Blocks stay the only content model. A layout is a renderer of the same view. Changing layout never creates, hides, deletes or migrates content.
- **Appearance is Profile-level** (as in 0003) and consists of exactly **Layout + Mode + Accent**. Photo/logo is identity, not appearance.
- **Three universal layouts:** **Classic**, **Editorial** and **Showcase**, named for their presentation, never for a role, so any customer may choose any of them. Stored as `profiles.layout` (enum, default `classic`).
- **Mode:** Light or Dark, chosen by the owner and stored as `profiles.color_mode` (enum, default `light`). The visitor's system preference does not override it in V1.
- **Accent:** the existing 8 curated colours only, each with a light value and a committed dark variant whose contrast is enforced by tests. No custom HEX and no font customization in V1. Neffi owns typography (Geist).
- **Grouped rendering:** layouts place content by role (identity, intro, primary actions, featured, socials, links, work, about, contact, forms). Within a group, stored position order is kept, and every visible item appears in every layout.
- **Every supported link kind renders** in every layout, with a brand or neutral icon and a deterministic fallback. Supported content is never silently omitted.
- **Mobile first:** every layout is complete at phone width. Desktop may add width or subtle asymmetry, never meaning.
- `profiles.theme`, never read or written, is dropped in the same migration after a pre-check that every value is `default`.

## Consequences

- One additive migration (two enums and two columns, plus the Goal from [0014](0014-guided-setup-and-goal.md)) and the guarded `theme` drop. Existing Profiles become Classic/Light with their accent unchanged, URLs unchanged and no re-onboarding.
- Appearance changes are visitor-visible and must bump `content_version` ([0011](0011-fresh-card-state-cached-scene-content.md)).
- In the mode editor, per-section reorder now matches public order, so the cross-type interleaving caveat disappears.
- A new layout means an enum value plus a component. Custom colour, per-mode appearance or per-Card appearance each need a new decision record.
