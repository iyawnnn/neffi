# 0003 — Profile owns identity and appearance; Scenes change content focus

**Status:** Accepted (October 10 revision; M6, M7). Supersedes the earlier flat Profile Links model.

## Context

The first design was one flat profile with a list of links. Customers need different emphasis for different contexts without re-entering their identity.

## Decision

- A **Profile** holds shared identity and **appearance** (accent colour, image or logo). Appearance applies across all its Scenes.
- A **Scene** belongs to a Profile and contains ordered **Blocks** (About, Project, Link, Contact/Save Contact, Booking, Form).
- Every Profile has a protected **Default Scene**. At most one other Scene is the *shown* Scene (`profiles.active_scene_id`; NULL means the Default). The public page shows the shown Scene and falls back to the Default.
- There is no per-Scene theme and no per-Card Scene override in V1. The legacy flat `profile_links` table is unused after migration 0010.

## Consequences

- Public rendering reads Profile, then shown Scene, then Blocks. Cards only route to Profiles.
- Per-Card overrides or per-Scene themes need a new decision record and an additive migration.
