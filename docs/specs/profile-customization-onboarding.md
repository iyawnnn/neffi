# Spec: Profile layouts, appearance and guided setup

**Date:** 2026-10-21. **State:** Implemented (T2–T15). Architecture locked by the maintainer. Current behavior is described here, in [profiles and the public card](profiles-and-public-card.md) and in [cards and activation](cards-and-activation.md). The task sequence is in [the implementation plan](../superpowers/plans/2026-10-21-profile-customization-onboarding.md). That plan is not a specification.

Decisions: [0013 universal layouts and Profile appearance](../decisions/0013-universal-layouts-profile-appearance.md), [0014 guided setup and Goal](../decisions/0014-guided-setup-and-goal.md), [0015 optional Showcase cover image](../decisions/0015-showcase-cover-image.md). Related: [0003](../decisions/0003-profile-scene-model.md), [0011](../decisions/0011-fresh-card-state-cached-scene-content.md), [profile mode editor](profile-mode-editor.md), [customer UI](../architecture/customer-ui.md), [marketing UI](../architecture/marketing-ui.md).

## 1. Purpose and principles

Let a non-technical customer build a polished, personal Neffi by making one understandable decision at a time, then keep it easy to change later.

- **Ease of use first.** Plain language, good defaults, optional fields marked, Skip for now where it is safe.
- **Hard to make a bad-looking profile.** Neffi controls typography, spacing and contrast. Customers choose a layout, Light or Dark, and an accent from a curated list.
- **One profile model.** A layout is only a presentation. Switching layouts never changes, hides or requires re-entering content.
- **Mobile first.** Profiles are opened after an NFC tap, a QR scan or a shared link, so every layout is designed at 320–430px first. Desktop expands the layout, and no layout's value depends on desktop width.
- **Only supported content.** Recommendations name only fields and block types Neffi supports today.

## 2. Vocabulary

| Term | Meaning | Customer-facing? |
|---|---|---|
| **Profile** | The shared identity, contact details and appearance (existing) | Yes |
| **Profile mode** | A Scene: a context-specific ordered set of content (existing; internal name Scene) | Yes |
| **Goal** | Why the customer mainly uses Neffi. It drives recommendations and defaults only | Yes, in setup ("What will you use Neffi for?") |
| **Layout** | How the Profile is arranged: Classic, Editorial or Showcase | Yes |
| **Mode** | Light or Dark colour treatment. Internally `color_mode`, so it is never confused with Profile mode | Yes, labelled "Light" / "Dark" under "Colours" |
| **Accent** | One curated colour | Yes |
| **Appearance** | Layout + Mode + Accent, plus an optional Showcase cover image ([0015](../decisions/0015-showcase-cover-image.md)). Photo/logo is **not** Appearance; it is identity | Yes |
| **Cover image** | An optional wide image shown only by Showcase, in place of the accent band | Yes ("Cover image", in Appearance) |
| **Guided setup** | The first-run flow that builds the first Profile for a claimed card | Yes ("Set up your Neffi") |

Goal ≠ Layout ≠ Mode. A Goal never restricts a Layout, a Layout never restricts content, and Mode never changes hierarchy.

## 3. Existing system preserved

- Account → Profiles (≤10) → Scenes/Profile modes (≤5, protected Default, at most one other shown) → ordered Blocks (≤20): `about`, `project`, `link`, `contact`, `booking`, `form`. Forms (≤5 per Profile) and Inbox are unchanged.
- A Card routes to exactly one Profile (`cards.profile_id`, composite FK to the owner). Several Cards may show one Profile. Card ownership comes only from a claim ([0002](../decisions/0002-purchaser-account-card-profile.md)).
- Profile status `draft → published ⇄ unpublished`. Publish requirements (`publishGaps`): a name, at least one of phone, email or website, and a visible Default-Scene Block. Edits to a Published Profile are live when saved, and edits that would break publishability are refused.
- `/c/{token}` reads the Card fresh. Only Scene content is cached, keyed `(profile, scene, content_version)`. Every visitor-visible change bumps `content_version`, and the new appearance columns are visitor-visible.
- Save Contact (`/c/{token}/contact`, vCard 3.0: FN, N, ORG, TITLE, TEL, EMAIL, URL), the Sharing QR (`/c/{token}`), Cloudinary images (jpg/png/webp/heic, 5 MB) and URL safety (https only, re-checked at render) are unchanged.

**V1 card/profile rule.** One Card shows one Profile at a time. This holds already, and multi-profile use is already possible: an Account can own several Profiles and switch a Card between them, and Profile modes cover Work/Personal/Event contexts. This work adds no multi-profile features.

## 4. Canonical profile model

No new tables. The model is the existing Profile + Scenes + Blocks, plus three appearance and goal Profile columns (T2) and one optional cover column group (T8a).

| Concept | Source | Notes |
|---|---|---|
| Identity: photo or logo | `profiles.image_asset_id`, `image_is_logo` | One image. A logo is shown uncropped, a photo round |
| Identity: name, headline, company, location | `profiles.full_name`, `headline`, `company`, `location` | Location uses the PSGC combobox (existing) |
| Identity: short intro | `profiles.bio` (≤300) | Rendered in every layout unless an About Block duplicates it (§6.3) |
| Contact | `profiles.phone`, `email`, `website` | Public contact, separate from the sign-in email |
| Save Contact | A `contact` Block with `saveContact` in the shown Profile mode | Contact details are visible to visitors only through a visible Contact Block (existing behavior) |
| Socials | `link` Blocks whose kind has category `social` | §6.2 |
| Links | `link` Blocks with category `link`, and `booking` Blocks | Booking Blocks are primary actions (§6.3) |
| Work | `project` Blocks (title, description, optional URL) | No project images in V1 |
| About | `about` Blocks (≤1000, per Profile mode) | |
| Forms | `form` Blocks | Unchanged |
| **Layout** | **new** `profiles.layout` enum `classic` \| `editorial` \| `showcase`, NOT NULL, default `classic` | Profile-level, applies to every Profile mode |
| **Mode** | **new** `profiles.color_mode` enum `light` \| `dark`, NOT NULL, default `light` | Profile-level |
| Accent | `profiles.accent_color` (existing hex, curated values only) | NULL renders as Ink |
| **Goal** | **new** `profiles.goal` enum `networking` \| `freelance` \| `business` \| `student`, NULL | Recommendation input only |
| **Showcase cover** | **new** `profiles.cover_asset_id` (text), `cover_width`, `cover_height`, `cover_crop_x`, `cover_crop_y`, `cover_crop_width` (integers); all NULL or all set | Optional Appearance asset that only Showcase renders ([0015](../decisions/0015-showcase-cover-image.md)). Separate from the photo/logo |

**Cover rules:**
- `cover_width` and `cover_height` are the size of the stored asset after the existing 2048px incoming limit, read from Cloudinary when the upload is confirmed.
- The crop is a 3:1 rectangle in source pixels. Its height is `round(cover_crop_width / 3)` and is never stored.
- Database CHECKs enforce:
  - all six columns NULL, or all six set
  - positive size
  - `x, y ≥ 0`
  - `cover_crop_width ≥ 600`
  - `x + cover_crop_width ≤ cover_width`
  - `y + round(cover_crop_width / 3) ≤ cover_height`
- No URL, version, format or focal point is stored; delivery URLs are derived at render time, as for the photo.

`profiles.theme` (unused, always `default`) is dropped ([0013](../decisions/0013-universal-layouts-profile-appearance.md)).

**Alternatives considered and rejected.** A JSON `appearance` column loses database validation and enum safety for no gain. Separate per-layout content tables break the one-model rule.

## 5. Goals

A Goal recommends a Layout, orders suggestions and names the first Profile mode. It never hides a field, layout or block type.

| Value | Label | Helper | Recommended layout | Suggestions in "What should people find?" (in order) | Default Profile mode name |
|---|---|---|---|---|---|
| `networking` | Networking / Professional | Share your details and stay in touch. | Classic | LinkedIn, Messenger, WhatsApp, Custom link | Networking |
| `freelance` | Freelance / Creative | Show your work and get new clients. | Showcase | Project, Portfolio, Instagram, Behance, Dribbble, Book a meeting, Contact form | My work |
| `business` | Business / Sales | Help customers reach you and take action. | Editorial | Book a meeting, Facebook, Messenger, Shop, Menu, Contact form | Business |
| `student` | Student / Job Seeking | Share your projects and make a great first impression. | Classic | LinkedIn, Project, Portfolio, GitHub, Custom link labelled "Resume" | Main |
| *(none)* | Not sure yet | You can change everything later. | Classic | LinkedIn, Facebook, Instagram, Custom link | Main |

- Website, phone, email and Save Contact belong to the Contact step for every Goal and are not repeated as suggestions.
- "Resume" is an ordinary Custom link with the label pre-filled. Neffi has no resume type.
- No form is created automatically. "Contact form" is a suggestion; guided setup creates no starter content.
- The Goal is stored once the Profile exists. It is **not editable** after setup in V1, and nothing outside guided setup shows a recommendation derived from it, because a stale Goal must not steer later choices. It stays stored for resume and future use.
- The Goals replaced the former purposes (`network`, `get_clients`, `show_my_work`). Purposes were never stored, so there is no data mapping. Notion still lists the three starter goals; see [known drift](../README.md#known-drift).

The Goal table lives in one pure, client-safe module (replacing `purpose-options.ts` and `starters.ts`).

## 6. Rendering contract

### 6.1 One view, many layouts

`buildSceneView` stays the single mapping from stored rows to what a visitor sees. It gains:

```ts
appearance: { layout: "classic" | "editorial" | "showcase"; mode: "light" | "dark"; accent: string /* resolved curated hex */;
              cover: { src: string; srcSet: string } | null /* T8a, 0015 */ }
```

**`appearance.cover`:**
- Built server-side in `view.ts` from the cover columns by a Cloudinary URL helper next to `imageUrl`, then passed into the pure `buildSceneView`, as the photo URL is today.
- Present whatever the saved layout is. Setup mini-renders and the Appearance preview can therefore show Showcase with the real cover before the layout is saved.
- It is not content. `profileSections` and `identity` do not carry it.
- `ProfileRenderer` passes it to `ShowcaseLayout` only.

A pure, zod-free and client-importable function `profileSections(view)` returns the grouped content every layout consumes:

```ts
{ identity, intro: string | null, primary: PrimaryAction[], featured: WorkItem | LinkItem | null,
  socials: LinkItem[], links: LinkItem[], work: WorkItem[], about: AboutItem[], contact: ContactGroup | null, forms: FormItem[] }
```

A `ProfileRenderer` component dispatches on `appearance.layout` to `ClassicLayout`, `EditorialLayout` or `ShowcaseLayout`. An unknown value renders Classic. Every consumer uses it: `/c/{token}`, the owner preview, publish, guided setup and the Appearance editor. `SceneViewPreview` is removed once all callers are switched. Owner preview renders inert controls, as today.

### 6.2 Link kinds

Every one of the 22 supported `profile_link_type` values renders in every layout. The `publicIcon` gate (today only 6 kinds show an icon) is removed.

| Category | Kinds | Icon |
|---|---|---|
| `social` | facebook, messenger, instagram, tiktok, linkedin, youtube, github, x, whatsapp, viber, telegram, threads, discord, reddit, pinterest, behance, dribbble | Brand glyph already in `platform-registry.ts` |
| `link` | portfolio, shop, menu, custom, booking (legacy) | Neutral Lucide glyph (for example briefcase, shopping bag, utensils, link, calendar) |

- `category` and the icon identifier live in the registry. A kind without a specific glyph uses the generic link glyph, so it is never omitted.
- Labels: a stored label wins, otherwise the registry public label (existing behavior).
- A registry test asserts that every enum value has a category and resolves to an icon. A layout test renders a fixture containing every kind in all three layouts and asserts each appears with an accessible name.

### 6.3 Grouping rules

1. Every visible Block of the shown Profile mode appears in every layout. Layouts only choose placement.
2. Within a group, items keep stored `position` order. The mode editor's per-section reorder therefore matches the public page. This supersedes the "one public list" rule of [profile mode editor §11](profile-mode-editor.md).
3. **Primary actions:** Save contact (if any visible Contact Block has `saveContact`), then every visible `booking` Block. Exactly one primary action is accent-filled: Save contact if present, otherwise the first booking. The others use the outline treatment.
4. **Contact group:** present when any visible Contact Block exists. It shows phone (`tel:`), email (`mailto:`) and website once, however many Contact Blocks there are.
5. **Location** appears only in identity, never repeated in the contact group.
6. **Intro:** `profiles.bio`. It is omitted from the header when a visible About Block's trimmed text equals the trimmed bio, which covers profiles whose starter copied bio into an About Block. Stored data is not rewritten.
7. **Featured** (Showcase only): the first `work` item. If there is no work, the first `link`-category link. If neither exists, none. A featured item is not repeated in its own group.
8. Unsafe or non-https URLs are dropped at render (existing behavior). A dropped item is not an empty placeholder.
9. Empty groups render nothing: no headings, placeholders or "Add…" text on public pages.

### 6.4 Colour tokens

A pure function `profileTheme(accentHex, mode)` returns CSS custom properties scoped to the rendered profile:

| Token | Light | Dark |
|---|---|---|
| `--pf-bg` | Snow `#F7F8FA` | Ink-based dark canvas (near `#0C0C0D`) |
| `--pf-surface` | `#FFFFFF` | One step lighter than `--pf-bg` |
| `--pf-fg` | Ink | Snow |
| `--pf-fg-muted` | `#62646A` | Neutral grey ≥4.5:1 on `--pf-bg` |
| `--pf-border` | Neutral hairline (`border` token) | Neutral hairline on dark |
| `--pf-accent` | Curated light value | Curated dark variant |
| `--pf-on-accent` | `onAccent()` result | `onAccent()` result |
| `--pf-accent-text` | Accent if ≥4.5:1 on bg, otherwise a committed darker text variant | Dark variant ≥4.5:1 on bg |

- Each of the 8 curated accents (Ink, Ocean, Teal, Forest, Amber, Vermilion, Rose, Plum) stores its light hex (the persisted value) and a committed dark variant in `appearance-options.ts`. Ink's dark variant is Snow.
- A test asserts, for every accent and both modes: `contrast(on-accent, accent) ≥ 4.5`, `contrast(accent-text, bg) ≥ 4.5`, and `contrast(fg-muted, bg) ≥ 4.5`, using the existing `contrast()` helper. The exact dark hex values are chosen in the implementation task and must pass this test.
- A stored accent outside the curated list (for example the seed's `#2f6fed`) renders as Ink. The Appearance editor then shows no swatch selected.
- **Custom HEX is not offered in V1.** Arbitrary colours cannot guarantee contrast in two modes or keep profiles polished. The column already stores hex, so adding it later needs only a contrast-adjusting step in `profileTheme`.
- The mode is the owner's choice. The visitor's `prefers-color-scheme` does not override it in V1.
- **No font customization.** All layouts use Geist Sans. Geist Mono is allowed only for Editorial section labels.

## 7. Layouts

All three are single-column at phone width with 16px side gutters and no horizontal overflow at 320px. The owner bar ("Only you see this", Edit, Switch mode) sits outside the layout, restyled with `--pf-*` tokens.

### 7.1 Shared visual rules

- Quality reference: the approved Home and Product pages ([marketing UI](../architecture/marketing-ui.md)). Snow/Ink first, the customer accent used sparingly: one filled primary, plus link arrows, focus and hover text.
- Type: Geist, weights 400/500/600. Name sizes are set per layout below. Body 15–16px with line height 1.5–1.6. Muted metadata 13–14px.
- Hairline separators and spacing build structure. No card-per-item soup, nested boxes, shadows, gradients, glass, glow or pill clusters.
- Radius: 12px for buttons and project cards, round photos. 24px is reserved for the device-like **preview shell** in setup and the editor, never on the public page itself.
- Touch targets ≥44px (primary buttons 48px). Visible focus ring in `--pf-accent-text`.
- Motion: colour/opacity transitions of 220ms on the shared ease only. No entrance animation on the public page. `prefers-reduced-motion` removes transitions.
- Images: photo `object-cover` round with face gravity (existing Cloudinary URL); logo `object-contain` on `--pf-surface`, never cropped. Without an image, Classic and Showcase show the existing initials disc in the accent, and Editorial shows no image slot.
- Social icon row: icons 24px inside 44px targets, `--pf-fg` monochrome with the brand glyph shape (brand colour is not used on the public page, so every accent and mode stays coherent). Each has an accessible name ("LinkedIn").
- Long names, URLs and labels wrap (`overflow-wrap: anywhere`) and never push controls off-screen.

### 7.2 Classic

The safest universal layout. Identity is centred and immediately understandable.

| Order | Group | Treatment |
|---|---|---|
| 1 | Identity | Centred: 96px image, name 26–28px/600, headline 16px, "Company · Location" muted 14px |
| 2 | Intro | Centred, max ~36ch, muted body |
| 3 | Primary | Full-width stacked buttons; first filled with the accent |
| 4 | Socials | Centred icon row, wraps |
| 5 | Links | Full-width rows: icon, label, trailing arrow; hairline-separated list on `--pf-surface` |
| 6 | Work | Project rows: title, description, "View project" text link |
| 7 | About | Left-aligned paragraphs under a small heading "About" |
| 8 | Contact | Labelled rows (Mobile, Email, Website) |
| 9 | Forms | Existing public form, restyled with tokens |

Desktop: the same column centred, max width ~480px, on `--pf-bg` with generous top spacing.

### 7.3 Editorial

Type-led and confident. It differs through alignment, hierarchy and grouping, not columns.

| Order | Group | Treatment |
|---|---|---|
| 1 | Identity | Left-aligned. 64px image inline beside the name block; name 32–36px/600 with tight tracking; headline; company and location as muted lines |
| 2 | Intro | Lead paragraph, 17–18px |
| 3 | Primary | Full-width filled primary; secondary actions as outline buttons below |
| 4 | Contact | Section label (Geist Mono, 11–12px, uppercase, tracked) + labelled hairline rows |
| 5 | Links | Typographic list: label left, arrow right, hairline between, no boxes |
| 6 | Work | Title 17px/600 + description, hairline-separated |
| 7 | About | Section label + paragraphs |
| 8 | Socials | Icon row with text labels on wider screens, icons only below 390px |
| 9 | Forms | Restyled public form |

At ≥1024px the content area widens to ~760px and section labels move into a left gutter column (~160px), creating a subtle asymmetry. Every label still precedes its content in DOM order, so mobile and assistive technology read the same structure.

### 7.4 Showcase

Content- and work-forward, still clean and professional.

| Order | Group | Treatment |
|---|---|---|
| 1 | Identity | The header is the customer's **cover image** when one is stored. Otherwise it is a solid cover band (~120px; `color-mix` of accent and `--pf-bg`, about 14% accent, no gradient). Either way the 88px image overlaps its lower edge, with name 28–30px/600 and headline left-aligned below |
| 2 | Intro | Body text |
| 3 | Primary | Filled primary + outline secondaries |
| 4 | Featured | One emphasized item on `--pf-surface` with hairline border: project (title 20px, description, "View project") or the featured link (icon, label, URL host) |
| 5 | Work | Remaining projects as bordered items; 2 columns at ≥768px |
| 6 | Links | Rows as in Classic |
| 7 | Socials | Icon row |
| 8 | About | Paragraphs |
| 9 | Contact | Labelled rows |
| 10 | Forms | Restyled public form |

With no work and no `link`-category links, Showcase is a clean left-aligned profile with the cover band. The layout picker describes it as "Best when you have projects or links to feature" without blocking it.

Desktop: centred column max ~560px. Work grid as above.

**Cover image ([0015](../decisions/0015-showcase-cover-image.md)):**
- **Markup.** The cover replaces only the band element. The overlap, identity block and every later group are unchanged. It is a plain `<img>` inside a decorative wrapper (`aria-hidden="true"`, `alt=""`), because no information depends on it and no text sits on it.
- **Frame.** The wrapper keeps the band's bleed and uses `aspect-ratio: 3 / 1`, so it is about 125px tall at 375px width and grows to about 197px at the desktop column. The image fills it with `object-fit: cover`; since the stored crop is already 3:1, nothing stretches.
- **Loading.** The wrapper's background is the band colour, so a slow load looks like the fallback.
- **Delivery.** A `srcSet` of three fixed widths (640, 1080, 1600) built from `c_crop`, then `c_limit`, `f_auto` and `q_auto`. `c_limit` never upscales. The image is above the fold, so it loads eagerly with `fetchPriority="high"`. `width` and `height` attributes prevent layout shift.
- **Colour modes.** Light and Dark render the same cover. The photo keeps its `--pf-bg` ring over the cover in both modes.
- **Fallback.** With no cover the band renders exactly as approved in T7.

## 8. Guided setup

### 8.1 Where it sits

Activation stays first. Ownership must exist before a Profile can be routed to a card.

```
/activate → enter code → sign in (Google or email code) → Add to my account (claim)
  → /app/setup/{cardId}   (claim now redirects here instead of /app?added=1)
```

The dashboard's "Set up this Neffi" and Card detail links stay as resume entry points. Activation's `already_yours` outcome still goes to `/app`.

**Existing-profile branch (kept).** If the Account already owns Profiles, setup first offers "Show one of your profiles on this card" (connect and finish) or "Create a new profile", which enters the steps below. This is today's behavior, restyled.

### 8.2 Steps

Route: `/app/setup/[cardId]?step=<id>`. The route name and query pattern are retained from today; the implementer may adopt a nested segment only if the Next.js 16 guide requires it, without changing semantics. Setup uses the `/app` setup chrome (`SetupHeader`, bottom nav hidden). The header shows Back, quiet text progress ("2 of 7"; no bar, no dots) and, from step 3, a Preview button on mobile.

| # | Step id | Screen title | Content | Required | Persists on Continue |
|---|---|---|---|---|---|
| 1 | `goal` | Let's set up your Neffi | Intro line, then "What will you use Neffi for?" with five full-width choice rows (four Goals + Not sure yet) | Choice required; "Not sure yet" is valid | Nothing. Carried as `?goal=` |
| 2 | `you` | Let's start with you | Full name*, Headline, Company, City / municipality (existing combobox), Short intro (counter /300) | Full name | **Creates the Draft Profile** (§8.3) |
| 3 | `photo` | Add a photo or logo | Existing upload; "This is a logo" switch; guidance: "A clear photo of your face, or your logo. JPG, PNG, WebP or HEIC, up to 5 MB." Preview of the crop | Optional (Skip for now) | Image + logo flag (existing actions) |
| 4 | `contact` | How can people reach you? | Mobile number (+63 control), Public email (pre-filled with the sign-in email, helper "Shown on your profile. Clear it to keep your sign-in email private."), Website; Save contact switch (on), helper "Visitors can save your details to their phone." | At least one of mobile, email or website | Identity contact fields + Contact Block upsert |
| 5 | `links` | What should people find? | Four collapsed categories: Social, Professional, Messaging & community, Other links & actions. Registry-backed choices use Goal ranking within each category and open an inline add/edit form; Added links lists saved items with Edit/Remove | Optional (Skip for now) | Each item saved immediately via existing Block services |
| 6 | `look` | Choose how your profile looks | Classic, Editorial, Showcase, each with a live mini-render of the customer's own profile and a one-line description; "Recommended" badge on the Goal's layout | Pre-selected with the recommendation | `layout` |
| 7 | `style` | Make it yours | Colours: Light / Dark (segmented control). Accent: 8 swatches with names. Preview-first | Pre-selected Light + Ink | `color_mode`, `accent_color` |
| — | `review` | Review your Neffi | Product-card illustration and truthful pre-publish copy; real profile preview; publish gaps with Fix links; Your setup rows with derived summaries and Change links; primary **Publish** | Publish gaps must be empty to publish | Publish |
| — | `done` | Your Neffi is live | "Tap your card on your phone to try it." Buttons: View your page (`/c/{token}`, new tab), Customize more (Profile hub), Go to Home | — | — |

Layout descriptions: Classic: "Centred and simple. Works for anyone." Editorial: "Type-led and polished. Great for leading with your details." Showcase: "Puts your work and links up front."

Step rules:
- **One decision per screen.** Each screen asks one question with one form group. Choice lists stay short and fixed: Goal 5 rows, layouts 3, accents 8 named swatches, Links has four initially collapsed categories with registry-derived choices.
- Labels are persistent; optional fields show a quiet "Optional"; examples are placeholders, never pre-filled values (except the sign-in email, labelled as above).
- Validation runs on Continue and on blur of an already-errored field, never while typing. Errors sit below the field, say how to fix it ("Enter a mobile number like 912 345 6789"), and focus moves to the first invalid field.
- Mobile keyboard: correct `inputmode`/`autocomplete` (existing Details editor values); Continue stays in normal flow, not pinned over the keyboard; the active field is scrolled into view.
- Back always returns to the previous step id, re-rendered from the server, so saved data is preserved. Unsaved edits on the current step trigger the existing "Discard changes?" confirmation (unsaved-navigation pattern, also on `beforeunload`).
- Skip for now = go to the next step without writing.
- **No cover step.** Setup never asks for a Showcase cover. A new Profile has no cover, so Showcase previews and publishes with the accent band. The cover is added later in Appearance (§10), reached from Done → Customize more.

### 8.3 Profile creation

At `you` → Continue, a new domain function `createProfileFromSetup(accountId, cardId, goal | null, identity)` runs in one transaction with the existing lock order (Account, then Card) and checks:
- creates the Profile (`status = draft`, identity, `goal`, `layout` = the Goal's recommended layout, `color_mode = light`, `accent_color = NULL`);
- creates the Default Profile mode named per §5;
- creates **no** starter Blocks;
- routes the Card (`cards.profile_id`) and records `card_profile_changed`;
- is idempotent per card: if the Card already routes to a Profile, it returns that Profile unchanged (existing `createProfileFromStarter` behavior);
- enforces the 10-Profile limit with the existing message.

Revisiting earlier steps after the Profile exists: `you` → Continue calls `updateIdentity`, and `goal` → Continue updates only `profiles.goal`. A changed Goal never overwrites a layout the customer may have chosen; it only changes the look step's Recommended badge and the links step's suggestion order.

Later steps use existing services (`updateIdentity`, Block add/remove, image actions) plus an appearance service that validates layout/mode/accent and bumps `content_version`. The contact step upserts exactly one Contact Block in the Default mode (update `saveContact` if one exists, else add).

### 8.4 Live preview

The customer should always feel they are building their profile, not filling in settings.

| Viewport | Steps 1–2 | Steps 3–5 | Steps 6–7 | Review |
|---|---|---|---|---|
| Phone / tablet (<1024px) | Form only | Form + header **Preview** button opening a full-screen dialog | Preview first: bounded scrolling real-renderer frame, choices below | Card illustration, bounded inline scrolling preview (max 22rem), setup summaries and Publish; no preview dialog |
| Desktop (≥1024px) | Step 1 single column; from step 2, form left (max ~480px) + sticky preview right | Same | Choices left, sticky bounded scrolling preview right | Card illustration, summaries and Publish left; sticky real preview right |

- The preview is the real `ProfileRenderer` inside a 390px-wide preview shell (24px radius, hairline border). It is never a separate mock.
- Data: the server passes the saved owner view. A pure client function overlays the current step's unsaved fields (identity, contact, layout, mode, accent). Before the Profile exists (step 2) the overlay builds from the draft alone. No client-side Zod, database or server-only imports ([client import graph test](../../src/app/client-import-graph.test.ts)).
- The look choices and preview use the same renderer; preview containers are inert where controls are duplicated.
- Preview never accepts input. It is `aria-hidden` only where duplicated by the form, and the full-screen preview dialog is a named dialog with Close.

## 9. Save, publish and resume

| Question | Rule |
|---|---|
| When is data persisted? | On each step's Continue, and immediately for Link/Content/Action items added in `links` and for image upload. Steps 1 and Skip write nothing |
| Autosave? | No. Explicit Continue in setup; explicit Save in the editor (existing) |
| Draft state | The Profile is Draft from step 2 until Publish. Draft is never public: visitors see the generic unavailable page, and the owner sees "Manage this card" (existing) |
| What "Publish" means | Existing `publishProfile`: gaps must be empty, status becomes Published, and the Card's next tap shows the Profile |
| Is a profile public right after activation? | No. Claim creates no Profile; setup creates a Draft |
| After publishing | Every editor save is live immediately (no unpublished-changes layer in V1). Unpublish/republish stays on the Profile hub |
| Abandoned before step 2 | Only the claim exists. `/app` keeps "Set up this Neffi"; resume starts at `goal` |
| Abandoned after step 2 | `/app/setup/{cardId}` with no `step` resumes at the **earliest incomplete required step**, derived from persisted data: publish gap `name` → `you`; gap `contact` or `content` → `contact` (that step creates the Contact Block); no gaps → `review`. Optional steps are never resume targets; Review lists them. Persisted layout/mode/accent defaults satisfy Look/Colours. No `onboarding_step` or other step column is stored |
| Explicit `?step=` | Honoured whenever its prerequisite exists: `goal` and `you` always; `photo` through `review` need the Profile, otherwise redirect to `goal`; `done` needs a Published Profile, otherwise redirect to the derived resume step. Unknown values are treated as no `step` |
| Card routes to a Published Profile | Setup redirects to the Profile hub (existing) |
| Browser refresh | The URL keeps the step; saved data reloads; unsaved current-step input is protected by the `beforeunload` guard |
| Skippable | `goal` (Not sure yet), `photo`, `links`, `look` (keeps recommendation), `style` (keeps Light + Ink) |
| Not skippable | `you` (name), `contact` (≥1 method) |
| Second card, existing profiles | Chooser branch (§8.1); connecting a Published Profile finishes setup immediately |

The dashboard's draft prompt ("Preview and publish") links to `/app/setup/{cardId}` when a Card routes to the Draft Profile, and otherwise to the existing `/app/profiles/{id}/publish`. `/publish` stays as the fallback for Draft Profiles without a Card and uses the new renderer.

## 10. Editing after setup

The same mental model, the same components.

| Hub area | Route | Contains |
|---|---|---|
| **Your details** | `/app/profiles/[id]/identity` | Name, headline, company, location, short intro, mobile, public email, website, **photo/logo** |
| **Profile mode** | `/app/profiles/[id]/scenes/[sceneId]` | Socials & links, Content, Actions (existing [mode editor](profile-mode-editor.md)) |
| **Appearance** | `/app/profiles/[id]/appearance` | Layout, Colours (Light/Dark), Accent and, while Showcase is selected, Cover image (optional); preview-first |
| Preview | `/app/profiles/[id]/preview` | `ProfileRenderer`, per Profile mode (existing tabs) |

- Photo/logo is identity. The upload and logo control move from Appearance into Your details, reusing `image-upload.tsx`. If that split proves disproportionate in its task, the current location is recorded as transitional debt and this canonical IA stays unchanged.
- Appearance reuses the setup `LayoutPicker`, `ModeToggle` and `AccentPicker` (one implementation). It presents Classic / Editorial / Showcase plainly, with **no Recommended badge** and no Goal reference.
- Saving Appearance is explicit (Save changes + toast), like Your details. Selections preview instantly before saving.
- **Cover image** ([0015](../decisions/0015-showcase-cover-image.md); task T8c):
  - **Visibility.** The section shows only while Showcase is selected in the form. A stored cover stays dormant under Classic or Editorial and reappears when Showcase is selected again.
  - **Copy direction** (not locked): "Cover image · Optional. Shown at the top of the Showcase layout. If you leave it empty, your accent colour is used." Show "JPG, PNG, WebP or HEIC · Max 5 MB · At least 600 pixels wide" before the file is chosen.
  - **Upload.** Add cover → file picker → signed upload to Cloudinary → crop dialog → **Save cover**. The dialog has a 3:1 frame, drag to reposition, a labelled zoom slider and arrow-key nudging. It opens on the centred largest 3:1 crop. Zoom stops when the crop reaches 600 source pixels. Save cover verifies the upload, validates the crop and stores everything in one transaction.
  - **Cancel.** Cancelling the dialog stores nothing and deletes that upload.
  - **Replace.** The same flow as Upload. The previous cover stays live until the new one is saved, then its asset is deleted.
  - **Reposition.** Reopens the dialog on the stored crop and saves only the crop. No re-upload.
  - **Remove.** Clears the cover. Showcase immediately returns to the accent band in the preview and on the live page.
  - **Save semantics.** Cover actions save from the cover dialog, independently of Save changes, exactly as the photo upload does today. The copy makes this clear.
  - **Errors.** Type or size ("Use a JPG, PNG, WebP or HEIC image up to 5 MB."), too small ("Use an image at least 600 pixels wide."), and a failed upload or save. On failure the previous cover is kept. Errors are announced and focused as in the photo control.
- The mode editor is unchanged except copy: its sections now match public grouping, so the caveat that public order can interleave types is removed.
- Not added: drag-and-drop, per-mode appearance, fonts, custom colours, design-builder controls.

## 11. Migration and backward compatibility

One forward migration (task T2):

1. Create enums `profile_layout` (`classic`, `editorial`, `showcase`), `profile_color_mode` (`light`, `dark`), `profile_goal` (`networking`, `freelance`, `business`, `student`).
2. Add `profiles.layout profile_layout NOT NULL DEFAULT 'classic'`, `profiles.color_mode profile_color_mode NOT NULL DEFAULT 'light'`, `profiles.goal profile_goal NULL`.
3. Pre-check in the migration: a `DO` block raises if any `profiles.theme <> 'default'`, so the migration fails closed instead of losing information. Then drop `profiles.theme`.

Existing Profiles after migration: Classic, Light, accent unchanged (NULL → Ink, off-palette → Ink at render), Goal NULL, status, URLs, Cards, Scenes, Blocks, Forms and submissions untouched. No customer redoes setup. The first deploy of the new renderer changes how every existing Profile looks (Classic) without changing content; the bio dedupe rule (§6.3) prevents duplicated intro text from earlier starters. Seed data moves to curated accents and covers all three layouts and both modes; the ERD is regenerated with `pnpm db:erd`.

**Cover migration (task T8a, [0015](../decisions/0015-showcase-cover-image.md)).** A second forward, additive migration adds the six nullable `cover_*` columns and their CHECKs (§4). It has no defaults, no backfill and no drops. Every existing Profile has no cover and renders the accent band, which is valid by construction.

Applying either migration to the shared `neffi-dev` database is a separate, explicit maintainer decision ([operations](../operations.md)). Production uses the separate `neffi-production` project; its initial migration evidence is [recorded separately](../verification/2026-10-23-production-readiness.md). Do not infer permission to migrate either live environment from this spec.

## 12. Accessibility

- Plain-language labels; required vs optional always visible; no jargon (never Scene, Block, Theme, token, NFC in setup copy).
- 44px minimum targets (48px primary). Keyboard: every choice row and swatch is a real button or radio; layout and accent pickers are radio groups with arrow-key support (native radios styled), visible focus.
- Accent swatches carry names ("Teal") and a selected state not conveyed by colour alone (check mark + `aria-checked`).
- Contrast guaranteed by §6.4 tests in both modes; muted text ≥4.5:1.
- Step changes move focus to the new step heading; errors are linked by `aria-describedby` and announced; a polite live region announces saves.
- Reduced motion honoured; nothing depends on animation or hover.
- Image upload: accepted types and size stated before choosing; failures explained ("This file is larger than 5 MB").
- Showcase cover: decorative on the public page (`alt=""`, wrapper `aria-hidden`), with no text over it. The crop dialog is a named dialog. Repositioning works by keyboard (arrow keys) as well as by pointer, and zoom is a labelled native range input.
- Public pages: one `h1` (name), group headings as `h2` where shown, link names include the platform, `lang` from the root layout.

## 13. Acceptance gates (for the implementation tasks)

| Area | Evidence |
|---|---|
| Schema | Migration applies on PGlite from 0000; defaults on existing rows; `theme` pre-check refuses non-default data; enums match the domain lists |
| Contract | `profileSections` unit tests: every visible item placed exactly once per layout; stored order within groups; primary/featured/contact/intro-dedupe rules; empty groups absent |
| Link kinds | Registry covers all 22 kinds with category and icon; fixture with every kind renders in all three layouts |
| Colour | Contrast test for 8 accents × 2 modes; off-palette and NULL → Ink |
| Layouts | Server-render tests per layout for full, minimal (name + one contact) and long-text fixtures; no horizontal-overflow-prone fixed widths; owner bar outside the layout |
| Public compatibility | `/c/{token}` availability, caching key, vCard, form submission and owner links unchanged; appearance changes bump `content_version` |
| Setup | Step routing; profile creation idempotent; resume derivation table (§9) tested exhaustively; existing-profile branch; claim redirect; Back preserves data; Skip writes nothing; contact upsert creates exactly one Contact Block |
| Editor | Appearance saves layout/mode/accent with no recommendation badge; photo/logo in Your details |
| Cover storage | Cover migration applies; existing rows have no cover; each CHECK rejects a partial group, an out-of-bounds crop and a crop narrower than 600px; changing layout never touches the cover |
| Cover upload | Cover ids are profile-scoped and disjoint from photo ids, and each is rejected where the other is expected. Signed-out, unowned and foreign ids are refused. Invalid media is deleted. Replace deletes the old asset only after the commit. Remove clears all six columns. Cancel never deletes the current cover. Profile deletion cleans up both images. Confirm, re-crop and remove each bump `content_version` |
| Cover rendering | Showcase with a cover renders a decorative `img` with `srcSet` and no band; without a cover it renders the band; Classic and Editorial render no cover from the same view |
| Cover editor | Section visible only with Showcase selected; upload, cancel, replace, reposition and remove flows; error states; keyboard crop; touch targets |
| Boundaries | `client-import-graph`, `server-only-boundary`, `access-sweep` and touch-target tests pass unchanged |
| Manual (browser-only) | 320/390px phones and one desktop per layout in both modes; Showcase with and without a cover at the same widths, plus cover crop dragging on a real touch screen; software keyboard on setup forms; one real tap of a published card |

## 14. Non-goals (V1)

Multi-profile per Card, per-Card or per-mode appearance, custom HEX, font choice, project images, drag-and-drop, Goal editing after setup, analytics, lead-capture beyond existing Forms/Inbox, new block types or link kinds, unpublished-changes drafts, visitor-controlled dark mode, changing Home/Product marketing pages, a cover step in setup, covers in Classic or Editorial, per-mode covers, background images or any other custom backgrounds ([0015](../decisions/0015-showcase-cover-image.md)).

## 15. Extension points (not built)

- **New layout:** add an enum value, a layout component and a picker entry; content is untouched.
- **Custom colour:** extend `profileTheme` with contrast adjustment; the hex column already exists.
- **Per-mode appearance or Work/Personal/Event looks:** a new decision amending [0003](../decisions/0003-profile-scene-model.md) and an additive column on `scenes`.
- **Analytics or lead capture:** `ProfileRenderer` and the existing form endpoint are the single entry points.
- **Editable Goal:** an identity setting plus reinstating recommendations outside setup.
