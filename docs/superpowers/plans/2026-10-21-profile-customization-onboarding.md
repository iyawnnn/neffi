# Profile layouts, appearance and guided setup — Implementation Plan

> **Canonical path:** `docs/superpowers/plans/2026-10-21-profile-customization-onboarding.md`. This is a plan, not a specification. Behavior is defined by [the spec](../../specs/profile-customization-onboarding.md), [0013](../../decisions/0013-universal-layouts-profile-appearance.md), [0014](../../decisions/0014-guided-setup-and-goal.md) and [0015](../../decisions/0015-showcase-cover-image.md). If this plan and the spec disagree, the spec wins; stop and report.
> **Status:** T1 (architecture/spec/docs lock) committed on `main` 2026-10-21. T2–T6 merged to `main` (`395ee83`). 2026-10-22: the optional Showcase cover was added as tasks T8a–T8c ([0015](../../decisions/0015-showcase-cover-image.md)). All tasks T2–T15 are implemented. Manual physical acceptance (real phone, real NFC tap, live Cloudinary) is pending.

## Context

The public profile, setup and appearance editor are being rebuilt to the approved Home/Product quality without changing the content model: three universal layouts, Light/Dark, curated accents, a stored recommendation-only Goal, and a guided setup that ends with a published profile. The work is split so each task is reviewable on its own and `main` stays shippable after every task.

**Baseline (2026-10-21):** `main` at `a6bac08`. Migrations through `0016_extend_social_platforms`. Shared Neon development is migrated through `0015` per [roadmap](../../roadmap.md) (0016's status there is unverified; check before T2). Production does not exist.

## 0. Execution protocol

- **Branch:** `feat/profile-layouts-guided-setup` from `main`, which already contains T1 (`docs(profile): lock customization and guided setup architecture`). One commit per task from T2, tests in the same commit.
- **Ledger:** `.superpowers/sdd/2026-10-21-profile-customization-onboarding/progress.md`. It is local and git-ignored: never `git add -f` it and never make a ledger-only commit.
- **Per task:**
  1. Expand the task's checklist in the ledger.
  2. RED: write the smallest test proving the behavior and watch it fail.
  3. GREEN: implement until it passes.
  4. Run the task's targeted checks plus `pnpm typecheck` and `pnpm lint` on touched files.
  5. Update the ledger.
  6. Commit with the exact message.
- **Resumption:** read the ledger, `git log`, and §2. Continue from the first task without a commit.
- **Next.js first:** read the relevant guide in `node_modules/next/dist/docs/` before routing, caching or client/server boundary work (AGENTS.md).
- **Database:** tests use PGlite only. Never run migrations against shared `neffi-dev` without an explicit maintainer decision; Preview validation uses an isolated temporary Neon branch and Preview, torn down afterwards ([operations](../../operations.md)).
- **Guards that must stay green, unchanged:** `src/app/client-import-graph.test.ts`, `src/server-only-boundary.test.ts`, `src/app/access-sweep.test.ts`, `src/app/(customer)/touch-targets.test.ts`, `pnpm check:bundle`.

## 1. Decisions (locked)

| # | Decision | Disposition |
|---|---|---|
| D1 | Layouts render grouped content; within-group stored order | Accepted, [0013](../../decisions/0013-universal-layouts-profile-appearance.md) |
| D2 | `profiles.goal` nullable, recommendation only, not editable after setup in V1; Recommended badge only in setup | Accepted, [0014](../../decisions/0014-guided-setup-and-goal.md) |
| D3 | Drop `profiles.theme` after an in-migration pre-check | Accepted, 0013 |
| D4 | Classic / Editorial / Showcase; Light/Dark; 8 curated accents with dark variants; no custom HEX or fonts | Accepted, 0013 |
| D5 | Resume derived from `publishGaps`: name → you, contact/content → contact, none → review | Accepted, 0014 |
| D6 | All 22 link kinds render in all layouts with icon fallback | Accepted, 0013 |
| D7 | Photo/logo belongs to Your details; Appearance = Layout + Mode + Accent | Accepted, spec §10 |
| D8 | Optional, Showcase-only cover image in Appearance. Accent band is the fallback. Six `profiles.cover_*` columns (asset id, stored size, 3:1 crop rectangle). Delivered by Cloudinary crop. Existing upload pipeline reused with an asset kind. Minimum crop width 600px. No setup step. T7 committed unchanged | Accepted, [0015](../../decisions/0015-showcase-cover-image.md), spec §4, §7.4, §10 |

## 2. Canonical task sequence

```
T1 docs ─▶ T2 schema ─▶ T3 domain ─▶ T4 contract ─▶ T5 Classic+renderer ─┬▶ T6 Editorial ─┐
                                                                        ├▶ T7 Showcase  ─┼▶ T8 Appearance editor ─┐
                                                                        └▶ T9 setup shell ─▶ T10 you/photo/contact ─▶ T11 links ─┴▶ T12 look/style ─▶ T13 review/done ─▶ T14 cleanup ─▶ T15 verification

Showcase cover (0015):  T7 ─▶ T8a cover storage ─▶ T8b cover rendering ─┐
                        T8 ──────────────────────────────────────────────┴▶ T8c cover editor ─▶ (before T14)
```

- T6, T7 and T9 may proceed in any order after T5.
- T12 needs T8 and T11.
- T8a may start once T7 is merged, in parallel with T8.
- T8c needs both T8 and T8b.
- The cover tasks do not block T9–T13, because setup has no cover step. T14 and T15 need T8c.

### T2 — Schema: appearance and goal columns

- **Purpose:** add `layout`, `color_mode` and `goal`, and drop `theme` safely.
- **Depends on:** T1.
- **Files:** `src/db/schema/enums.ts`, `src/db/schema/profiles.ts`, generated `drizzle/0017_*.sql` (hand-reviewed, with the `DO` pre-check added before the drop), `drizzle/meta/*`, `src/db/seed.ts` (curated accents, all layouts/modes, a goal on one profile), `docs/database/erd.md` (via `pnpm db:erd`), `src/db/migrations.db.test.ts` or a new `migration-0017.db.test.ts`.
- **Acceptance:** spec §11 exactly. Existing rows read `classic`/`light`/NULL goal; a row with `theme <> 'default'` makes the migration raise; `pnpm db:check` clean; CI's generate-diff check clean.
- **Tests:** migration test seeding a pre-0017 profile, applying 0017, and asserting defaults plus the absent `theme`; a pre-check failure case; enum values equal the domain lists added in T3 (assert in T3).
- **Non-goals:** no service or UI reads the new columns yet; no shared-database migration.
- **Commit:** `feat(db): add profile layout, colour mode and goal`

### T3 — Domain: goals, appearance service, setup creation

- **Purpose:** server rules for the new columns, plus setup profile creation.
- **Depends on:** T2.
- **Files:**
  - New pure `src/modules/profiles/goals.ts`: the spec §5 table, `isGoal`, recommended layout, suggestion list and mode name.
  - `appearance-options.ts`: layouts, modes, accent light/dark pairs (values finalized in T4).
  - `profiles.ts`:
    - `updateAppearance` gains `layout` and `colorMode`, keeps curated-accent validation and bumps `content_version`;
    - new `createProfileFromSetup` (spec §8.3);
    - new `setProfileGoal`;
    - new `upsertContactBlock` (or in `blocks.ts`), with the same lock order and limits.
  - `view.ts` `selectProfile` reads `layout`/`colorMode`.
  - `scene-view.ts` adds `appearance` to the view.
- **Acceptance:** creation idempotent per card; 10-profile limit; no starter Blocks; Default mode name per Goal; upsert yields exactly one Contact Block; invalid layout/mode/accent refused; every change bumps `content_version`. Old `createProfileFromStarter` stays until T13 so current setup keeps working.
- **Tests:** `profiles.db.test.ts`, `content-version.db.test.ts` and `blocks.db.test.ts` additions; `goals.test.ts`; enum/domain list equality.
- **Non-goals:** no UI and no renderer change.
- **Commit:** `feat(profiles): add goal, appearance and setup creation services`

### T4 — Pure rendering contract

- **Purpose:** the zod-free contract every layout consumes.
- **Depends on:** T3.
- **Files:**
  - New `src/modules/profiles/profile-sections.ts`: `profileSections`, with primary, featured, contact, intro-dedupe and empty-group rules (spec §6.3).
  - New `src/modules/profiles/profile-theme.ts`: `profileTheme` (spec §6.4).
  - `platform-registry.ts`: a `category` and an icon id for all 22 kinds; remove the `publicIcon` gate.
  - `appearance-options.ts`: final dark variants.
- **Acceptance:** spec §6.2–§6.4. Every visible block lands in exactly one group; within-group order is preserved; off-palette and NULL accents give Ink; the module graph contains no Zod, `server-only` or db import.
- **Tests:**
  - `profile-sections.test.ts`: full, minimal, duplicate contact blocks, bio equal to an About block, no work/links for featured, unsafe URLs.
  - `profile-theme.test.ts`: 8 accents × 2 modes contrast thresholds.
  - Registry test: all enum values covered, each with a category and an icon.
- **Non-goals:** no components.
- **Commit:** `feat(profiles): add grouped profile view and colour tokens`

### T5 — ProfileRenderer and Classic layout

- **Purpose:** replace `SceneViewPreview` with the new renderer, starting with Classic in Light and Dark.
- **Depends on:** T4.
- **Files:**
  - New `src/components/profile/` containing `profile-renderer.tsx`, `classic-layout.tsx`, shared `profile-parts.tsx` (identity, primary actions, social row, link row, work item, contact rows) and `link-kind-icon` usage.
  - `src/components/public-form.tsx` (token styling only).
  - Switch callers: `src/app/(public)/c/[token]/page.tsx` (owner bar restyled; cream `#F2F0EA` removed), `.../profiles/[profileId]/preview/page.tsx`, `.../publish/page.tsx`.
  - `src/components/scene-view.tsx` deleted, or reduced to a re-export only if a caller remains (none should).
- **Acceptance:**
  - Spec §7.1–§7.2.
  - Unknown layout renders Classic.
  - Every one of the 22 kinds renders with an accessible name.
  - Public availability, cache key, vCard, form submission and owner links are unchanged.
  - Existing published profiles render with their content intact.
- **Tests:**
  - Renderer server-render tests: full, minimal, long text, every-link-kind, light and dark.
  - Existing `/c/[token]` page/contact route tests, `view.db.test.ts`, preview and publish page tests updated.
  - Boundary guards.
- **Non-goals:** Editorial and Showcase (they render Classic until T6/T7); no editor UI for layout.
- **Commit:** `feat(profile): render public profiles with the Classic layout`

### T6 — Editorial layout

- **Depends on:** T5.
- **Files:** `src/components/profile/editorial-layout.tsx` and the renderer dispatch.
- **Acceptance:** spec §7.3. Mobile single column. The ≥1024px label gutter uses CSS only, with DOM order unchanged. Every group from T4 is rendered.
- **Tests:** the same fixture set as T5, rendered with `layout = editorial`, plus an assertion that each label precedes its content in the markup.
- **Non-goals:** picker UI.
- **Commit:** `feat(profile): add the Editorial layout`

### T7 — Showcase layout

- **Depends on:** T5.
- **Files:** `src/components/profile/showcase-layout.tsx` and the renderer dispatch.
- **Acceptance:** spec §7.4. The featured rule is honoured and the featured item is not repeated. The layout degrades cleanly with no work and no links. The cover band is a solid `color-mix`, not a gradient.
- **Tests:** T5 fixtures + featured project, featured link, no-featured cases.
- **Non-goals:** project images; the cover image (T8a–T8c; T7 is committed unchanged with the band).
- **Commit:** `feat(profile): add the Showcase layout`

### T8 — Appearance editor and shared pickers

- **Purpose:** the post-setup Appearance page, and the pickers that setup reuses.
- **Depends on:** T6, T7.
- **Files:**
  - New `src/components/profile/appearance-pickers.tsx`: `LayoutPicker`, `ModeToggle`, `AccentPicker`. Native radio groups; live mini-render via `ProfileRenderer`; a `recommended?` prop used only by setup.
  - `.../profiles/[profileId]/appearance/page.tsx` and its form: Layout + Colours + Accent, preview-first, explicit Save with toast.
  - `actions.ts` (the appearance action gains layout/mode).
  - Move the photo/logo control from Appearance to `identity/` (reusing `image-upload.tsx`). If that split is disproportionate, stop, record it as transitional debt in the spec §10 note, and continue.
  - Profile hub copy.
- **Acceptance:** spec §10. The Appearance page shows no Recommended badge and no Goal. Saving updates `content_version`. Pickers are keyboard-operable, with names and selected state not conveyed by colour alone.
- **Tests:** appearance page/form tests, action tests (validation, ownership), touch targets, identity page test covering photo/logo.
- **Non-goals:** custom colours, fonts, the cover image (T8c).
- **Commit:** `feat(profile): add layout and colour mode to appearance`

### T8a — Showcase cover: storage, upload plumbing and view

- **Purpose:** store an optional cover safely and expose it in the view. No UI.
- **Depends on:** T7 merged. May run in parallel with T8.
- **Files:**
  - **Schema:** `src/db/schema/profiles.ts`, adding the six nullable `cover_*` columns and CHECKs (spec §4).
  - **Migration:** generated `drizzle/0018_*.sql` (hand-reviewed, additive only) and `drizzle/meta/*`.
  - **Docs:** `docs/database/erd.md` (via `pnpm db:erd`).
  - **Cloudinary** (`src/integrations/media/cloudinary.ts`):
    - `signImageUpload` takes `kind: "image" | "cover"`. Cover ids are `neffi/profiles/{id}/cover/{uuid}`. Photo tickets stay byte-identical.
    - New `isProfileCoverId`.
    - New `coverUrls(cloudName, id, crop)`, returning `{ src, srcSet }` with fixed widths 640, 1080 and 1600.
  - **Domain** (`src/modules/profiles/profiles.ts`):
    - `setProfileCover` (all six columns or none; returns `previousAssetId`; bumps `content_version`).
    - `setProfileCoverCrop` (validates against the stored size; bumps).
    - `deleteProfile` also returns `coverAssetId`.
    - `OwnedProfile` gains the cover fields.
  - **Actions** (`[profileId]/actions.ts`):
    - `startImageUploadAction` accepts a validated kind (shared quota).
    - `confirmCoverAction(profileId, publicId, crop)` checks the id, `getImage`, `checkImage` and the minimum width, validates the crop with zod, stores, then deletes the previous asset after the commit.
    - New `updateCoverCropAction`, `removeCoverAction` and `discardCoverUploadAction`.
    - `deleteProfileAction` also deletes the cover.
  - **View:** `src/modules/profiles/view.ts` selects the cover columns and builds `coverUrls`. In `scene-view.ts`, `buildSceneView` takes `cover` and `SceneView.appearance.cover` is added.
- **Acceptance:** spec §4, §6.1 and §11 (cover migration); the "Cover storage" and "Cover upload" rows of §13; 0015.
- **Tests:**
  - `migration-0018.db.test.ts`
  - `cloudinary.test.ts`: cover ticket, photo ticket unchanged, id isolation, exact URLs
  - domain `*.db.test.ts`: set, re-crop, remove, previous id, layout change keeps the cover, delete returns both ids
  - `media-actions.test.ts` pattern: auth, ownership, foreign ids, cross-kind ids, invalid or small media deleted, out-of-bounds crop, replace order, remove, discard never deletes the current cover, quota
  - `buildSceneView` cover passthrough
- **Non-goals:** any UI or rendering; a sweeper for orphaned uploads; changing photo behaviour; the deferred "unsigned Cloudinary overwrite" item.
- **Review gate:** a data and security review of the migration, CHECKs, id isolation and delete ordering before T8b starts. No shared-database migration.
- **Commit:** `feat(profile): store an optional Showcase cover`

### T8b — Showcase cover rendering

- **Purpose:** Showcase renders the stored cover and keeps the band as the fallback.
- **Depends on:** T8a.
- **Files:**
  - `src/components/profile/showcase-layout.tsx`: optional `cover` prop that replaces only the band element.
  - `profile-renderer.tsx`: passes `view.appearance.cover` to Showcase only.
  - `profile.css`: `.pf-showcase-cover` with the band's bleed, `aspect-ratio: 3 / 1`, the band colour as placeholder, `object-fit: cover`.
  - `src/app/dev/profile-preview`: a cover fixture using a CSP-safe local or `data:` image.
- **Acceptance:**
  - Spec §7.4 "Cover image" and the §13 "Cover rendering" row.
  - The T7 band markup and tests pass unchanged when there is no cover.
  - The header overlap, identity block and later groups are unchanged.
- **Tests:**
  - With a cover: a decorative `img` (`alt=""` inside an `aria-hidden` wrapper), with `srcSet`, `sizes` and `fetchPriority`, and no band.
  - Without a cover: the band.
  - Classic and Editorial render no cover from the same view.
  - Light and dark.
  - Client-import-graph unchanged.
- **Non-goals:** editor UI; any visual change to Showcase beyond the header image.
- **Review gate:** visual review of the dev preview with and without a cover at 320px, 390px and desktop, in Light and Dark, before T8c.
- **Commit:** `feat(profile): render the Showcase cover`

### T8c — Showcase cover editor in Appearance

- **Purpose:** owners add, frame, replace and remove the cover.
- **Depends on:** T8 and T8b.
- **Files:**
  - Appearance form: a "Cover image · Optional" section rendered only while Showcase is selected.
  - New cover control and crop dialog beside `image-upload.tsx`. Signing, upload and status logic is shared with the photo control only where reuse is direct. The dialog has a 3:1 frame, pointer drag, a native range input for zoom, arrow-key nudge, a centred default and a zoom limit at 600 source pixels.
  - The preview shows the cover or the band.
- **Acceptance:**
  - Spec §10 "Cover image", §12 and the §13 "Cover editor" row.
  - Cover actions save independently of Save changes.
  - Cancel stores nothing.
  - Remove returns the preview to the band.
  - No new dependency.
- **Tests:**
  - Section visible only with Showcase.
  - Upload, cancel, replace, reposition and remove flows with mocked actions.
  - Error states: type or size, too small, failed save keeps the previous cover.
  - Keyboard repositioning.
  - Touch targets.
  - Access sweep unchanged.
- **Non-goals:** a cover step in setup; covers for other layouts; filters or editing beyond crop and zoom.
- **Review gate:** UX review of the crop dialog on a phone-width viewport before merging.
- **Commit:** `feat(profile): edit the Showcase cover in Appearance`

### T9 — Guided setup shell

- **Purpose:** step routing and navigation, the Goal step, resume, and entry points.
- **Depends on:** T3, T5.
- **Files:**
  - `src/app/(customer)/app/setup/[cardId]/page.tsx`: step resolution, the existing-profile chooser branch, and a Draft-routed card resuming instead of redirecting.
  - New `setup-steps.ts` (pure step order, prerequisites, `resumeStep(gaps)`).
  - `setup-view.tsx` and `src/components/setup-header.tsx` (Back, "n of 7", Preview slot).
  - Goal step UI.
  - `src/app/(public)/activate/actions.ts`: claimed → `/app/setup/{cardId}`.
  - `dashboard.tsx`: the draft prompt links to setup when a card routes to the Draft.
  - The old purpose/essentials screens remain reachable only as the current `you` fallback until T10 lands.
- **Acceptance:** spec §8.1, §9 (resume and explicit-step rows); the claim redirect; `already_yours` unchanged; the chooser branch intact.
- **Tests:**
  - `setup-steps.test.ts`: the full resume table and prerequisite redirects.
  - Setup page tests per state.
  - Activate action tests.
  - Dashboard test.
- **Non-goals:** steps 2–7 content.
- **Commit:** `feat(setup): add guided setup steps and resume`

### T10 — You, Photo and Contact steps with live preview

- **Depends on:** T9.
- **Files:**
  - Setup step components and `actions.ts`: `you` creates or updates; `photo` reuses the image actions; `contact` updates identity and upserts the Contact Block.
  - New pure `setup-draft.ts`: the client draft overlay.
  - Preview dialog (mobile) and sticky preview shell (desktop ≥1024px).
  - Reuse the Details editor's field definitions, +63 mobile control, location combobox and unsaved-navigation guard.
- **Acceptance:** spec §8.2 rows 2–4, §8.4, the validation/keyboard rules and the Back/Skip rules. The overlay module graph is client-safe.
- **Tests:** action tests (create idempotent, validation messages, ownership), overlay unit tests, step render tests, client-import-graph.
- **Non-goals:** the links step.
- **Commit:** `feat(setup): build identity, photo and contact steps`

### T11 — Links step

- **Depends on:** T10.
- **Files:**
  - Setup links step: Goal-ordered suggestions from `goals.ts`.
  - Reuse the mode editor's add dialog (`mode-editor.tsx` dialog controller, `item-fields.tsx`, `form-editor.tsx`, platform chooser) through a non-redirecting mutation, extracting a shared component only where reuse requires it.
  - Saved-item list with Remove.
- **Acceptance:**
  - Only supported kinds and types are offered.
  - "Resume" is a Custom link with the label pre-filled.
  - The contact form is created only when chosen.
  - Items persist immediately and respect limits.
  - Skip writes nothing.
- **Tests:** suggestion order per Goal, add/remove through the setup route, no form auto-creation, mode editor tests unchanged.
- **Non-goals:** reorder in setup (available in the editor).
- **Commit:** `feat(setup): add guided links and content step`

### T12 — Look and Colours steps

- **Depends on:** T8, T11.
- **Files:** setup look/style steps using the T8 pickers with `recommended`; appearance persistence via the T3 service.
- **Acceptance:** spec §8.2 rows 6–7. The Recommended badge appears only here. A changed Goal never overwrites the chosen layout. Preview-first on mobile.
- **Tests:** step render tests (badge present here only), persistence tests, a Goal-change test.
- **Commit:** `feat(setup): add layout and colour steps`

### T13 — Review, Publish and Done; remove purpose code

- **Depends on:** T12.
- **Files:**
  - Setup review/done steps: reuse `PublishButton` and `PUBLISH_GAP_COPY` with jump links.
  - Delete `purpose-options.ts`, `starters.ts`, `createProfileFromStarter`, the old `EssentialsForm`/`EssentialsFields` and their tests, plus `src/app/dev/setup-preview` if it only previews the removed screens.
  - `/publish` keeps its fallback role.
- **Acceptance:** spec §8.2 review/done and the §9 publish rows. The Done screen links `/c/{token}`. Nothing references the removed modules.
- **Tests:** review gaps and publish flow, done-page links, a journey test (claim → setup → publish → public view) in `src/journeys/`.
- **Commit:** `feat(setup): finish guided setup with review and publish`

### T14 — Editor alignment and cleanup

- **Depends on:** T13, T8c.
- **Files:**
  - Mode editor copy (remove the interleaving caveat).
  - Profile hub labels (Your details / Profile mode / Appearance).
  - Preview page tabs on the new renderer.
  - Confirm no `SceneViewPreview` references remain. Marketing demo components are out of scope.
- **Acceptance:** spec §10. No customer copy uses Scene, Block or Theme.
- **Tests:** affected page tests and a terminology assertion.
- **Commit:** `refactor(profile): align editor with grouped profile layouts`

### T15 — Responsive, accessibility and final verification

- **Depends on:** T14.
- **Work:**
  - Accessibility pass against spec §12.
  - Fix findings in small follow-ups inside this task.
  - Update `PRODUCT.md`, `profiles-and-public-card.md`, `cards-and-activation.md`, `domain-model.md`, `architecture/system.md` (media now covers the photo and the Showcase cover) and `profile-mode-editor.md` from Planned to current behavior; mark the spec, 0013, 0014 and 0015 Implemented; update the roadmap row.
- **Full gate:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:check`, `pnpm build`, `pnpm check:bundle`.
- **Manual acceptance (browser or human only):**
  1. Each layout in Light and Dark at 320px and 390px and at one desktop width. Visual quality and overflow cannot be proven by server rendering.
  2. Showcase cover, at the same widths and modes, on one published profile:
     - with a cover: the framing matches the crop dialog, nothing is stretched and the photo overlap is intact
     - after Remove: the accent band returns
     - after switching to Classic or Editorial: no cover is shown
     - after switching back to Showcase: the same cover returns
     - one drag and zoom of the crop dialog on a real touch screen
  3. Setup on a real phone with the software keyboard: field visibility and the Continue position.
  4. One real NFC tap of a newly published card, because tap-to-page needs physical hardware.

  Everything else is covered by automation and is not repeated by hand.
- **Commit:** `docs: record profile layouts and guided setup as implemented`

## 3. Stop conditions

Stop and report instead of improvising when:
- the spec and the code disagree on an existing rule;
- a task needs a schema change beyond T2 and T8a;
- the cover crop dialog cannot be built as one focused component without a new dependency (ask before adding one);
- a guard test would need weakening;
- a needed product decision is in neither the spec nor Notion;
- the photo/logo move or the dialog reuse would require restructuring unrelated editors;
- the migration's pre-check fails on any real database.
