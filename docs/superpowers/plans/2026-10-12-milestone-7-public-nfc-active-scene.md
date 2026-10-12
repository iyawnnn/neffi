# Milestone 7 — Public NFC / Active Scene Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax. The plan is executor-independent: any capable agent or human must be able to execute it from repository state alone.

**Goal:** the permanent `/c/{token}` URL (NFC chip and digital Sharing QR) becomes the real visitor-facing Neffi:
- a fresh Card-state check on every request;
- then connected Profile → active Scene → Default Scene fallback → ordered visible Blocks;
- working visitor actions: Save Contact, call/email/links, booking and the native Form;
- one privacy-safe unavailable state;
- small owner-only shortcuts;
- a version-keyed public Scene cache.

**Architecture:** the public path has two layers.
1. **Fresh layer (never cached):** `resolveCard` runs one indexed `cards ⟕ profiles` lookup on the unique public token. It returns either "unavailable" or `(profileId, sceneId = coalesce(active, default), contentVersion)`.
2. **Cached layer:** `cachedSceneView` is a `"use cache"` function keyed by `(profileId, sceneId, contentVersion)`. It reuses the M6 `buildSceneView` mapping through a new `loadPublicSceneView`.

Every M6 mutation that changes what a visitor could see calls `bumpProfileContentVersion(tx, profileId)` inside its transaction, so an edit can never hit a stale entry on any instance. The page renders through the existing `SceneViewPreview` component, extended with a visitor mode (interactive Form plus Save Contact link). The Form posts to the existing M6 Route Handler.

**Tech stack:**
- Next.js 16.4 with `cacheComponents`: `"use cache"`, `cacheLife`, `connection()`, `notFound()`, Route Handlers.
- React 19.3, Drizzle 0.45 with PostgreSQL, Zod 4.
- vitest 5 with PGlite, using `renderToStaticMarkup` for component tests.
- No new dependencies.

**Spec (source of truth):** the Notion "Neffi — Business Hub", read 2026-10-12 and not modified:
- Step 7 (Rendering/Caching, Action-First Public Resolution);
- Step 8 (M7 contract plus the Oct 10 revision);
- Step 9 (M7 planning boundaries, including the themes caution);
- Mobile-First Design System (Warm Precision);
- Page Inventory §6.

Precedence: Locked Plan → Step 7 → Step 8 → Step 9 → supporting pages. The user's M7 planning brief and the 2026-10-12 decisions (§2, D1/D2) are newer direct instructions.

**Predecessor:** M6 plan `docs/superpowers/plans/2026-10-11-milestone-6-customer-mobile-experience.md`, merged as PR #6.

**Baseline:** `main` @ `f9a121f07b4c07617d8e0b07902cd7c50b13c5fa` (M6 feature HEAD `8fe36d0` contained). Statuses:
- M4: software gate passed, physical acceptance pending.
- M5: software gate passed, physical acceptance pending.
- M6: software gate passed.

**Hardware (updated 2026-10-12):** the physical NFC cards have arrived.
- Before M7 Task 1, in this order and against current `main`:
  1. the outstanding M4 physical acceptance;
  2. then the M5 packaged-card physical acceptance.

  That work belongs to M4 and M5; it is not part of this plan and does not change their milestone ownership.
- M7 progression:
  1. Tasks 1–15 → **"M7 software gate passed — physical NFC acceptance pending"**;
  2. Task 16 (required physical NFC acceptance) → only after it passes may M7 be marked **complete**.

---

## Execution & resumption protocol (read before every session)

1. **Canonical plan:** this file, on branch `feat/m7-public-experience`.
   - **Precondition (executor, only after the user confirms that the M4, then M5, physical acceptance on `main` is done):**
     - The planner has saved this plan at its canonical path, but has not created the branch or committed it.
     - Create `feat/m7-public-experience` from the then-current `main`.
     - If the plan is not yet committed, commit it there first as `docs(m7): add public NFC active scene implementation plan`.
     - If `main` has moved past `f9a121f`, record the new base SHA in the ledger. Stop if any change touches the files this plan modifies.
   - Executors then start at Task 1.
   - There are 16 tasks. Every code task ends in exactly one commit with the message given in that task. Tasks 14–16 are verification-only, and Task 16 is required.
2. **Handoff state:** git history plus the local ledger `.superpowers/sdd/2026-10-12-milestone-7-public-nfc-active-scene/progress.md`.
   - The ledger is git-ignored through `.git/info/exclude`. Add the line `.superpowers/sdd/2026-10-12-milestone-7-public-nfc-active-scene/` there if missing.
   - Never `git add -f` the ledger, and never make ledger-only commits.
3. **Before any work:**
   - `git switch feat/m7-public-experience`
   - `git status --short` must be clean.
   - `git log --oneline main..HEAD`
   - Read the whole ledger.
4. **Next task:** the lowest-numbered task without `Status: complete`.
   - **Recovery:** if `git log` shows a task's exact commit message but the ledger has no entry, re-run that task's verification and record `Status: complete (recovered)`.
5. **Ledger entry,** appended after each commit and never committed:
   ```
   ## Task N — <title>
   - Status: complete
   - Commit: <full SHA | "none (verification only)">
   - Executor: <agent/human>
   - Checks: <command> → <pass/fail + counts>
   - Result: <one line>
   - Rulings: <none | decision + who approved>
   ```
   If the ledger is missing at Task 1, create it with the header `# SDD ledger — plan: docs/superpowers/plans/2026-10-12-milestone-7-public-nfc-active-scene.md` and `Plan commit: <SHA>`.
6. **Stop for the user:**
   - Task 14 needs a real browser, a phone, the user's inbox and the user's account.
   - Task 16 needs the physical NFC cards and real phones.
   - Anything touching Neon, Vercel, Cloudinary settings, Resend, Notion or Production.
   - Applying migration 0011 to `neffi-dev`.
   - Any push or PR.
   - Any deviation from this plan.
7. **Never record secrets:** no activation codes, OTPs, cookies, session tokens, API secrets or database URLs with passwords.
8. **Change control:** if code or Notion contradicts this plan, stop, log it under `Blocked` in the ledger, and ask.

### Binding lessons from M5/M6

- **Windows paths with `( )` or `[ ]`:** the pnpm shim drops quoting. Run path-specific tests as `node node_modules/vitest/vitest.mjs run "<path>"`, and package scripts as `corepack pnpm <script>`.
- **Request-time reads under `cacheComponents`:** a page or GET handler that reads the database at request time calls `await connection()` first (as `src/app/api/health/route.ts` does) and exports `instant = false` (as every `/app` page does). Never read the clock during render.
- **Touch targets ≥ 44px:** `h-11`, `min-h-11` or larger on every control. The guard in `src/app/(customer)/touch-targets.test.ts` is extended to `/c` (Task 11).
- **Customer and visitor copy never says:** token, resolver, record, ID, HMAC, OAuth, API, JSON, credential, Draft, Unpublished, disabled, claimed, activation.

---

## 1. Repository findings (main @ f9a121f, inspected 2026-10-12)

| Area | Fact | M7 consequence |
|---|---|---|
| Route | There is no `/c` route. `(public)` holds `page.tsx`, `activate/` and `sign-in/` and has no layout or nav. | New `src/app/(public)/c/[token]/…`. The root layout only. |
| Cards schema | `cards.public_token` is unique (`cards_public_token_unique`, so it has an index). Columns: `kind`, `state` (`blank/ready/reserved/released/retired`), `owner_account_id`, `profile_id`, `disabled_at`. Owner is only possible when `released`/`retired`. A retired card routes nowhere. `cards_profile_owner_fk` keeps owner = profile owner. | A single-statement indexed resolver. "Published" requires `kind='dbc' ∧ state='released' ∧ owner ∧ ¬disabled ∧ profile ∧ status='published'`. |
| Profile/Scene | `profiles.default_scene_id`/`active_scene_id` have composite FKs to the Profile's own scenes. `deleteScene` nulls `active` before deleting. The CHECK requires a Default Scene when Published. | The fallback `coalesce(active, default)` already exists. The loader still falls back defensively when the scene row is missing, and treats "no scene at all" as unavailable. |
| Renderer | `buildSceneView` (pure, `src/modules/profiles/scene-view.ts`) and `SceneViewPreview` (`src/components/scene-view.tsx`; inert form, disabled "Save contact"). `loadOwnerSceneView` (`src/modules/profiles/view.ts`) filters by `account_id`. | Reuse both. Add `loadPublicSceneView` sharing the loader internals. Add a visitor mode to the component. No second renderer. |
| Forms | `POST /api/forms/[formId]/submissions`: Origin must equal `authBaseUrl` origin, 16 KB byte cap, 10/IP/10 min, honeypot `website`, idempotent `key`. `submitForm` rechecks eligibility at insert time; notification runs in `after()`. | Reused unchanged except the Origin allow-list (D7). M7 builds only the visitor UI. |
| Caching | `next.config.ts` has `cacheComponents: true`. The repo has no `"use cache"`, `cacheTag`, `updateTag` or `revalidateTag`. Bundled docs (`node_modules/next/dist/docs/01-app/02-guides/how-revalidation-works.md` § Multi-Instance; `cacheHandlers.md`) say the default `use cache` store is per-process memory, and tag invalidation is local to the instance that runs it. | D1: a version-keyed cache with no tag invalidation. |
| Mutation points | Every M6 Profile/Scene/Block/Form mutation is in `src/modules/profiles/{profiles,scenes,blocks}.ts` or `src/modules/forms/forms.ts`. All of them start with `lockOwnedProfile`, which is also used by `connectCardToProfile` and has early-return no-op paths. `profiles.updated_at` is read nowhere. | D1 refinement (user): an explicit `bumpProfileContentVersion` in content-changing transactions only. |
| Media | `imageUrl(cloud, id, isLogo)` gives fixed `c_fill,g_face` / `c_fit` 256px transformations with `f_auto,q_auto`. It is a direct Cloudinary CDN URL rendered as a plain `<img>` (no Next image proxy). The secret is server-only. `check:bundle` scans for it. | Reused as is. The logo vs photo behaviour is preserved. Nothing new. |
| URLs | `normalizeLink` stores https only. Block content is validated by strict Zod on write. | Render-time https re-check as defence in depth (Task 1). |
| Auth | `getViewer()` (memoized, no refresh) and `ownsAccountResource(viewer, ownerAccountId)`. | Owner shortcuts are decided server-side (Task 12). |
| SEO | `/app`, `/admin`, `/activate` and `/sign-in` set `robots: { index:false, follow:false }`. There is no Open Graph anywhere. | `/c` sets the same. `notFound()` also injects noindex. |
| Design | `globals.css` is stock shadcn neutral and the font is Geist. The locked Warm Precision tokens (Paper `#F2F0EA`, Ink `#0C0C0D`, Muted Ink `#74736F`, border `#D8D5CE`, raised `#F8F7F3`) and the PP Neue Montreal font are not in the repo. | M7 applies Paper/Ink/Muted/border tokens to the public surface only. The font and global token migration are out of scope (R3). |
| Theme | `profiles.theme` exists and defaults to `'default'`, with one implemented theme. Step 9 explicitly says "do not assume three theme implementations are an M7 gate". | One excellent public system. Minimal/Professional/Creator is not an M7 gate (R4). |
| Seed/dev | Loopback acceptance pattern: `scripts/dev-activation-fixture.mts` (migrates and creates claimable cards); cluster `127.0.0.1:55432`. | Task 14 reuses it. No new tooling. |
| Housekeeping (not M7) | `.superpowers/sdd/2026-10-10-milestone-4-physical-card-provisioning/progress.md` is tracked in git, contrary to the ledger rule. | Reported only; not changed in M7. |

## 2. Decisions

| ID | Decision |
|---|---|
| **D1** (user-approved 2026-10-12) | **Version-keyed public Scene cache.**<br>- Additive migration `0011` adds `profiles.content_version integer NOT NULL DEFAULT 0`.<br>- `cachedSceneView({ profileId, sceneId, version })` is `"use cache"` with `cacheLife("max")`. The version is part of the key and is read fresh with the Card on every request.<br>- **Bumps (explicit helper, user refinement):** `bumpProfileContentVersion(tx, profileId)` runs after the successful write in:<br>&nbsp;&nbsp;• `updateIdentity`, `updateAppearance`;<br>&nbsp;&nbsp;• `setProfileImage` (only when the asset changes);<br>&nbsp;&nbsp;• `renameScene`;<br>&nbsp;&nbsp;• `showScene` (only when the shown scene changes);<br>&nbsp;&nbsp;• `deleteScene` (only when it deletes the shown scene);<br>&nbsp;&nbsp;• `addBlock`, `updateBlock`, `moveBlock` (only when moved), `setBlockVisible`, `deleteBlock`;<br>&nbsp;&nbsp;• `updateForm`.<br>- **No bump:** `lockOwnedProfile` itself, `publishProfile`/`unpublishProfile` (status is read fresh), `createScene` (a new scene is not shown until `showScene`), deleting a non-shown scene, `createProfileFromStarter`, `deleteProfile`, `connectCardToProfile`, `setCardDisabled`, and every early-return no-op. Card state and Card→Profile routing are fresh resolver concerns.<br>- No `cacheTag`/`updateTag`/`revalidateTag`. |
| **D2** (user-approved 2026-10-12) | **One unavailable state.** Invalid or malformed token, unknown token, blank/ready/retired, unclaimed, disabled, no Profile, Draft, Unpublished, and a missing scene all give the same `notFound()` (404, noindex) with the same generic copy. The response never discloses the reason. Only a server-authorized owner of that Card receives the same copy plus a "Manage this card" link (`/app/cards/{cardId}`, status 200). |
| D3 | **Resolver contract:** `resolveCard(db, token): Promise<CardRoute>` is a single query on `cards.public_token` (unique index) left-joined to `profiles`. It is never cached. A token not matching `/^[0-9A-Za-z]{1,64}$/` returns unavailable without querying. There is no case-folding (the NFC URL is exact). There is no redirect: the permanent URL renders in place, so its meaning never changes. |
| D4 | **Public DTO** = the existing `SceneView`: identity, scene, visible ordered blocks, the Form's public field list and the Cloudinary URL. `loadPublicSceneView` selects explicit columns only (the same column list as the owner loader). It contains no Account, Card or owner sign-in data; this is proven by test. `formId` is public by design (it is the submission address). |
| D5 | **Renderer:** `SceneViewPreview` gains an optional `visitorActions: { saveContactHref: string }`.<br>- When present, Forms are interactive (`PublicForm`) and Save Contact is a link.<br>- When absent, the M6 owner preview is unchanged.<br>- `buildSceneView` additionally drops or blanks any non-https stored URL and computes an accessible `onAccent` text colour. |
| D6 | **Save Contact:** `GET /c/{token}/contact` runs the same fresh resolver plus the cached view. It answers only when the shown Scene has a visible Contact block with `saveContact`; otherwise it returns 404.<br>- Body: vCard 3.0 (`FN`, `N`, `ORG`, `TITLE`, `TEL`, `EMAIL`, `URL`) from `view.identity` only. Text values escaped; lines CRLF and folded at 75 octets.<br>- `Content-Type: text/vcard; charset=utf-8`; `Content-Disposition: attachment; filename="<ascii-name>.vcf"` (fallback `contact.vcf`).<br>- `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `X-Content-Type-Options: nosniff`.<br>- No photo, location or Card URL. |
| D7 | **Form Origin allow-list** = `{ new URL(authBaseUrl).origin, new URL(cardUrlOrigin).origin }`. Both configured values are normalized with `new URL(...).origin` before comparison, so neither is assumed to be pre-normalized. They are Neffi's own configured origins, with no wildcard. This lets a Form work when `CARD_URL_ORIGIN` is a separate NFC domain. The domain contract is unchanged. |
| D8 | **Owner shortcuts:** the page calls `getViewer()` and compares with `ownsAccountResource`.<br>- Owner, Published: a bar ("Only you see this") with **Edit** → `/app/profiles/{profileId}/scenes/{sceneId}` and **Switch scene** → `/app/profiles/{profileId}`.<br>- Owner, unavailable: D2's Manage link.<br>- No redirect to `/app`, and no mutation endpoint on the public page; destinations re-authorize. Non-owners and visitors see nothing extra. |
| D9 | **Metadata:** static `{ title: "Neffi", robots: { index: false, follow: false } }`. No Profile data in metadata, no Open Graph, no canonical (not needed for a noindex page). Customer SEO is a future feature (R5). |
| D10 | **No `loading.tsx` under `/c/[token]`:** `notFound()` must run before streaming starts so unavailable answers 404 (docs: `03-file-conventions/not-found.md` "Before streaming starts…"). |
| D11 | **Visual system for the public surface:** the canvas is Paper `#F2F0EA` with Ink text. The column is ≤560px with a 20px gutter. Primary actions (booking, Form send) are ≥48px tall, filled with the Profile accent and `onAccent` text. Secondary links have a 1px border. Muted text is `#74736F`; borders are `#D8D5CE`. No animation is added, so reduced motion is trivially respected. No bottom nav. |
| D12 | **Concurrency:** M7 adds no lock and no multi-statement race.<br>- The read path is one lock-free statement plus the cached load.<br>- Version bumps run inside transactions already holding the Profile row lock (M6 D20), so increments serialize.<br>- Form idempotency and eligibility are unchanged.<br>- The existing `check:profile-concurrency` is re-run at the gate; no new concurrency script is needed. |

## 3. Scope

**In M7:**
- the resolver and safe states;
- the public loader and version cache;
- the renderer visitor mode;
- the interactive Form;
- vCard;
- owner shortcuts;
- noindex/privacy;
- the Origin allow-list;
- migration 0011;
- docs, acceptance and the gate.

**Not in M7 (reviewers reject):**
- customer SEO (index toggles, sitemap, OG, structured data, Search Console);
- three themes or a per-Scene theme;
- a Card→Scene override;
- analytics;
- CRM or integrations;
- Turnstile, CSP or other M10 hardening;
- M8 Orders and M9 Support;
- custom domains;
- printed QR;
- owner MFA;
- global design-token or font migration;
- Redis or any cache handler.

## 4. Interfaces (names used verbatim across tasks)

```ts
// src/modules/profiles/scene-view.ts (Task 1)
export type ViewIdentity = { /* existing fields */ accent: string; onAccent: "#0C0C0D" | "#FFFFFF"; /* … */ };
export function contrast(a: string, b: string): number;          // WCAG ratio of two #rrggbb colours
export function onAccent(accent: string): "#0C0C0D" | "#FFFFFF";

// src/modules/profiles/profiles.ts (Task 2)
export async function bumpProfileContentVersion(tx: Db, profileId: string): Promise<void>;

// src/modules/profiles/view.ts (Task 3)
export async function loadPublicSceneView(db: Db, input: { profileId: string; sceneId: string }): Promise<SceneView | null>;

// src/modules/cards/resolve.ts (Tasks 4–5)
export type CardRoute =
  | { status: "unavailable"; cardId: string | null; ownerAccountId: string | null }
  | { status: "published"; cardId: string; ownerAccountId: string; profileId: string; sceneId: string; version: number };
export type ViewKey = { profileId: string; sceneId: string; version: number };
export type ViewLoader = (key: ViewKey) => Promise<SceneView | null>;
export type PublicExperience =
  | { status: "unavailable"; cardId: string | null; ownerAccountId: string | null }
  | { status: "published"; cardId: string; ownerAccountId: string; profileId: string; view: SceneView };
export async function resolveCard(db: Db, token: string): Promise<CardRoute>;
export async function resolvePublicExperience(db: Db, token: string, loadView: ViewLoader): Promise<PublicExperience>;

// src/components/public-form.tsx (Task 6, "use client")
export type InquiryResult = "sent" | "invalid" | "unavailable" | "busy" | "failed";
export const INQUIRY_MESSAGES: Record<Exclude<InquiryResult, "sent">, string>;
export async function sendInquiry(formId: string, key: string, data: FormData, send?: typeof fetch): Promise<{ result: InquiryResult; fields: string[] }>;
export function PublicForm(props: { formId: string; title: string; fields: ReturnType<typeof visibleFields> }): JSX.Element;

// src/modules/profiles/vcard.ts (Task 8, pure)
export function buildVCard(identity: ViewIdentity): string;
export function vCardFilename(fullName: string): string;

// src/app/(public)/c/[token]/cached-view.ts (Task 11)
export async function cachedSceneView(key: ViewKey): Promise<SceneView | null>;   // "use cache"
```

## Review Focus (failure modes no single task's happy path covers)

1. **A stale cache hides a Card change.** Disable, unpublish or reconnect must take effect on the next request even when the content entry is warm. This is pinned in Task 5 by a memoizing-loader integration test, and in Task 14F by a real `next start`.
2. **Reason leakage.** Every unavailable variant must be visually identical for a visitor, and the owner variant must require server-side ownership. Pinned in Tasks 11/12 page tests and the copy-vocabulary test.
3. **A Form whose eligibility changes after render.** Hide the block or unpublish while the page is open, then submit: the visitor gets a calm message and nothing is stored. Pinned in Task 5 (domain) and Task 6 (UI mapping of 404).
4. **Hostile stored content** (a legacy or hand-edited `javascript:`/`http:` URL, or newlines/`;` in names reaching vCard). Pinned in Tasks 1 and 8.
5. **A missed content bump in a future mutation.** Pinned by the per-function bump/no-op tables in Task 2. The helper's comment states the rule for future mutations.

---

## Task 1: Harden the shared view mapping (https-only links, readable accent text)

**Purpose:** defence in depth for "safe URL schemes only", plus accessible text on accent fills. This is shared by the owner preview and the public page.

**Files:**
- Modify: `src/modules/profiles/scene-view.ts`
- Test: `src/modules/profiles/scene-view.test.ts`
- Modify (fixture type only): `src/components/scene-view.test.tsx`

**Interfaces:**
- Consumes: `ACCENTS` from `./rules`, in the test only.
- Produces: `ViewIdentity.onAccent`, `contrast`, `onAccent`.

- [ ] **Step 1: Write failing tests.** Append to `src/modules/profiles/scene-view.test.ts`:

```ts
import { ACCENTS } from "./rules";
import { contrast, onAccent } from "./scene-view";

test("any stored link that is not https is dropped or blanked", () => {
  const view = buildSceneView({
    ...base(),
    profile: { ...base().profile, website: "http://ana.example/" },
    blocks: [
      block("l", "link", 0, { kind: "custom", label: null, url: "javascript:alert(1)" }),
      block("b", "booking", 1, { label: null, url: "data:text/html,hi" }),
      block("p", "project", 2, { title: "Site", description: null, url: "http://ana.example/" }),
      block("ok", "link", 3, { kind: "github", label: null, url: "https://github.com/ana" }),
    ],
  });
  expect(view.identity.website).toBeNull();
  expect(view.blocks).toEqual([
    { id: "p", type: "project", title: "Site", description: null, url: null },
    { id: "ok", type: "link", kind: "github", label: "GitHub", url: "https://github.com/ana" },
  ]);
});
test.each(ACCENTS.map(a => a.hex))("text on accent %s meets WCAG AA (4.5:1)", hex => {
  expect(contrast(hex, onAccent(hex))).toBeGreaterThanOrEqual(4.5);
});
test("view identity carries the accent text colour, Ink on Vermilion", () => {
  const view = buildSceneView({ ...base(), profile: { ...base().profile, accentColor: "#E64A35" } });
  expect(view.identity.onAccent).toBe("#0C0C0D");
  expect(buildSceneView(base()).identity.onAccent).toBe("#FFFFFF");
});
```

- [ ] **Step 2: Run and see it fail.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles/scene-view.test.ts`. Expected: FAIL (`contrast` is not exported, and javascript/http are kept).
- [ ] **Step 3: Implement** in `src/modules/profiles/scene-view.ts`:
  - Add `onAccent: "#0C0C0D" | "#FFFFFF"` to `ViewIdentity`, after `accent`.
  - Add the helpers above `buildSceneView`:

```ts
// Stored links are validated https on write; this keeps any older or hand-edited row from ever reaching a visitor.
const https = (value: unknown) => {
  if (typeof value !== "string") return null;
  try { return new URL(value).protocol === "https:" ? value : null; } catch { return null; }
};
const channel = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string) => { const [r, g, b] = [1, 3, 5].map(i => channel(parseInt(hex.slice(i, i + 2), 16))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
// Text on an accent fill: white unless Ink reads better (Vermilion, Amber), per the design system's "Ink on Vermilion".
export const onAccent = (accent: string) => (contrast(accent, "#FFFFFF") >= contrast(accent, "#0C0C0D") ? "#FFFFFF" : "#0C0C0D");
```

  Then, in `buildSceneView`:
  - In `identity`, use `website: https(profile.website)` and set `onAccent: onAccent(profile.accentColor ?? "#0C0C0D")`. Compute the accent once and reuse it for both.
  - **project:** `url: https(c.url)`.
  - **link/booking:** compute `const url = https(c.url)`; push only when `url` is non-null, using `url`.
- [ ] **Step 4: Fix the fixture type.** In `src/components/scene-view.test.tsx` `base.identity`, add `onAccent: "#FFFFFF",` after `accent`.
- [ ] **Step 5: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles/scene-view.test.ts src/components/scene-view.test.tsx` → PASS. Then `corepack pnpm typecheck` → PASS.
- [ ] **Step 6: Commit.** `git add src/modules/profiles/scene-view.ts src/modules/profiles/scene-view.test.ts src/components/scene-view.test.tsx && git commit -m "feat(profiles): keep stored links https-only and pick readable accent text"`

**Acceptance:**
- Non-https URLs never reach the view.
- Every ACCENT gets ≥4.5:1 text.
- The M6 tests still pass.

---

## Task 2: Profile content version (migration 0011 + explicit bumps)

**Purpose:** D1. Gives every visitor-visible change a new cache identity, independent of instance memory.

**Files:**
- Modify: `src/db/schema/profiles.ts`
- Create: `drizzle/0011_profile_content_version.sql` and `drizzle/meta/0011_snapshot.json` (both generated), and update `drizzle/meta/_journal.json`
- Regenerate: `docs/database/erd.md`
- Modify:
  - `src/modules/profiles/profiles.ts`
  - `src/modules/profiles/scenes.ts`
  - `src/modules/profiles/blocks.ts`
  - `src/modules/forms/forms.ts`
- Test: create `src/modules/profiles/content-version.db.test.ts`

**Interfaces:**
- Produces: the `profiles.contentVersion` column and `bumpProfileContentVersion(tx, profileId)`.

- [ ] **Step 1: Write the failing test** at `src/modules/profiles/content-version.db.test.ts`:

```ts
import { asc, eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards, formDefinitions, profiles, sceneBlocks } from "@/db/schema";
import { insertAccount, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { connectCardToProfile, setCardDisabled } from "../cards/manage";
import { PRESETS } from "../forms/config";
import { updateForm } from "../forms/forms";
import { addBlock, deleteBlock, moveBlock, setBlockVisible, updateBlock } from "./blocks";
import { createProfileFromStarter, publishProfile, setProfileImage, unpublishProfile, updateAppearance, updateIdentity } from "./profiles";
import { createScene, deleteScene, renameScene, showScene } from "./scenes";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

async function setup(tx: TestTx) {
  const account = await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: account.id }).where(eq(cards.id, card.id));
  const { profileId } = await createProfileFromStarter(tx, { accountId: account.id, cardId: card.id, purpose: "get_clients", essentials: { fullName: "Ana", headline: null, bio: null, email: "ana@e.test", phone: null, link: "https://cal.com/ana" } });
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, profileId));
  const defaultSceneId = profile.defaultSceneId!;
  const blocks = await tx.select().from(sceneBlocks).where(eq(sceneBlocks.sceneId, defaultSceneId)).orderBy(asc(sceneBlocks.position));
  const [form] = await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, profileId));
  const { sceneId: extraSceneId } = await createScene(tx, { accountId: account.id, profileId, name: "Events", copyFromSceneId: null });
  return { accountId: account.id, cardId: card.id, profileId, defaultSceneId, extraSceneId, firstBlockId: blocks[0].id, formId: form.id };
}
type Ctx = Awaited<ReturnType<typeof setup>>;
const version = async (tx: TestTx, profileId: string) => (await tx.select({ v: profiles.contentVersion }).from(profiles).where(eq(profiles.id, profileId)))[0].v;
const own = (c: Ctx) => ({ accountId: c.accountId, profileId: c.profileId });
const identity = { fullName: "Ana B", headline: null, company: null, bio: null, phone: null, email: "ana@e.test", website: null, location: null };

const changes: [string, (tx: TestTx, c: Ctx) => Promise<unknown>][] = [
  ["identity", (tx, c) => updateIdentity(tx, { ...own(c), identity })],
  ["appearance", (tx, c) => updateAppearance(tx, { ...own(c), accentColor: "#1F5FAE", imageIsLogo: true })],
  ["a new image", (tx, c) => setProfileImage(tx, { ...own(c), assetId: `neffi/profiles/${c.profileId}/00000000-0000-4000-8000-000000000000` })],
  ["renaming a scene", (tx, c) => renameScene(tx, { ...own(c), sceneId: c.defaultSceneId, name: "Work" })],
  ["showing another scene", (tx, c) => showScene(tx, { ...own(c), sceneId: c.extraSceneId })],
  ["adding a block", (tx, c) => addBlock(tx, { ...own(c), sceneId: c.defaultSceneId, type: "about", content: { text: "Hi" } })],
  ["editing a block", (tx, c) => updateBlock(tx, { ...own(c), blockId: c.firstBlockId, content: { label: "Book", url: "https://cal.com/ana" } })],
  ["moving a block", (tx, c) => moveBlock(tx, { ...own(c), blockId: c.firstBlockId, direction: "down" })],
  ["hiding a block", (tx, c) => setBlockVisible(tx, { ...own(c), blockId: c.firstBlockId, visible: false })],
  ["deleting a block", (tx, c) => deleteBlock(tx, { ...own(c), blockId: c.firstBlockId })],
  ["form settings", (tx, c) => updateForm(tx, { ...own(c), formId: c.formId, title: "Hello", config: PRESETS.contact.config })],
];
test.each(changes)("%s moves the content version by exactly one", (_name, run) => rollback(db, async tx => {
  const c = await setup(tx);
  const before = await version(tx, c.profileId);
  await run(tx, c);
  expect(await version(tx, c.profileId)).toBe(before + 1);
}));
test("deleting the shown scene moves the version (the Default Scene shows again)", () => rollback(db, async tx => {
  const c = await setup(tx);
  await showScene(tx, { ...own(c), sceneId: c.extraSceneId });
  const before = await version(tx, c.profileId);
  await deleteScene(tx, { ...own(c), sceneId: c.extraSceneId });
  expect(await version(tx, c.profileId)).toBe(before + 1);
}));

const steady: [string, (tx: TestTx, c: Ctx) => Promise<unknown>][] = [
  ["publish and unpublish (status is read fresh)", async (tx, c) => { await publishProfile(tx, own(c)); await unpublishProfile(tx, own(c)); }],
  ["unpublishing a Draft", (tx, c) => unpublishProfile(tx, own(c))],
  ["creating a scene that is not shown", (tx, c) => createScene(tx, { ...own(c), name: "Later", copyFromSceneId: c.defaultSceneId })],
  ["deleting a scene that is not shown", (tx, c) => deleteScene(tx, { ...own(c), sceneId: c.extraSceneId })],
  ["showing the scene already shown", (tx, c) => showScene(tx, { ...own(c), sceneId: c.defaultSceneId })],
  ["moving the first block up", (tx, c) => moveBlock(tx, { ...own(c), blockId: c.firstBlockId, direction: "up" })],
  ["removing an image that is not there", (tx, c) => setProfileImage(tx, { ...own(c), assetId: null })],
  ["connecting a card to the profile it already shows", (tx, c) => connectCardToProfile(tx, { accountId: c.accountId, cardId: c.cardId, profileId: c.profileId })],
  ["turning a card off and on", async (tx, c) => { await setCardDisabled(tx, { accountId: c.accountId, cardId: c.cardId, disabled: true }); await setCardDisabled(tx, { accountId: c.accountId, cardId: c.cardId, disabled: false }); }],
];
test.each(steady)("%s leaves the content version alone", (_name, run) => rollback(db, async tx => {
  const c = await setup(tx);
  const before = await version(tx, c.profileId);
  await run(tx, c);
  expect(await version(tx, c.profileId)).toBe(before);
}));
test("a new profile starts at version 0", () => rollback(db, async tx => {
  expect(await version(tx, (await setup(tx)).profileId)).toBe(0);
}));
```

- [ ] **Step 2: Run and see it fail.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles/content-version.db.test.ts`. Expected: FAIL (`contentVersion` does not exist).
- [ ] **Step 3: Schema.** In `src/db/schema/profiles.ts`, after `imageIsLogo`, add:

```ts
    // Moves on every change a visitor could see (bumpProfileContentVersion); the public Scene cache is keyed by it.
    contentVersion: integer().notNull().default(0),
```

  Run `corepack pnpm db:generate --name profile_content_version`. The expected SQL is exactly `ALTER TABLE "profiles" ADD COLUMN "content_version" integer DEFAULT 0 NOT NULL;`. Prepend one comment line in the 0010 style:

```sql
-- M7: public Scene cache version (additive). Rollback: ALTER TABLE "profiles" DROP COLUMN "content_version".
```

  Then run `corepack pnpm db:erd` to regenerate `docs/database/erd.md`. The table and enum counts are unchanged.
- [ ] **Step 4: Helper** in `src/modules/profiles/profiles.ts` (below `lockOwnedProfile`):

```ts
// Call inside the transaction of every successful change a visitor could see: identity, appearance, image, a Scene's name,
// its Blocks, a Form, or which Scene is shown. The public Scene cache is keyed by this version, so a missed call serves stale
// content. Card state, Card→Profile routing and publish status are read fresh on every tap and need no bump.
export async function bumpProfileContentVersion(tx: Db, profileId: string): Promise<void> {
  await tx.update(schema.profiles).set({ contentVersion: sql`${schema.profiles.contentVersion} + 1` }).where(eq(schema.profiles.id, profileId));
}
```

- [ ] **Step 5: Call sites.** Each call goes inside the existing transaction, after the write:
  - **`profiles.ts`:**
    - `updateIdentity` and `updateAppearance`: after the update, `await bumpProfileContentVersion(tx, p.id);`.
    - `setProfileImage`: wrap the update and the bump in `if (p.imageAssetId !== input.assetId) { … }`.
  - **`scenes.ts`** (import the helper from `./profiles`):
    - `renameScene`: bump after the update.
    - `deleteScene`: inside the existing `if (profile.activeSceneId === input.sceneId)` block, bump after the update.
    - `showScene`: replace the body after `ownedScene` with:

```ts
    const active = input.sceneId === profile.defaultSceneId ? null : input.sceneId;
    if (active === profile.activeSceneId) return;
    await tx.update(schema.profiles).set({ activeSceneId: active }).where(eq(schema.profiles.id, profile.id));
    await bumpProfileContentVersion(tx, profile.id);
```

  - **`blocks.ts`:**
    - `addBlock`: bump before `return { blockId }`.
    - `updateBlock`, `setBlockVisible`, `deleteBlock`: bump last.
    - `moveBlock`: bump after `writeOrder` (the early return already skips no-ops).
  - **`forms.ts`:** `updateForm`, after the `not_found` check: `await bumpProfileContentVersion(tx, input.profileId);`.
- [ ] **Step 6: Verify.**
  - `node node_modules/vitest/vitest.mjs run src/modules/profiles src/modules/forms src/modules/cards src/db/erd.db.test.ts` → PASS.
  - `corepack pnpm db:check` → PASS.
  - `corepack pnpm db:generate` → "No schema changes".
  - `corepack pnpm typecheck` → PASS.
- [ ] **Step 7: Commit.** `git add src/db/schema/profiles.ts drizzle docs/database/erd.md src/modules/profiles/profiles.ts src/modules/profiles/scenes.ts src/modules/profiles/blocks.ts src/modules/forms/forms.ts src/modules/profiles/content-version.db.test.ts && git commit -m "feat(profiles): version public profile content"`

**Acceptance:**
- Each listed change moves the version by exactly 1.
- Each listed no-op or unrelated operation leaves it unchanged.
- No drift; M6 tests pass.

---

## Task 3: Public Scene loader (reuse the M6 loader internals)

**Files:**
- Modify: `src/modules/profiles/view.ts`
- Test: `src/modules/profiles/view.db.test.ts` (append)

**Interfaces:**
- Produces: `loadPublicSceneView(db, { profileId, sceneId })`.

- [ ] **Step 1: Failing tests.** Append to `src/modules/profiles/view.db.test.ts`. Add `loadPublicSceneView` to the `./view` import, and add the `node:crypto`, `accounts` and `createScene` imports:

```ts
import { randomUUID } from "node:crypto";
import { accounts } from "@/db/schema";
import { createScene } from "./scenes";
import { loadPublicSceneView } from "./view";

test("public view shows the requested scene and falls back to the Default Scene", () => rollback(db, async tx => {
  const input = await setup(tx);
  const { sceneId } = await createScene(tx, { ...input, name: "Events", copyFromSceneId: null });
  expect((await loadPublicSceneView(tx, { profileId: input.profileId, sceneId }))?.scene.name).toBe("Events");
  expect((await loadPublicSceneView(tx, { profileId: input.profileId, sceneId: randomUUID() }))?.scene.name).toBe("Clients");
}));
test("public view of a missing profile is null", () => rollback(db, async tx => {
  expect(await loadPublicSceneView(tx, { profileId: randomUUID(), sceneId: randomUUID() })).toBeNull();
}));
test("public view carries no account, card or sign-in data", () => rollback(db, async tx => {
  const input = await setup(tx);
  const [account] = await tx.select().from(accounts).where(eq(accounts.id, input.accountId));
  const [card] = await tx.select().from(cards).where(eq(cards.profileId, input.profileId));
  const json = JSON.stringify(await loadPublicSceneView(tx, { profileId: input.profileId, sceneId: randomUUID() }));
  for (const secret of [input.accountId, input.profileId, account.email, card.id, card.publicToken!]) expect(json).not.toContain(secret);
}));
```

- [ ] **Step 2: Run and see it fail.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles/view.db.test.ts`. Expected: FAIL (no export).
- [ ] **Step 3: Implement.** Refactor `src/modules/profiles/view.ts`. Behaviour of `loadOwnerSceneView` is unchanged.

```ts
import "server-only";
import { and, eq, type SQL } from "drizzle-orm";
import { env } from "@/config/env";
import { imageUrl } from "@/integrations/media/cloudinary";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { buildSceneView } from "./scene-view";

const selectProfile = (db: Db, where: SQL | undefined) => db.select({
  fullName: schema.profiles.fullName, headline: schema.profiles.headline, company: schema.profiles.company,
  bio: schema.profiles.bio, phone: schema.profiles.phone, email: schema.profiles.email,
  website: schema.profiles.website, location: schema.profiles.location, accentColor: schema.profiles.accentColor,
  imageAssetId: schema.profiles.imageAssetId, imageIsLogo: schema.profiles.imageIsLogo, defaultSceneId: schema.profiles.defaultSceneId, activeSceneId: schema.profiles.activeSceneId,
}).from(schema.profiles).where(where);
type ViewProfile = Awaited<ReturnType<typeof selectProfile>>[number];

async function sceneView(db: Db, profileId: string, profile: ViewProfile, sceneId: string | undefined, fallbackSceneId: string | null) {
  const sceneRows = await db.select({ id: schema.scenes.id, name: schema.scenes.name }).from(schema.scenes).where(eq(schema.scenes.profileId, profileId));
  const scene = sceneRows.find(s => s.id === sceneId) ?? sceneRows.find(s => s.id === fallbackSceneId);
  if (!scene) return null;
  const [blocks, forms] = await Promise.all([
    db.select({ id: schema.sceneBlocks.id, type: schema.sceneBlocks.type, position: schema.sceneBlocks.position, visible: schema.sceneBlocks.visible, content: schema.sceneBlocks.content, formId: schema.sceneBlocks.formId }).from(schema.sceneBlocks).where(eq(schema.sceneBlocks.sceneId, scene.id)),
    db.select({ id: schema.formDefinitions.id, title: schema.formDefinitions.title, config: schema.formDefinitions.config }).from(schema.formDefinitions).where(eq(schema.formDefinitions.profileId, profileId)),
  ]);
  return buildSceneView({ profile, imageUrl: profile.imageAssetId ? imageUrl(env.cloudinaryCloudName, profile.imageAssetId, profile.imageIsLogo) : null, scene, blocks, forms });
}

export async function loadOwnerSceneView(db: Db, input: { accountId: string; profileId: string; sceneId?: string }) {
  const [profile] = await selectProfile(db, and(eq(schema.profiles.id, input.profileId), eq(schema.profiles.accountId, input.accountId)));
  return profile ? sceneView(db, input.profileId, profile, input.sceneId, profile.activeSceneId ?? profile.defaultSceneId) : null;
}

// Shared public data only. The caller has already checked, fresh, that a live card shows this Published profile and which
// Scene is shown; a Scene that has since disappeared falls back to the Default Scene.
export async function loadPublicSceneView(db: Db, input: { profileId: string; sceneId: string }) {
  const [profile] = await selectProfile(db, eq(schema.profiles.id, input.profileId));
  return profile ? sceneView(db, input.profileId, profile, input.sceneId, profile.defaultSceneId) : null;
}
```

- [ ] **Step 4: Verify.** `node node_modules/vitest/vitest.mjs run src/modules/profiles/view.db.test.ts "src/app/(customer)/app/profiles/[profileId]/preview/page.test.tsx"` → PASS. Then `corepack pnpm typecheck` → PASS.
- [ ] **Step 5: Commit.** `git add src/modules/profiles/view.ts src/modules/profiles/view.db.test.ts && git commit -m "feat(profiles): load the public scene view"`

---

## Task 4: Fresh Card resolver and the safe-state matrix

**Files:**
- Create: `src/modules/cards/resolve.ts`
- Test: create `src/modules/cards/resolve.db.test.ts`
- Modify: `src/server-only-boundary.test.ts` (add `"src/modules/cards/resolve.ts"`)

**Interfaces:**
- Produces: `CardRoute` and `resolveCard` (§4).

- [ ] **Step 1: Failing tests** at `src/modules/cards/resolve.db.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { cards, profiles } from "@/db/schema";
import { insertAccount, insertClaimedCard, insertProvisioningDbc, insertReadyDbc, insertReleasedDbc } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { createProfileFromStarter, publishProfile, unpublishProfile } from "../profiles/profiles";
import { createScene, showScene } from "../profiles/scenes";
import { retireCard } from "./card";
import { setCardDisabled } from "./manage";
import { resolveCard } from "./resolve";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

async function publishedCard(tx: TestTx, accountId?: string, fullName = "Ana") {
  const owner = accountId ?? (await insertAccount(tx)).id;
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: owner }).where(eq(cards.id, card.id));
  const { profileId } = await createProfileFromStarter(tx, { accountId: owner, cardId: card.id, purpose: "get_clients", essentials: { fullName, headline: "Designer", bio: null, email: "ana@e.test", phone: null, link: "https://cal.com/ana" } });
  await publishProfile(tx, { accountId: owner, profileId });
  const [{ defaultSceneId }] = await tx.select({ defaultSceneId: profiles.defaultSceneId }).from(profiles).where(eq(profiles.id, profileId));
  return { accountId: owner, card: { ...card, ownerAccountId: owner }, profileId, defaultSceneId: defaultSceneId! };
}
const nothing = { status: "unavailable", cardId: null, ownerAccountId: null };

test.each(["", "not a token!", "A".repeat(65), "ZZZZZZZZZZZZZZZZZZZZZZZZZZ"])("unknown or malformed token %j is unavailable", token => rollback(db, async tx => {
  expect(await resolveCard(tx, token)).toEqual(nothing);
}));
test("a Published, enabled, claimed card resolves to its profile's Default Scene", () => rollback(db, async tx => {
  const c = await publishedCard(tx);
  expect(await resolveCard(tx, c.card.publicToken!)).toEqual({ status: "published", cardId: c.card.id, ownerAccountId: c.accountId, profileId: c.profileId, sceneId: c.defaultSceneId, version: 0 });
}));
test("the shown scene wins over the Default Scene", () => rollback(db, async tx => {
  const c = await publishedCard(tx);
  const { sceneId } = await createScene(tx, { accountId: c.accountId, profileId: c.profileId, name: "Events", copyFromSceneId: c.defaultSceneId });
  await showScene(tx, { accountId: c.accountId, profileId: c.profileId, sceneId });
  expect(await resolveCard(tx, c.card.publicToken!)).toMatchObject({ status: "published", sceneId });
}));
test.each([
  ["blank (in provisioning)", async (tx: TestTx) => (await insertProvisioningDbc(tx)).card],
  ["ready (unsold)", async (tx: TestTx) => (await insertReadyDbc(tx)).card],
  ["sold but unclaimed", async (tx: TestTx) => (await insertReleasedDbc(tx)).card],
  ["retired", async (tx: TestTx) => { const { card } = await insertProvisioningDbc(tx); await retireCard(tx, { actorId: (await insertAccount(tx, "owner")).id, cardId: card.id, reason: "test" }); return card; }],
])("an ownerless card that is %s is unavailable", (_name, make) => rollback(db, async tx => {
  const card = await make(tx);
  expect(await resolveCard(tx, card.publicToken!)).toEqual({ status: "unavailable", cardId: card.id, ownerAccountId: null });
}));
test.each([
  ["claimed with no profile", async (tx: TestTx) => { const { card, owner } = await insertClaimedCard(tx); await tx.update(cards).set({ profileId: null }).where(eq(cards.id, card.id)); return { card, accountId: owner.id }; }],
  ["showing a Draft profile", async (tx: TestTx) => { const { card, owner } = await insertClaimedCard(tx); return { card, accountId: owner.id }; }],
  ["turned off", async (tx: TestTx) => { const c = await publishedCard(tx); await setCardDisabled(tx, { accountId: c.accountId, cardId: c.card.id, disabled: true }); return c; }],
  ["showing an Unpublished profile", async (tx: TestTx) => { const c = await publishedCard(tx); await unpublishProfile(tx, { accountId: c.accountId, profileId: c.profileId }); return c; }],
])("an owned card %s is unavailable but keeps its owner for the owner shortcut", (_name, make) => rollback(db, async tx => {
  const { card, accountId } = await make(tx);
  expect(await resolveCard(tx, card.publicToken!)).toEqual({ status: "unavailable", cardId: card.id, ownerAccountId: accountId });
}));
```

- [ ] **Step 2: Run and see it fail.** Run `node node_modules/vitest/vitest.mjs run src/modules/cards/resolve.db.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/modules/cards/resolve.ts`:

```ts
import "server-only";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";

const TOKEN = /^[0-9A-Za-z]{1,64}$/;
export type CardRoute =
  | { status: "unavailable"; cardId: string | null; ownerAccountId: string | null }
  | { status: "published"; cardId: string; ownerAccountId: string; profileId: string; sceneId: string; version: number };

// Fresh on every tap and never cached: one indexed lookup on the unique public token. Every reason a card cannot show a
// profile collapses into "unavailable", so nothing downstream can reveal why. The owner id is kept only for the owner's own
// Manage shortcut, which the page grants after a server-side ownership check.
export async function resolveCard(db: Db, token: string): Promise<CardRoute> {
  if (!TOKEN.test(token)) return { status: "unavailable", cardId: null, ownerAccountId: null };
  const [row] = await db.select({
    cardId: schema.cards.id, kind: schema.cards.kind, state: schema.cards.state, ownerAccountId: schema.cards.ownerAccountId,
    disabledAt: schema.cards.disabledAt, profileId: schema.profiles.id, status: schema.profiles.status,
    sceneId: sql<string | null>`coalesce(${schema.profiles.activeSceneId}, ${schema.profiles.defaultSceneId})`,
    version: schema.profiles.contentVersion,
  }).from(schema.cards).leftJoin(schema.profiles, eq(schema.profiles.id, schema.cards.profileId)).where(eq(schema.cards.publicToken, token));
  if (!row) return { status: "unavailable", cardId: null, ownerAccountId: null };
  const { cardId, ownerAccountId, profileId, sceneId, version } = row;
  if (row.kind !== "dbc" || row.state !== "released" || !ownerAccountId || row.disabledAt || !profileId || row.status !== "published" || !sceneId || version === null) {
    return { status: "unavailable", cardId, ownerAccountId };
  }
  return { status: "published", cardId, ownerAccountId, profileId, sceneId, version };
}
```

  Add `"src/modules/cards/resolve.ts",` to `SERVER_ONLY_ENTRYPOINTS` in `src/server-only-boundary.test.ts`.
- [ ] **Step 4: Verify.** `node node_modules/vitest/vitest.mjs run src/modules/cards/resolve.db.test.ts src/server-only-boundary.test.ts` → PASS. Then `corepack pnpm typecheck` → PASS.
- [ ] **Step 5: Commit.** `git add src/modules/cards/resolve.ts src/modules/cards/resolve.db.test.ts src/server-only-boundary.test.ts && git commit -m "feat(cards): resolve a card's public state fresh on every tap"`

---

## Task 5: Public experience over a version-keyed view cache

**Purpose:** compose the fresh layer with the cached layer, and prove the two-layer invariants with a memoizing loader that stands in for `"use cache"`.

**Files:**
- Modify: `src/modules/cards/resolve.ts`
- Test: `src/modules/cards/resolve.db.test.ts` (append)

**Interfaces:**
- Consumes: `loadPublicSceneView` (Task 3); `resolveCard` (Task 4).
- Produces: `ViewKey`, `ViewLoader`, `PublicExperience` and `resolvePublicExperience` (§4).

- [ ] **Step 1: Failing tests** (append; extend the imports with `asc, and` from drizzle-orm, `sceneBlocks, formDefinitions` from schema, `updateIdentity` from profiles, `setBlockVisible` from blocks, `connectCardToProfile` from `./manage`, `submitForm` from `../forms/submissions`, `loadPublicSceneView` from `../profiles/view`, `type SceneView`, and `randomUUID` from `node:crypto`):

```ts
import { resolvePublicExperience, type ViewLoader } from "./resolve";

// Stands in for "use cache": entries live across "requests" and are only ever looked up by key.
function cache(tx: TestTx) {
  const entries = new Map<string, Promise<SceneView | null>>();
  const misses: string[] = [];
  const load: ViewLoader = key => {
    const id = JSON.stringify(key);
    if (!entries.has(id)) { misses.push(id); entries.set(id, loadPublicSceneView(tx, key)); }
    return entries.get(id)!;
  };
  return { load, misses };
}
const name = async (tx: TestTx, token: string, load: ViewLoader) => {
  const experience = await resolvePublicExperience(tx, token, load);
  return experience.status === "published" ? experience.view.identity.fullName : "unavailable";
};

test("a warm cache never hides turning a card off; turning it on reuses the entry", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load, misses } = cache(tx); const token = c.card.publicToken!;
  expect(await name(tx, token, load)).toBe("Ana");
  expect(await name(tx, token, load)).toBe("Ana");
  expect(misses).toHaveLength(1);
  await setCardDisabled(tx, { accountId: c.accountId, cardId: c.card.id, disabled: true });
  expect(await name(tx, token, load)).toBe("unavailable");
  await setCardDisabled(tx, { accountId: c.accountId, cardId: c.card.id, disabled: false });
  expect(await name(tx, token, load)).toBe("Ana");
  expect(misses).toHaveLength(1);
}));
test("unpublishing hides at once and publishing shows again", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load } = cache(tx); const token = c.card.publicToken!;
  await name(tx, token, load);
  await unpublishProfile(tx, { accountId: c.accountId, profileId: c.profileId });
  expect(await name(tx, token, load)).toBe("unavailable");
  await publishProfile(tx, { accountId: c.accountId, profileId: c.profileId });
  expect(await name(tx, token, load)).toBe("Ana");
}));
test("edits and scene switches show on the next tap despite a warm cache", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load } = cache(tx); const token = c.card.publicToken!;
  await name(tx, token, load);
  await updateIdentity(tx, { accountId: c.accountId, profileId: c.profileId, identity: { fullName: "Ana Cruz", headline: null, company: null, bio: null, phone: null, email: "ana@e.test", website: null, location: null } });
  expect(await name(tx, token, load)).toBe("Ana Cruz");
  const [booking] = await tx.select().from(sceneBlocks).where(eq(sceneBlocks.sceneId, c.defaultSceneId)).orderBy(asc(sceneBlocks.position));
  await setBlockVisible(tx, { accountId: c.accountId, profileId: c.profileId, blockId: booking.id, visible: false });
  const hidden = await resolvePublicExperience(tx, token, load);
  expect(hidden.status === "published" && hidden.view.blocks.map(b => b.type)).toEqual(["form", "contact"]);
  const { sceneId } = await createScene(tx, { accountId: c.accountId, profileId: c.profileId, name: "Events", copyFromSceneId: null });
  await showScene(tx, { accountId: c.accountId, profileId: c.profileId, sceneId });
  const switched = await resolvePublicExperience(tx, token, load);
  expect(switched.status === "published" && switched.view.scene.name).toBe("Events");
}));
test("two cards on one profile share content; turning one off leaves the other", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load } = cache(tx);
  const { card: second } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: c.accountId }).where(eq(cards.id, second.id));
  await connectCardToProfile(tx, { accountId: c.accountId, cardId: second.id, profileId: c.profileId });
  expect(await name(tx, second.publicToken!, load)).toBe("Ana");
  await setCardDisabled(tx, { accountId: c.accountId, cardId: c.card.id, disabled: true });
  expect(await name(tx, c.card.publicToken!, load)).toBe("unavailable");
  expect(await name(tx, second.publicToken!, load)).toBe("Ana");
}));
test("reconnecting a card to another owned profile shows that profile on the next tap", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load } = cache(tx);
  const other = await publishedCard(tx, c.accountId, "Ben");
  expect(await name(tx, c.card.publicToken!, load)).toBe("Ana");
  await connectCardToProfile(tx, { accountId: c.accountId, cardId: c.card.id, profileId: other.profileId });
  expect(await name(tx, c.card.publicToken!, load)).toBe("Ben");
}));
test("a view that cannot be built is unavailable, never a broken page", () => rollback(db, async tx => {
  const c = await publishedCard(tx);
  expect(await resolvePublicExperience(tx, c.card.publicToken!, async () => null)).toEqual({ status: "unavailable", cardId: c.card.id, ownerAccountId: c.accountId });
}));
test("a form shown on the page stops accepting once its block is hidden", () => rollback(db, async tx => {
  const c = await publishedCard(tx); const { load } = cache(tx);
  const shown = await resolvePublicExperience(tx, c.card.publicToken!, load);
  const form = shown.status === "published" ? shown.view.blocks.find(b => b.type === "form") : undefined;
  expect(form?.type).toBe("form");
  const [block] = await tx.select().from(sceneBlocks).where(and(eq(sceneBlocks.sceneId, c.defaultSceneId), eq(sceneBlocks.type, "form")));
  await setBlockVisible(tx, { accountId: c.accountId, profileId: c.profileId, blockId: block.id, visible: false });
  expect(await submitForm(tx, { formId: block.formId!, clientKey: randomUUID(), answers: { name: "Vic", email: "vic@e.test", message: "Hi" } })).toEqual({ status: "unavailable" });
}));
```

- [ ] **Step 2: Run and see it fail.** Expected: FAIL (`resolvePublicExperience` is not exported).
- [ ] **Step 3: Implement.** Append to `src/modules/cards/resolve.ts` (and add `import type { SceneView } from "../profiles/scene-view";`):

```ts
export type ViewKey = { profileId: string; sceneId: string; version: number };
export type ViewLoader = (key: ViewKey) => Promise<SceneView | null>;
export type PublicExperience =
  | { status: "unavailable"; cardId: string | null; ownerAccountId: string | null }
  | { status: "published"; cardId: string; ownerAccountId: string; profileId: string; view: SceneView };

// Card state is always fresh; only the Scene content comes from `loadView`, whose key carries the content version.
export async function resolvePublicExperience(db: Db, token: string, loadView: ViewLoader): Promise<PublicExperience> {
  const route = await resolveCard(db, token);
  if (route.status === "unavailable") return route;
  const view = await loadView({ profileId: route.profileId, sceneId: route.sceneId, version: route.version });
  if (!view) return { status: "unavailable", cardId: route.cardId, ownerAccountId: route.ownerAccountId };
  return { status: "published", cardId: route.cardId, ownerAccountId: route.ownerAccountId, profileId: route.profileId, view };
}
```

- [ ] **Step 4: Verify.** `node node_modules/vitest/vitest.mjs run src/modules/cards/resolve.db.test.ts` → PASS. Then `corepack pnpm typecheck` → PASS.
- [ ] **Step 5: Commit.** `git add src/modules/cards/resolve.ts src/modules/cards/resolve.db.test.ts && git commit -m "feat(cards): compose the public experience over a version-keyed view cache"`

---

## Task 6: Visitor Form component

**Purpose:** the real public UI for the M6 Form endpoint. It adds no backend.

**Files:**
- Create: `src/components/public-form.tsx`
- Test: create `src/components/public-form.test.tsx`

**Interfaces:**
- Produces: `sendInquiry`, `INQUIRY_MESSAGES`, `PublicForm` (§4).

- [ ] **Step 1: Failing tests** at `src/components/public-form.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { PRESETS, visibleFields } from "@/modules/forms/config";
import { INQUIRY_MESSAGES, PublicForm, sendInquiry } from "./public-form";

const FORM = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";
const data = (entries: Record<string, string>) => { const d = new FormData(); for (const [k, v] of Object.entries(entries)) d.set(k, v); return d; };
const reply = (status: number, body: object) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

test("posts answers and the browser key as JSON to the form's endpoint", async () => {
  const send = reply(201, { ok: true });
  expect(await sendInquiry(FORM, KEY, data({ name: "Vic", email: "vic@e.test", website: "" }), send)).toEqual({ result: "sent", fields: [] });
  const [url, init] = send.mock.calls[0];
  expect(url).toBe(`/api/forms/${FORM}/submissions`);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({ key: KEY, answers: { name: "Vic", email: "vic@e.test" } });
});
test("a filled honeypot travels as `website`, never as an answer", async () => {
  const send = reply(201, { ok: true });
  await sendInquiry(FORM, KEY, data({ name: "Vic", website: "spam.example" }), send);
  expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toEqual({ key: KEY, answers: { name: "Vic" }, website: "spam.example" });
});
test.each([
  [400, { error: "invalid", fields: ["email"] }, { result: "invalid", fields: ["email"] }],
  [413, { error: "too_large" }, { result: "invalid", fields: [] }],
  [404, { error: "unavailable" }, { result: "unavailable", fields: [] }],
  [429, { error: "rate_limited" }, { result: "busy", fields: [] }],
  [500, {}, { result: "failed", fields: [] }],
])("status %i maps to a calm visitor outcome", async (status, body, expected) => {
  expect(await sendInquiry(FORM, KEY, data({ name: "Vic" }), reply(status, body))).toEqual(expected);
});
test("a network failure keeps the visitor on the form with a retry message", async () => {
  const send = vi.fn<typeof fetch>(async () => { throw new TypeError("offline"); });
  expect(await sendInquiry(FORM, KEY, data({ name: "Vic" }), send)).toEqual({ result: "failed", fields: [] });
  expect(INQUIRY_MESSAGES.failed).toContain("try again");
});
test("renders persistent labels, required fields, autocomplete and a hidden honeypot", () => {
  const html = renderToStaticMarkup(<PublicForm formId={FORM} title="Send me a message" fields={visibleFields(PRESETS.contact.config)} />);
  expect(html).toContain("Send me a message");
  for (const label of ["Your name", "Email", "Phone", "Message"]) expect(html).toContain(label);
  const tag = (name: string) => html.match(new RegExp(`<(?:input|textarea)\\b[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
  expect(tag("name")).toContain('autoComplete="name"'.toLowerCase());
  expect(tag("email")).toContain('type="email"');
  expect(tag("email")).toContain("required");
  expect(tag("phone")).toContain('type="tel"');
  expect(tag("website")).toContain('tabindex="-1"');
  expect(html).toMatch(/aria-hidden="true"[^>]*>\s*<label[^>]*>[^<]*<input[^>]*name="website"/);
  for (const [t] of html.matchAll(/<(?:input|textarea|button)\b[^>]*>/g)) expect(t).not.toContain("disabled");
});
```

- [ ] **Step 2: Run and see it fail.** Run `node node_modules/vitest/vitest.mjs run src/components/public-form.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/components/public-form.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Input, Textarea } from "@/components/ui/input";
import type { visibleFields } from "@/modules/forms/config";

type Field = ReturnType<typeof visibleFields>[number];
export type InquiryResult = "sent" | "invalid" | "unavailable" | "busy" | "failed";
export const INQUIRY_MESSAGES: Record<Exclude<InquiryResult, "sent">, string> = {
  invalid: "Check the highlighted fields and try again.",
  unavailable: "This form isn't taking messages right now.",
  busy: "Too many messages were sent from this network. Please try again in a few minutes.",
  failed: "Your message wasn't sent. Check your connection and try again.",
};
const AUTOCOMPLETE: Record<string, string> = { name: "name", email: "email", phone: "tel", company: "organization" };

// The browser key is made once per form view, so a retry or double tap stores one message (M6 D11).
export async function sendInquiry(formId: string, key: string, data: FormData, send: typeof fetch = fetch): Promise<{ result: InquiryResult; fields: string[] }> {
  const answers = Object.fromEntries([...data].filter(([name, value]) => name !== "website" && typeof value === "string"));
  const website = data.get("website");
  let response: Response;
  try {
    response = await send(`/api/forms/${formId}/submissions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, answers, ...(typeof website === "string" && website ? { website } : {}) }) });
  } catch {
    return { result: "failed", fields: [] };
  }
  if (response.ok) return { result: "sent", fields: [] };
  if (response.status === 404) return { result: "unavailable", fields: [] };
  if (response.status === 429) return { result: "busy", fields: [] };
  if (response.status !== 400 && response.status !== 413) return { result: "failed", fields: [] };
  const body = (await response.json().catch(() => ({}))) as { fields?: unknown };
  return { result: "invalid", fields: Array.isArray(body.fields) ? body.fields.filter((f): f is string => typeof f === "string") : [] };
}

export function PublicForm({ formId, title, fields }: { formId: string; title: string; fields: Field[] }) {
  const [key] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<{ result?: InquiryResult; fields: string[]; pending: boolean }>({ fields: [], pending: false });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(current => ({ ...current, pending: true }));
    setState({ ...(await sendInquiry(formId, key, new FormData(event.currentTarget))), pending: false });
  }
  if (state.result === "sent") return (
    <section className="flex flex-col gap-2 rounded-xl border border-[#D8D5CE] bg-[#F8F7F3] p-4">
      <h2 className="break-words text-lg font-medium">{title}</h2>
      <p role="status">Thanks, your message was sent.</p>
    </section>
  );
  return (
    <form onSubmit={submit} className="relative flex flex-col gap-3 rounded-xl border border-[#D8D5CE] bg-[#F8F7F3] p-4">
      <h2 className="break-words text-lg font-medium">{title}</h2>
      {fields.map(field => {
        const invalid = state.fields.includes(field.key) || undefined;
        const props = { name: field.key, required: field.required, "aria-invalid": invalid, autoComplete: AUTOCOMPLETE[field.key] };
        return (
          <label key={field.key} className="flex flex-col gap-1 text-sm font-medium">
            {field.label}{field.required ? " (required)" : ""}
            {field.kind === "long" ? <Textarea {...props} maxLength={2000} /> : <Input {...props} type={field.kind} maxLength={field.kind === "email" ? 254 : 500} />}
          </label>
        );
      })}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state.result ? <p role="alert" className="text-sm">{INQUIRY_MESSAGES[state.result]}</p> : null}
      <button type="submit" disabled={state.pending} className="min-h-12 rounded-lg px-4 font-medium disabled:opacity-60" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        {state.pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
```

  The final static-render assertion (no `disabled` attribute) passes because `pending` is false on first render; React omits `disabled` when it is false.
- [ ] **Step 4: Verify.** `node node_modules/vitest/vitest.mjs run src/components/public-form.test.tsx` → PASS; `corepack pnpm typecheck` → PASS; `corepack pnpm lint` → PASS.
- [ ] **Step 5: Commit.** `git add src/components/public-form.tsx src/components/public-form.test.tsx && git commit -m "feat(forms): visitor form component"`

---

## Task 7: Visitor mode for the shared renderer

**Files:**
- Modify: `src/components/scene-view.tsx`
- Test: `src/components/scene-view.test.tsx`

**Interfaces:**
- Consumes: `PublicForm` (Task 6); `identity.onAccent` (Task 1).
- Produces: `SceneViewPreview({ view, visitorActions?: { saveContactHref: string } })`.

- [ ] **Step 1: Failing tests** (append to `src/components/scene-view.test.tsx`; rename the existing test title `"contact links work; Save contact remains disabled until M7"` to `"contact links work; Save contact stays inert in the owner preview"`):

```tsx
const visitor = { saveContactHref: "/c/TOKEN/contact" };
const full: SceneView = { ...base, identity: { ...base.identity, phone: "+63 917 123 4567", email: "ana@e.test" }, blocks: [
  { id: "a", type: "about", text: "Hi" },
  { id: "p", type: "project", title: "Site", description: null, url: "https://ana.example/" },
  { id: "l", type: "link", kind: "github", label: "GitHub", url: "https://github.com/ana" },
  { id: "c", type: "contact", saveContact: true, phone: "+63 917 123 4567", email: "ana@e.test", website: null, location: null },
  { id: "b", type: "booking", label: "Book a time", url: "https://cal.com/ana" },
  { id: "f", type: "form", formId: "form", title: "Send me a message", fields: visibleFields(PRESETS.contact.config) },
] };

test("visitor mode: Save contact is a link and the form is live", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={full} visitorActions={visitor} />);
  expect(html).toMatch(/<a\b[^>]*href="\/c\/TOKEN\/contact"[^>]*>Save contact<\/a>/);
  expect(html).toContain('name="website"');
  for (const [tag] of html.matchAll(/<(?:input|textarea|button)\b[^>]*>/g)) expect(tag).not.toContain("disabled");
  expect(html).not.toContain("Visitors can send you a message here.");
});
test("visitor mode: every control is at least 44px tall", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={full} visitorActions={visitor} />);
  const tags = [...html.matchAll(/<(?:a|button|input|textarea)\b[^>]*>/g)].map(([t]) => t).filter(t => !t.includes('name="website"'));
  expect(tags.length).toBeGreaterThan(5);
  for (const tag of tags) expect(tag).toMatch(/\b(min-h-11|h-11|min-h-12|min-h-24)\b/);
});
test("tel links dial digits only", () => {
  expect(renderToStaticMarkup(<SceneViewPreview view={full} />)).toContain('href="tel:+639171234567"');
});
test("accent fills use the readable accent text colour", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={{ ...full, identity: { ...full.identity, accent: "#E64A35", onAccent: "#0C0C0D" } }} visitorActions={visitor} />);
  expect(html).toContain("--on-accent:#0C0C0D");
  expect(html).toContain("color:var(--on-accent)");
  expect(html).not.toContain("#fff");
});
```

- [ ] **Step 2: Run and see it fail.** Run `node node_modules/vitest/vitest.mjs run src/components/scene-view.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Replace `src/components/scene-view.tsx`. The markup structure is kept; the changes are the visitor mode, tel digits, on-accent and the Warm Precision tokens (D11).

```tsx
import type { CSSProperties } from "react";
import { PublicForm } from "@/components/public-form";
import { Input, Textarea } from "@/components/ui/input";
import type { SceneView } from "@/modules/profiles/scene-view";

const actionClass = "inline-flex min-h-12 w-full items-center justify-center rounded-lg border px-4 text-center font-medium";
const rowClass = "inline-flex min-h-11 items-center break-all";
const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, "")}`;

// The one renderer for what a visitor sees. The owner preview passes no visitorActions and gets inert controls; the public
// card page passes them and gets the working Save contact link and form.
export function SceneViewPreview({ view, visitorActions }: { view: SceneView; visitorActions?: { saveContactHref: string } }) {
  const { identity } = view;
  return (
    <article
      style={{ "--accent": identity.accent, "--on-accent": identity.onAccent } as CSSProperties}
      className={visitorActions ? "mx-auto flex w-full max-w-[560px] flex-col gap-5 px-5 py-10" : "mx-auto flex w-full max-w-[390px] flex-col gap-4 rounded-2xl border bg-background p-5"}
    >
      <header className="flex flex-col items-center gap-2 text-center">
        {identity.image ? (
          <img src={identity.image.url} alt="" width={96} height={96} decoding="async" className={`size-24 ${identity.image.isLogo ? "object-contain" : "rounded-full object-cover"}`} />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-full text-2xl font-medium" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{identity.initials}</div>
        )}
        <h1 className="break-words text-3xl font-medium tracking-tight">{identity.fullName}</h1>
        {identity.headline ? <p className="break-words text-lg">{identity.headline}</p> : null}
        {identity.company ? <p className="break-words text-sm text-[#74736F]">{identity.company}</p> : null}
        {identity.location ? <p className="break-words text-sm text-[#74736F]">{identity.location}</p> : null}
      </header>
      {view.blocks.map(block => {
        if (block.type === "about") return <p key={block.id} className="whitespace-pre-line break-words leading-7">{block.text}</p>;
        if (block.type === "project") return (
          <section key={block.id} className="flex flex-col gap-2 rounded-xl border border-[#D8D5CE] p-4">
            <h2 className="break-words text-lg font-medium">{block.title}</h2>
            {block.description ? <p className="whitespace-pre-line break-words text-sm leading-6">{block.description}</p> : null}
            {block.url ? <a href={block.url} target="_blank" rel="noopener noreferrer" className={actionClass} style={{ borderColor: "var(--accent)" }}>View project</a> : null}
          </section>
        );
        if (block.type === "link" || block.type === "booking") return (
          <a key={block.id} href={block.url} target="_blank" rel="noopener noreferrer" className={actionClass}
            style={block.type === "booking" ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" } : { borderColor: "var(--accent)" }}>{block.label}</a>
        );
        if (block.type === "contact") return (
          <section key={block.id} className="flex flex-col gap-1">
            {block.phone ? <a href={telHref(block.phone)} className={rowClass}>{block.phone}</a> : null}
            {block.email ? <a href={`mailto:${block.email}`} className={rowClass}>{block.email}</a> : null}
            {block.website ? <a href={block.website} target="_blank" rel="noopener noreferrer" className={rowClass}>{block.website}</a> : null}
            {block.location ? <p className="break-words text-[#74736F]">{block.location}</p> : null}
            {block.saveContact ? (visitorActions
              ? <a href={visitorActions.saveContactHref} className={`${actionClass} mt-2`} style={{ borderColor: "var(--accent)" }}>Save contact</a>
              : <button disabled className="min-h-11 rounded-lg border px-4 font-medium disabled:opacity-50">Save contact</button>) : null}
          </section>
        );
        if (visitorActions) return <PublicForm key={block.id} formId={block.formId} title={block.title} fields={block.fields} />;
        return (
          <section key={block.id} className="flex flex-col gap-3 rounded-lg border p-4">
            <h2 className="break-words font-medium">{block.title}</h2>
            {block.fields.map(field => (
              <label key={field.key} className="flex flex-col gap-1 text-sm">
                {field.label}{field.required ? " (required)" : ""}
                {field.kind === "long" ? <Textarea disabled /> : <Input disabled type={field.kind} />}
              </label>
            ))}
            <button disabled className="min-h-11 rounded-lg border px-4 font-medium disabled:opacity-50">Send</button>
            <p className="text-sm text-muted-foreground">Visitors can send you a message here.</p>
          </section>
        );
      })}
    </article>
  );
}
```

  Note on the existing test `"external link is touch-safe…"`: it expects `min-h-11` in the first `<a>`. `actionClass` uses `min-h-12`, so change that expectation to `toMatch(/min-h-1[12]/)`.
- [ ] **Step 4: Verify.**
  - `node node_modules/vitest/vitest.mjs run src/components "src/app/(customer)/app/profiles/[profileId]/preview/page.test.tsx"` → PASS.
  - `corepack pnpm typecheck` → PASS.
  - `corepack pnpm lint` → PASS.
- [ ] **Step 5: Commit.** `git add src/components/scene-view.tsx src/components/scene-view.test.tsx && git commit -m "feat(profiles): visitor mode for the scene renderer"`

---

## Task 8: vCard builder (pure)

**Files:**
- Create: `src/modules/profiles/vcard.ts`
- Test: create `src/modules/profiles/vcard.test.ts`

- [ ] **Step 1: Failing tests:**

```ts
import { expect, test } from "vitest";
import type { ViewIdentity } from "./scene-view";
import { buildVCard, vCardFilename } from "./vcard";

const identity: ViewIdentity = { fullName: "Ana Cruz", initials: "AC", headline: "Designer", company: "Studio", bio: "private bio", phone: "+63 917 123 4567", email: "ana@e.test", website: "https://ana.example/", location: "Manila", accent: "#0C0C0D", onAccent: "#FFFFFF", image: null };
const unfold = (text: string) => text.replace(/\r\n /g, "");

test("vCard 3.0 with CRLF lines and only the public contact fields", () => {
  const card = buildVCard(identity);
  expect(card.endsWith("\r\n")).toBe(true);
  expect(card.replace(/\r\n/g, "")).not.toContain("\n");
  expect(card.split("\r\n").filter(Boolean)).toEqual([
    "BEGIN:VCARD", "VERSION:3.0", "FN:Ana Cruz", "N:;Ana Cruz;;;", "ORG:Studio", "TITLE:Designer",
    "TEL;TYPE=CELL:+63 917 123 4567", "EMAIL;TYPE=INTERNET:ana@e.test", "URL:https://ana.example/", "END:VCARD",
  ]);
  expect(card).not.toContain("private bio");
  expect(card).not.toContain("Manila");
});
test("absent fields are omitted, not left empty", () => {
  const lines = buildVCard({ ...identity, headline: null, company: null, phone: null, email: null, website: null }).split("\r\n").filter(Boolean);
  expect(lines).toEqual(["BEGIN:VCARD", "VERSION:3.0", "FN:Ana Cruz", "N:;Ana Cruz;;;", "END:VCARD"]);
});
test("text values are escaped so they cannot add properties", () => {
  const card = buildVCard({ ...identity, fullName: "Cruz, Ana; \\x", company: "A\r\nEND:VCARD\nBEGIN:VCARD" });
  expect(card).toContain("FN:Cruz\\, Ana\\; \\\\x");
  expect(card).toContain("ORG:A\\nEND:VCARD\\nBEGIN:VCARD");
  expect(card.split("\r\n").filter(line => line === "END:VCARD")).toHaveLength(1);
});
test("long lines fold at 75 octets without splitting a character", () => {
  const website = `https://ana.example/${"é".repeat(60)}`;
  const card = buildVCard({ ...identity, fullName: "名".repeat(40), website });
  for (const line of card.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(unfold(card)).toContain(`FN:${"名".repeat(40)}`);
  expect(unfold(card)).toContain(`URL:${website}`);
});
test.each([["Ana Cruz", "Ana-Cruz.vcf"], ["José Ñúñez", "Jose-Nunez.vcf"], ["名前", "contact.vcf"], ['a"b/c\\d', "abcd.vcf"]])("filename for %j is %j", (name, file) => {
  expect(vCardFilename(name)).toBe(file);
});
```

- [ ] **Step 2: Run and see it fail.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles/vcard.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/modules/profiles/vcard.ts`:

```ts
import type { ViewIdentity } from "./scene-view";

// RFC 2426 text escaping. Phone, email and https URL values are already validated and are not text-typed.
const text = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/([,;])/g, "\\$1");
const encoder = new TextEncoder();

// Lines longer than 75 octets continue on the next line after CRLF + space; never split inside a character.
function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > (parts.length ? 74 : 75)) { parts.push(current); current = ""; bytes = 0; }
    current += char;
    bytes += size;
  }
  return [...parts, current].join("\r\n ");
}

// Save contact: built only from the public identity a visitor already sees; never Account or sign-in data.
export function buildVCard(identity: ViewIdentity): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${text(identity.fullName)}`, `N:;${text(identity.fullName)};;;`];
  if (identity.company) lines.push(`ORG:${text(identity.company)}`);
  if (identity.headline) lines.push(`TITLE:${text(identity.headline)}`);
  if (identity.phone) lines.push(`TEL;TYPE=CELL:${identity.phone}`);
  if (identity.email) lines.push(`EMAIL;TYPE=INTERNET:${identity.email}`);
  if (identity.website) lines.push(`URL:${identity.website}`);
  lines.push("END:VCARD");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function vCardFilename(fullName: string): string {
  const ascii = fullName.normalize("NFKD").replace(/[^A-Za-z0-9 -]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  return `${ascii || "contact"}.vcf`;
}
```

- [ ] **Step 4: Verify.** `node node_modules/vitest/vitest.mjs run src/modules/profiles/vcard.test.ts` → PASS; `corepack pnpm typecheck` → PASS.
- [ ] **Step 5: Commit.** `git add src/modules/profiles/vcard.ts src/modules/profiles/vcard.test.ts && git commit -m "feat(profiles): vCard for Save contact"`

---

## Task 9: Save Contact route

**Files:**
- Create:
  - `src/app/(public)/c/[token]/contact/route.ts`
  - `src/app/(public)/c/[token]/cached-view.ts` (also used by Task 11)
- Test:
  - create `src/app/(public)/c/[token]/contact/route.test.ts`
  - `src/server-only-boundary.test.ts` (add `"src/app/(public)/c/[token]/cached-view.ts"`)

**Interfaces:**
- Consumes: `resolvePublicExperience`; `buildVCard`, `vCardFilename`; `loadPublicSceneView`.
- Produces: `cachedSceneView(key: ViewKey)`.

- [ ] **Step 1: Failing tests** at `src/app/(public)/c/[token]/contact/route.test.ts`:

```ts
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/cards/resolve", () => ({ resolvePublicExperience: m.resolve }));
vi.mock("../cached-view", () => ({ cachedSceneView: "cached" }));
import { GET } from "./route";

const identity = { fullName: "Ana Cruz", initials: "AC", headline: null, company: null, bio: null, phone: "+639171234567", email: "ana@e.test", website: null, location: null, accent: "#0C0C0D", onAccent: "#FFFFFF", image: null };
const published = (saveContact: boolean, visible = true) => ({ status: "published", cardId: "c1", ownerAccountId: "a1", profileId: "p1", view: { identity, scene: { id: "s1", name: "Main" }, blocks: visible ? [{ id: "b", type: "contact", saveContact, phone: identity.phone, email: identity.email, website: null, location: null }] : [] } });
const call = () => GET(new Request("http://localhost:3000/c/TOKEN/contact"), { params: Promise.resolve({ token: "TOKEN" }) });
beforeEach(() => vi.resetAllMocks());

test("serves a private, non-indexed vCard attachment when the shown scene offers Save contact", async () => {
  m.resolve.mockResolvedValue(published(true));
  const response = await call();
  expect(response.status).toBe(200);
  expect(m.resolve).toHaveBeenCalledWith({}, "TOKEN", "cached");
  expect(response.headers.get("content-type")).toBe("text/vcard; charset=utf-8");
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="Ana-Cruz.vcf"');
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.text()).toContain("FN:Ana Cruz");
});
test.each([
  ["an unavailable card", { status: "unavailable", cardId: "c1", ownerAccountId: "a1" }],
  ["a scene without Save contact", published(false)],
  ["a scene without a contact block", published(true, false)],
])("answers the same private 404 for %s", async (_name, experience) => {
  m.resolve.mockResolvedValue(experience);
  const response = await call();
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).toBe("Not found");
});
```

- [ ] **Step 2: Run and see it fail.** Run `node node_modules/vitest/vitest.mjs run "src/app/(public)/c/[token]/contact/route.test.ts"`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/app/(public)/c/[token]/cached-view.ts`:

```ts
import "server-only";
import { cacheLife } from "next/cache";
import { db } from "@/db";
import type { ViewKey } from "@/modules/cards/resolve";
import { loadPublicSceneView } from "@/modules/profiles/view";

// Shared public Scene content only; Card state is never cached. `key.version` is not read here: it is part of the cache key
// and moves on every change a visitor could see (bumpProfileContentVersion), so an edit never meets a stale entry on any
// instance. ponytail: per-instance in-memory store; add a remote cache handler only if measured traffic needs it.
export async function cachedSceneView(key: ViewKey) {
  "use cache";
  cacheLife("max");
  return loadPublicSceneView(db, { profileId: key.profileId, sceneId: key.sceneId });
}
```

  and `src/app/(public)/c/[token]/contact/route.ts`:

```ts
import { connection } from "next/server";
import { db } from "@/db";
import { resolvePublicExperience } from "@/modules/cards/resolve";
import { buildVCard, vCardFilename } from "@/modules/profiles/vcard";
import { cachedSceneView } from "../cached-view";

const PRIVATE = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };

// Save contact: the same fresh card check as the page, then only what the shown Scene offers.
export async function GET(_request: Request, { params }: RouteContext<"/c/[token]/contact">) {
  await connection();
  const { token } = await params;
  const experience = await resolvePublicExperience(db, token, cachedSceneView);
  if (experience.status !== "published" || !experience.view.blocks.some(block => block.type === "contact" && block.saveContact)) {
    return new Response("Not found", { status: 404, headers: PRIVATE });
  }
  const { identity } = experience.view;
  return new Response(buildVCard(identity), {
    headers: { ...PRIVATE, "content-type": "text/vcard; charset=utf-8", "content-disposition": `attachment; filename="${vCardFilename(identity.fullName)}"`, "x-content-type-options": "nosniff" },
  });
}
```

  Add `"src/app/(public)/c/[token]/cached-view.ts",` to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 4: Verify.**
  - `node node_modules/vitest/vitest.mjs run "src/app/(public)/c/[token]/contact/route.test.ts" src/server-only-boundary.test.ts` → PASS.
  - `corepack pnpm typecheck` → PASS. It runs `next typegen`, which creates the `RouteContext` type.
- [ ] **Step 5: Commit.** `git add "src/app/(public)/c" src/server-only-boundary.test.ts && git commit -m "feat(cards): Save contact download route"`

---

## Task 10: Form submissions from the card origin (D7)

**Files:**
- Modify: `src/app/api/forms/[formId]/submissions/route.ts`
- Test: `src/app/api/forms/[formId]/submissions/route.test.ts`

- [ ] **Step 1: Failing test.** In the env mock, add `cardUrlOrigin: "https://tap.example.test/"`. The trailing slash is deliberate: it proves the value is normalized and not compared raw. Then append:

```ts
test("accepts Neffi's card origin as well as the app origin, compared as normalized origins", async () => {
  expect((await call(undefined, "https://tap.example.test")).status).toBe(201);
  expect(m.submit).toHaveBeenCalled();
});
test("a look-alike of the card origin is still refused", async () => {
  expect((await call(undefined, "https://tap.example.test.evil.example")).status).toBe(403);
});
```

- [ ] **Step 2: Run and see it fail.** Run `node node_modules/vitest/vitest.mjs run "src/app/api/forms/[formId]/submissions/route.test.ts"`. Expected: the new test fails with 403.
- [ ] **Step 3: Implement.** Replace the Origin check:
  - Add a module constant that normalizes both allowed origins and never compares the raw `env.cardUrlOrigin`: `const ORIGINS = new Set([new URL(env.authBaseUrl).origin, new URL(env.cardUrlOrigin).origin]);`
  - Use `if (!ORIGINS.has(request.headers.get("origin") ?? "")) return json({ error: "forbidden" }, 403);`
  - Update the comment to: `// Public, unauthenticated endpoint for Neffi Forms on /c/{token}. Only Neffi's own app and card origins; nothing is echoed back.`
- [ ] **Step 4: Verify.** The same test file → PASS (including the foreign/missing-origin 403 test); `corepack pnpm typecheck` → PASS.
- [ ] **Step 5: Commit.** `git add "src/app/api/forms/[formId]/submissions" && git commit -m "fix(forms): accept submissions from the card origin"`

---

## Task 11: Public card page and the single unavailable state

**Files:**
- Create:
  - `src/app/(public)/c/[token]/page.tsx`
  - `src/app/(public)/c/[token]/unavailable.tsx`
  - `src/app/(public)/c/[token]/not-found.tsx`
- Test: create `src/app/(public)/c/[token]/page.test.tsx`
- Modify: `src/app/(customer)/touch-targets.test.ts` (also scan `/c`)

**Interfaces:**
- Consumes: `resolvePublicExperience`, `cachedSceneView`, `SceneViewPreview`.

- [ ] **Step 1: Failing tests** at `src/app/(public)/c/[token]/page.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ resolve: vi.fn(), viewer: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/auth/access", () => ({ getViewer: m.viewer }));
vi.mock("@/modules/cards/resolve", () => ({ resolvePublicExperience: m.resolve }));
vi.mock("./cached-view", () => ({ cachedSceneView: "cached" }));
vi.mock("@/components/scene-view", () => ({ SceneViewPreview: ({ visitorActions }: { visitorActions: { saveContactHref: string } }) => <article data-save={visitorActions.saveContactHref}>Ana</article> }));
import CardPage, { metadata } from "./page";
import { Unavailable } from "./unavailable";

const view = { identity: { fullName: "Ana" }, scene: { id: "s1", name: "Main" }, blocks: [] };
const published = { status: "published", cardId: "c1", ownerAccountId: "a1", profileId: "p1", view };
const unavailable = { status: "unavailable", cardId: "c1", ownerAccountId: "a1" };
const render = async () => renderToStaticMarkup(await CardPage({ params: Promise.resolve({ token: "TOKEN" }), searchParams: Promise.resolve({}) }));
beforeEach(() => { vi.resetAllMocks(); m.viewer.mockResolvedValue(null); });

test("a Published card renders the public scene from the fresh resolver and the cached loader", async () => {
  m.resolve.mockResolvedValue(published);
  const html = await render();
  expect(m.resolve).toHaveBeenCalledWith({}, "TOKEN", "cached");
  expect(html).toContain('data-save="/c/TOKEN/contact"');
  expect(html).not.toContain("/app/");
});
test.each([
  ["unknown token", { status: "unavailable", cardId: null, ownerAccountId: null }],
  ["ownerless card", { status: "unavailable", cardId: "c1", ownerAccountId: null }],
  ["owned card", unavailable],
])("visitors get the one not-found state for an %s", async (_name, experience) => {
  m.resolve.mockResolvedValue(experience);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
test("the page is never indexed and its metadata carries no profile data", () => {
  expect(metadata).toEqual({ title: "Neffi", robots: { index: false, follow: false } });
});
test("unavailable copy names no reason and no internal state", () => {
  const text = renderToStaticMarkup(<Unavailable />).replace(/<[^>]+>/g, " ");
  expect(text).toContain("This Neffi isn’t available right now");
  expect(text).not.toMatch(/disabled|draft|unpublish|claim|activat|token|profile|account|owner|error|404/i);
});
```

- [ ] **Step 2: Run and see it fail.** Run `node node_modules/vitest/vitest.mjs run "src/app/(public)/c/[token]/page.test.tsx"`. Expected: FAIL.
- [ ] **Step 3: Implement.** `src/app/(public)/c/[token]/unavailable.tsx`:

```tsx
import Link from "next/link";

// The same words for every reason a card shows nothing, so the page never reveals whether a link exists or why it is off.
export function Unavailable({ manageHref }: { manageHref?: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#F2F0EA] px-5 py-16 text-center text-[#0C0C0D]">
      <h1 className="text-2xl font-medium tracking-tight">This Neffi isn’t available right now</h1>
      <p className="max-w-sm text-[#74736F]">If you expected to see someone’s details here, ask them to share their link again.</p>
      {manageHref ? (
        <>
          <p className="text-sm text-[#74736F]">Only you can see this.</p>
          <Link href={manageHref} className="inline-flex min-h-11 items-center rounded-lg bg-[#0C0C0D] px-4 font-medium text-[#F2F0EA]">Manage this card</Link>
        </>
      ) : null}
    </main>
  );
}
```

  `src/app/(public)/c/[token]/not-found.tsx`:

```tsx
import { Unavailable } from "./unavailable";

export default function CardNotFound() {
  return <Unavailable />;
}
```

  `src/app/(public)/c/[token]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SceneViewPreview } from "@/components/scene-view";
import { db } from "@/db";
import { resolvePublicExperience } from "@/modules/cards/resolve";
import { cachedSceneView } from "./cached-view";

// Public but kept out of search: customer-controlled indexing is a later, separately planned feature.
export const metadata: Metadata = { title: "Neffi", robots: { index: false, follow: false } };
// Card state is read fresh on every request.
export const instant = false;

// No loading.tsx in this segment: notFound() must run before streaming starts so an unavailable card answers 404.
export default async function CardPage({ params }: PageProps<"/c/[token]">) {
  await connection();
  const { token } = await params;
  const experience = await resolvePublicExperience(db, token, cachedSceneView);
  if (experience.status === "unavailable") notFound();
  return (
    <main className="flex flex-1 flex-col bg-[#F2F0EA] text-[#0C0C0D]">
      <SceneViewPreview view={experience.view} visitorActions={{ saveContactHref: `/c/${token}/contact` }} />
    </main>
  );
}
```

  In `src/app/(customer)/touch-targets.test.ts`, replace the `files` line with:

```ts
const files = ["src/app/(customer)", "src/app/(public)/c"].flatMap(walk).filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"));
```

- [ ] **Step 4: Verify.**
  - `node node_modules/vitest/vitest.mjs run "src/app/(public)/c" "src/app/(customer)/touch-targets.test.ts"` → PASS.
  - `corepack pnpm typecheck` → PASS.
  - `corepack pnpm lint` → PASS.
  - `corepack pnpm build` → PASS. `/c/[token]` must be listed as dynamic (ƒ) with no prerender or "uncached data outside Suspense" error.
- [ ] **Step 5: Commit.** `git add "src/app/(public)/c" "src/app/(customer)/touch-targets.test.ts" && git commit -m "feat(cards): public card page with privacy-safe unavailable state"`

---

## Task 12: Owner shortcuts on the public page (D8)

**Files:**
- Modify: `src/app/(public)/c/[token]/page.tsx`
- Test: `src/app/(public)/c/[token]/page.test.tsx`

- [ ] **Step 1: Failing tests** (append):

```tsx
test("the signed-in owner sees the real public page plus Edit and Switch scene, with no redirect", async () => {
  m.resolve.mockResolvedValue(published);
  m.viewer.mockResolvedValue({ accountId: "a1", email: "owner@e.test", role: "customer" });
  const html = await render();
  expect(html).toContain('data-save="/c/TOKEN/contact"');
  expect(html).toContain('href="/app/profiles/p1/scenes/s1"');
  expect(html).toContain('href="/app/profiles/p1"');
  expect(html).toContain("Only you see this");
  expect(html).not.toContain("owner@e.test");
});
test("a signed-in non-owner sees exactly the visitor page", async () => {
  m.resolve.mockResolvedValue(published);
  m.viewer.mockResolvedValue({ accountId: "someone-else", email: "x@e.test", role: "owner" });
  const html = await render();
  expect(html).not.toContain("/app/");
  expect(html).not.toContain("Only you see this");
});
test("the owner of an unavailable card gets the generic copy plus Manage this card", async () => {
  m.resolve.mockResolvedValue(unavailable);
  m.viewer.mockResolvedValue({ accountId: "a1", email: "owner@e.test", role: "customer" });
  const html = await render();
  expect(html).toContain("This Neffi isn’t available right now");
  expect(html).toContain('href="/app/cards/c1"');
});
test("a signed-in non-owner of an unavailable card gets the plain not-found state", async () => {
  m.resolve.mockResolvedValue(unavailable);
  m.viewer.mockResolvedValue({ accountId: "someone-else", email: "x@e.test", role: "customer" });
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
```

  The OWNER business role is deliberately not an owner of a customer's card (`ownsAccountResource`, M3 policy).
- [ ] **Step 2: Run and see it fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Update `page.tsx`:
  - Add imports: `Link` from `next/link`, `getViewer` from `@/auth/access`, `ownsAccountResource` from `@/auth/policy`, `Unavailable` from `./unavailable`.
  - Replace the body after `const { token } = await params;` with:

```tsx
  const [experience, viewer] = await Promise.all([resolvePublicExperience(db, token, cachedSceneView), getViewer()]);
  // Ownership is decided here on the server; the destinations re-check it. Visitors and other accounts never see these.
  const owner = viewer !== null && experience.ownerAccountId !== null && ownsAccountResource(viewer, experience.ownerAccountId);
  if (experience.status === "unavailable") {
    if (!owner || !experience.cardId) notFound();
    return <Unavailable manageHref={`/app/cards/${experience.cardId}`} />;
  }
  const { profileId, view } = experience;
  return (
    <main className="flex flex-1 flex-col bg-[#F2F0EA] text-[#0C0C0D]">
      {owner ? (
        <nav aria-label="Manage your Neffi" className="flex flex-wrap items-center justify-center gap-2 border-b border-[#D8D5CE] bg-[#F8F7F3] px-5 py-2 text-sm">
          <span className="text-[#74736F]">Only you see this</span>
          <Link href={`/app/profiles/${profileId}/scenes/${view.scene.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-[#D8D5CE] px-3 font-medium">Edit</Link>
          <Link href={`/app/profiles/${profileId}`} className="inline-flex min-h-11 items-center rounded-lg border border-[#D8D5CE] px-3 font-medium">Switch scene</Link>
        </nav>
      ) : null}
      <SceneViewPreview view={view} visitorActions={{ saveContactHref: `/c/${token}/contact` }} />
    </main>
  );
```

- [ ] **Step 4: Verify.** `node node_modules/vitest/vitest.mjs run "src/app/(public)/c" "src/app/(customer)/touch-targets.test.ts"` → PASS; `corepack pnpm typecheck` → PASS; `corepack pnpm lint` → PASS.
- [ ] **Step 5: Commit.** `git add "src/app/(public)/c" && git commit -m "feat(cards): owner shortcuts on the public card page"`

---

## Task 13: Documentation

**Files:** modify `README.md`.

- [ ] **Step 1: Edit `README.md`.**
  - Line ~177: replace "There is no `/c/{token}` page yet: the public card resolver is Milestone 7." with "`/c/{token}` is the public card page (Milestone 7, below)."
  - Line ~221: replace "Visitor form rendering, the public `/c/{token}` page, vCard download and public caching belong to M7." with "Visitors use these forms on the public card page."
  - Add a section `## Public card page (Milestone 7)` with this text:

```markdown
`/c/{token}` is the permanent URL on the NFC chip and in the digital Sharing QR. Every request reads the card fresh (one
indexed lookup): only a claimed, enabled card showing a Published profile renders; everything else — unknown link,
unclaimed, turned off, no profile, Draft or Unpublished — gets the same "This Neffi isn't available right now" 404, so the
page never reveals why. The profile's shown Scene (or its Default Scene) renders with its visible Blocks in order.

Scene content is cached with `"use cache"` under `(profile, scene, content_version)`. Every change a visitor could see calls
`bumpProfileContentVersion` inside its transaction, so an edit never meets a stale entry; card state, card→profile routing
and publish status are never cached. Visitors can save a vCard (`/c/{token}/contact`), follow https links, book, call,
email and send the profile's form. A signed-in owner sees the same page plus Edit / Switch scene (or Manage this card when
it is unavailable). All public pages are `noindex`; customer search indexing is a later, separately planned feature.
```

- [ ] **Step 2: Verify.** `corepack pnpm lint` → PASS.
- [ ] **Step 3: Commit.** `git add README.md && git commit -m "docs(m7): public card page"`

---

## Task 14: Browser acceptance (390×844 primary; production build; loopback PostgreSQL) — user participation required

**Setup:**
- Disposable database: `createdb -h 127.0.0.1 -p 55432 -U postgres neffi_m7_dev`.
- Run `DATABASE_URL=postgres://postgres@127.0.0.1:55432/neffi_m7_dev ACTIVATION_CODE_SECRET=<dev value> corepack pnpm dev:activation-fixture`. It migrates, including 0011, and creates claimable cards. Codes are used privately and never recorded.
- **Production server** (so `"use cache"` is real): `corepack pnpm build`, then `DATABASE_URL=postgres://postgres@127.0.0.1:55432/neffi_m7_dev corepack pnpm start`. The process env overrides `.env.local`; never use Neon.
- **Phone access** (C, H): use the same machine's LAN address only if `CARD_URL_ORIGIN` and `BETTER_AUTH_URL` are set to it for this run. Otherwise those two items are user-reported on desktop mobile emulation plus a QR scan that decodes the link text.
- **Claim with the user's account through `/activate`:**
  - **Card P:** Get Clients, then Publish.
  - **Card D:** Network, left as Draft.
  - **Card N:** claimed but not set up.
  - **Card U:** left unclaimed.

**Recording:** for each item record `pass`/`fail`, the viewport, and `executor-observed` or `user-reported`. Never record codes, OTPs, cookies or secrets. A token suffix is enough to identify a card.

- [ ] **A — Visitor view (private window, signed out):** open P's `/c/<token>`.
  - Name, headline, booking (filled accent), form, contact and Save contact appear in Scene order.
  - There is no bottom nav and no owner bar.
  - The page is Paper on Ink in a single column.
- [ ] **B — Visitor actions:**
  - Booking and links open the https target in a new tab.
  - `tel:` dials digits and `mailto:` opens mail.
  - Save contact downloads `<Name>.vcf`, which imports correctly on a phone (user-reported).
  - A Contact block with "Save contact" off shows no Save contact, and `/c/<token>/contact` then answers 404.
- [ ] **C — Form:**
  - **Valid send:** "Thanks, your message was sent." The message appears in the Inbox and the notification email arrives (user inbox).
  - **Validation:** an empty required field gives native validation, and a wrong email format is highlighted.
  - **Double tap:** produces one message.
  - **Eligibility change:** hide the form block in `/app` while the page stays open, then send. The visitor sees "This form isn't taking messages right now" and nothing new appears in the Inbox.
  - **Offline:** with the network off (DevTools), sending shows the retry message; turning the network back on and sending again stores exactly one message.
- [ ] **D — Unavailable matrix (private window):** D (Draft), N (no profile), U (unclaimed), a random 26-character token, P after **Turn off**, and P's profile after **Unpublish**.
  - Each shows identical visible text.
  - `curl -s -o /dev/null -w "%{http_code}" <url>` prints `404` for each.
  - View-source has `<meta name="robots" content="noindex"`.
  - No page shows the reason, a name or any account detail.
- [ ] **E — Recovery:** turn P on again, then republish. P renders again on the next load.
- [ ] **F — Freshness with a warm cache:** load P, then load it again (a cached hit). Then, one change at a time, check that the next reload reflects each:
  - change the name;
  - change the accent;
  - hide a block;
  - reorder blocks;
  - edit the form title;
  - add a scene and **Show this**;
  - delete the shown scene (falls back to the Default Scene);
  - connect P to another Published profile, then back;
  - connect card N to P's profile — both cards show the same page; turn N off and P still shows.
- [ ] **G — Owner:**
  - Signed in as the owner, open P: the same public page plus "Only you see this · Edit · Switch scene", with no redirect. Edit opens the shown Scene editor; Switch scene opens the profile overview.
  - Open D as the owner: the generic copy plus "Manage this card", which opens that card's page.
  - Signed in as a second account (another email): P shows no owner bar, and D gives the plain 404.
- [ ] **H — Sharing QR:** scan P's QR from `/app/cards/<id>`. It opens the same `/c/<token>` page (user-reported).
- [ ] **I — Privacy:** `curl -s <P url>` contains none of:
  - the owner's sign-in email;
  - the account, profile or card UUIDs (taken from `/app` URLs);
  - `og:` tags;
  - the Cloudinary secret value.

  `curl -sI <P url>/contact` shows `cache-control: no-store` and `x-robots-tag: noindex, nofollow`. With an image set, the `<img>` src is `res.cloudinary.com/...` with `f_auto,q_auto`: round for a photo, uncropped for a logo.
- [ ] **J — Layout:**
  - At 390×844 there is no horizontal scroll, including with a long name, a long URL and a long form title.
  - Every control is at least 44px and every form field has a visible label.
  - At 1280px the content is a centred column of at most 560px.
- [ ] **K — Lightweight (evidence only):** record the DevTools mobile-emulation transfer size and LCP for P on a cold load. There is no target; it is recorded for M10.
- [ ] **Ledger:** record the results with `Commit: none (verification only)`. Fix any failure in the owning task's files with a failing test first, commit it as `fix(<area>): <defect>`, re-run that task's verification and this item, and record both.

## Task 15: M7 software gate

- [ ] **Step 1: Fresh verification**, recording every result:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm db:check
corepack pnpm db:generate && git diff --exit-code drizzle              # no drift
corepack pnpm build
corepack pnpm check:bundle
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test corepack pnpm check:db-concurrency
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test corepack pnpm check:provisioning-concurrency
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test corepack pnpm check:claim-concurrency
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test corepack pnpm check:profile-concurrency
git diff --name-only main..HEAD -- drizzle                              # only 0011_profile_content_version.sql, meta/0011_snapshot.json, meta/_journal.json
git grep -nE "updateTag|revalidateTag|unstable_cache|cacheTag" -- src   # expect no output
git grep -ln '"use cache"' -- src                                       # expect only src/app/(public)/c/[token]/cached-view.ts
git grep -n "bumpProfileContentVersion" -- src ":!*.test.ts"            # expect the D1 call sites only
git ls-files "src/app/(public)/c/[token]/loading.tsx"                   # expect no output (D10)
git grep -nE "console\.(log|info|debug|warn)" -- src/modules src/app src/components   # expect no output
```

- [ ] **Step 2: Whole-branch review.** Use superpowers:requesting-code-review, or an independent reviewer, against this plan. Required checks:
  - §3 exclusions respected;
  - D1–D12 implemented as written;
  - Card state is never inside a cached scope;
  - the `"use cache"` function reads no request data;
  - unavailable responses are indistinguishable for visitors;
  - owner affordances are decided server-side;
  - the public DTO has no Account, Card or owner sign-in data;
  - only https/tel/mailto hrefs;
  - no secret in a client file;
  - the touch guard covers `/c`;
  - no clock reads during render;
  - the M6 owner preview behaves as before.

  Fix findings test-first and re-run Step 1.
- [ ] **Step 3: Ledger.** Record the status exactly as **"M7 software gate passed — physical NFC acceptance pending"**. M7 is not complete until Task 16 passes. Record the Rulings, plus these known limitations:
  - The cache store is per-instance memory: correct by version key, with a modest hit rate on serverless.
  - Owner shortcuts need the session cookie, so on a separate NFC domain owners see the visitor view.
  - The PP Neue Montreal font and global Warm Precision tokens are not applied (outside M7).
  - Migration 0011 must be applied to `neffi-dev` (user approval) before Preview acceptance.
- [ ] **Step 4: Stop.** Do not push, open a PR, migrate `neffi-dev` or update Notion without explicit user approval. Continue to Task 16 when the user is ready with cards and phones.

## Task 16: M7 physical NFC acceptance (required) — user participation required

**Purpose:** prove that the real NFC transport opens the M7 public experience. This runs after the Task 15 software gate, against the M7 branch build.

**Out of scope here:** the M4 provisioning and M5 packaged-activation acceptance. Those have already been run against `main` before M7 implementation, under their own milestones. This task only uses a card they produced.

**Setup:**
- Use a DBC that is provisioned with its NFC holding exactly `<CARD_URL_ORIGIN>/c/<token>`, claimed, and connected to a profile.
- The phones must reach the server at `CARD_URL_ORIGIN` (the Task 14 production-mode server on that origin, or a Preview only after the user approves migrating `neffi-dev`).
- Test on at least one Android phone and one iPhone, each with its default browser, over Wi-Fi or mobile data.

**Recording:** follow the Task 14 rules (pass/fail, device, OS and browser, `executor-observed` or `user-reported`). Never record codes, cookies or secrets, and never fabricate evidence.

- [ ] **A — Published:** with the profile Published, a real tap opens the public page for that card, with the correct active or Default Scene and Blocks in order.
- [ ] **B — Disabled and re-enabled:** after the owner turns the card off, the next tap shows the unavailable page. After turning it back on, the next tap shows the public page again.
- [ ] **C — Draft, Unpublished, Published:** with the profile Unpublished (and, using a second card or profile, while still Draft), a tap shows the unavailable page. After publishing, the next tap shows the public page.
- [ ] **D — NFC vs Sharing QR:** the URL opened by the tap and the URL decoded from that card's Sharing QR (`/app/cards/<id>`) are the same permanent `/c/<token>`, and both show the same page.
- [ ] **E — Save Contact:** from the page opened by a tap, Save contact downloads a vCard that the phone imports with the correct name, phone, email and website.
- [ ] **F — Form submission:** from the page opened by a tap, sending the form shows "Thanks, your message was sent." The message appears once in the owner's Inbox and the notification email arrives.
- [ ] **Ledger:** record every item. If all pass, record the M7 status as **"M7 complete — software gate and physical NFC acceptance passed"**. If any item fails, fix it in the owning task's files with a failing test first (`fix(<area>): <defect>`), re-run Task 15 Step 1 and the failed Task 16 items, and record both. A hardware-only failure, such as a tag that won't read, is recorded and escalated to the user; it is never worked around in M7 code.

---

## 5. Risks, ambiguities and contradictions

| # | Item | Status |
|---|---|---|
| R1 | Next 16's default `use cache` store is per-process; tag invalidation is local (bundled docs). | Resolved by D1 (user-approved version key). No conflict with locked rules. |
| R2 | The Form Route Handler accepted only the app origin; a separate `CARD_URL_ORIGIN` domain would 403 every public Form. | D7: the allow-list adds the configured card origin. This changes the domain contract (no approval needed) and is a small fix to M6 code. Session cookies don't cross domains, so owner shortcuts degrade to the visitor view there (documented limitation). |
| R3 | Warm Precision is locked (PP Neue Montreal, Paper/Ink tokens), but the repo ships Geist and stock shadcn tokens. | M7 applies the tokens to the public surface only. The font licence/asset and a global token migration need a separate decision; this is not an M7 gate. |
| R4 | The Page Inventory lists Minimal/Professional/Creator themes; Public Profile Templates and Step 9 say design one system first. | Not an M7 gate (matches the user brief and Step 9). `profiles.theme` stays `'default'`. |
| R5 | Customer SEO/Discoverability is recorded for the future. | Out of M7: static noindex metadata, no OG, no canonical, no sitemap. |
| R6 | A tracked M4 ledger file in git (`.superpowers/sdd/2026-10-10-…/progress.md`). | Housekeeping outside M7; reported only. |
| R7 | Migration 0011 must reach `neffi-dev` before Vercel Preview acceptance. | User-approved step at PR time; not done by executors. |

No locked product or domain rule conflicts with the repository. Card→Profile (never →Scene), Profile-owned Scenes, the mandatory Default Scene, Profile-level appearance, the public non-credential token and no-account visitors are all preserved.

## 6. Self-review record (planner, 2026-10-12)

- **Brief → tasks:**

  | Brief area | Tasks |
  |---|---|
  | 1 Resolver | 4, 11 |
  | 2 Safe states | 4, 11, 12, 14D |
  | 3 DTO | 3 |
  | 4 Blocks | 1, 7 |
  | 5 vCard | 8, 9 |
  | 6 Visitor actions | 7, 9, 14B |
  | 7 Forms | 6, 10, 5, 14C |
  | 8 Owner | 12, 14G |
  | 9 Cache | 2, 5, 9, 14F |
  | 10 Media | 3 (reuse), 14I |
  | 11 Mobile | 7, 11, 14J |
  | 12/14 SEO baseline | 11 |
  | 13 Themes | R4 |
  | Physical NFC acceptance (required) | 16 |
  | Gate | 15 |

- **Test expectations covered:**
  - Card and lifecycle matrix (4);
  - active/default selection and broken-scene fallback (3, 4, 5);
  - ordered/hidden blocks (M6 tests and 5);
  - multiple cards and reconnect (5);
  - owner vs non-owner (12);
  - privacy (3, 11, 14I);
  - Form success/failure and eligibility change (5, 6, 14C);
  - vCard (8, 9);
  - invalidation and disable/re-enable under a warm cache (2, 5, 14F);
  - safe URLs (1);
  - noindex (11, 14D);
  - mobile a11y (7, 11, 14J);
  - secrets (15);
  - build, schema drift and regression (15).
- **Concurrency:** D12. No new concurrency script; the existing four are re-run.
- **Placeholders:** none. Bracketed values are runtime inputs (dev secret, tokens, UUIDs read from `/app`).
- **Type consistency:** `ViewKey`, `ViewLoader`, `PublicExperience`, `cachedSceneView`, `bumpProfileContentVersion`, `onAccent`, `sendInquiry` and `INQUIRY_MESSAGES` are used verbatim across Tasks 1–12.

## 7. Execution sequence & recommendation

**Sequence:**
- M4 physical acceptance, then M5 packaged-card physical acceptance (both on `main`, outside this plan);
- 1 → 2 → 3 → 4 → 5 (domain, all PGlite-tested);
- 6 → 7 (UI components);
- 8 → 9 (vCard);
- 10 (Form origin);
- 11 → 12 (page);
- 13 (docs);
- 14 (acceptance, with the user);
- 15 (gate);
- 16 (required physical NFC acceptance).

Tasks 6–8 and 10 depend only on Task 1 and could run in any order after it.

**Before Task 1 (outside this plan):** the M4 and M5 physical acceptance runs against current `main` under those milestones.

**Software-testable:** everything in Tasks 1–15. That covers direct `/c/<token>` navigation, the Sharing QR decode, mobile emulation and the real production cache.

**Physical (required, not deferred):** Task 16, run after the Task 15 gate:
- real taps against Published, Disabled/re-enabled and Draft/Unpublished/published;
- NFC vs Sharing QR URL;
- Save Contact;
- a Form submission.

M7 is complete only after Task 16 passes.
