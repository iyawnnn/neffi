# 0015 — Showcase may show an optional cover image

**Status:** Implemented (2026-10-22). Amends [0013](0013-universal-layouts-profile-appearance.md). Spec: [profile layouts, appearance and guided setup](../specs/profile-customization-onboarding.md) §4, §7.4 and §10.

## Context

Showcase opens with a solid accent-tinted band. Customers want to put their own image there. The profile photo/logo is an identity asset used by every layout, so it cannot double as a wide header image. 0013 limited appearance to Layout + Mode + Accent and required a new decision for anything beyond that.

## Decision

- **Optional, Showcase-only.** A Profile may store one cover image. Only Showcase renders it. With no cover, Showcase renders the accent band unchanged. Classic and Editorial never render a cover. A cover is never required to choose Showcase or to publish.
- **Appearance, not identity.** The cover is part of Appearance, separate from the photo/logo. Appearance becomes Layout + Mode + Accent + an optional Showcase cover. Changing layout never creates, changes or deletes the cover, so switching back to Showcase restores it.
- **Storage on `profiles`.** These are six nullable columns, all set or all NULL:
  - `cover_asset_id` (Cloudinary public id)
  - `cover_width` and `cover_height` (size of the stored asset)
  - `cover_crop_x`, `cover_crop_y` and `cover_crop_width` (crop rectangle in source pixels)

  The crop height is always `round(cover_crop_width / 3)` and is not stored. Database CHECKs keep the group whole and the crop inside the image. No URL, version, format or focal point is stored.
- **Fixed 3:1 frame.** Delivery crops the stored original with a Cloudinary transformation (`c_crop`, then `c_limit` to a fixed width set, `f_auto`, `q_auto`). The crop editor, phones and desktop all use the same 3:1 frame, so what the owner frames is what visitors see. Repositioning never needs a new upload.
- **Minimum size.** The crop must be at least 600 source pixels wide. Smaller images are refused with a clear message, and zoom stops at that width.
- **One upload pipeline.**
  - The existing signed upload is reused with an asset kind. Cover public ids are `neffi/profiles/{profileId}/cover/{uuid}`, which can never be mistaken for a photo id.
  - Formats, the 5 MB and 2048px limits, the signing quota and server-side verification are unchanged.
  - Replacing or removing a cover commits first and then deletes the old asset best effort. Deleting a Profile deletes both images.
- **Not in guided setup.** No setup step is added. Covers are added later in Appearance.

## Consequences

- One additive migration with six nullable columns and their CHECKs. Every existing Profile has no cover and keeps the band. Nothing is backfilled or dropped.
- `SceneView.appearance` gains `cover` (`{ src, srcSet } | null`). `profileSections` and the Classic and Editorial props are unchanged.
- Cover changes are visitor-visible and bump `content_version` ([0011](0011-fresh-card-state-cached-scene-content.md)), whatever the current layout.
- Abandoned uploads stay the existing accepted orphan debt. Cancelling the crop dialog deletes its upload.
- Covers in other layouts, per-mode covers, background images or patterns, and any other custom backgrounds each need a new decision.
