# Profile mode editor: design and implementation specification

**Date:** 2026-10-18. **State:** UX direction locked by the maintainer; implementation specification awaiting review. This document describes the target, not a claim that it is implemented. No implementation is authorized by this documentation pass.

**Route:** `/app/profiles/[profileId]/scenes/[sceneId]`.

Related: [authenticated customer UI](../architecture/customer-ui.md), [profiles and public card](profiles-and-public-card.md), [profile/scene model](../decisions/0003-profile-scene-model.md), [cache and content versions](../decisions/0011-fresh-card-state-cached-scene-content.md).

The latest maintainer brief is the authority for this target UX. Existing domain validation, authorization and public rendering remain authoritative unless an explicit change below is implemented and verified. Internal names such as `Scene`, `sceneBlocks`, and `BlockType` remain valid engineering terms. Customer-facing copy uses **Profile mode** / **Profile modes**, sentence case. Do not expose Scene, Block, Link type, Form preset or Move block in this editor or its dialogs/fallback forms.

## 1. Goals

- Give non-technical customers a focused, compact editor with clear add, edit, hide/show, remove and section-level reorder operations.
- Use one main column and three predictable sections, with strong mobile usability and explicit Preview navigation.
- Match Neffi's established authenticated UI: Geist, Snow canvas, white surfaces, Ink text, restrained Vermilion, thin neutral borders and rounded rectangles.
- Reuse the existing ordered block model, schema limits, server validation, authorization, content-version invalidation and form definitions.
- Keep task transitions inside one responsive dialog instead of navigating away for normal add/edit flows.

## 2. Non-goals

- No permanent side/phone preview, global shell redesign, public-profile redesign or new publication behavior.
- No shared profile-detail fields in this editor: Full name, Headline, Company, Short intro, Mobile number, Public email, Website and City / municipality remain profile-level.
- No database schema/enum migration, new block type, new platform, social account connection/OAuth, platform account verification or shared social library.
- No drag dependency, drag handles, section-wide batch save, or cross-section reorder controls.
- Do not add a third content choice or move generic links into Content to make layouts symmetrical.

## 3. Existing architecture to preserve

The inspection baseline is the current working tree, including uncommitted scene-editor work. Preserve that work unless directly superseded by this approved target; do not reset it to a historical commit.

| Existing area | Preserved contract |
| --- | --- |
| `modules/profiles/editor.ts` | Owned mode/item reads, stored global order, item content and associated form data |
| `modules/profiles/blocks.ts` | Add/update/visibility/remove/move transactions, profile lock, limits and content-version bump |
| `modules/profiles/block-content.ts` | Server Zod parsing of the six existing block types |
| `modules/profiles/block-options.ts` | Existing enum-backed kinds and section membership |
| `modules/forms/config.ts`, `forms.ts` | Three existing configurations, field/question constraints and profile-owned definitions |
| Mode route `actions.ts` | Authenticated server-action pattern, IDs, ownership, safe error mapping |
| `SceneViewPreview`, public view loader | One globally ordered visible item list, safe URL filtering and current visitor functionality |

Limits remain 20 items per mode, 5 form definitions per profile and existing profile/mode limits. Preserve rejection of hiding/removing the final visible item of a published profile's default mode. Default-mode deletion remains forbidden. Preserve the existing currently-shown/default fallback behavior.

The working tree already contains section-aware `moveBlock(..., { among })`. This is not yet a reason to assume it is committed or shipped; verify its presence when implementing. Its intended semantics are specified in section 11.

## 4. Page information architecture

One centered main editing column, approximately 800–848px of usable desktop content; align with the Profile/Your details editor rather than filling the viewport. On phones use 16px page gutters and the unchanged app-shell bottom clearance.

Header order:

1. `Back to profile` linking to `/app/profiles/[profileId]`.
2. Dynamic mode name, with a quiet `Currently showing` badge only when applicable.
3. `Choose what visitors see in this profile mode.`
4. `Preview` and an overflow button labeled `More profile mode options`.

Preview retains `/app/profiles/[profileId]/preview?scene=[sceneId]`. Overflow contains `Rename mode` and `Delete mode` where permitted. Rename is a focused dialog, never a permanent form. Keep the existing deletion confirmation/protected default behavior.

Below: Socials & links, Content, Actions, in that order. Remove the permanent preview markup, desktop preview column, preview-only data read and corresponding loading work entirely. Keep the standalone Preview route.

## 5. Section behavior

Each section is one integrated white surface: neutral 1px border, approximately 12px radius, minimal/no shadow. Use an unboxed restrained leading icon, title, short description and compact outline `+ Add` action aligned right. Maintain full readability at narrow widths; header descriptions may use a full-width second row if space requires it. No fixed header height.

| Section | Types | Helper | Empty line |
| --- | --- | --- | --- |
| Socials & links | `link` | Add your social media and important links. | Add Facebook, LinkedIn, Instagram or another link. |
| Content | `about`, `project` | Showcase your work and tell your story. | Add an introduction or highlight a project. |
| Actions | `contact`, `booking`, `form` | Let visitors take action. | Add a way for visitors to connect or take action. |

Use approximately 16–20px section padding, subtle header/list divider, 20–24px between sections, and restrained one-line empty states. Do not keep add choices expanded or permanently visible. Replace the current inline quick-add behavior with dialogs; that earlier experiment is superseded.

Existing rows target 60–64px minimum/content-driven height, approximately 36px icon containers and two text lines. Left: icon, primary name and truncated secondary URL/text/type. Right: 44px switch hit area and 44px overflow button, vertically centered. Long names must not displace controls. Allow extra height for text zoom rather than clipping. Use Ink/secondary tokens and a subtle `Hidden` badge; avoid aggressive opacity on hidden text.

Use a wide edit link/button over the informational part of the row. Toggle/menu are siblings, never nested inside that control; no stretched overlay intercepting their clicks. Provide equivalent Edit in the menu. Hover and keyboard focus use neutral surfaces/rings without layout movement. The page is not a drag surface.

## 6. Add-modal architecture

All three `+ Add` actions open the same Base UI Dialog presentation, with section-specific chooser content. No desktop popover/mobile sheet split. No URL navigation on a choice or edit action in the normal editor experience.

Use a single dialog controller with mutually exclusive states:

| State | Content | Transition |
| --- | --- | --- |
| Closed | Main editor | Add → section chooser; Edit → item loading/editor |
| Section chooser | Social grid or Content/Actions rows | Choice → matching form inside same popup |
| Add editor | Selected type/platform form | Back → chooser; successful submit → close |
| Edit loading/editor | Existing item form | Successful save → close; Cancel → close |
| Saving | Existing form plus local pending state | Success → refresh/close; error → retain form |

Keep one dialog root/popup through chooser-to-form transitions. Back is available only for add flows, labeled `Back to choices` for assistive technology; visible contextual text may be `Add social link`, `Add content` or `Add an action`. Close is always an X with `Close dialog`. Avoid nested chooser dialogs and preserve focus explicitly when changing steps.

Reuse the existing draft-discard confirmation language for real unsaved form changes: `Discard changes?`, `Your changes haven’t been saved.`, `Keep editing`, `Discard changes`. Apply it to Back, Cancel, X, outside dismissal and Escape after edits; pristine chooser/form closes normally. Keep editing returns focus to the active field. This is local dialog draft protection, not a redesign of unrelated navigation guards. No confirmation on successful save.

## 7. Central social platform registry

Create/reconcile one client-safe platform metadata registry keyed by the existing `LinkKind`. It owns customer label, recognizable glyph/component, brand treatment, chooser group/order, form heading/help and generic fallback placeholder where needed. Derive editor/add-modal labels and icons from it; remove duplicate component-local platform lists and brand/label maps. `LINK_KINDS` remains the server validation source of allowed persisted enum values. Do not import runtime Zod or database modules into the icon registry.

The current `social-icons.tsx` brand paths and `block-options.ts` labels are the starting point. Consolidate without changing persisted kind values or automatically relabeling stored custom labels. If labels must be usable outside React, keep one pure metadata source with an icon identifier and resolve that identifier in the centralized icon renderer. Do not introduce a plugin/provider system or platform tables.

Chooser grouping and order are fixed:

| Group | Kinds in display order |
| --- | --- |
| Popular | Facebook, Messenger, Instagram, TikTok, LinkedIn, YouTube |
| More | GitHub, X (Twitter), WhatsApp, Viber, Telegram, Portfolio, Shop, Menu, Custom link |

Visible group labels are `Popular` and `More`, not “Popular in the Philippines.” Heading: `Add a social or link`. Each option is a horizontal icon/name tile, equal height, equal column width. Desktop has exactly 3 columns; below `sm` (640px), exactly 2. Group headings span all columns. An odd final row is allowed; never add a fake option to fill it. Target tile height 48–56px; long labels wrap inside the equal-height grid without horizontal overflow. No search at this catalogue size.

Recognizable brand glyphs: Facebook, Messenger, Instagram, TikTok, LinkedIn, YouTube, GitHub, X, WhatsApp, Viber, Telegram. Generic neutral glyphs: Portfolio, Shop, Menu, Custom link. Brand color stays in the small glyph treatment, not full row/tile surfaces. Reuse licensed/source-attributed assets already present where suitable.

**Legacy Booking link:** `link.kind = booking` remains valid and editable under Socials & links, with centralized metadata. It is intentionally absent from the new social chooser: new booking actions use the actual `booking` block type under Actions. Do not convert, delete, hide, or reclassify existing Booking links. Unsupported Discord, Reddit and Threads are absent; never disguise them as named custom platform options. Custom link is an ordinary generic user-entered link, not an unsupported-platform adapter.

The registry must be reusable by preview/public components later. This pass does not require adding icons or changing the visual appearance of the public profile.

## 8. Social add/edit UX

Selecting a platform transitions inside the same dialog to its form. Platform glyph/name and concise help identify the choice. Example: `Facebook` / `Connect your Facebook profile or page.` Fields: `Facebook link` (required), `Display label` with quiet `Optional`. No Type/Link type dropdown; chosen platform determines hidden `kind`.

Use a platform example placeholder such as `facebook.com/yourpage`. Optional display label may show the platform label as a placeholder/default presentation; leaving it empty stores the existing null/empty normalization and lets the renderer derive its label. Do not inject factual account data into placeholders or overwrite an existing label.

Custom link uses `Label` (quiet `Optional`) and `URL` (required), with generic examples `My website` and `example.com`. The approved sketch does not override schema: current `link.label` is optional, max 40; requiring a custom label would be a new business rule and is not part of this design. Empty custom labels retain a generic `Custom link` editor fallback; preserve existing public fallback until a separate approved change.

Add footer: `Cancel` (outline) and `Add link` (primary). Edit footer: `Cancel` and `Save changes`. Edit reuses the selected platform form; retain the existing kind, URL and label. Do not provide platform switching as an accidental side effect of editing a URL. Existing legacy kinds remain supported.

Server parsing stays canonical: `label` max 40, required URL normalized by `normalizeLink`/`linkSchema`, max 2048. Missing schemes may become HTTPS. Reject HTTP, credentials and unsafe/non-web schemes according to existing rules. Do not add new platform-host restrictions or silently rewrite profile identifiers.

On success, close, refresh the affected section from server truth, show concise Neffi toast feedback, and restore focus to the invoking Add/Edit control. A new item appends using current global position behavior; do not regroup all stored positions when adding.

## 9. Content add/edit UX

Title: `Add content`. Exactly two full-width choice rows; no grid:

- `About` — `Tell visitors a little more about you.`
- `Project` — `Highlight something you've made.`

Rows have an approximately 36px neutral icon, title/helper, optional right chevron, equal comfortable height (approximately 64–72px) and a neutral hover/focus surface. They transition to forms in the same dialog.

About: required text, existing max 1000. Project: required title max 80, optional description max 500 and optional URL using existing URL rules. Persistent field labels, suitable textarea heights, inline errors. Do not add another shared Short intro; About is mode-specific content. Add uses `Add content`; edit uses `Save changes`; Cancel closes without mutation.

## 10. Action add/edit UX

Title: `Add an action`. Full-width choice rows matching Content:

| Choice | Helper | Internal type |
| --- | --- | --- |
| Save contact | Let visitors save your details. | `contact` |
| Book a meeting | Add your booking link. | `booking` |
| Contact form | Let visitors send you a message. | `form` |

Save contact: selected form explains use of shared contact details, then `Add action`; create `saveContact: true` through the existing action payload representation. Do not ask for profile identity fields or add an unnecessary off switch during creation. Existing items with `saveContact: false` remain editable with the existing Save contact setting; visibility and saveContact are distinct. Hiding an item must not rewrite its content flag.

Booking: `Button text` (Optional, max 40) and `Booking link` (required, existing HTTPS normalization). Add uses `Add action`; edit uses `Save changes`.

Contact form: preserve actual three preset/config options and the definition lifecycle. If template choice is needed during creation, label it `Start with`, with customer choices `Connect`, `Project inquiry`, `Contact`; never display “Form preset.” Selecting Contact form alone does not create a persisted item. `Add contact form` creates the existing definition and block atomically using the selected preset; no new combined domain workflow is needed.

Editing opens the existing form configuration inside the dialog: title max 60; existing fixed field catalogue; Name required; Email or Phone required; at most 3 custom questions; labels max 80; retain existing question IDs. Use `Contact form` / `Edit contact form`, not generic Form settings. Existing `FormEditor` can be reused with modal-aware submit/cancel presentation. No dynamic form-builder expansion.

Copied modes can share a form definition. Preserve this behavior: do not clone on edit. When sharing is present, expose restrained guidance that changes apply wherever this contact form is used; derive it from actual references, not an assumed count. Removing a form block must retain existing definition/submission behavior and must not promise deletion of messages or recovery of form quota.

## 11. Reorder behavior and global positions

Normal section header offers `Reorder` immediately before `+ Add` when at least two items exist. In Reorder mode, replace those controls with `Done`. Mode is local to that section; other sections retain normal operation. Do not expose normal Edit/Hide/Remove menus or switches inside the section while reordering. Rows retain their identity/Hidden badge and display labeled Up/Down buttons with 44px minimum targets. No drag handles.

- Entering and leaving Reorder does not write anything.
- Each Up/Down saves immediately using the existing transaction and refreshes ordered rows; Done only exits mode, not a second save.
- First item Up and last item Down are disabled, counting hidden and visible items alike.
- Disable that section's reorder controls while a move is pending; no duplicate/conflicting moves. Preserve Reorder mode across refreshes by stable component keys.
- After a move, restore focus to an enabled control on the same item (opposite direction if the initiating control became disabled). Announce successful movement and failure without relying on animation.
- If a concurrent update leaves fewer than two items, exit Reorder safely and return focus to the section heading/Add control.

**Storage mapping:** sections are editor projections, not separate stored lists. Read the complete list in global position order, then filter by the section's type set. A move swaps the selected item with the nearest preceding/following item in that same set, skipping other types. Write dense global positions under the existing profile lock and bump `content_version`.

Example: global `[link A, about X, link B, form Y]`; moving B up in Socials & links yields `[link B, about X, link A, form Y]`. About X and Form Y retain their global slots and relative order. Public rendering continues consuming this single list; it does not group sections. Thus a link can cross content/action items in the public sequence when it swaps with another link. The UI must not imply globally grouped public sections. This limitation is intentional in this scoped pass.

Current working-tree `among` behavior implements the intended swap. The prior global-adjacent API alone cannot implement section ordering: if `among` is absent from the implementation baseline, adding it is an explicit, narrowly scoped domain behavior extension requiring DB tests, not a migration. Server maps validated section names to fixed `BLOCK_SECTIONS`; never trust arbitrary client-supplied type arrays. Ensure the target block belongs to the submitted section and the route's owned mode. Do not automatically normalize old records into grouped order or add section-position columns.

## 12. Visibility and remove behavior

Normal menu order: `Edit`, contextual `Hide` or `Show`, divider, `Remove`. No Move up/down in this menu. Visibility switch and menu command invoke the same mutation and pending/error state. Switch name identifies the item, e.g. `Show Facebook to visitors`, with accurate checked state. Server truth determines the visible state; a rejected change leaves the row unchanged and explains the publish requirement.

Remove opens confirmation: `Remove [item name]?` with concise existing consequence copy, `Cancel`, destructive `Remove`. No mutation on opening/canceling. Disable duplicate submission while pending. On success refresh, close, toast, and move focus to the nearest remaining row or section Add control because the original trigger is gone. Do not delete shared form definitions or historical messages through this control.

## 13. Mobile behavior

- Single column, 16px gutters; no side preview or horizontal page overflow at 320px, text zoom or long names.
- Preserve bottom-navigation clearance supplied by the app shell; do not add a floating editor footer over navigation.
- Social picker: exactly 2 equal columns; horizontal icon/name tiles. Content/Actions: full-width vertical choice rows.
- Same centered dialog as desktop, width `calc(100vw - 32px)`, max-height constrained to `calc(100dvh - 32px)` and safe areas; approximately 12px radius, not an oversized bottom sheet.
- Keep dialog heading/close reachable and the body independently scrollable. Form actions stay in normal/reachable dialog flow; no footer that hides fields. Use visible-viewport handling already established by the location dialog if the keyboard requires it. Scroll the active input into the visible body.
- Touch targets remain at least 44px, including Back, Close, menu items and reorder controls. Tile text can wrap; no clipped platform labels.

## 14. Desktop behavior

- Centered bounded main column and integrated section surfaces, never an editor/preview split.
- Header actions align naturally to the right while long mode names wrap on the left.
- Social dialog approximately 560–600px wide to accommodate 3 equal columns. Content/Actions/editor forms can use approximately 520–560px. All remain viewport-constrained.
- No extra cards around individual form fields. Use ~220ms color/opacity interactions, restrained elevation, and existing tokens/radii. Avoid gradients, glow, glassmorphism, excessive pills, giant whitespace and rainbow surfaces.

## 15. Accessibility

- Use the installed Base UI Dialog/Menu/Button patterns, named dialogs, proper title/description associations, focus trapping, Escape handling and focus restoration.
- Chooser options are real buttons; Enter/Space selects, Tab follows visible DOM order. No listbox/grid roles unless their full keyboard interaction is implemented.
- Step changes announce/focus the new heading or first input. No nested interactive elements or row link wrapping a switch/menu.
- Persistent native/Field labels on inputs; field errors linked by unique `aria-describedby`, `aria-invalid` set when relevant. Do not misuse Base UI labels for controls they do not label.
- Menus support keyboard navigation and dismiss properly before opening Edit/Remove. Visibility is a genuine accessible switch; reorder buttons say `Move [item name] up/down` and expose native disabled state.
- Use a polite live region for move/save feedback, alert treatment for actionable failures, visible focus and reduced-motion support. Do not move keyboard focus to a toast.
- Minimum 44px interactive area everywhere, including compact visible controls. Icons are decorative when adjacent to text; icon-only actions have explicit accessible names. Hidden/selected/pending state is never conveyed by color alone.

## 16. Error, loading and success states

Validate using existing server schemas; preserve all drafts on field/network/domain failures. Return field keys/messages as structured action data when practical; show errors immediately below relevant fields and focus the first invalid input after pending ends. Keep generic failures concise, with input retained and a usable retry via the original Save/Add action.

During mutation, disable duplicate actions, retain values, use a button spinner plus `Adding…`, `Saving…` or `Removing…`; no full-page overlay. Prevent closing while a mutation is pending to avoid ambiguous completion. Lightweight loading feedback inside Edit dialog is allowed while its owned data is fetched; don't open a blank popup. An unavailable/deleted item produces a concise safe error, refreshes the list and never displays another profile's content.

Reuse Base UI Toast and Neffi feedback styling from Your details. Suggested success copy: `Link added`, `Changes saved`, `Content added`, `Action added`, `Contact form added`, `Item hidden`, `Item shown`, `Item removed`; reorder can use a local polite status. A network/server failure should say the change could not be saved and that inputs remain. Publish/limit failures retain existing actionable domain meaning; translate old “scene/block” copy at the customer boundary without weakening guards.

## 17. Component architecture

Use a small composition, not a generic form-builder framework:

- Server page loads the owned mode and ordered editor DTO; renders the header and client editor boundary.
- `SceneSection` (internal name may remain) owns section Reorder state and rows; Add no longer owns inline disclosure state.
- One editor dialog controller holds discriminated intent (`add section`, `add type/kind`, `edit item`) and local draft lifecycle.
- Shared chooser views: social registry grid, Content rows, Actions rows.
- Shared field forms render inside that dialog and existing standalone route shells. They accept completion/cancel handling rather than owning route navigation.
- `BlockRow` preserves identity, switch and menu; mode-aware controls replace hidden move actions.
- Central platform metadata/icon registry; existing `BLOCK_META` can continue for non-link types.

Reuse `EditorDialog`, `DialogCancel`, Button/Input/Textarea, DropdownMenu and the Base UI toast pattern. Extend them only where this task requires it. No new dependency is required.

## 18. Server/client boundaries and route compatibility

Current add/update/move/toggle/remove actions redirect back to the mode route. A redirect prevents the requested same-modal validation/success lifecycle and may reset Reorder state. Introduce small non-redirecting mutation actions/results for the editor, with existing redirecting actions as route-fallback adapters over shared server helpers. Avoid copying domain logic. Return serializable success/error/field information and authoritative identifiers needed for refresh; use `router.refresh()` after success and close only then/as part of confirmed success. Preserve version/cache invalidation through domain functions.

Keep `/blocks/new` and `/blocks/[blockId]` accessible for existing bookmarks, direct links and fallback use. Normal chooser/edit buttons use dialogs; a fallback route is not the primary flow. Share form fields and server mutations so limits, labels and normalization do not diverge. Do not add an intercepted-route hierarchy solely for this small modal transition.

Server must authenticate every mutation and verify Profile → mode → item/form association. Current update/move/visibility/remove helpers establish profile ownership, but their action wrappers also need to reject item IDs that belong to a different mode in the same profile when route context is submitted. For forms, verify the mode's actual block references the submitted profile-owned form definition. Reuse `blockForEditing`/owned lookups where appropriate; don't weaken ownership to simplify modal fetching.

Edit DTO options: include safe content in the server-rendered editor data (already available for non-form items) and load full form config through an authenticated read action on demand. Validate association before returning it; no browser DB credentials or new public API are needed. Type-only imports are allowed. Client components must not transitively import runtime Zod, server-only modules or database schema helpers. Preserve `client-import-graph.test.ts`; do not bypass it with dynamic imports.

## 19. Expected files affected during implementation

Paths below are prospective; this spec pass changes documentation only.

| File/area | Expected responsibility |
| --- | --- |
| `src/app/(customer)/app/profiles/[profileId]/scenes/[sceneId]/page.tsx`, `page.test.tsx` | Focused layout, editor DTO, header/Preview, no permanent preview |
| Same directory `block-forms.tsx`, `block-meta.tsx` | Reuse fields/metadata; replace inline Add and menu moves |
| Same directory, proposed `editor-dialog.tsx`, `editor-section.tsx` or equivalent focused files | Dialog flow, draft/pending state, section Reorder and row interactions |
| Same directory `form-editor.tsx` | Modal-compatible Contact form editing with existing config |
| Same directory `actions.ts`, `actions.test.ts` | Non-redirecting adapters, association checks, structured results and existing fallback redirects |
| Same directory `blocks/new/page.tsx`, `blocks/[blockId]/page.tsx`, `block-page.tsx` and tests | Preserve direct routes, shared fields, customer terminology |
| `src/components/social-icons.tsx`, `src/modules/profiles/block-options.ts`, proposed pure platform metadata module if needed | One centralized registry and derived labels/options without runtime Zod |
| `src/modules/profiles/editor.ts`, `editor.db.test.ts` | Minimal editor DTO/read association and actual shared-form reference information |
| `src/modules/profiles/blocks.ts`, `blocks.db.test.ts` | Preserve/verify scoped `among` movement; change only if missing or a concrete correctness gap exists |
| `src/app/(customer)/touch-targets.test.ts`, `src/app/client-import-graph.test.ts` | Run unchanged guards; extend coverage without lowering thresholds |
| Focused component tests beside editor files | Add/edit/reorder/menu/dialog integration coverage |

No `drizzle/`, enum migrations, generated PSGC data, identity editor, global tokens, app shell or unrelated routes should change. Public renderer tests should run for compatibility; the renderer itself need not change in this scope. Documentation should record final implemented behavior after approval, without restating milestone status outside the roadmap.

## 20. Testing strategy and acceptance gates

Use existing Vitest/server-render and happy-dom patterns. Tests should prove behavior rather than mirror every class string. Keep a small source/render contract for structural responsive rules that a DOM environment cannot calculate.

| Area | Required evidence |
| --- | --- |
| Page | Correct three sections; dynamic name and currently-showing condition; Back/Preview destinations retained; no aside/live-preview markup or preview-only loader call |
| Terminology | Customer labels/titles/menu/form errors use approved terms; no Scene/Block/Link type/Form preset/Move block leaks; internal routes/types remain valid |
| Social chooser | Exact Popular/More grouping/order; exactly 15 offered kinds; recognizable/neutral icons; no Discord/Reddit/Threads or Booking-link creation tile |
| Responsive contract | Social grid declares 2 mobile / 3 desktop equal columns and horizontal tiles; Content/Actions declare full-width rows, not grids |
| Selection/add | Choice changes form inside the same dialog without navigation; kind fixed; URL required; optional label; Custom link follows current optional-label schema; successful mutation closes/refreshes/toasts |
| Edit | Existing values/kind preserved; no Type selector; legacy Booking links editable; save result/inline errors retain drafts; direct routes still work |
| Content | Exactly About/Project; schema lengths/optional fields retained; add/edit completes in dialog |
| Actions | Exact three options/helpers; contact creation sends saveContact true; booking fields; contact form template/config operations preserve IDs and constraints |
| Visibility | Switch and menu Hide/Show use same action; pending disables duplicates; accurate Hidden badge; last-visible guard failure preserves row |
| Removal | Confirmation mandatory; Cancel does nothing; successful focus fallback; no shared-form/submission deletion change |
| Reorder | Normal menu excludes Up/Down; section Reorder/Done state; 44px controls only in mode; first/last disabled including hidden items; pending/failure/focus/announcement behavior; mode survives refresh |
| Domain ordering | Interleaved link/about/project/action fixtures prove nearest same-section swap and unchanged other-section slots; dense global positions, profile lock, content-version bump, boundary no-op; forged section/foreign mode/item refused |
| Accessibility | Named/focus-trapped dialog; keyboard chooser/menu flow; Escape, dirty-dismiss confirmation, Back-step focus, restoration, no Base UI warnings, 44px touch-target tests unchanged |
| Boundaries | Client-import graph unchanged/passing; runtime Zod only in server validation/actions; authenticated edit-data reads and mutation authorization regressions |
| Public compatibility | Original one-list global order and visible filtering; all six types; legacy Booking link; nullable labels; unsafe URLs still filtered; vCard availability; shared form config/submissions remain compatible |

Run relevant mode-route/actions/component tests, profile editor/blocks DB tests, forms/public view tests, affected customer/access checks, full typecheck and targeted lint. Use CI-equivalent synthetic environment for tests that import server configuration; never target a shared database for automated fixtures.

Manual acceptance after implementation: 320/375/390px phones and a representative desktop; long mode/item names and URLs; text zoom; equal picker tiles; dialog scroll with software keyboard; no horizontal overflow; bottom navigation unobstructed; keyboard-only add/edit/reorder/remove; visible focus/reduced motion. A source assertion cannot prove physical keyboard/viewport geometry: report manual evidence separately. Browser/screenshot work is not authorized by this specification pass.

## 21. Risks, conflicts and edge cases

1. **Existing experiment differs from locked UX:** inline add and menu moves are superseded; permanent preview stays removed. No implementation changes belong in this pass.
2. **Global order versus grouped editor:** section swapping can move items across other types in the public sequence. Preserve the slot-swap behavior and test it; grouping the public page or persisting separate section order would be a distinct product change.
3. **Redirecting actions:** same-dialog completion requires the narrow server adapter change in section 18. Do not catch/swallow framework redirects or falsely report a save as complete.
4. **Shared form definitions:** updates may affect copied modes, and removing a block does not necessarily release the form-definition quota. Preserve behavior and communicate actual sharing.
5. **Custom label optionality:** the current schema allows blank labels. This design does not make Custom link Label required without a separate explicit decision.
6. **Two Booking representations:** existing Booking-kind links remain Socials & links; new Book a meeting choices create booking actions. No data conversion or enum edit.
7. **Stale/concurrent state:** item removed elsewhere, mode renamed/deleted, quota reached, or another tab moving items must refresh safely, retain unsaved drafts where possible and show domain errors. Ordering correctness lives in locked transactions, not client indices.
8. **Route-context integrity:** profile ownership alone must not let a forged modal request mutate a different mode's item. Add association checks without expanding data exposure.
9. **No hidden block-type change:** display Save contact state accurately, preserve shared details and existing public behavior; URL-label cleanup must not rewrite persisted values.

The existing block model supports the approved design **without a database migration**. The implementation work is composition, metadata consolidation, modal-aware server results, explicit reorder state and focused boundary checks. No architectural blocker requires new tables.

## 22. Explicitly deferred work

- Discord, Reddit and Threads; each requires a separately approved enum migration and validation/public-display work.
- Drag-and-drop and drag handles.
- Shared social library, connected social accounts and new platform tables.
- Database migrations or changing the persisted Scene/Block naming.
- Separate persisted section ordering, global editor reorder UX, or grouped public rendering.
- Public-profile/preview visual redesign and per-mode identity/appearance.
- Automatic cloning of shared contact forms, new form types, or template/data-model redesign.

Stop after specification review. Do not implement, install dependencies, migrate, commit, push or open a PR as part of this pass.
