# Milestone 6 — Customer Mobile Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is executor-independent: any capable agent (or human) must be able to execute it from repository state alone.

**Goal:** A customer who claimed a Card in M5 can, from a phone and without technical knowledge:
- set it up: purpose → essentials → prepared Neffi → preview → publish;
- manage Profiles, Scenes, ordered Blocks, appearance, native Forms and a lightweight Inbox;
- receive inquiry emails;
- see each Card's digital Sharing QR;
- manage Cards and sign-in methods.

**Architecture:** This extends the existing Next.js 16 modular monolith.
- **Schema:** one additive migration (`0010`) adds `scenes`, `scene_blocks`, `form_definitions` and `form_submissions`, plus three `profiles` columns. Existing Profiles get a Default Scene, and their flat links become Link blocks.
- **Domain logic** lives in `src/modules/profiles`, `src/modules/forms` and `src/modules/cards`. Every mutation takes the caller's `accountId` and locks the owned row in a real transaction.
- **Owner UI:** Server Components plus Server Actions under `/app`.
- **Visitor submissions:** a same-origin Route Handler. The public `/c/{token}` resolver remains M7.

**Tech stack:**
- Next.js 16.4 (`cacheComponents`, Server Actions, Route Handlers, `after()`, `connection()`).
- React 19.3, Better Auth 1.7 (emailOTP change-email, unlink, revoke sessions), Drizzle 0.45 with PostgreSQL.
- Zod 4, vitest 5 with PGlite, `node-postgres` concurrency scripts.
- Resend (existing EmailService) and Cloudinary (signed direct upload, no SDK).
- `uqr@0.1.3` (new, exact pin) for the QR.

**Spec:** the source of truth is the Notion workspace "Neffi — Business Hub". It was read 2026-10-11 and not modified; page edit timestamps were unchanged since the M5 planning read.
- AI Build Handoff
- Locked Plan, including the Oct 10 Action-First revision
- Step 2 Product Definitions
- Step 4 Objects, including the Scenes/Blocks extension
- Step 5 Pages & Capabilities, including the Customer Experience revision
- Step 6 Data Model, including the DBC extension
- Step 7 Architecture, including the Action-First extension
- Step 8 Implementation Plan, including the M6A–E decomposition
- Step 9 Execution
- Mobile-First Design System
- Public Profile Templates
- Packaging & Activation
- Brand Identity

Precedence: Locked Plan → Step 7 → Step 8 → Step 9 → earlier Steps and supporting pages.

**Predecessor:** M5 plan `docs/superpowers/plans/2026-10-11-milestone-5-secure-activation.md` and its local ledger. M5 merged as `418d1ca` (PR #5).

**Baseline:** `main` @ `418d1caaf0227b96bea6d8b0046c01f340e6afea`. Statuses:
- M4: software gate passed, physical hardware acceptance pending.
- M5: software gate passed, physical packaged-card acceptance pending.

The Deferred Hardware Acceptance Rule applies.

**User decisions (2026-10-11, M6 planning):**
1. Self-service account deletion is deferred to M9. M6 shows plain "contact Neffi support" text.
2. The QR encoder is `uqr@0.1.3`, pinned exactly.
3. Cloudinary env vars are required and fail fast. The user supplies a dev Cloudinary account and adds the values to `.env.local` and Vercel Preview before media acceptance and the PR.

---

## Execution & resumption protocol (read before every session)

1. **The canonical plan is this file** on branch `feat/m6-customer-experience`. Chat history and agent-local plan files are not authoritative.
   - The planner has already done the precondition: created the branch from `main` @ `418d1ca` and committed this plan as `docs(m6): add customer mobile experience implementation plan`. Executors start at Task 1.
   - There are 27 tasks. Every code task ends in exactly one commit with the message given in that task.
2. **Handoff state:** git history plus the local ledger `.superpowers/sdd/2026-10-11-milestone-6-customer-mobile-experience/progress.md`.
   - The ledger is git-ignored through `.git/info/exclude`.
   - Never `git add -f` it, and never commit it. There are no ledger-only commits.
3. **Before any work:**
   - `git switch feat/m6-customer-experience`
   - `git status --short` must be clean; otherwise stop and report.
   - `git log --oneline main..HEAD`
   - Read the whole ledger.
4. **The next task** is the lowest-numbered task without a `Status: complete` ledger entry. Never repeat a completed task.
5. **Recovery:** if `git log` shows a task's exact commit message but the ledger has no entry, do not redo the task. Re-run its verification commands and record `Status: complete (recovered)`. Tasks 26 and 27 are verification-only; if their entries are missing, re-run them.
6. **Ledger entry format:** append immediately after each task's commit, and do not commit it.
   ```
   ## Task N — <title>
   - Status: complete
   - Commit: <full SHA | "none (verification only)">
   - Executor: <agent/human identifier>
   - Checks: <each command> → <pass/fail + counts>
   - Result: <one line>
   - Rulings: <none | decision and who approved it>
   ```
7. **Bootstrap:** if the ledger is missing at Task 1, create it with the header `# SDD ledger — plan: docs/superpowers/plans/2026-10-11-milestone-6-customer-mobile-experience.md` and `Plan commit: <SHA>`.
8. **Executor change** (for example Codex → Claude): repeat steps 3–5 and resume at the first task without a completion entry. Never rely on chat memory.
9. **Stop for the user:**
   - Task 15 needs Cloudinary dev credentials in `.env.local`.
   - Task 26 needs a real browser, inbox and Google account.
   - Anything touching Neon, Notion, Vercel or Production.
   - Any push or PR.
   - Any deviation from this plan.

   Record approvals under `Rulings`.
10. **Never record secrets:** no activation codes, OTPs, cookies, session tokens, API secrets or database URLs with passwords.
11. **Change control:** if the code or Notion contradicts this plan, stop, log it under a `Blocked` heading in the ledger, and ask. Do not invent workarounds.

### Lessons carried from M5 (binding)

- **Windows paths with parentheses:** the `pnpm` shim drops quoting. Run path-specific tests as `node node_modules/vitest/vitest.mjs run "<path>"`. Use `corepack pnpm <script>` for package scripts.
- **Request-time reads under `cacheComponents`:** any code that reads the clock (`new Date()`, `Date.now()`) or other request-time data while rendering must `await connection()` (from `next/server`) first. M5 Task 10 found this defect.
  - Prefer not reading the clock in render at all. Display stored timestamps with an absolute `Intl.DateTimeFormat` and do not compute relative times.
  - Domain functions called from Server Actions or Route Handlers may use `new Date()` freely; those are request contexts.
- **Touch targets:** `Button` default `size` renders 32px. Every interactive control in `/app` must be at least 44px: use the new `size="touch"` (Task 1) or `h-11`, and give links `inline-flex min-h-11 items-center`. Task 1 adds a regression test that enforces this for `src/app/(customer)`.
- **Better Auth Google linking stays deliberate:** `disableImplicitLinking`. Local Resend delivery only reaches the verified inbox, so notification acceptance uses the user's own inbox as the Profile owner email.
- **Customer copy never says:** token, HMAC, OAuth, API, webhook, JSON, credential, transaction, challenge, Scene ID, record or resolver. "Scene" is acceptable product vocabulary (Mobile-First Design System: "My Scenes").

---

## 1. Reconciliation findings (code vs. locked docs) — resolved

| Topic | Repository fact (main @ 418d1ca) | Resolution in M6 |
|---|---|---|
| Profile | `profiles` exists (M2): `account_id`, `status` (`draft/published/unpublished`), `full_name`, `headline`, `company`, `bio`, `phone`, `email`, `website`, `location`, `theme` text default `'default'`, `accent_color` (hex CHECK), `image_asset_id`, timestamps, CHECK `profiles_published_needs_name`, unique `(id, account_id)`. | Reused as the shared Identity. Add `default_scene_id`, `active_scene_id` and `image_is_logo` (§4). |
| Flat links | `profile_links` exists, seeded for Ana; no app code reads it. | The 0010 backfill copies the rows into Link blocks of each Profile's Default Scene. The table is kept, frozen and unused, for rollback safety. It is never written or read by M6 code, and the drop is a later reviewed migration (§12 debt). |
| Card → Profile | `cards.profile_id` with composite FK `cards_profile_owner_fk (profile_id, owner_account_id) → profiles(id, account_id)`, plus CHECKs `cards_profile_needs_owner` and `cards_retired_routes_nowhere`. | Reused unchanged. The database already rejects cross-Account routing. |
| Card disable | `cards.disabled_at` exists; CHECK `cards_disabled_needs_owner`. | Reused for disable and re-enable. |
| M5 handoff | `/app` lists owned DBCs with `profile_id IS NULL` as "Ready to set up" (plain text). `ownedCards(db, accountId)` lives in `src/modules/cards/owned.ts`. | Each item becomes a link to `/app/setup/[cardId]` (Task 9). `ownedCards` is unchanged. |
| Email | `createResendSender` in `src/integrations/email/resend.ts`: plain text with a random Idempotency-Key. | Extended with optional `idempotencyKey` and `replyTo` (Task 19). The sender is reused: `AUTH_EMAIL_FROM`. |
| Media | No Cloudinary code or env. `.env.example` says "Added by later milestones: Cloudinary". | New `src/integrations/media/cloudinary.ts` using node crypto and fetch, with no SDK. Three required env vars (Task 15). |
| QR | No encoder installed. | `uqr@0.1.3`, server-rendered SVG data URI (Task 21). |
| Account controls | Better Auth HTTP routes `/unlink-account`, `/revoke-sessions`, `/email-otp/request-email-change` and `/email-otp/change-email` are in `DISABLED_PATHS`. The `auth.api.*` server calls still work (disabledPaths guards only HTTP). | M6 calls them server-side from Server Actions only, and the HTTP paths stay disabled. Enable `emailOTP({ changeEmail: { enabled: true } })` (Task 22). |
| Activity | `ActivityType` union in `src/modules/activity/record.ts`. | Add `card_profile_changed`, `card_disabled` and `card_enabled` (Task 7 / Task 21). |
| Client IP helper | A private `clientIp` in `src/app/(public)/activate/actions.ts`. | Moved to `src/lib/client-ip.ts` and reused by the form Route Handler (Task 18). Behavior is unchanged. |
| Quota | `consumeQuota(db, key, limit)` (10-minute window). | Reused for form submissions per IP and email-change requests per Account. |
| ERD guard | `src/db/erd.db.test.ts` expects "22 tables", "13 enums". | After 0010 the guard expects 26 tables and 15 enums. Regenerate `docs/database/erd.md` with `corepack pnpm db:erd`. |
| Seed | `src/db/seed.ts` truncates an explicit table list. `seed.db.test.ts` requires every non-auth table to have rows. | Add the four new tables to `SEED_TABLES` and seed them (Task 3). |
| Bundle scan | `scripts/check-client-bundle.mjs` `SECRET_VARS`. | Add `CLOUDINARY_API_SECRET` (Task 15). |
| CI env | `.github/workflows/ci.yml` synthetic env. | Add synthetic `CLOUDINARY_*` values (Task 15). |
| Public form submission vs M7 | Step 8 M6D: "public submission persistence; owner Inbox; owner email". Step 8 M7: "ordered public Block/Action rendering and supported public Form submission". | **M6** builds the submission domain service and the same-origin `POST /api/forms/[formId]/submissions` Route Handler (Step 7: "Use Route Handlers for … public form submissions"). **M7** renders the interactive form on `/c/{token}` and calls that endpoint. In M6, submissions are exercised by tests and by a scripted local request (Task 26). |
| Preview vs public renderer | Step 7 says the published public experience is server-rendered from a cached public Scene DTO, which is M7. M6 must show a "mobile preview" before publishing. | M6 builds the pure DTO mapper `buildSceneView` and the presentational `SceneView` component, used only by the owner preview. M7 adds the public loader, caching and invalidation, and reuses both. M6 adds no `/c` route and no caching. |

## 2. Final architecture decisions

| ID | Decision |
|---|---|
| D1 | **Domain shape:** `Account 1→n Profile 1→n Scene 1→n SceneBlock`. `Profile 1→n FormDefinition 1→n FormSubmission`. `SceneBlock(type=form) → FormDefinition` (many blocks may show one form). `PhysicalCard → 0..1 Profile` (existing). There is no Card→Scene link, no per-Card content and no per-Scene theme. |
| D2 | **Default and active Scene** are columns on `profiles`: `default_scene_id` and `active_scene_id`. Both have composite FKs `(scene_id, id) → scenes(id, profile_id)`, so a Profile can only point at its own Scenes. `active_scene_id IS NULL` means "showing the Default Scene". M7 resolves `coalesce(active_scene_id, default_scene_id)`. The Default Scene cannot be deleted: the FK rejects it, and the domain returns a friendly error first. |
| D3 | **Every Profile has a Default Scene.** M6 creates Profiles only through `createProfileFromStarter`, which creates the Default Scene in the same transaction. The 0010 backfill gives existing Profiles one. CHECK `profiles_published_needs_default_scene` guarantees it for Published Profiles at the database level. |
| D4 | **Starter Experience** is a pure recipe in `src/modules/profiles/starters.ts`: `network`, `get_clients` or `show_my_work`. It seeds the Default Scene's name and Blocks, plus Form presets, inside the create transaction. Nothing records which recipe was used. |
| D5 | **Onboarding state is derived; there is no onboarding table.** A claimed Card with `profile_id IS NULL` is "Ready to set up" → `/app/setup/[cardId]`. The purpose choice travels in the URL query (`?purpose=`). It is not secret and is not stored. Submitting essentials creates a **Draft** Profile and connects the Card in one transaction. A Draft Profile is "Not published yet" → `/app/profiles/[id]/publish`. Resume is therefore always reconstructible from the database. |
| D6 | **Lifecycle:** Draft → Published ⇄ Unpublished (the existing enum). Edits apply immediately; there is no separate published copy (Mobile-First: avoid CMS complexity). Publishing requires a full name, at least one of phone, email or website, and at least one visible Block in the Default Scene. While Published, an edit that would break these rules is rejected with a plain message. |
| D7 | **Blocks** are `scene_blocks` rows with `type` (`block_type` enum: `about`, `project`, `link`, `contact`, `booking`, `form`), `position`, `visible` and `content` jsonb. The content is validated by a strict Zod schema per type on every write. It is not customer-supplied JSON: the customer fills plain form fields. Form blocks carry `form_id`, CHECKed. Contact blocks reuse the Profile's contact fields, so no data is duplicated. Order uses dense positions `0..n-1`, renumbered inside a transaction that holds the Profile row lock. |
| D8 | **Scene list order** is the Default Scene first, then by `created_at`. There is no manual Scene reordering in V1. |
| D9 | **Appearance V1:** a single Neffi-maintained theme (`profiles.theme` stays `'default'`; no theme picker until a second theme exists), an accent colour chosen from 8 curated swatches stored as hex, and one image shown as a round photo or, when `image_is_logo`, uncropped. Without an image, the avatar shows initials from the full name on the accent colour. |
| D10 | **Forms:** a fixed field catalogue (`name`, `email`, `phone`, `company`, `message`). Each field is `hidden`, `optional` or `required`. `name` is always required, and at least one of email or phone must be required so the owner can reply. A form can add up to 3 short custom questions. Presets: Connect, Project Inquiry, Contact. There is no branching or calculation logic, no extra pages and no CRM status. |
| D11 | **Submissions:** `POST /api/forms/[formId]/submissions` (Route Handler, same-origin only).<br>**Abuse limits:** Origin must equal the app origin; JSON bodies are capped at 16 KB; 10 submissions per IP per 10 minutes via `consumeQuota`; a honeypot field `website` is silently accepted and dropped; a browser-generated `key` (UUID) is unique per form, so double submits store one row.<br>**Acceptance rules:** the request must target a form that belongs to a Published Profile and is shown by at least one visible Block in that Profile. Answers are validated against the current form and stored as a `[{label, value}]` snapshot. |
| D12 | **Notification:** the submission is persisted first. Then `after()` sends a plain-text email to the Profile owner's Account email through Resend: `Idempotency-Key` = submission id, `Reply-To` = the visitor's email when given. On success it sets `notified_at`. On failure it keeps the submission, logs no payload and does not retry automatically. The Inbox is the source of truth. |
| D13 | **Inbox:** all Profiles of the Account, newest first. Keyset pagination of 20 on `(created_at, id)`. Opening a submission marks it read. The owner may delete a submission after confirming. Unread counts appear on Home and on the Profile. There are no statuses, assignment or pipelines. |
| D14 | **Media:** browser → Cloudinary signed upload.<br>**Signing:** a Server Action authorizes the owner and signs `public_id=neffi/profiles/<profileId>/<uuid>`, `allowed_formats=jpg,png,webp,heic`, `transformation=c_limit,h_2048,w_2048` and `timestamp` with SHA-1.<br>**Confirmation:** a second action verifies through the Cloudinary Admin API that the asset exists, has the expected id prefix, is at most 5 MB in an allowed format, and is at most 2048px. Only then does it store `image_asset_id`, and after commit it deletes the replaced asset (best effort). A failed check deletes the upload.<br>**Delivery:** URLs use two fixed transformations with `f_auto,q_auto`. No customer SVG. The API secret never leaves the server. |
| D15 | **Sharing QR** encodes exactly `cardUrl(env.cardUrlOrigin, card.publicToken)`, the same permanent URL that is on the NFC chip. It is rendered on the server as an SVG `<img>` data URI with a download link. Until M7 ships, opening that URL is not yet the public page. That is expected; M6 verifies the encoded text. |
| D16 | **Cards:** list, detail, connect to another owned Profile (DB-enforced same Account), disable and re-enable. Each change records an Activity Event (`card_profile_changed`, `card_disabled`, `card_enabled`). There is no disconnect-to-nothing, no transfer and no unclaim. |
| D17 | **Account:** shows the signed-in email and sign-in methods. Available controls:<br>- Connect Google (existing);<br>- Remove Google (the email-code method always remains);<br>- change sign-in email, which needs a fresh sign-in (Better Auth `sensitiveSessionMiddleware`) plus a code sent to the new address, with 3 requests per Account per 10 minutes;<br>- sign out everywhere (`revokeSessions`).<br>Deleting the account shows support text (decision 1). |
| D18 | **Limits:**<br>- 10 Profiles per Account;<br>- 5 Scenes per Profile;<br>- 20 Blocks per Scene;<br>- 5 forms per Profile;<br>- 3 custom questions per form.<br>Counts are checked while holding the Account row lock (Profiles) or the Profile row lock (everything else). |
| D19 | **Authorization:** every customer read filters by `account_id = viewer.accountId` in SQL. Pages call `requireAccount("/app")`, actions call `authorize("account")`, and domain mutations take `accountId`, lock the owned row and throw `not_found` for anything not owned. Pages turn `not_found` into `notFound()`. OWNER role grants no access to customer content in M6. |
| D20 | **Transactions and locks:**<br>- **Setup:** Account row `FOR UPDATE` → Card row `FOR UPDATE` (same `lockCard` as M4/M5).<br>- **Profile, Scene, Block and Form mutations:** the Profile row `FOR UPDATE` first.<br>- **Card connect, disable or enable:** the Card row first, then the Profile row.<br>- **Submission:** a single `INSERT … ON CONFLICT DO NOTHING`, with no locks.<br>No code path locks Profile before Card, so lock order is acyclic. |

## 3. Scope

**In M6** (Step 8 M6A–E plus Cards/Account and media):
- the setup handoff and guided onboarding;
- shared Identity editing;
- Starter Experiences;
- Scenes: Default, optional extras, switching which is shown, rename, delete;
- ordered Blocks: add, edit, reorder, show or hide, delete;
- Appearance: accent colour and image or logo;
- native Forms with the Inbox and the notification email;
- the submission Route Handler;
- the owner preview, publish and unpublish;
- the digital Sharing QR;
- Cards and Account management;
- app navigation;
- migration 0010, seed, ERD;
- concurrency proof;
- browser acceptance.

**Explicitly not in M6 (reviewers reject):**
- **M7:** the `/c/{token}` route or any public Card/Profile page; public DTO caching or `revalidateTag` invalidation; the interactive public form UI; the vCard/Save Contact download endpoint; public SEO/noindex for Scenes; signed-in-owner affordances on the public page; the Disabled/Unclaimed/Draft public states.
- **M8:** Orders, release, Support data.
- **M9:** `/support`, account deletion, recovery, wrong-account correction, consolidation.
- **M10:** Turnstile, CSP, Cloudinary strict-transformation settings, limit tuning, the `profile_links` drop.
- **Post-V1:** per-Card Scene overrides, per-Scene themes, temporary or expiring Scenes, Smart GitHub, Google Sheets/Notion/webhooks/Zapier, API keys or customer secrets, OAuth integrations, CRM pipelines, form branching or logic, file or PDF blocks, analytics.

## 4. Schema and migration 0010 (additive)

### New enums (`src/db/schema/enums.ts`)

```ts
export const blockType = pgEnum("block_type", ["about", "project", "link", "contact", "booking", "form"]);
export const formPreset = pgEnum("form_preset", ["connect", "project_inquiry", "contact"]);
```

### `profiles` additions (`src/db/schema/profiles.ts`)

New columns, after `imageAssetId`:
```ts
    // Every profile has a Default Scene; a NULL active scene means the Default Scene is showing.
    defaultSceneId: uuid(),
    activeSceneId: uuid(),
    // The single image is shown uncropped when it is a logo, otherwise as a round photo.
    imageIsLogo: boolean().notNull().default(false),
```
New constraints, added to the existing array:
```ts
    // Scenes are pointed at only within the same profile (MATCH SIMPLE: NULL skips the check).
    foreignKey({ name: "profiles_default_scene_fk", columns: [t.defaultSceneId, t.id], foreignColumns: [scenes.id, scenes.profileId] }),
    foreignKey({ name: "profiles_active_scene_fk", columns: [t.activeSceneId, t.id], foreignColumns: [scenes.id, scenes.profileId] }),
    check("profiles_published_needs_default_scene", sql`${t.status} <> 'published' OR ${t.defaultSceneId} IS NOT NULL`),
```
`profiles` and `scenes` reference each other. If TypeScript reports TS7022/TS7024 (implicit any in a circular initializer), annotate the callback return types: `.references((): AnyPgColumn => profiles.id, …)` (import `type AnyPgColumn` from `drizzle-orm/pg-core`). Do not restructure the files.

### New tables (`src/db/schema/profiles.ts`, after `profileLinks`)

```ts
// A context-specific presentation of a Profile. Belongs to the Profile, never to a Card.
export const scenes = pgTable(
  "scenes",
  {
    id: uuid().primaryKey().defaultRandom(),
    profileId: uuid()
      .notNull()
      .references((): AnyPgColumn => profiles.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [
    check("scenes_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 40`),
    unique("scenes_id_profile_unique").on(t.id, t.profileId),
    index("scenes_profile_id_idx").on(t.profileId),
  ],
);

// Constrained, owner-configured form. Owned by the Profile so submissions outlive any block that shows it.
export const formDefinitions = pgTable(
  "form_definitions",
  {
    id: uuid().primaryKey().defaultRandom(),
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    preset: formPreset().notNull(),
    title: text().notNull(),
    // { fields: { name|email|phone|company|message: "hidden"|"optional"|"required" }, questions: [{ id, label, required }] },
    // validated by src/modules/forms/config.ts on every write.
    config: jsonb().notNull(),
    ...timestamps(),
  },
  (t) => [
    check("form_definitions_title_length", sql`char_length(${t.title}) BETWEEN 1 AND 60`),
    check("form_definitions_config_object", sql`jsonb_typeof(${t.config}) = 'object'`),
    unique("form_definitions_id_profile_unique").on(t.id, t.profileId),
    index("form_definitions_profile_id_idx").on(t.profileId),
  ],
);

// One structured content/action item. Content is type-specific and validated by src/modules/profiles/block-content.ts.
export const sceneBlocks = pgTable(
  "scene_blocks",
  {
    id: uuid().primaryKey().defaultRandom(),
    sceneId: uuid()
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    type: blockType().notNull(),
    position: integer().notNull(),
    visible: boolean().notNull().default(true),
    content: jsonb().notNull().default(sql`'{}'::jsonb`),
    formId: uuid().references(() => formDefinitions.id),
    ...timestamps(),
  },
  (t) => [
    check("scene_blocks_position_nonnegative", sql`${t.position} >= 0`),
    check("scene_blocks_content_object", sql`jsonb_typeof(${t.content}) = 'object'`),
    check("scene_blocks_form_only_on_form", sql`(${t.type} = 'form') = (${t.formId} IS NOT NULL)`),
    index("scene_blocks_scene_id_position_idx").on(t.sceneId, t.position),
    index("scene_blocks_form_id_idx").on(t.formId).where(sql`${t.formId} IS NOT NULL`),
  ],
);

// A visitor's message. Neffi's copy is the source of truth; email is only a notification.
export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    formId: uuid().notNull(),
    profileId: uuid().notNull(),
    // Generated by the visitor's browser per form view; a double submit or retry stores one submission.
    clientKey: uuid().notNull(),
    // Snapshot of what the visitor saw and typed: [{ label, value }]. Later form edits never change it.
    answers: jsonb().notNull(),
    createdAt: createdAt(),
    readAt: timestamp({ withTimezone: true }),
    notifiedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "form_submissions_form_fk",
      columns: [t.formId, t.profileId],
      foreignColumns: [formDefinitions.id, formDefinitions.profileId],
    }).onDelete("cascade"),
    check("form_submissions_answers_array", sql`jsonb_typeof(${t.answers}) = 'array'`),
    unique("form_submissions_form_client_key_unique").on(t.formId, t.clientKey),
    index("form_submissions_profile_created_idx").on(t.profileId, t.createdAt.desc()),
  ],
);
```
Imports to add: `boolean` (already there), `foreignKey`, `jsonb`, `timestamp`, `type AnyPgColumn`, plus `blockType` and `formPreset` from `./enums`.

**Deletion semantics (database-enforced):**
- **Deleting a Profile** cascades to its Scenes, Blocks, forms and submissions. It is blocked by `cards_profile_owner_fk` while any Card points at it.
- **Deleting the Default Scene** fails on `profiles_default_scene_fk` (NO ACTION).
- **Deleting a form Block** leaves its form and submissions intact. An orphaned form no longer accepts submissions (D11).

### Migration file

1. Run `corepack pnpm db:generate`. Drizzle names the file `drizzle/0010_<adjective_noun>.sql`; keep the generated name.
2. Edit the generated SQL **once**. Insert the backfill block below **immediately before** the statement `ALTER TABLE "profiles" ADD CONSTRAINT "profiles_published_needs_default_scene" …`, so the CHECK is validated against backfilled rows:
```sql
--> statement-breakpoint
-- Every existing Profile gets a Default Scene; its flat links become ordered Link blocks there.
-- profile_links is kept unchanged (unused from M6 on) so this migration stays reversible.
INSERT INTO "scenes" ("profile_id", "name") SELECT "id", 'Main' FROM "profiles";--> statement-breakpoint
UPDATE "profiles" p SET "default_scene_id" = s."id" FROM "scenes" s WHERE s."profile_id" = p."id";--> statement-breakpoint
INSERT INTO "scene_blocks" ("scene_id", "type", "position", "visible", "content")
SELECT p."default_scene_id", 'link',
       (row_number() OVER (PARTITION BY l."profile_id" ORDER BY l."position", l."created_at", l."id") - 1)::int,
       l."visible",
       jsonb_strip_nulls(jsonb_build_object('kind', l."type"::text, 'label', l."label", 'url', l."url"))
FROM "profile_links" l JOIN "profiles" p ON p."id" = l."profile_id";--> statement-breakpoint
```
   If the generated file orders the FK constraints after that CHECK, that is fine. The backfill only needs the new tables and columns to exist, and Drizzle emits `CREATE TABLE` and `ADD COLUMN` statements first. Confirm by reading the file.
3. **Rollback, documented in the migration header comment:** drop the four tables, the three columns and the two enums. `profile_links` still holds the pre-M6 links, so a rollback loses only M6-created content.

## 5. Interfaces (exact; later tasks rely on these names)

```ts
// src/components/ui/button.tsx — new size variant (Task 1)
size: { …, touch: "h-11 gap-1.5 px-4" }

// src/components/ui/input.tsx (Task 1)
export const inputClass: string;   // 44px text field style shared by all /app and /activate forms
export function Input(props: React.ComponentProps<"input">): JSX.Element;
export function Textarea(props: React.ComponentProps<"textarea">): JSX.Element;

// src/lib/safe-url.ts (Task 4, pure)
export function normalizeLink(raw: string): string | null; // adds https:// when no scheme; https only; ≤2048; no userinfo

// src/lib/client-ip.ts (Task 18, pure)
export const clientIp: (headers: Headers) => string;

// src/modules/profiles/rules.ts (Task 4, pure)
export const LIMITS: { profilesPerAccount: 10; scenesPerProfile: 5; blocksPerScene: 20; formsPerProfile: 5 };
export const ACCENTS: readonly { name: string; hex: `#${string}` }[];        // 8 swatches
export const identitySchema: z.ZodType<Identity>;
export type Identity = { fullName: string; headline: string | null; company: string | null; bio: string | null; phone: string | null; email: string | null; website: string | null; location: string | null };
export type PublishGap = "name" | "contact" | "content";
export function publishGaps(input: { fullName: string | null; phone: string | null; email: string | null; website: string | null; visibleDefaultBlocks: number }): PublishGap[];

// src/modules/profiles/block-content.ts (Task 4, pure)
export type BlockType = "about" | "project" | "link" | "contact" | "booking" | "form";
export type BlockContent =
  | { type: "about"; text: string }
  | { type: "project"; title: string; description: string | null; url: string | null }
  | { type: "link"; kind: LinkKind; label: string | null; url: string }
  | { type: "contact"; saveContact: boolean }
  | { type: "booking"; label: string | null; url: string }
  | { type: "form" };
export function parseBlockContent(type: BlockType, input: Record<string, unknown>): { ok: true; content: Record<string, unknown> } | { ok: false };

// src/modules/forms/config.ts (Task 5, pure)
export const FORM_FIELDS: readonly ["name", "email", "phone", "company", "message"];
export type FieldMode = "hidden" | "optional" | "required";
export type FormConfig = { fields: Record<(typeof FORM_FIELDS)[number], FieldMode>; questions: { id: string; label: string; required: boolean }[] };
export const PRESETS: Record<"connect" | "project_inquiry" | "contact", { title: string; config: FormConfig }>;
export function parseFormConfig(input: unknown): { ok: true; config: FormConfig } | { ok: false };
export type Answer = { label: string; value: string };
export function validateAnswers(config: FormConfig, raw: Record<string, unknown>): { ok: true; answers: Answer[]; replyTo: string | null } | { ok: false; fields: string[] };
export function visibleFields(config: FormConfig): { key: string; label: string; required: boolean; kind: "text" | "email" | "tel" | "long" }[];

// src/modules/profiles/starters.ts (Task 6, pure)
export type Purpose = "network" | "get_clients" | "show_my_work";
export const PURPOSES: Record<Purpose, { label: string; description: string; sceneName: string; linkLabel: string }>;
export type Essentials = { fullName: string; headline: string | null; bio: string | null; email: string | null; phone: string | null; link: string | null };
export const essentialsSchema: z.ZodType<Essentials>;
export type BlockSeed = { type: BlockType; content: Record<string, unknown>; preset?: keyof typeof PRESETS };
export function starterBlocks(purpose: Purpose, essentials: Essentials): BlockSeed[];

// src/modules/profiles/errors.ts (Task 7)
export type ProfileErrorCode = "not_found" | "limit_reached" | "not_ready" | "has_cards" | "default_scene" | "invalid";
export class ProfileError extends Error { readonly code: ProfileErrorCode; readonly gaps: PublishGap[] }

// src/modules/profiles/profiles.ts (Tasks 7–8, server-only)
export function createProfileFromStarter(db: Db, input: { accountId: string; cardId: string; purpose: Purpose; essentials: Essentials }): Promise<{ profileId: string; created: boolean }>;
export function ownedProfiles(db: Db, accountId: string): Promise<{ id: string; fullName: string | null; status: "draft" | "published" | "unpublished"; unread: number }[]>;
export function getOwnedProfile(db: Db, accountId: string, profileId: string): Promise<OwnedProfile | null>;
export function publishProfile(db: Db, input: { accountId: string; profileId: string }): Promise<void>;
export function unpublishProfile(db: Db, input: { accountId: string; profileId: string }): Promise<void>;
export function updateIdentity(db: Db, input: { accountId: string; profileId: string; identity: Identity }): Promise<void>;
export function updateAppearance(db: Db, input: { accountId: string; profileId: string; accentColor: string; imageIsLogo: boolean }): Promise<void>;
export function setProfileImage(db: Db, input: { accountId: string; profileId: string; assetId: string | null }): Promise<{ previousAssetId: string | null }>;
export function deleteProfile(db: Db, input: { accountId: string; profileId: string }): Promise<{ imageAssetId: string | null }>;

// src/modules/profiles/scenes.ts (Task 11, server-only)
export function createScene(db: Db, input: { accountId: string; profileId: string; name: string; copyFromSceneId: string | null }): Promise<{ sceneId: string }>;
export function renameScene(db: Db, input: { accountId: string; profileId: string; sceneId: string; name: string }): Promise<void>;
export function deleteScene(db: Db, input: { accountId: string; profileId: string; sceneId: string }): Promise<void>;
export function showScene(db: Db, input: { accountId: string; profileId: string; sceneId: string }): Promise<void>; // Default → stores NULL

// src/modules/profiles/blocks.ts (Task 12, server-only)
export function addBlock(db: Db, input: { accountId: string; profileId: string; sceneId: string; type: BlockType; content: Record<string, unknown>; preset?: keyof typeof PRESETS }): Promise<{ blockId: string }>;
export function updateBlock(db: Db, input: { accountId: string; profileId: string; blockId: string; content: Record<string, unknown> }): Promise<void>;
export function moveBlock(db: Db, input: { accountId: string; profileId: string; blockId: string; direction: "up" | "down" }): Promise<void>;
export function setBlockVisible(db: Db, input: { accountId: string; profileId: string; blockId: string; visible: boolean }): Promise<void>;
export function deleteBlock(db: Db, input: { accountId: string; profileId: string; blockId: string }): Promise<void>;

// src/modules/profiles/scene-view.ts (Task 10, pure — reused by M7's public loader)
export type SceneView = { identity: ViewIdentity; scene: { id: string; name: string }; blocks: ViewBlock[] };
export function buildSceneView(input: SceneViewInput): SceneView;

// src/modules/profiles/view.ts (Task 10, server-only; Task 16 adds the image URL)
export function loadOwnerSceneView(db: Db, input: { accountId: string; profileId: string; sceneId?: string }): Promise<SceneView | null>;

// src/components/scene-view.tsx (Task 10)
export function SceneViewPreview({ view }: { view: SceneView }): JSX.Element;   // forms render disabled with a preview note

// src/modules/forms/forms.ts (Task 17, server-only)
export function updateForm(db: Db, input: { accountId: string; profileId: string; formId: string; title: string; config: unknown }): Promise<void>;

// src/modules/forms/submissions.ts (Tasks 18, 20, server-only)
export type SubmitResult = { status: "created"; submissionId: string; replyTo: string | null } | { status: "duplicate"; submissionId: string } | { status: "unavailable" } | { status: "invalid"; fields: string[] };
export function submitForm(db: Db, input: { formId: string; clientKey: string; answers: Record<string, unknown> }): Promise<SubmitResult>;
export function listInbox(db: Db, input: { accountId: string; before?: { createdAt: Date; id: string } }): Promise<{ items: InboxItem[]; next: { createdAt: Date; id: string } | null }>;
export function openSubmission(db: Db, input: { accountId: string; submissionId: string }): Promise<SubmissionDetail | null>; // marks read
export function deleteSubmission(db: Db, input: { accountId: string; submissionId: string }): Promise<void>;
export function unreadCount(db: Db, accountId: string): Promise<number>;

// src/modules/forms/notify.ts (Task 19, server-only)
export function notifySubmission(db: Db, send: EmailSender, input: { submissionId: string; appOrigin: string; replyTo: string | null }): Promise<void>; // never throws

// src/integrations/email/resend.ts (Task 19)
export type Email = { to: string; subject: string; text: string; replyTo?: string; idempotencyKey?: string };

// src/integrations/media/cloudinary.ts (Task 15, server-only)
export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };
export function signImageUpload(config: CloudinaryConfig, input: { profileId: string; now?: Date }): ImageUploadTicket;
export function isProfileImageId(profileId: string, publicId: string): boolean;
export function checkImage(image: { bytes: number; width: number; height: number; format: string }): boolean;
export function getImage(config: CloudinaryConfig, publicId: string): Promise<{ bytes: number; width: number; height: number; format: string } | null>;
export function destroyImage(config: CloudinaryConfig, publicId: string): Promise<void>;
export function imageUrl(cloudName: string, publicId: string, isLogo: boolean): string;

// src/modules/cards/manage.ts (server-only; Task 7 adds connectCardToProfile, Task 21 adds the rest)
export function cardSummaries(db: Db, accountId: string): Promise<CardSummary[]>;
export function getOwnedCard(db: Db, accountId: string, cardId: string): Promise<CardSummary | null>;
export function connectCardToProfile(db: Db, input: { accountId: string; cardId: string; profileId: string }): Promise<void>;
export function setCardDisabled(db: Db, input: { accountId: string; cardId: string; disabled: boolean }): Promise<void>;

// src/modules/cards/qr.ts (Task 21)
export function qrSvgDataUri(text: string): string;
```

## 6. Customer routes, states and copy

All routes live under `src/app/(customer)/app/`. They inherit the existing layout, which calls `requireAccount("/app")` and sets `noindex` and `instant = false`. Every page also calls `requireAccount("/app")`, and every action calls `authorize("account")`.

**Navigation (Task 23):** a fixed bottom bar with **Home** (`/app`), **Profiles** (`/app/profiles`), **Cards** (`/app/cards`) and **Account** (`/app/account`). Links use `aria-current="page"` and `min-h-11`. The Inbox is reached from Home and from each Profile; it is not a fifth tab (Step 5 revision).

| Route | Purpose | Key states and copy (exact) |
|---|---|---|
| `/app` | Home | "Ready to set up": each item is a link "Set up Neffi ending in WXYZ" → `/app/setup/[cardId]`. "Not published yet": each item is a link "Preview and publish {name}" → `/app/profiles/[id]/publish`. "Messages": "1 new message" / "{n} new messages" → `/app/inbox` (shown when n > 0). "Your profiles": name + status → `/app/profiles/[id]`. `?added=1` keeps the M5 status line. Link "Activate another Neffi" / "Activate a Neffi" (M5 behaviour). |
| `/app/setup/[cardId]` | Onboarding | With existing Profiles and no `?purpose`: heading "Set up your Neffi"; "Show one of your profiles on this card" with one button per Profile ("Use {name}"); then the button "Create a new profile" → `?step=purpose`. Purpose step: heading "What do you want your Neffi to help you do?" with three large buttons (label + description from `PURPOSES`). `?purpose=<valid>`: heading "Your essentials"; fields "Full name" (required), "What you do", "Short intro", "Email", "Phone" and the purpose link field; note "You can change all of this later."; button "Create my Neffi". Card already set up → redirect `/app/profiles/[profileId]`. Card not owned → `notFound()`. |
| `/app/profiles` | List | Each Profile: name (or "Untitled profile") and status word ("Draft", "Published", "Unpublished"). No "New profile" button: Profiles are created by setting up a Card (D5). |
| `/app/profiles/[id]` | Overview | Heading name; status; `?published=1` → `role=status` "Your Neffi is live."<br>Sections: "Now showing" ({scene name}, then a button "Show this" per other Scene); "Scenes" (links to edit, "(Default)" marker, "Add a scene" form: name plus "Start from: Empty / Copy of {scene}"); "Your details" → `/identity`; "Appearance" → `/appearance`; "Preview" → `/preview`; "Messages" → `/app/inbox`; "Cards showing this profile" (suffixes).<br>Publish button "Publish" (from Draft or Unpublished) or "Unpublish" (from Published). Missing requirements are listed with `PUBLISH_GAP_COPY`.<br>"Delete profile": confirm checkbox "I understand this deletes this profile, its scenes and its messages", button "Delete profile". When Cards are connected it is replaced by the text "Move or disable the cards showing this profile before deleting it." |
| `/app/profiles/[id]/identity` | Edit details | Fields: Full name, What you do, Company, Short intro, Phone, Email, Website, Location. Button "Save". |
| `/app/profiles/[id]/appearance` | Appearance | "Accent colour" (8 swatch radio buttons with names, 44px). "Show my image as": Photo / Logo. "Image": Upload / Replace / Remove. Accepted image types are listed. Button "Save". |
| `/app/profiles/[id]/preview` | Owner preview | Renders `SceneViewPreview` for `?scene=` or the shown Scene, inside a max-w-[390px] frame, with the note "This is a preview. Visitors see this when your Neffi is published." Scene switcher links. |
| `/app/profiles/[id]/publish` | Setup end | Heading "Your Neffi is ready" (Draft). Preview of the Default Scene. If there are gaps, `PUBLISH_GAP_COPY` items plus "Edit details". Button "Publish" → `/app/profiles/[id]?published=1`. Secondary link "Edit before publishing" → `/app/profiles/[id]`. A non-Draft Profile redirects to the overview. |
| `/app/profiles/[id]/scenes/[sceneId]` | Scene editor | Name field + "Rename". Ordered Block list: each row shows the type label and summary, plus buttons "Move up", "Move down", "Hide"/"Show", "Edit" and "Remove" (Remove needs a confirm checkbox).<br>"Add to this scene": links "Add About", "Add Project", "Add Link", "Add Contact", "Add Booking", "Add Form". Types not yet in the Scene are listed first.<br>"Delete scene" is hidden for the Default Scene. |
| `/app/profiles/[id]/scenes/[sceneId]/blocks/new?type=` | Add block | Type-specific fields (§7). Form type: choose "Connect", "Project inquiry" or "Contact", then "Add". |
| `/app/profiles/[id]/scenes/[sceneId]/blocks/[blockId]` | Edit block | Type-specific fields. A form Block edits its form (§7). |
| `/app/inbox` | Inbox | Newest first: "{first answer value}" preview, profile name, form title, date, and an unread dot with text "New". A "Show older" link (`?before=`) when there is a next page. Empty state: "No messages yet. Messages people send from your Neffi appear here." |
| `/app/inbox/[submissionId]` | Message | Labels and values, the date, and "Reply by email" (`mailto:`, only when an email answer exists). Delete: confirm checkbox + "Delete message". |
| `/app/cards` | Cards | Each Card: "Neffi ending in WXYZ", "Shows {profile name}" or "Not set up yet", and "Turned off" when disabled. |
| `/app/cards/[cardId]` | Card | "Shows" select (owned Profiles) + "Save". "Turn off this card" / "Turn on this card" with confirm text "When it's off, tapping it won't show your profile." "Share your Neffi": the QR image (alt "QR code for your Neffi link"), the link text, "Download QR code" (`download="neffi-qr.svg"`) and the note "Anyone who scans this opens the same page as tapping your card." |
| `/app/account` | Account | "Signed in as {email}". "Sign-in methods": Email code (always), Google (if linked). "Connect Google" (existing), or "Remove Google" (with the note "You can still sign in with an email code."). "Change sign-in email": new address → "Send code" → 6-digit code → "Change email". "Sign out everywhere". "Delete your account": text "To delete your account, please contact Neffi support." (decision 1). |

**`PUBLISH_GAP_COPY`** in `src/modules/profiles/rules.ts`:
```ts
export const PUBLISH_GAP_COPY: Record<PublishGap, string> = {
  name: "Add your full name.",
  contact: "Add a phone number, email or website so people can reach you.",
  content: "Show at least one item in your main scene.",
};
```

**Error copy** (shared `MESSAGES` in each action file):

| Error code | Copy |
|---|---|
| `not_found` | Rendered as `notFound()` |
| `limit_reached` | "You've reached the limit for this. Remove one first." |
| `not_ready` | The `PUBLISH_GAP_COPY` lines |
| `has_cards` | "Move or disable the cards showing this profile before deleting it." |
| `default_scene` | "Your main scene can't be deleted." |
| `invalid` | "Check the highlighted fields and try again." |

## 7. Block and form fields (customer-facing)

| Block | Fields (labels exact) | Stored `content` |
|---|---|---|
| About | "About you" (textarea, ≤1000) | `{ text }` |
| Project | "Project name" (≤80, required), "Short description" (≤500), "Link" (optional) | `{ title, description, url }` (nulls kept) |
| Link | "Type" (select of the 16 link kinds with friendly names), "Label" (optional, ≤40), "Link" (required) | `{ kind, label, url }` |
| Contact | "Show a Save Contact button" (checkbox, default on) | `{ saveContact }` |
| Booking | "Button text" (optional, ≤40; shown as "Book a time" when empty), "Booking link" (required) | `{ label, url }` |
| Form | "Form title" (≤60). For each of Your name (locked Required), Email, Phone, Company and Message: a select Hidden / Optional / Required. "Your questions": up to 3 rows of question text plus a "Required" checkbox, and an "Add a question" button. | Block `{}` + `form_definitions.config` |

Link kind friendly names: Facebook, Instagram, TikTok, LinkedIn, YouTube, GitHub, Messenger, WhatsApp, Viber, Telegram, X, Portfolio, Booking, Shop, Menu, Other. The internal `custom` kind displays as "Other". Customer-entered links accept `example.com`, which is stored as `https://example.com/`. Anything that is not https after normalization is rejected with "Enter a web address starting with https://".

## Global Constraints

- **Next.js 16.4.** Before Tasks 9, 10, 13, 14, 16, 18, 19 and 22, read the relevant files in `node_modules/next/dist/docs/01-app/`:
  - `03-api-reference/04-functions/{cookies,after,connection,redirect,not-found}.md`;
  - `02-guides/server-actions.md`;
  - `01-getting-started/15-route-handlers.md`.
- **Mobile-first at 390×844:**
  - single column, `max-w-sm` (forms) or `max-w-md` (lists);
  - `px-4`;
  - no horizontal scroll;
  - every control at least 44px (see Lessons);
  - every input has a visible `<label>`;
  - errors render in `role="alert"`, status in `role="status"`;
  - color is never the only signal (unread shows the text "New").
- **No relative times and no clock reads during render.** Dates display with `formatDateTime` from `src/lib/format-date.ts` (Task 20: `en-US`, `dateStyle: "medium"`, `timeStyle: "short"`, `timeZone: "Asia/Manila"`).
- **Server-only boundary:** every new server module starts with `import "server-only";` and is added to `SERVER_ONLY_ENTRYPOINTS` in `src/server-only-boundary.test.ts`. Pure modules (`rules.ts`, `block-content.ts`, `starters.ts`, `config.ts`, `safe-url.ts`, `client-ip.ts`, the pure part of `view.ts`) must not import `server-only`, `@/db` or `@/config/env`.
- **Client Components receive minimal DTOs** and never raw rows. No Cloudinary secret, database handle or env object is ever imported into a `"use client"` file.
- **Queries select explicit columns** (no `select()` without a projection in app paths) and paginate unbounded lists. Pages make no N+1 queries: one query per list with joins or aggregates.
- **No new dependencies except `uqr@0.1.3`,** pinned exactly in Task 21. No Cloudinary SDK, no QR library other than `uqr`, no form library and no drag-and-drop library.
- **No Neon, Notion, Vercel or Production mutation, and no push or PR.** All database work runs against PGlite or loopback PostgreSQL.
- **Activity notes never contain** customer content, codes or secrets.
- **Physical evidence:** do not fabricate physical NFC/package evidence. M6 creates no hardware claims.

## Review Focus

1. **A second Card for an Account that already has Profiles.** Setup must offer "Use {name}" without creating a duplicate Profile, and the Card must show that Profile immediately. Tested in Tasks 7 and 9 (`connectCardToProfile` via setup).
2. **Double-tapping "Create my Neffi"** or resubmitting after a slow network. Expect exactly one Profile, with the second request redirected to it. Tested in Task 7 (`created:false`) and Task 24 (concurrent).
3. **Hiding or removing the last visible Block of the Default Scene, or clearing every contact method, while Published.** Expect a plain refusal (D6). The Profile never becomes "Published but empty". Tested in Tasks 8 and 12.
4. **A form that was removed from every Scene still receives submissions from an old open page.** Expect `unavailable` (404) with no row stored, while earlier submissions stay in the Inbox. Tested in Task 18.
5. **Pasted links without `https://`, `http://` links, and `javascript:` or `data:` links.** Expect normalization or rejection, so only `https:` is stored. Tested in Task 4.

---

## Task 1: Touch-safe UI primitives and guard

**Files:**
- Modify: `src/components/ui/button.tsx` (add the `touch` size)
- Create: `src/components/ui/input.tsx`
- Modify: `src/app/(public)/sign-in/sign-in-form.tsx` (import `inputClass` from `@/components/ui/input`, keep re-export `export { inputClass }` so M5 imports keep working) and `src/app/(public)/activate/activate-forms.tsx` (import from `@/components/ui/input`)
- Create: `src/app/(customer)/touch-targets.test.ts`

**Interfaces:** Produces `Button size="touch"`, `inputClass`, `Input` and `Textarea` (§5).

- [ ] **Step 1: Write the failing test** `src/app/(customer)/touch-targets.test.ts`:
```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { buttonVariants } from "@/components/ui/button";

// Opening tags of a JSX element, tolerant of `=>` and nested braces inside attributes.
export function openingTags(source: string, name: string): string[] {
  const tags: string[] = [];
  for (let i = source.indexOf(`<${name}`); i !== -1; i = source.indexOf(`<${name}`, i + 1)) {
    if (!/[\s/>]/.test(source[i + name.length + 1] ?? "")) continue;
    let depth = 0;
    let j = i;
    for (; j < source.length; j++) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") depth--;
      else if (source[j] === ">" && depth === 0) break;
    }
    tags.push(source.slice(i, j + 1));
  }
  return tags;
}

const TALL = /size="touch"|\bh-11\b|\bmin-h-11\b|\bsize-11\b/;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const files = walk("src/app/(customer)").filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"));

test("the touch size is 44px", () => {
  expect(buttonVariants({ size: "touch" })).toContain("h-11");
});

test("the tag scanner sees through arrow functions", () => {
  expect(openingTags('<Button onClick={() => go()} className="h-8">Go</Button>', "Button")).toEqual([
    '<Button onClick={() => go()} className="h-8">',
  ]);
});

test.each(files)("%s: every Button and Link is at least 44px tall", (file) => {
  const source = readFileSync(file, "utf8");
  for (const tag of [...openingTags(source, "Button"), ...openingTags(source, "Link")]) expect(tag, file).toMatch(TALL);
});
```
- [ ] **Step 2: Verify it fails.** Run `node node_modules/vitest/vitest.mjs run "src/app/(customer)/touch-targets.test.ts"`. Expected: FAIL on "the touch size is 44px" (`size: "touch"` is not a variant). The per-file cases pass on the current M5 files.
- [ ] **Step 3: Implement.**
  - In `button.tsx`, add `touch: "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",` to `size`.
  - Create `src/components/ui/input.tsx`:
```tsx
import type { ComponentProps } from "react";
import { cn } from "cn";

// 44px text fields shared by every customer form (touch-target rule, M5 Task 10I).
export const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "h-auto min-h-24 py-2", className)} {...props} />;
}
```
  - In `sign-in-form.tsx`, replace the local `export const inputClass = "…"` with `import { inputClass } from "@/components/ui/input";` and `export { inputClass };`.
  - In `activate-forms.tsx`, change the import to `@/components/ui/input`.

  The class string is identical to M5's except for the added `aria-invalid` style.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run "src/app/(customer)" "src/app/(public)"`, then `corepack pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/components/ui "src/app/(customer)/touch-targets.test.ts" "src/app/(public)/sign-in/sign-in-form.tsx" "src/app/(public)/activate/activate-forms.tsx" && git commit -m "feat(ui): touch-safe button size, shared inputs and touch-target guard"`
- [ ] **Step 6: Ledger.** Create the ledger (protocol step 7) and append the Task 1 entry.

## Task 2: Schema and migration 0010

**Files:**
- Modify: `src/db/schema/enums.ts`, `src/db/schema/profiles.ts`
- Create: `drizzle/0010_*.sql` (generated + backfill), `drizzle/meta/*` (generated), `src/db/scenes.db.test.ts`, `src/db/migration-0010.db.test.ts`

**Interfaces:**
- Consumes: existing `profiles`, `cards`, `accounts` and fixtures.
- Produces: the tables and constraints in §4.

- [ ] **Step 1: Write the failing tests.**

  `src/db/scenes.db.test.ts` (PGlite, `rollback`, `expectPgError` exactly as in `src/db/profiles.db.test.ts`):
```ts
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { cards, formDefinitions, formSubmissions, profiles, sceneBlocks, scenes } from "./schema";
import { insertAccount, insertClaimedCard, insertProfile } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb, type TestTx } from "./testing";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const CONFIG = { fields: { name: "required", email: "required", phone: "optional", company: "hidden", message: "required" }, questions: [] };
async function profileWithScene(tx: TestTx) {
  const profile = await insertProfile(tx, (await insertAccount(tx)).id);
  const [scene] = await tx.insert(scenes).values({ profileId: profile.id, name: "Main" }).returning();
  await tx.update(profiles).set({ defaultSceneId: scene.id }).where(eq(profiles.id, profile.id));
  return { profile, scene };
}

describe("scenes", () => {
  test("names are 1–40 characters", () =>
    rollback(db, async (tx) => {
      const profile = await insertProfile(tx, (await insertAccount(tx)).id);
      await expectPgError(tx, (s) => s.insert(scenes).values({ profileId: profile.id, name: "" }), "23514", "scenes_name_length");
      await expectPgError(tx, (s) => s.insert(scenes).values({ profileId: profile.id, name: "x".repeat(41) }), "23514", "scenes_name_length");
    }));

  test("a profile can only point at its own scenes", () =>
    rollback(db, async (tx) => {
      const a = await profileWithScene(tx);
      const b = await profileWithScene(tx);
      await expectPgError(tx, (s) => s.update(profiles).set({ defaultSceneId: b.scene.id }).where(eq(profiles.id, a.profile.id)), "23503", "profiles_default_scene_fk");
      await expectPgError(tx, (s) => s.update(profiles).set({ activeSceneId: b.scene.id }).where(eq(profiles.id, a.profile.id)), "23503", "profiles_active_scene_fk");
    }));

  test("a published profile needs a default scene", () =>
    rollback(db, async (tx) => {
      const profile = await insertProfile(tx, (await insertAccount(tx)).id);
      await expectPgError(
        tx,
        (s) => s.update(profiles).set({ status: "published", fullName: "Synthetic" }).where(eq(profiles.id, profile.id)),
        "23514",
        "profiles_published_needs_default_scene",
      );
    }));

  test("the default scene cannot be deleted", () =>
    rollback(db, async (tx) => {
      const { scene } = await profileWithScene(tx);
      await expectPgError(tx, (s) => s.delete(scenes).where(eq(scenes.id, scene.id)), "23503", "profiles_default_scene_fk");
    }));
});

describe("blocks, forms and submissions", () => {
  test("only form blocks carry a form; content is an object; positions are non-negative", () =>
    rollback(db, async (tx) => {
      const { profile, scene } = await profileWithScene(tx);
      const [form] = await tx.insert(formDefinitions).values({ profileId: profile.id, preset: "contact", title: "Contact", config: CONFIG }).returning();
      await expectPgError(tx, (s) => s.insert(sceneBlocks).values({ sceneId: scene.id, type: "form", position: 0 }), "23514", "scene_blocks_form_only_on_form");
      await expectPgError(tx, (s) => s.insert(sceneBlocks).values({ sceneId: scene.id, type: "about", position: 0, formId: form.id }), "23514", "scene_blocks_form_only_on_form");
      await expectPgError(tx, (s) => s.insert(sceneBlocks).values({ sceneId: scene.id, type: "about", position: -1 }), "23514", "scene_blocks_position_nonnegative");
      await expectPgError(tx, (s) => s.insert(sceneBlocks).values({ sceneId: scene.id, type: "about", position: 0, content: [] as never }), "23514", "scene_blocks_content_object");
      await tx.insert(sceneBlocks).values({ sceneId: scene.id, type: "form", position: 0, formId: form.id });
    }));

  test("a submission belongs to its form's profile and is stored once per client key", () =>
    rollback(db, async (tx) => {
      const { profile } = await profileWithScene(tx);
      const other = await profileWithScene(tx);
      const [form] = await tx.insert(formDefinitions).values({ profileId: profile.id, preset: "contact", title: "Contact", config: CONFIG }).returning();
      const key = crypto.randomUUID();
      await expectPgError(tx, (s) => s.insert(formSubmissions).values({ formId: form.id, profileId: other.profile.id, clientKey: key, answers: [] }), "23503", "form_submissions_form_fk");
      await expectPgError(tx, (s) => s.insert(formSubmissions).values({ formId: form.id, profileId: profile.id, clientKey: key, answers: {} as never }), "23514", "form_submissions_answers_array");
      await tx.insert(formSubmissions).values({ formId: form.id, profileId: profile.id, clientKey: key, answers: [] });
      await expectPgError(tx, (s) => s.insert(formSubmissions).values({ formId: form.id, profileId: profile.id, clientKey: key, answers: [] }), "23505", "form_submissions_form_client_key_unique");
    }));

  test("deleting a profile removes its scenes, blocks, forms and messages, but not while a card shows it", () =>
    rollback(db, async (tx) => {
      const { card, profile } = await insertClaimedCard(tx);
      const [scene] = await tx.insert(scenes).values({ profileId: profile.id, name: "Main" }).returning();
      await tx.update(profiles).set({ defaultSceneId: scene.id }).where(eq(profiles.id, profile.id));
      const [form] = await tx.insert(formDefinitions).values({ profileId: profile.id, preset: "contact", title: "Contact", config: CONFIG }).returning();
      await tx.insert(sceneBlocks).values({ sceneId: scene.id, type: "form", position: 0, formId: form.id });
      await tx.insert(formSubmissions).values({ formId: form.id, profileId: profile.id, clientKey: crypto.randomUUID(), answers: [] });
      await expectPgError(tx, (s) => s.delete(profiles).where(eq(profiles.id, profile.id)), "23503", "cards_profile_owner_fk");
      await tx.update(cards).set({ profileId: null }).where(eq(cards.id, card.id));
      await tx.delete(profiles).where(eq(profiles.id, profile.id));
      for (const table of [scenes, formDefinitions]) expect(await tx.select().from(table).where(eq(table.profileId, profile.id))).toHaveLength(0);
      expect(await tx.select().from(formSubmissions).where(eq(formSubmissions.profileId, profile.id))).toHaveLength(0);
    }));
});
```
  `src/db/migration-0010.db.test.ts` proves the backfill on rows that existed before 0010:
```ts
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, test } from "vitest";
import * as schema from "./schema";

test("0010 gives every existing profile a default scene and turns its links into ordered link blocks", async () => {
  // Migrations 0000–0009 only, so the profile and links exist before 0010 runs.
  const before = mkdtempSync(join(tmpdir(), "neffi-0009-"));
  cpSync("drizzle", before, { recursive: true });
  const journal = JSON.parse(readFileSync(join(before, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 9);
  writeFileSync(join(before, "meta/_journal.json"), JSON.stringify(journal));

  const db = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: before });
  await db.execute(sql`INSERT INTO accounts (id, name, email) VALUES ('00000000-0000-4000-8000-000000000001', 'Synthetic', 'synthetic@example.test')`);
  await db.execute(sql`INSERT INTO profiles (id, account_id, status, full_name) VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'published', 'Synthetic')`);
  await db.execute(sql`INSERT INTO profile_links (profile_id, type, label, url, position, visible) VALUES
    ('00000000-0000-4000-8000-000000000002', 'custom', 'Portfolio', 'https://example.test/b', 5, false),
    ('00000000-0000-4000-8000-000000000002', 'linkedin', NULL, 'https://example.test/a', 1, true)`);

  await migrate(db, { migrationsFolder: "drizzle" });

  const { rows: [profile] } = await db.execute(sql`SELECT default_scene_id, active_scene_id FROM profiles`);
  expect(profile.default_scene_id).toBeTruthy();
  expect(profile.active_scene_id).toBeNull();
  const { rows: blocks } = await db.execute(sql`SELECT type, position, visible, content FROM scene_blocks WHERE scene_id = ${profile.default_scene_id} ORDER BY position`);
  expect(blocks).toEqual([
    { type: "link", position: 0, visible: true, content: { kind: "linkedin", url: "https://example.test/a" } },
    { type: "link", position: 1, visible: false, content: { kind: "custom", label: "Portfolio", url: "https://example.test/b" } },
  ]);
  const { rows: legacy } = await db.execute(sql`SELECT count(*)::int AS n FROM profile_links`);
  expect(legacy[0].n).toBe(2);
});
```
- [ ] **Step 2: Verify they fail.** Run `node node_modules/vitest/vitest.mjs run src/db/scenes.db.test.ts src/db/migration-0010.db.test.ts`. Expected: FAIL (no `scenes` export / no table; journal has no idx 10).
- [ ] **Step 3: Implement.** Apply §4 to `enums.ts` and `profiles.ts`. Run `corepack pnpm db:generate`, insert the backfill block (§4 "Migration file", step 2), and add this header comment as the first lines of the SQL file:
  `-- M6: Scenes, Scene Blocks, native Forms and submissions (additive). Rollback: drop form_submissions, scene_blocks, form_definitions, scenes, the profiles default/active scene and image_is_logo columns, and the block_type/form_preset enums; profile_links still holds the pre-M6 links.`
- [ ] **Step 4: Verify.**
  - `node node_modules/vitest/vitest.mjs run src/db` → the new tests PASS. `erd.db.test.ts` FAILS on counts; that is expected and fixed in Task 3. Every other `src/db` test passes.
  - `corepack pnpm db:check` → PASS.
  - `corepack pnpm typecheck` → PASS.
- [ ] **Step 5: Commit.** `git add src/db/schema drizzle src/db/scenes.db.test.ts src/db/migration-0010.db.test.ts && git commit -m "feat(db): scenes, blocks, forms and submissions (migration 0010)"`
- [ ] **Step 6: Ledger.** Record the generated migration file name, and note that the ERD test is expected to stay red until Task 3.

## Task 3: Seed, fixtures and ERD for the M6 schema

**Files:**
- Modify: `src/db/seed.ts`, `src/db/seed.db.test.ts` (only if a count assertion names tables), `src/db/test-fixtures.ts`, `src/db/erd.db.test.ts`, `docs/database/erd.md` (regenerated)

**Interfaces:** Produces `insertProfileWithScene(tx, accountId): Promise<{ profile; scene }>`.

- [ ] **Step 1: Write the failing test.** In `src/db/erd.db.test.ts`, change `"22 tables"` → `"26 tables"` and `"13 enums"` → `"15 enums"`, and add:
```ts
  expect(erd).toContain("profiles_default_scene_fk");
  expect(erd).toContain("form_submissions_form_client_key_unique");
  expect(erd).toContain("scene_blocks_form_only_on_form");
```
- [ ] **Step 2: Verify it fails.** Run `node node_modules/vitest/vitest.mjs run src/db/erd.db.test.ts`. Expected: FAIL (the committed ERD is stale).
- [ ] **Step 3: Implement.**
  - **`seed.ts`:**
    1. Add `"scenes", "form_definitions", "scene_blocks", "form_submissions"` to `SEED_TABLES` right after `"profile_links"`.
    2. Add the ids `sceneAnaMain: id(62)`, `sceneAnaEvents: id(63)`, `sceneBenMain: id(64)`, `formAna: id(65)` to `S`. Use the next unused numbers if any are taken.
    3. Insert Ana's Profile with `status: "draft"` first. Keep the existing `profileLinks` rows unchanged; they are legacy.
    4. Then insert:
```ts
    await tx.insert(schema.scenes).values([
      { id: S.sceneAnaMain, profileId: S.profileAna, name: "Main" },
      { id: S.sceneAnaEvents, profileId: S.profileAna, name: "Events" },
      { id: S.sceneBenMain, profileId: S.profileBenDraft, name: "Main" },
    ]);
    await tx.insert(schema.formDefinitions).values({
      id: S.formAna, profileId: S.profileAna, preset: "connect", title: "Let's connect",
      config: { fields: { name: "required", email: "required", phone: "optional", company: "optional", message: "optional" }, questions: [] },
    });
    await tx.insert(schema.sceneBlocks).values([
      { sceneId: S.sceneAnaMain, type: "link", position: 0, content: { kind: "linkedin", url: "https://example.test/in/ana" } },
      { sceneId: S.sceneAnaMain, type: "link", position: 1, content: { kind: "custom", label: "Portfolio", url: "https://example.test/ana" } },
      { sceneId: S.sceneAnaMain, type: "contact", position: 2, content: { saveContact: true } },
      { sceneId: S.sceneAnaEvents, type: "form", position: 0, formId: S.formAna },
    ]);
    await tx.insert(schema.formSubmissions).values({
      formId: S.formAna, profileId: S.profileAna, clientKey: id(66),
      answers: [{ label: "Your name", value: "Synthetic Visitor" }, { label: "Email", value: "visitor@example.test" }],
    });
    await tx.update(schema.profiles).set({ defaultSceneId: S.sceneAnaMain, status: "published" }).where(eq(schema.profiles.id, S.profileAna));
    await tx.update(schema.profiles).set({ defaultSceneId: S.sceneBenMain }).where(eq(schema.profiles.id, S.profileBenDraft));
```
       (Import `eq` from `drizzle-orm` if it is not already imported. `id(n)` is the existing seed id helper; if `id(66)` is taken, use the next free number.)
  - **`test-fixtures.ts`:**
```ts
// A Draft profile with its Default Scene, as every M6-created profile has.
export async function insertProfileWithScene(tx: TestTx, accountId: string) {
  const profile = await insertProfile(tx, accountId);
  const [scene] = await tx.insert(scenes).values({ profileId: profile.id, name: "Main" }).returning();
  await tx.update(profiles).set({ defaultSceneId: scene.id }).where(eq(profiles.id, profile.id));
  return { profile: { ...profile, defaultSceneId: scene.id }, scene };
}
```
       Add `scenes` to the schema import and `eq` from `drizzle-orm`.
  - Regenerate the ERD with `corepack pnpm db:erd`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/db`, then `corepack pnpm test`. Expected: all PASS, including `seed.db.test.ts` ("every domain table is exercised").
- [ ] **Step 5: Commit.** `git add src/db docs/database/erd.md && git commit -m "chore(db): seed and document the M6 schema"`
- [ ] **Step 6: Ledger.**

## Task 4: Pure rules — links, identity, appearance, publishing, block content

**Files:**
- Create: `src/lib/safe-url.ts` + `src/lib/safe-url.test.ts`
- Create: `src/modules/profiles/rules.ts` + `rules.test.ts`
- Create: `src/modules/profiles/block-content.ts` + `block-content.test.ts`

**Interfaces:** Produces `normalizeLink`, `LIMITS`, `ACCENTS`, `identitySchema`, `publishGaps`, `PUBLISH_GAP_COPY`, `parseBlockContent`, `LINK_KINDS` and `LINK_KIND_LABELS`.

- [ ] **Step 1: Write the failing tests.**

  `src/lib/safe-url.test.ts`:
```ts
import { expect, test } from "vitest";
import { normalizeLink } from "./safe-url";

test.each([
  ["example.com", "https://example.com/"],
  ["  https://cal.com/ana  ", "https://cal.com/ana"],
  ["www.linkedin.com/in/ana", "https://www.linkedin.com/in/ana"],
])("accepts %j", (raw, expected) => expect(normalizeLink(raw)).toBe(expected));

test.each(["", "http://example.com", "javascript:alert(1)", "data:text/html,x", "mailto:a@b.c", "https://user:pw@example.com", "https://", `https://e.com/${"a".repeat(2050)}`, "ftp://e.com"])(
  "rejects %j",
  (raw) => expect(normalizeLink(raw)).toBeNull(),
);
```
  `src/modules/profiles/rules.test.ts`:
```ts
import { expect, test } from "vitest";
import { ACCENTS, identitySchema, LIMITS, publishGaps } from "./rules";

test("identity trims, blanks become null, links normalize, bad contacts are rejected", () => {
  const parsed = identitySchema.parse({ fullName: "  Ana  ", headline: "", company: " ", bio: "Hi", phone: "+63 917 123 4567", email: "ANA@Example.test", website: "ana.example", location: "" });
  expect(parsed).toEqual({ fullName: "Ana", headline: null, company: null, bio: "Hi", phone: "+63 917 123 4567", email: "ana@example.test", website: "https://ana.example/", location: null });
  for (const bad of [{ fullName: "" }, { phone: "call me" }, { email: "nope" }, { website: "javascript:alert(1)" }, { bio: "x".repeat(301) }]) {
    expect(identitySchema.safeParse({ fullName: "Ana", headline: "", company: "", bio: "", phone: "", email: "", website: "", location: "", ...bad }).success).toBe(false);
  }
});

test("publishing needs a name, a way to reach you and something to show", () => {
  expect(publishGaps({ fullName: "Ana", phone: null, email: "a@e.test", website: null, visibleDefaultBlocks: 1 })).toEqual([]);
  expect(publishGaps({ fullName: null, phone: null, email: null, website: null, visibleDefaultBlocks: 0 })).toEqual(["name", "contact", "content"]);
});

test("limits and the accent palette are fixed", () => {
  expect(LIMITS).toEqual({ profilesPerAccount: 10, scenesPerProfile: 5, blocksPerScene: 20, formsPerProfile: 5 });
  expect(ACCENTS).toHaveLength(8);
  for (const accent of ACCENTS) expect(accent.hex).toMatch(/^#[0-9A-F]{6}$/);
});
```
  `src/modules/profiles/block-content.test.ts`:
```ts
import { expect, test } from "vitest";
import { parseBlockContent } from "./block-content";

test.each([
  ["about", { text: " Hello " }, { text: "Hello" }],
  ["project", { title: "Site", description: "", url: "site.test" }, { title: "Site", description: null, url: "https://site.test/" }],
  ["link", { kind: "github", label: "", url: "github.com/ana" }, { kind: "github", label: null, url: "https://github.com/ana" }],
  ["contact", { saveContact: "on" }, { saveContact: true }],
  ["contact", {}, { saveContact: false }],
  ["booking", { label: "", url: "cal.com/ana" }, { label: null, url: "https://cal.com/ana" }],
  ["form", {}, {}],
] as const)("%s accepts valid input", (type, input, content) => {
  expect(parseBlockContent(type, input)).toEqual({ ok: true, content });
});

test.each([
  ["about", { text: "" }],
  ["about", { text: "x".repeat(1001) }],
  ["project", { title: "", url: "" }],
  ["link", { kind: "myspace", url: "https://e.test" }],
  ["link", { kind: "custom", url: "javascript:alert(1)" }],
  ["booking", { url: "" }],
] as const)("%s rejects %j", (type, input) => {
  expect(parseBlockContent(type, input)).toEqual({ ok: false });
});
```
- [ ] **Step 2: Verify they fail.** Run `node node_modules/vitest/vitest.mjs run src/lib/safe-url.test.ts src/modules/profiles`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.**

  `src/lib/safe-url.ts`:
```ts
// Customer-entered web links. Non-technical people paste "example.com", so a missing scheme becomes https://.
// Only https survives: no http, javascript:, data:, mailto: or credentials in the URL.
export function normalizeLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password) return null;
  return url.href.length <= 2048 ? url.href : null;
}
```
  `src/modules/profiles/rules.ts`:
```ts
import { z } from "zod";
import { normalizeLink } from "@/lib/safe-url";

export const LIMITS = { profilesPerAccount: 10, scenesPerProfile: 5, blocksPerScene: 20, formsPerProfile: 5 } as const;

// Neffi-maintained accent swatches (Brand Identity: customer profiles keep their own colours).
export const ACCENTS = [
  { name: "Ink", hex: "#0C0C0D" },
  { name: "Ocean", hex: "#1F5FAE" },
  { name: "Teal", hex: "#0E7C86" },
  { name: "Forest", hex: "#2E6B4F" },
  { name: "Amber", hex: "#B86E00" },
  { name: "Vermilion", hex: "#E64A35" },
  { name: "Rose", hex: "#B83A6B" },
  { name: "Plum", hex: "#6B3FA0" },
] as const;

const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
export const phoneSchema = optional(30).refine((value) => value === null || /^\+?[0-9 ()-]{7,20}$/.test(value));
export const emailSchema = optional(254)
  .transform((value) => value?.toLowerCase() ?? null)
  .refine((value) => value === null || z.email().safeParse(value).success);
export const linkSchema = (max = 2048) =>
  optional(max).transform((value, ctx) => {
    if (value === null) return null;
    const link = normalizeLink(value);
    if (!link) ctx.addIssue({ code: "custom", message: "link" });
    return link;
  });

export const identitySchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  headline: optional(80),
  company: optional(80),
  bio: optional(300),
  phone: phoneSchema,
  email: emailSchema,
  website: linkSchema(),
  location: optional(80),
});
export type Identity = z.infer<typeof identitySchema>;

export type PublishGap = "name" | "contact" | "content";
export const PUBLISH_GAP_COPY: Record<PublishGap, string> = {
  name: "Add your full name.",
  contact: "Add a phone number, email or website so people can reach you.",
  content: "Show at least one item in your main scene.",
};

export function publishGaps(p: { fullName: string | null; phone: string | null; email: string | null; website: string | null; visibleDefaultBlocks: number }): PublishGap[] {
  const gaps: PublishGap[] = [];
  if (!p.fullName) gaps.push("name");
  if (!p.phone && !p.email && !p.website) gaps.push("contact");
  if (p.visibleDefaultBlocks < 1) gaps.push("content");
  return gaps;
}
```
  `src/modules/profiles/block-content.ts`:
```ts
import { z } from "zod";
import { profileLinkType } from "@/db/schema/enums";
import { linkSchema } from "./rules";

export type BlockType = "about" | "project" | "link" | "contact" | "booking" | "form";
export const LINK_KINDS = profileLinkType.enumValues;
export type LinkKind = (typeof LINK_KINDS)[number];
export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube", github: "GitHub",
  messenger: "Messenger", whatsapp: "WhatsApp", viber: "Viber", telegram: "Telegram", x: "X", portfolio: "Portfolio",
  booking: "Booking", shop: "Shop", menu: "Menu", custom: "Other",
};

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const required = linkSchema().refine((value): value is string => value !== null);
const checkbox = z.unknown().transform((value) => value === true || value === "on");

// Content is built only from these schemas: customers fill plain fields, never raw JSON.
const SCHEMAS = {
  about: z.object({ text: text(1000) }),
  // prefault (not default): Zod 4 runs the missing-key value through the transforms, so absent fields become null.
  project: z.object({ title: text(80), description: optional(500).prefault(""), url: linkSchema().prefault("") }),
  link: z.object({ kind: z.enum(LINK_KINDS), label: optional(40).prefault(""), url: required }),
  contact: z.object({ saveContact: checkbox }),
  booking: z.object({ label: optional(40).prefault(""), url: required }),
  form: z.object({}),
} satisfies Record<BlockType, z.ZodType>;

export function parseBlockContent(type: BlockType, input: Record<string, unknown>): { ok: true; content: Record<string, unknown> } | { ok: false } {
  const result = SCHEMAS[type].safeParse(input);
  return result.success ? { ok: true, content: result.data as Record<string, unknown> } : { ok: false };
}
```
  `@/db/schema/enums` is pure (it imports only `drizzle-orm/pg-core`), so this module remains client-safe. Also add the test case `["project", { title: "Site" }, { title: "Site", description: null, url: null }]` to the accept table; it proves the `prefault` behaviour for absent keys.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/lib src/modules/profiles`, then `corepack pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/lib/safe-url.ts src/lib/safe-url.test.ts src/modules/profiles && git commit -m "feat(profiles): link, identity, publishing and block content rules"`
- [ ] **Step 6: Ledger.**

## Task 5: Pure form configuration and answer validation

**Files:** Create `src/modules/forms/config.ts` and `src/modules/forms/config.test.ts`.

**Interfaces:** Produces `FORM_FIELDS`, `FieldMode`, `FormConfig`, `PRESETS`, `parseFormConfig`, `validateAnswers`, `visibleFields` and `FIELD_LABELS` (§5).

- [ ] **Step 1: Write the failing tests** `src/modules/forms/config.test.ts`:
```ts
import { expect, test } from "vitest";
import { parseFormConfig, PRESETS, validateAnswers, visibleFields } from "./config";

test("presets are valid configurations", () => {
  for (const preset of Object.values(PRESETS)) expect(parseFormConfig(preset.config)).toEqual({ ok: true, config: preset.config });
  expect(PRESETS.connect.title).toBe("Let's connect");
  expect(PRESETS.project_inquiry.title).toBe("Tell me about your project");
  expect(PRESETS.contact.title).toBe("Send me a message");
});

test.each([
  ["name not required", { fields: { ...PRESETS.contact.config.fields, name: "optional" }, questions: [] }],
  ["no way to reply", { fields: { ...PRESETS.contact.config.fields, email: "optional", phone: "hidden" }, questions: [] }],
  ["four questions", { ...PRESETS.contact.config, questions: Array.from({ length: 4 }, (_, i) => ({ id: `q${i}aaaaa`, label: "Q", required: false })) }],
  ["empty question", { ...PRESETS.contact.config, questions: [{ id: "q1aaaaaa", label: " ", required: false }] }],
  ["unknown field", { fields: { ...PRESETS.contact.config.fields, budget: "required" }, questions: [] }],
  ["not an object", "x"],
])("rejects %s", (_name, input) => expect(parseFormConfig(input)).toEqual({ ok: false }));

test("answers: required fields enforced, hidden fields ignored, snapshot keeps labels", () => {
  const config = { ...PRESETS.project_inquiry.config, questions: [{ id: "budget01", label: "Budget", required: true }] };
  expect(validateAnswers(config, { name: "", email: "bad", message: "" })).toEqual({ ok: false, fields: ["name", "email", "message", "budget01"] });
  expect(validateAnswers(config, { name: " Vic ", email: "VIC@e.test", phone: "", company: "", message: "Hi", budget01: "10k", extra: "ignored" })).toEqual({
    ok: true,
    replyTo: "vic@e.test",
    answers: [
      { label: "Your name", value: "Vic" },
      { label: "Email", value: "vic@e.test" },
      { label: "Message", value: "Hi" },
      { label: "Budget", value: "10k" },
    ],
  });
});

test("visible fields in display order with input kinds", () => {
  expect(visibleFields(PRESETS.contact.config).map((f) => [f.key, f.kind, f.required])).toEqual([
    ["name", "text", true],
    ["email", "email", true],
    ["phone", "tel", false],
    ["message", "long", true],
  ]);
});
```
- [ ] **Step 2: Verify it fails.** Run `node node_modules/vitest/vitest.mjs run src/modules/forms/config.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/modules/forms/config.ts`:
```ts
import { z } from "zod";

// Native Neffi forms stay small: a fixed field catalogue, three modes, up to three short custom questions.
export const FORM_FIELDS = ["name", "email", "phone", "company", "message"] as const;
export type FormField = (typeof FORM_FIELDS)[number];
export type FieldMode = "hidden" | "optional" | "required";
export const FIELD_LABELS: Record<FormField, string> = { name: "Your name", email: "Email", phone: "Phone", company: "Company", message: "Message" };
const FIELD_KIND = { name: "text", email: "email", phone: "tel", company: "text", message: "long" } as const;
const FIELD_MAX: Record<FormField, number> = { name: 80, email: 254, phone: 30, company: 80, message: 2000 };
export const MAX_QUESTIONS = 3;

const mode = z.enum(["hidden", "optional", "required"]);
const configSchema = z
  .object({
    fields: z.strictObject({ name: mode, email: mode, phone: mode, company: mode, message: mode }),
    questions: z
      .array(z.strictObject({ id: z.string().regex(/^[a-z0-9]{8}$/), label: z.string().trim().min(1).max(80), required: z.boolean() }))
      .max(MAX_QUESTIONS),
  })
  .strict()
  .refine((c) => c.fields.name === "required" && (c.fields.email === "required" || c.fields.phone === "required"));
export type FormConfig = z.infer<typeof configSchema>;

export const PRESETS = {
  connect: { title: "Let's connect", config: { fields: { name: "required", email: "required", phone: "optional", company: "optional", message: "optional" }, questions: [] } },
  project_inquiry: { title: "Tell me about your project", config: { fields: { name: "required", email: "required", phone: "optional", company: "optional", message: "required" }, questions: [] } },
  contact: { title: "Send me a message", config: { fields: { name: "required", email: "required", phone: "optional", company: "hidden", message: "required" }, questions: [] } },
} satisfies Record<string, { title: string; config: FormConfig }>;
export type Preset = keyof typeof PRESETS;

export function parseFormConfig(input: unknown): { ok: true; config: FormConfig } | { ok: false } {
  const result = configSchema.safeParse(input);
  return result.success ? { ok: true, config: result.data } : { ok: false };
}

export function visibleFields(config: FormConfig) {
  return [
    ...FORM_FIELDS.filter((key) => config.fields[key] !== "hidden").map((key) => ({ key, label: FIELD_LABELS[key], required: config.fields[key] === "required", kind: FIELD_KIND[key] })),
    ...config.questions.map((q) => ({ key: q.id, label: q.label, required: q.required, kind: "text" as const })),
  ];
}

export type Answer = { label: string; value: string };

export function validateAnswers(config: FormConfig, raw: Record<string, unknown>) {
  const answers: Answer[] = [];
  const fields: string[] = [];
  let replyTo: string | null = null;
  for (const field of visibleFields(config)) {
    const value = typeof raw[field.key] === "string" ? (raw[field.key] as string).trim() : "";
    const max = field.key in FIELD_MAX ? FIELD_MAX[field.key as FormField] : 500;
    const normalized = field.kind === "email" ? value.toLowerCase() : value;
    const valid =
      normalized.length <= max &&
      (!normalized || field.kind !== "email" || z.email().safeParse(normalized).success) &&
      (!normalized || field.kind !== "tel" || /^\+?[0-9 ()-]{7,20}$/.test(normalized));
    if (!valid || (field.required && !normalized)) {
      fields.push(field.key);
      continue;
    }
    if (!normalized) continue;
    if (field.kind === "email") replyTo = normalized;
    answers.push({ label: field.label, value: normalized });
  }
  return fields.length ? { ok: false as const, fields } : { ok: true as const, answers, replyTo };
}
```
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules/forms`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/modules/forms && git commit -m "feat(forms): constrained form configuration and answer validation"`
- [ ] **Step 6: Ledger.**

## Task 6: Starter Experiences (pure recipes)

**Files:** Create `src/modules/profiles/starters.ts` and `src/modules/profiles/starters.test.ts`.

**Interfaces:**
- Consumes: `identitySchema` pieces, `PRESETS`.
- Produces: `Purpose`, `PURPOSES`, `essentialsSchema`, `Essentials`, `BlockSeed`, `starterBlocks`.

- [ ] **Step 1: Write the failing tests** `src/modules/profiles/starters.test.ts`:
```ts
import { expect, test } from "vitest";
import { essentialsSchema, PURPOSES, starterBlocks } from "./starters";

const base = { fullName: "Ana", headline: null, bio: null, email: "ana@e.test", phone: null, link: null };

test("purposes use customer language", () => {
  expect(Object.keys(PURPOSES)).toEqual(["network", "get_clients", "show_my_work"]);
  expect(PURPOSES.network.label).toBe("Network");
  expect(PURPOSES.get_clients.label).toBe("Get Clients");
  expect(PURPOSES.show_my_work.label).toBe("Show My Work");
});

test("Network: contact first, optional link and intro, Connect form", () => {
  expect(starterBlocks("network", { ...base, bio: "Hi", link: "https://www.linkedin.com/in/ana" })).toEqual([
    { type: "contact", content: { saveContact: true } },
    { type: "link", content: { kind: "linkedin", label: null, url: "https://www.linkedin.com/in/ana" } },
    { type: "about", content: { text: "Hi" } },
    { type: "form", content: {}, preset: "connect" },
  ]);
  expect(starterBlocks("network", { ...base, link: "https://ana.example/" })[1]).toEqual({ type: "link", content: { kind: "custom", label: null, url: "https://ana.example/" } });
});

test("Get Clients: intro, booking, project inquiry, contact — nothing empty is seeded", () => {
  expect(starterBlocks("get_clients", { ...base, link: "https://cal.com/ana" })).toEqual([
    { type: "booking", content: { label: null, url: "https://cal.com/ana" } },
    { type: "form", content: {}, preset: "project_inquiry" },
    { type: "contact", content: { saveContact: true } },
  ]);
});

test("Show My Work: intro, portfolio link, contact", () => {
  expect(starterBlocks("show_my_work", { ...base, bio: "Work", link: "https://ana.example/" })).toEqual([
    { type: "about", content: { text: "Work" } },
    { type: "link", content: { kind: "portfolio", label: null, url: "https://ana.example/" } },
    { type: "contact", content: { saveContact: true } },
  ]);
});

test("essentials normalize like identity and require a name", () => {
  expect(essentialsSchema.parse({ fullName: " Ana ", headline: "", bio: "", email: "A@E.TEST", phone: "", link: "cal.com/ana" })).toEqual({
    fullName: "Ana", headline: null, bio: null, email: "a@e.test", phone: null, link: "https://cal.com/ana",
  });
  expect(essentialsSchema.safeParse({ ...base, fullName: "" }).success).toBe(false);
});
```
- [ ] **Step 2: Verify it fails.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles/starters.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/modules/profiles/starters.ts`:
```ts
import { z } from "zod";
import type { Preset } from "../forms/config";
import type { BlockType } from "./block-content";
import { emailSchema, linkSchema, phoneSchema } from "./rules";

// Onboarding recipes only: they seed the first Scene and are never stored (Locked Plan: Starter Experience is not an object).
export type Purpose = "network" | "get_clients" | "show_my_work";
export const PURPOSES: Record<Purpose, { label: string; description: string; sceneName: string; linkLabel: string }> = {
  network: { label: "Network", description: "Share your contact details and stay in touch.", sceneName: "Networking", linkLabel: "LinkedIn or main profile link" },
  get_clients: { label: "Get Clients", description: "Show what you offer and make it easy to reach you.", sceneName: "Clients", linkLabel: "Booking link" },
  show_my_work: { label: "Show My Work", description: "Show your projects and where to see more.", sceneName: "My work", linkLabel: "Portfolio link" },
};
export const isPurpose = (value: unknown): value is Purpose => typeof value === "string" && Object.hasOwn(PURPOSES, value);

const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
export const essentialsSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  headline: optional(80),
  bio: optional(300),
  email: emailSchema,
  phone: phoneSchema,
  link: linkSchema(),
});
export type Essentials = z.infer<typeof essentialsSchema>;

export type BlockSeed = { type: BlockType; content: Record<string, unknown>; preset?: Preset };

const contact: BlockSeed = { type: "contact", content: { saveContact: true } };
const about = (e: Essentials): BlockSeed[] => (e.bio ? [{ type: "about", content: { text: e.bio } }] : []);
const linkTo = (kind: string, url: string | null): BlockSeed[] => (url ? [{ type: "link", content: { kind, label: null, url } }] : []);

// No empty placeholder blocks: anything the customer did not provide is suggested later in the Scene editor.
export function starterBlocks(purpose: Purpose, e: Essentials): BlockSeed[] {
  if (purpose === "network") {
    const kind = e.link && new URL(e.link).hostname.endsWith("linkedin.com") ? "linkedin" : "custom";
    return [contact, ...linkTo(kind, e.link), ...about(e), { type: "form", content: {}, preset: "connect" }];
  }
  if (purpose === "get_clients") {
    const booking: BlockSeed[] = e.link ? [{ type: "booking", content: { label: null, url: e.link } }] : [];
    return [...about(e), ...booking, { type: "form", content: {}, preset: "project_inquiry" }, contact];
  }
  return [...about(e), ...linkTo("portfolio", e.link), contact];
}
```
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles`, then `corepack pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/modules/profiles/starters.ts src/modules/profiles/starters.test.ts && git commit -m "feat(profiles): Network, Get Clients and Show My Work starter recipes"`
- [ ] **Step 6: Ledger.**

## Task 7: Profile creation from a Starter, connect an existing Profile, owner reads

**Files:**
- Create: `src/modules/profiles/errors.ts`, `src/modules/profiles/profiles.ts`, `src/modules/profiles/profiles.db.test.ts`, `src/modules/cards/manage.ts`, `src/modules/cards/manage.db.test.ts`
- Modify: `src/modules/activity/record.ts`, `src/server-only-boundary.test.ts`

**Interfaces:**
- Consumes: `lockCard` (`src/modules/cards/card.ts`), `recordActivity`, `starterBlocks`, `PURPOSES`, `PRESETS`, `LIMITS`, `publishGaps`, `insertReleasedDbc`, `insertAccount`, `insertProfileWithScene`.
- Produces: `ProfileError`, `lockOwnedProfile`, `createProfileFromStarter`, `ownedProfiles`, `getOwnedProfile`, `OwnedProfile`, `connectCardToProfile`.

- [ ] **Step 1: Write the failing tests.**

  `src/modules/profiles/profiles.db.test.ts`. Use PGlite and `rollback`, and pass `tx` as `Db`, as in `src/modules/activation/claim.db.test.ts`. Shared setup:
```ts
async function ownedUnsetCard(tx: TestTx) {
  const { card } = await insertReleasedDbc(tx);
  const owner = await insertAccount(tx);
  await tx.update(cards).set({ ownerAccountId: owner.id }).where(eq(cards.id, card.id));
  return { card, owner };
}
const ESSENTIALS = { fullName: "Ana", headline: "Designer", bio: null, email: "ana@e.test", phone: null, link: "https://cal.com/ana" };
```
  Test cases (each a `test(…, () => rollback(db, async (tx) => …))`):
  1. **"creates a Draft profile with its Default Scene, seeded blocks and form, and connects the card".**
     - Call `createProfileFromStarter(tx, { accountId: owner.id, cardId: card.id, purpose: "get_clients", essentials: ESSENTIALS })`; it returns `{ profileId, created: true }`.
     - The profile has `status: "draft"`, `fullName: "Ana"`, `email: "ana@e.test"`, a non-null `defaultSceneId` and a null `activeSceneId`.
     - The Default Scene is named `"Clients"`.
     - Its blocks, ordered by `position`, are `[booking, form, contact]` with positions `[0, 1, 2]`.
     - The form block's `formId` points at a `form_definitions` row with `preset: "project_inquiry"` and `title: "Tell me about your project"`.
     - `cards.profileId === profileId`.
     - Exactly one `activity_events` row exists with `type: "card_profile_changed"`, `cardId`, `actorAccountId = accountId = owner.id` and a null `note`.
  2. **"a repeated submit returns the same profile and creates nothing new".** Call twice. The second call returns `{ profileId: first.profileId, created: false }`. Exactly 1 profile, 1 scene and 1 activity event exist for the account.
  3. **"someone else's card is not found".**
     - `createProfileFromStarter` with another account's id rejects with `ProfileError` code `not_found`.
     - The same holds for a random UUID card id.
     - Nothing is inserted.
  4. **"the tenth profile is the last".** Insert 10 profiles with `insertProfileWithScene(tx, owner.id)`. Then `createProfileFromStarter` rejects with `limit_reached`, and the card stays unset.
  5. **"ownedProfiles lists only the account's profiles, oldest first, with unread counts".** Create a profile through the starter. Insert two `form_submissions` rows for its form, one with `readAt` set. The result is `[{ id, fullName: "Ana", status: "draft", unread: 1 }]`. Another account gets `[]`.
  6. **"getOwnedProfile returns scenes (Default first), connected card suffixes, publish gaps and unread; null for anyone else".** For a profile created through the starter:
     - `scenes` is `[{ name: "Clients", isDefault: true, isShown: true }]` (match the ids);
     - `cards` is `[{ id: card.id, suffix: card.publicToken.slice(-4) }]`;
     - `gaps` is `[]`;
     - `getOwnedProfile(tx, otherAccount.id, profileId)` is `null`.

  `src/modules/cards/manage.db.test.ts`:
  1. **"connects an owned card to an owned profile and records it".** `connectCardToProfile(tx, { accountId, cardId, profileId })`. Afterwards `cards.profileId` is set and one `card_profile_changed` event exists.
  2. **"another account's profile is not found and the card is unchanged".** Expect `ProfileError` `not_found`. The database composite FK would also reject this.
  3. **"another account's card is not found".**

- [ ] **Step 2: Verify they fail.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles/profiles.db.test.ts src/modules/cards/manage.db.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.**

  In `src/modules/activity/record.ts`, add `| "card_profile_changed" | "card_disabled" | "card_enabled"` to `ActivityType`.

  `src/modules/profiles/errors.ts`:
```ts
import type { PublishGap } from "./rules";

export type ProfileErrorCode = "not_found" | "limit_reached" | "not_ready" | "has_cards" | "default_scene" | "invalid";

// A rule refusal the customer can act on. Carries only a code (and publish gaps), never customer data.
export class ProfileError extends Error {
  constructor(
    readonly code: ProfileErrorCode,
    readonly gaps: PublishGap[] = [],
  ) {
    super(code);
    this.name = "ProfileError";
  }
}
```
  `src/modules/profiles/profiles.ts`:
```ts
import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import { CardError, lockCard } from "../cards/card";
import type { Db } from "../db";
import { PRESETS } from "../forms/config";
import { ProfileError } from "./errors";
import { LIMITS, publishGaps, type PublishGap } from "./rules";
import { PURPOSES, starterBlocks, type Essentials, type Purpose } from "./starters";

// Every profile mutation starts here: the WHERE on account_id is the ownership check, FOR UPDATE serializes edits.
export async function lockOwnedProfile(tx: Db, accountId: string, profileId: string) {
  const [profile] = await tx
    .select()
    .from(schema.profiles)
    .where(and(eq(schema.profiles.id, profileId), eq(schema.profiles.accountId, accountId)))
    .for("update");
  if (!profile) throw new ProfileError("not_found");
  return profile;
}

export async function visibleBlockCount(tx: Db, sceneId: string | null): Promise<number> {
  if (!sceneId) return 0;
  const [row] = await tx
    .select({ n: count() })
    .from(schema.sceneBlocks)
    .where(and(eq(schema.sceneBlocks.sceneId, sceneId), eq(schema.sceneBlocks.visible, true)));
  return row.n;
}

export async function createProfileFromStarter(
  db: Db,
  input: { accountId: string; cardId: string; purpose: Purpose; essentials: Essentials },
): Promise<{ profileId: string; created: boolean }> {
  return db.transaction(async (tx) => {
    // Account row first, then the card: serializes the profile limit and a double submit for the same card.
    await tx.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.id, input.accountId)).for("update");
    const card = await lockCard(tx, input.cardId).catch((error) => {
      if (error instanceof CardError) return null;
      throw error;
    });
    if (!card || card.ownerAccountId !== input.accountId || card.kind !== "dbc" || card.state !== "released") throw new ProfileError("not_found");
    if (card.profileId) return { profileId: card.profileId, created: false };

    const [{ n }] = await tx.select({ n: count() }).from(schema.profiles).where(eq(schema.profiles.accountId, input.accountId));
    if (n >= LIMITS.profilesPerAccount) throw new ProfileError("limit_reached");

    const e = input.essentials;
    const [profile] = await tx
      .insert(schema.profiles)
      .values({ accountId: input.accountId, fullName: e.fullName, headline: e.headline, bio: e.bio, email: e.email, phone: e.phone })
      .returning({ id: schema.profiles.id });
    const [scene] = await tx
      .insert(schema.scenes)
      .values({ profileId: profile.id, name: PURPOSES[input.purpose].sceneName })
      .returning({ id: schema.scenes.id });
    let position = 0;
    for (const seed of starterBlocks(input.purpose, e)) {
      let formId: string | null = null;
      if (seed.preset) {
        const preset = PRESETS[seed.preset];
        const [form] = await tx
          .insert(schema.formDefinitions)
          .values({ profileId: profile.id, preset: seed.preset, title: preset.title, config: preset.config })
          .returning({ id: schema.formDefinitions.id });
        formId = form.id;
      }
      await tx.insert(schema.sceneBlocks).values({ sceneId: scene.id, type: seed.type, position: position++, content: seed.content, formId });
    }
    await tx.update(schema.profiles).set({ defaultSceneId: scene.id }).where(eq(schema.profiles.id, profile.id));
    await tx.update(schema.cards).set({ profileId: profile.id }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, { type: "card_profile_changed", actorAccountId: input.accountId, accountId: input.accountId, cardId: card.id });
    return { profileId: profile.id, created: true };
  });
}

const unread = sql<number>`count(${schema.formSubmissions.id}) filter (where ${schema.formSubmissions.readAt} is null)`.mapWith(Number);

export async function ownedProfiles(db: Db, accountId: string) {
  return db
    .select({ id: schema.profiles.id, fullName: schema.profiles.fullName, status: schema.profiles.status, unread })
    .from(schema.profiles)
    .leftJoin(schema.formSubmissions, eq(schema.formSubmissions.profileId, schema.profiles.id))
    .where(eq(schema.profiles.accountId, accountId))
    .groupBy(schema.profiles.id)
    .orderBy(asc(schema.profiles.createdAt));
}

export type OwnedProfile = {
  id: string;
  status: "draft" | "published" | "unpublished";
  fullName: string | null;
  headline: string | null;
  company: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  location: string | null;
  accentColor: string | null;
  imageAssetId: string | null;
  imageIsLogo: boolean;
  defaultSceneId: string;
  scenes: { id: string; name: string; isDefault: boolean; isShown: boolean }[];
  cards: { id: string; suffix: string }[];
  gaps: PublishGap[];
  unread: number;
};

export async function getOwnedProfile(db: Db, accountId: string, profileId: string): Promise<OwnedProfile | null> {
  const [p] = await db
    .select({
      id: schema.profiles.id, status: schema.profiles.status, fullName: schema.profiles.fullName, headline: schema.profiles.headline,
      company: schema.profiles.company, bio: schema.profiles.bio, phone: schema.profiles.phone, email: schema.profiles.email,
      website: schema.profiles.website, location: schema.profiles.location, accentColor: schema.profiles.accentColor,
      imageAssetId: schema.profiles.imageAssetId, imageIsLogo: schema.profiles.imageIsLogo,
      defaultSceneId: schema.profiles.defaultSceneId, activeSceneId: schema.profiles.activeSceneId,
    })
    .from(schema.profiles)
    .where(and(eq(schema.profiles.id, profileId), eq(schema.profiles.accountId, accountId)));
  if (!p?.defaultSceneId) return null; // every profile has a Default Scene since 0010
  const [sceneRows, cardRows, visible, [{ n: unreadCount }]] = await Promise.all([
    db.select({ id: schema.scenes.id, name: schema.scenes.name }).from(schema.scenes).where(eq(schema.scenes.profileId, p.id)).orderBy(asc(schema.scenes.createdAt)),
    db.select({ id: schema.cards.id, token: schema.cards.publicToken }).from(schema.cards).where(eq(schema.cards.profileId, p.id)),
    visibleBlockCount(db, p.defaultSceneId),
    db.select({ n: count() }).from(schema.formSubmissions).where(and(eq(schema.formSubmissions.profileId, p.id), sql`${schema.formSubmissions.readAt} is null`)),
  ]);
  const shown = p.activeSceneId ?? p.defaultSceneId;
  const scenes = sceneRows
    .map((s) => ({ ...s, isDefault: s.id === p.defaultSceneId, isShown: s.id === shown }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const { activeSceneId: _active, ...rest } = p;
  return {
    ...rest,
    defaultSceneId: p.defaultSceneId,
    scenes,
    cards: cardRows.map((c) => ({ id: c.id, suffix: (c.token ?? "").slice(-4) })),
    gaps: publishGaps({ ...p, visibleDefaultBlocks: visible }),
    unread: unreadCount,
  };
}
```
  `Array.prototype.sort` is stable, so creation order is preserved after the Default Scene.

  `src/modules/cards/manage.ts`:
```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { ProfileError } from "../profiles/errors";
import { lockOwnedProfile } from "../profiles/profiles";
import { CardError, lockCard } from "./card";

// Card row first, then the profile (D20). A card can only show a profile of its own owner (also cards_profile_owner_fk).
export async function lockOwnedCard(tx: Db, accountId: string, cardId: string) {
  const card = await lockCard(tx, cardId).catch((error) => {
    if (error instanceof CardError) return null;
    throw error;
  });
  if (!card || card.ownerAccountId !== accountId || card.kind !== "dbc") throw new ProfileError("not_found");
  return card;
}

export async function connectCardToProfile(db: Db, input: { accountId: string; cardId: string; profileId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const card = await lockOwnedCard(tx, input.accountId, input.cardId);
    await lockOwnedProfile(tx, input.accountId, input.profileId);
    if (card.profileId === input.profileId) return;
    await tx.update(schema.cards).set({ profileId: input.profileId }).where(and(eq(schema.cards.id, card.id)));
    await recordActivity(tx, { type: "card_profile_changed", actorAccountId: input.accountId, accountId: input.accountId, cardId: card.id });
  });
}
```
  Add `src/modules/profiles/profiles.ts` and `src/modules/cards/manage.ts` to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules src/server-only-boundary.test.ts`, then `corepack pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/modules src/server-only-boundary.test.ts && git commit -m "feat(profiles): create a profile from a starter and connect cards"`
- [ ] **Step 6: Ledger.**

## Task 8: Publish, unpublish, identity, appearance, image reference, delete

**Files:**
- Modify: `src/modules/profiles/profiles.ts`
- Create: `src/modules/profiles/lifecycle.db.test.ts`

**Interfaces:**
- Consumes: `lockOwnedProfile`, `visibleBlockCount`, `publishGaps`, `ACCENTS`, `identitySchema` output type.
- Produces: `publishProfile`, `unpublishProfile`, `updateIdentity`, `updateAppearance`, `setProfileImage`, `deleteProfile` (§5).

- [ ] **Step 1: Write the failing tests** `src/modules/profiles/lifecycle.db.test.ts`. Build a profile through `createProfileFromStarter` (Task 7 helper). Cases:
  1. **"publishing a ready profile makes it Published".** Expect status `published`.
  2. **"publishing reports exactly what is missing".**
     - Set `fullName` null and `email` null, and hide every block.
     - `publishProfile` rejects with `ProfileError` `not_ready`, `gaps: ["name", "contact", "content"]`.
     - The status stays `draft`.
  3. **"unpublish hides a Published profile; unpublishing a Draft changes nothing".** Expect `unpublished`; a Draft stays `draft`.
  4. **"updateIdentity saves normalized identity; while Published it cannot remove every way to reach you".** Published profile:
     - updating with `email: null, phone: null, website: null` rejects `not_ready` (`gaps: ["contact"]`) and the row is unchanged;
     - updating with a phone and no email succeeds.
  5. **"appearance accepts only palette colours".**
     - `accentColor: "#1F5FAE"` with `imageIsLogo: true` is saved.
     - `accentColor: "#123456"` rejects with `invalid`.
  6. **"setProfileImage returns the replaced asset for cleanup".**
     - Setting `"neffi/profiles/<id>/a"` returns `{ previousAssetId: null }`.
     - Then setting `null` returns `{ previousAssetId: "neffi/profiles/<id>/a" }`.
  7. **"deleteProfile refuses while a card shows it, then deletes everything and returns the image for cleanup".**
     - With the card connected, it rejects with `has_cards`.
     - Set the card's `profileId` to null and set `imageAssetId` to `"img"`.
     - `deleteProfile` returns `{ imageAssetId: "img" }`. The scenes, blocks, forms and submissions for it are gone.
  8. **"every mutation is not_found for another account".** Loop over the six functions with another account's id; expect `not_found`.
- [ ] **Step 2: Verify it fails.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles/lifecycle.db.test.ts`. Expected: FAIL (functions not exported).
- [ ] **Step 3: Implement** (append to `profiles.ts`):
```ts
export async function publishProfile(db: Db, input: { accountId: string; profileId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    const gaps = publishGaps({ ...p, visibleDefaultBlocks: await visibleBlockCount(tx, p.defaultSceneId) });
    if (gaps.length) throw new ProfileError("not_ready", gaps);
    await tx.update(schema.profiles).set({ status: "published" }).where(eq(schema.profiles.id, p.id));
  });
}

export async function unpublishProfile(db: Db, input: { accountId: string; profileId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    if (p.status === "published") await tx.update(schema.profiles).set({ status: "unpublished" }).where(eq(schema.profiles.id, p.id));
  });
}

// A Published profile must stay publishable (D6): edits that would empty it are refused, not silently applied.
export async function updateIdentity(db: Db, input: { accountId: string; profileId: string; identity: Identity }): Promise<void> {
  await db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    if (p.status === "published") {
      const gaps = publishGaps({ ...input.identity, visibleDefaultBlocks: await visibleBlockCount(tx, p.defaultSceneId) });
      if (gaps.length) throw new ProfileError("not_ready", gaps);
    }
    await tx.update(schema.profiles).set(input.identity).where(eq(schema.profiles.id, p.id));
  });
}

export async function updateAppearance(db: Db, input: { accountId: string; profileId: string; accentColor: string; imageIsLogo: boolean }): Promise<void> {
  if (!ACCENTS.some((accent) => accent.hex === input.accentColor)) throw new ProfileError("invalid");
  await db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    await tx.update(schema.profiles).set({ accentColor: input.accentColor, imageIsLogo: input.imageIsLogo }).where(eq(schema.profiles.id, p.id));
  });
}

export async function setProfileImage(db: Db, input: { accountId: string; profileId: string; assetId: string | null }) {
  return db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    await tx.update(schema.profiles).set({ imageAssetId: input.assetId }).where(eq(schema.profiles.id, p.id));
    return { previousAssetId: p.imageAssetId === input.assetId ? null : p.imageAssetId };
  });
}

export async function deleteProfile(db: Db, input: { accountId: string; profileId: string }) {
  return db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    const [{ n }] = await tx.select({ n: count() }).from(schema.cards).where(eq(schema.cards.profileId, p.id));
    if (n > 0) throw new ProfileError("has_cards");
    await tx.delete(schema.profiles).where(eq(schema.profiles.id, p.id));
    return { imageAssetId: p.imageAssetId };
  });
}
```
  Imports: `ACCENTS` and `type Identity` from `./rules`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles`, then `corepack pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/modules/profiles && git commit -m "feat(profiles): publish, unpublish, identity, appearance and delete rules"`
- [ ] **Step 6: Ledger.**

## Task 9: Setup handoff and onboarding UI

**Files:**
- Create: `src/app/(customer)/app/setup/[cardId]/page.tsx`, `actions.ts`, `setup-forms.tsx`, `page.test.tsx`, `actions.test.ts`
- Modify: `src/app/(customer)/app/page.tsx` (Ready-to-set-up items become links) and `src/app/(customer)/app/page.test.tsx`

**Interfaces:**
- Consumes: `requireAccount`, `authorize`, `ownedCards` (M5), `ownedProfiles`, `createProfileFromStarter`, `connectCardToProfile`, `ProfileError`, `PURPOSES`, `isPurpose`, `essentialsSchema`, `Input`, `Textarea`, `Button size="touch"`.
- Produces: the `/app/setup/[cardId]` route, `createProfileAction(prev, data)`, `chooseProfileAction(data)`.

- [ ] **Step 1: Write the failing tests.**

  **`actions.test.ts`.** Mock `@/auth/access`, `@/db`, `@/modules/profiles/profiles`, `@/modules/cards/manage` and `next/navigation` (`redirect` and `notFound` throw `Error("REDIRECT:<url>")` / `Error("NOT_FOUND")`), using the M5 `actions.test.ts` pattern. Cases:
  1. **Signed out:** `redirect("/sign-in?next=/app")`.
  2. **Invalid essentials:** `{ fullName: "" }` returns `{ error: "Check the highlighted fields and try again.", fields: ["fullName"] }`, and `createProfileFromStarter` is not called.
  3. **Bad purpose or card id:** `NOT_FOUND`.
  4. **Success:** the call is made with the normalized essentials, then `REDIRECT:/app/profiles/<id>/publish`. This holds whether the result has `created: true` or `created: false`.
  5. **`ProfileError("limit_reached")`:** returns the limit copy.
  6. **`ProfileError("not_found")`:** `NOT_FOUND`.
  7. **`chooseProfileAction`:** calls `connectCardToProfile`, then `REDIRECT:/app/profiles/<profileId>`.

  **`page.test.tsx`.** Use `renderToStaticMarkup` and mock data. Cases:
  1. **Unknown card:** `notFound`.
  2. **Card already set up:** `REDIRECT:/app/profiles/<id>`.
  3. **No profiles yet:** shows "What do you want your Neffi to help you do?" and three links to `?purpose=network|get_clients|show_my_work` with the `PURPOSES` labels.
  4. **Existing profiles and no `step`:** shows "Show one of your profiles on this card", a "Use Ana" button, and "Create a new profile" linking to `?step=purpose`.
  5. **`?purpose=get_clients`:** shows "Your essentials", the field labels including "Booking link", the Email field prefilled with `viewer.email`, and "Create my Neffi".
  6. **Invalid `?purpose=x`:** shows the purpose step.

  **`app/page.test.tsx` (update):** a waiting card renders `href="/app/setup/<id>"` with text "Set up Neffi ending in WXYZ".
- [ ] **Step 2: Verify they fail.** Run `node node_modules/vitest/vitest.mjs run "src/app/(customer)/app"`. Expected: FAIL.
- [ ] **Step 3: Implement.**

  **`actions.ts`:**
```ts
"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { connectCardToProfile } from "@/modules/cards/manage";
import { ProfileError } from "@/modules/profiles/errors";
import { createProfileFromStarter } from "@/modules/profiles/profiles";
import { essentialsSchema, isPurpose } from "@/modules/profiles/starters";

export type SetupState = { error?: string; fields?: string[] };
const MESSAGES = {
  invalid: "Check the highlighted fields and try again.",
  limit_reached: "You've reached the limit for this. Remove one first.",
};
const text = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
};
const uuid = (value: string) => (z.uuid().safeParse(value).success ? value : notFound());

async function viewerId() {
  const authorization = await authorize("account");
  if (!authorization.ok) redirect("/sign-in?next=/app");
  return authorization.viewer.accountId;
}

export async function createProfileAction(_previous: SetupState | undefined, data: FormData): Promise<SetupState> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const purpose = text(data, "purpose");
  if (!isPurpose(purpose)) notFound();
  const parsed = essentialsSchema.safeParse({
    fullName: text(data, "fullName"), headline: text(data, "headline"), bio: text(data, "bio"),
    email: text(data, "email"), phone: text(data, "phone"), link: text(data, "link"),
  });
  if (!parsed.success) return { error: MESSAGES.invalid, fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  let profileId: string;
  try {
    ({ profileId } = await createProfileFromStarter(db, { accountId, cardId, purpose, essentials: parsed.data }));
  } catch (error) {
    if (error instanceof ProfileError && error.code === "limit_reached") return { error: MESSAGES.limit_reached };
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  redirect(`/app/profiles/${profileId}/publish`);
}

export async function chooseProfileAction(data: FormData): Promise<void> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const profileId = uuid(text(data, "profileId"));
  try {
    await connectCardToProfile(db, { accountId, cardId, profileId });
  } catch (error) {
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  redirect(`/app/profiles/${profileId}`);
}
```
  **`setup-forms.tsx` (client):**
  - `EssentialsForm({ cardId, purpose, linkLabel, defaultEmail })` uses `useActionState(createProfileAction, undefined)`.
  - Hidden `cardId` and `purpose` inputs.
  - Fields in this order: "Full name" (`fullName`, required, `autoComplete="name"`), "What you do" (`headline`), "Short intro" (`bio`, `Textarea`, `maxLength={300}`), "Email" (`email`, `type="email"`, `defaultValue={defaultEmail}`), "Phone" (`phone`, `type="tel"`, `autoComplete="tel"`), `{linkLabel}` (`link`, `inputMode="url"`).
  - Each field with `aria-invalid` when its name is in `state.fields`.
  - The note "You can change all of this later."
  - Error in `role="alert"`.
  - `<Button type="submit" size="touch" className="w-full" disabled={pending}>Create my Neffi</Button>`.

  **`page.tsx`** (Server Component, `export const instant = false`):
```tsx
export default async function SetupPage({ params, searchParams }: PageProps<"/app/setup/[cardId]">) {
  const viewer = await requireAccount("/app");
  const [{ cardId }, query] = await Promise.all([params, searchParams]);
  const card = (await ownedCards(db, viewer.accountId)).find((owned) => owned.id === cardId);
  if (!card) notFound();
  if (card.profileId) redirect(`/app/profiles/${card.profileId}`);
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const purpose = first(query.purpose);
  // …render one of: essentials (isPurpose(purpose)), choose-existing (profiles.length && first(query.step) !== "purpose"), or purpose choice
}
```
  Render rules:
  - **Purpose options** are `<Link href={`?purpose=${key}`} className="flex min-h-11 flex-col rounded-lg border p-4">` with the label (`font-medium`) and the description.
  - **"Use {name}"** is a `<form action={chooseProfileAction}>` with hidden `cardId` and `profileId` inputs and a `size="touch"` Button. `{name}` is `fullName ?? "Untitled profile"`.
  - **Layout:** `<main className="flex flex-1 flex-col items-center gap-6 px-4 py-10"><div className="flex w-full max-w-sm flex-col gap-4">…`.
  - The card is referred to only as "your Neffi ending in WXYZ".

  **`/app` page:** replace each waiting `<li>` text with `<Link href={`/app/setup/${card.id}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">Set up Neffi ending in {card.publicToken.slice(-4)}</Link>`, and remove the "M6 turns each item…" comment.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run "src/app/(customer)"`, then `corepack pnpm typecheck` and `corepack pnpm lint`. Expected: PASS, including the touch-target guard.
- [ ] **Step 5: Commit.** `git add "src/app/(customer)/app" && git commit -m "feat(app): guided setup from a claimed card"`
- [ ] **Step 6: Ledger.**

## Task 10: Scene view, owner preview and publish step

**Files:**
- Create: `src/modules/profiles/scene-view.ts` + `scene-view.test.ts` (pure), `src/modules/profiles/view.ts` + `view.db.test.ts` (server-only), `src/components/scene-view.tsx` + `scene-view.test.tsx`
- Create: `src/app/(customer)/app/profiles/[profileId]/actions.ts` (`publishAction`, `unpublishAction`) + `actions.test.ts`
- Create: `src/app/(customer)/app/profiles/[profileId]/preview/page.tsx` + `page.test.tsx`, `src/app/(customer)/app/profiles/[profileId]/publish/page.tsx` + `page.test.tsx`
- Modify: `src/server-only-boundary.test.ts`

**Interfaces:**
- Consumes: `LINK_KIND_LABELS`, `visibleFields`, `parseFormConfig`, `getOwnedProfile`, `publishProfile`, `unpublishProfile`, `PUBLISH_GAP_COPY`.
- Produces: `buildSceneView`, `SceneView`, `ViewBlock`, `ViewIdentity`, `loadOwnerSceneView`, `SceneViewPreview`, `publishAction`, `unpublishAction`.

- [ ] **Step 1: Write the failing tests.**

  **`scene-view.test.ts` (pure).** Cases:
  - Hidden blocks are dropped; order follows `position`.
  - A link label falls back to `LINK_KIND_LABELS[kind]` (`"GitHub"`).
  - A booking label falls back to `"Book a time"`.
  - A contact block carries the identity's phone, email, website and location, and is dropped when all four are null and `saveContact` is false.
  - A form block carries `title` and `visibleFields(config)`.
  - A form block whose form row is missing or invalid is dropped.
  - Initials: `"Ana Maria Cruz"` → `"AC"`, `"ana"` → `"A"`, blank → `"N"`.
  - Accent defaults to `"#0C0C0D"`.
  - `image` is `null` when `imageUrl` is `null`.

  **`view.db.test.ts`:**
  - Profile created through the starter: `loadOwnerSceneView(tx, { accountId, profileId })` returns the shown Scene (Default) with three blocks for `get_clients`.
  - Passing another profile's `sceneId` falls back to the shown Scene.
  - Another account gets `null`.

  **`scene-view.test.tsx`:**
  - Renders name, headline and initials.
  - A link renders as `<a href="https://…" target="_blank" rel="noopener noreferrer">` with `min-h-11`.
  - Form inputs render `disabled`, with the text "Visitors can send you a message here."
  - Contact renders `tel:` and `mailto:` links, plus a disabled "Save contact" button.

  **`actions.test.ts`:**
  - `publishAction` success → `REDIRECT:/app/profiles/<id>?published=1`.
  - `not_ready` returns `{ error: "Your Neffi isn't ready to publish yet.", gaps: [<PUBLISH_GAP_COPY lines>] }`.
  - `not_found` → `NOT_FOUND`.
  - `unpublishAction` → `REDIRECT:/app/profiles/<id>`.

  **`publish/page.test.tsx`:**
  - Draft → "Your Neffi is ready", the preview and a "Publish" button.
  - With gaps → the gap copy and an "Edit details" link to `…/identity`.
  - Published → `REDIRECT:/app/profiles/<id>`.
  - Unknown → `NOT_FOUND`.

  **`preview/page.test.tsx`:**
  - Shows "This is a preview. Visitors see this when your Neffi is published."
  - Shows scene switcher links `?scene=<id>` for each Scene.
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement.**

  **`scene-view.ts` (pure; no `server-only`, no `@/db`):**
```ts
import { LINK_KIND_LABELS, type LinkKind } from "./block-content";
import { parseFormConfig, visibleFields } from "../forms/config";

export type ViewIdentity = {
  fullName: string; initials: string; headline: string | null; company: string | null; bio: string | null;
  phone: string | null; email: string | null; website: string | null; location: string | null;
  accent: string; image: { url: string; isLogo: boolean } | null;
};
export type ViewBlock =
  | { id: string; type: "about"; text: string }
  | { id: string; type: "project"; title: string; description: string | null; url: string | null }
  | { id: string; type: "link"; kind: LinkKind; label: string; url: string }
  | { id: string; type: "contact"; saveContact: boolean; phone: string | null; email: string | null; website: string | null; location: string | null }
  | { id: string; type: "booking"; label: string; url: string }
  | { id: string; type: "form"; formId: string; title: string; fields: ReturnType<typeof visibleFields> };
export type SceneView = { identity: ViewIdentity; scene: { id: string; name: string }; blocks: ViewBlock[] };
export type SceneViewInput = {
  profile: { fullName: string | null; headline: string | null; company: string | null; bio: string | null; phone: string | null; email: string | null; website: string | null; location: string | null; accentColor: string | null; imageIsLogo: boolean };
  imageUrl: string | null;
  scene: { id: string; name: string };
  blocks: { id: string; type: string; position: number; visible: boolean; content: unknown; formId: string | null }[];
  forms: { id: string; title: string; config: unknown }[];
};

const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length ? (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() : "N";
};

// The one mapping from stored rows to what a viewer sees. Owner preview uses it now; M7's public page reuses it.
export function buildSceneView({ profile, imageUrl, scene, blocks, forms }: SceneViewInput): SceneView {
  const identity: ViewIdentity = {
    fullName: profile.fullName ?? "", initials: initials(profile.fullName ?? ""), headline: profile.headline, company: profile.company,
    bio: profile.bio, phone: profile.phone, email: profile.email, website: profile.website, location: profile.location,
    accent: profile.accentColor ?? "#0C0C0D", image: imageUrl ? { url: imageUrl, isLogo: profile.imageIsLogo } : null,
  };
  const view: ViewBlock[] = [];
  for (const block of [...blocks].sort((a, b) => a.position - b.position)) {
    if (!block.visible) continue;
    const c = block.content as Record<string, unknown>;
    if (block.type === "about") view.push({ id: block.id, type: "about", text: String(c.text) });
    else if (block.type === "project") view.push({ id: block.id, type: "project", title: String(c.title), description: (c.description as string | null) ?? null, url: (c.url as string | null) ?? null });
    else if (block.type === "link") view.push({ id: block.id, type: "link", kind: c.kind as LinkKind, label: (c.label as string | null) ?? LINK_KIND_LABELS[c.kind as LinkKind], url: String(c.url) });
    else if (block.type === "booking") view.push({ id: block.id, type: "booking", label: (c.label as string | null) ?? "Book a time", url: String(c.url) });
    else if (block.type === "contact") {
      const { phone, email, website, location } = identity;
      if (c.saveContact || phone || email || website || location) view.push({ id: block.id, type: "contact", saveContact: Boolean(c.saveContact), phone, email, website, location });
    } else if (block.type === "form") {
      const form = forms.find((f) => f.id === block.formId);
      const parsed = form ? parseFormConfig(form.config) : { ok: false as const };
      if (form && parsed.ok) view.push({ id: block.id, type: "form", formId: form.id, title: form.title, fields: visibleFields(parsed.config) });
    }
  }
  return { identity, scene, blocks: view };
}
```
  **`view.ts` (server-only):**
  - `loadOwnerSceneView` selects the owned Profile's identity columns plus `defaultSceneId` and `activeSceneId`, filtered by `accountId`.
  - Scene selection: use `sceneId` if it belongs to the Profile, otherwise `activeSceneId ?? defaultSceneId`.
  - It selects that Scene's blocks (all columns used by `SceneViewInput`) and the Profile's `form_definitions` (`id`, `title`, `config`).
  - It returns `buildSceneView({ …, imageUrl: null })`; Task 16 adds the image.
  - It returns `null` when the Profile is not owned.

  **`src/components/scene-view.tsx`** (Server Component, no `"use client"`):
  - Root: `<article style={{ "--accent": view.identity.accent } as CSSProperties} className="mx-auto flex w-full max-w-[390px] flex-col gap-4 rounded-2xl border bg-background p-5">`.
  - Header:
    - avatar: a 96px `<img alt="">` when there is an image (`rounded-full object-cover`, or `object-contain` for a logo), otherwise a 96px circle with `background: var(--accent)` showing the white initials;
    - `<h1>` with the name;
    - the headline and company line;
    - the location.
  - Blocks:
    - **about:** `<p className="whitespace-pre-line">`.
    - **project:** a bordered section with an `<h2>`, the description and a "View project" link.
    - **link:** `<a className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border-2 px-4 font-medium" style={{ borderColor: "var(--accent)" }}>`.
    - **booking:** the same, filled: `style={{ background: "var(--accent)", color: "#fff" }}`.
    - **contact:** rows of `tel:`, `mailto:` and website links (each `min-h-11`) and the location text, plus `<button disabled className="min-h-11 …">Save contact</button>` when `saveContact`. The Save Contact download is M7.
    - **form:** `<h2>` title, then each field as a labelled `disabled` input or textarea (`required` marked by the text " (required)"), a `disabled` "Send" button, and `<p>` "Visitors can send you a message here."
  - Every external link has `target="_blank" rel="noopener noreferrer"`.

  **`actions.ts` (profile-level; later tasks append here):** start the file with this header, then the publish actions:
```ts
"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { ProfileError } from "@/modules/profiles/errors";
import { publishProfile, unpublishProfile } from "@/modules/profiles/profiles";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";

export type ProfileActionState = { error?: string; gaps?: string[]; fields?: string[]; ok?: string };
const PROFILE_MESSAGES = {
  invalid: "Check the highlighted fields and try again.",
  limit_reached: "You've reached the limit for this. Remove one first.",
  has_cards: "Move or disable the cards showing this profile before deleting it.",
  default_scene: "Your main scene can't be deleted.",
  not_ready: "Your Neffi isn't ready to publish yet.",
};
```
  `"use server"` files may only export async functions, and every exported async function becomes a callable endpoint. So `PROFILE_MESSAGES` and the helpers below are **not** exported. The `ProfileActionState` type export is fine because types are erased.
```ts
async function ownerId() …                 // not exported; as viewerId in Task 9 (authorize, redirect to /sign-in?next=/app)
const id = (value: FormDataEntryValue | null) => (typeof value === "string" && z.uuid().safeParse(value).success ? value : notFound());
// failure(error): ProfileError → not_found → notFound(); not_ready → { error: PROFILE_MESSAGES.not_ready, gaps: error.gaps.map((g) => PUBLISH_GAP_COPY[g]) }; other codes → { error: PROFILE_MESSAGES[code] }; non-ProfileError → rethrow.
export async function publishAction(_previous: ProfileActionState | undefined, data: FormData): Promise<ProfileActionState> {
  const accountId = await ownerId();
  const profileId = id(data.get("profileId"));
  try { await publishProfile(db, { accountId, profileId }); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${profileId}?published=1`);
}
export async function unpublishAction(data: FormData): Promise<void> { … unpublishProfile …; redirect(`/app/profiles/${profileId}`); }
```
  Write `ownerId`, `id` and `failure` as non-exported helpers in this file. Export only async actions.

  **Pages:**
  - `publish/page.tsx` (Server):
    - `requireAccount`;
    - `getOwnedProfile` (null → `notFound()`; `status !== "draft"` → `redirect` to the overview);
    - `loadOwnerSceneView` for the Default Scene;
    - renders the heading, `SceneViewPreview`, the gap list (if any) plus the "Edit details" link, a client `PublishButton` (`useActionState(publishAction)`) and the "Edit before publishing" link.
  - `preview/page.tsx`: the note, the scene links, and `SceneViewPreview`.
  - Put `PublishButton` in `src/app/(customer)/app/profiles/[profileId]/profile-forms.tsx` (`"use client"`). Later tasks add their client forms to this same file.

  Add `src/modules/profiles/view.ts` to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles src/components "src/app/(customer)"`, then `corepack pnpm typecheck` and `corepack pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/modules/profiles src/components "src/app/(customer)/app/profiles" src/server-only-boundary.test.ts && git commit -m "feat(profiles): owner preview and publish step"`
- [ ] **Step 6: Ledger.**

## Task 11: Scenes domain

**Files:** Create `src/modules/profiles/scenes.ts` and `src/modules/profiles/scenes.db.test.ts`. Modify `src/server-only-boundary.test.ts`.

**Interfaces:**
- Consumes: `lockOwnedProfile`, `LIMITS`, `ProfileError`.
- Produces: `createScene`, `renameScene`, `deleteScene`, `showScene` (§5).

- [ ] **Step 1: Write the failing tests** `scenes.db.test.ts`, on a profile created through the starter (`network`):
  1. **"creates an empty scene or a copy that shares the same forms".**
     - `createScene(…, { name: "Events", copyFromSceneId: null })` → 0 blocks.
     - `copyFromSceneId: defaultSceneId` → the same types, positions, visibility, content and `formId` as the source. The `form_definitions` count is unchanged.
  2. **"names are trimmed and 1–40 characters".** `" "` and 41 characters reject with `invalid`.
  3. **"a sixth scene is refused".** Expect `limit_reached`.
  4. **"rename and show".**
     - `renameScene` updates the name.
     - `showScene(events)` sets `activeSceneId = events`.
     - `showScene(default)` sets `activeSceneId = null`.
  5. **"the Default Scene cannot be deleted; deleting the shown scene falls back to Default".**
     - `deleteScene(default)` rejects with `default_scene`.
     - Show "Events", then delete it: `activeSceneId` becomes `null` and its blocks are gone.
  6. **"another profile's scene is not found".** For every function, use a scene id from a different profile of the same account. Expect `not_found`, with no change.
- [ ] **Step 2: Verify it fails.**
- [ ] **Step 3: Implement** `scenes.ts` (server-only). Every function runs `db.transaction` → `lockOwnedProfile` first.
```ts
const sceneName = (raw: string) => {
  const name = raw.trim();
  if (name.length < 1 || name.length > 40) throw new ProfileError("invalid");
  return name;
};
async function ownedScene(tx: Db, profileId: string, sceneId: string) {
  const [scene] = await tx.select({ id: schema.scenes.id }).from(schema.scenes).where(and(eq(schema.scenes.id, sceneId), eq(schema.scenes.profileId, profileId)));
  if (!scene) throw new ProfileError("not_found");
  return scene;
}
```
  - **`createScene`:**
    1. Run `sceneName`.
    2. Count the Profile's scenes; if the count is at least `LIMITS.scenesPerProfile`, throw `limit_reached`.
    3. If `copyFromSceneId` is set, call `ownedScene` on it.
    4. Insert the scene.
    5. If copying, read the source blocks ordered by `position` (`type`, `position`, `visible`, `content`, `formId`) and insert them under the new scene with the same values.
    6. Return `{ sceneId }`.
  - **`renameScene`:** `ownedScene`, then update the name.
  - **`deleteScene`:**
    1. If `sceneId === p.defaultSceneId`, throw `default_scene`.
    2. `ownedScene`.
    3. If `p.activeSceneId === sceneId`, update `activeSceneId: null` first.
    4. Delete the scene; its blocks cascade.
  - **`showScene`:** `ownedScene`, then update `activeSceneId: sceneId === p.defaultSceneId ? null : sceneId`.

  Add the file to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/modules/profiles/scenes.ts src/modules/profiles/scenes.db.test.ts src/server-only-boundary.test.ts && git commit -m "feat(profiles): scenes — add, copy, rename, show and delete"`
- [ ] **Step 6: Ledger.**

## Task 12: Blocks domain

**Files:** Create `src/modules/profiles/blocks.ts` and `src/modules/profiles/blocks.db.test.ts`. Modify `src/server-only-boundary.test.ts`.

**Interfaces:**
- Consumes: `lockOwnedProfile`, `visibleBlockCount`, `parseBlockContent`, `PRESETS`, `LIMITS`, `ProfileError`.
- Produces: `addBlock`, `updateBlock`, `moveBlock`, `setBlockVisible`, `deleteBlock` (§5).

- [ ] **Step 1: Write the failing tests** `blocks.db.test.ts`, on a profile created through the starter (`show_my_work` with `bio` and `link` set, so the Default Scene holds 3 blocks: about, link, contact):
  1. **"adds validated blocks at the end".**
     - `addBlock(type "project", content { title: "Site", url: "site.test" })` → position 3, stored content `{ title: "Site", description: null, url: "https://site.test/" }`.
     - Invalid content (`{ title: "" }`) rejects with `invalid`.
  2. **"a form block creates its form from the preset; a sixth form is refused".**
     - `addBlock(type "form", preset "contact")` → a new `form_definitions` row with title "Send me a message", and `block.formId` set.
     - `type: "form"` without a preset rejects with `invalid`.
     - After 5 forms in the Profile, it rejects with `limit_reached`.
  3. **"the 21st block in a scene is refused".** Expect `limit_reached`.
  4. **"move keeps positions dense".**
     - Move the last block up → the order is `[about, link, project, contact]`, positions `[0, 1, 2, 3]`.
     - Moving the first block up, or the last block down, changes nothing.
  5. **"delete renumbers".** Delete position 1 → the remaining positions are `[0, 1, 2]`.
  6. **"updateBlock revalidates; a form block's content cannot be edited here".**
     - Updating a link to `javascript:` rejects with `invalid`.
     - `updateBlock` on a form block rejects with `invalid`.
  7. **"a Published profile keeps at least one visible block in its Default Scene".**
     - Publish the Profile and hide blocks until one is left; hiding the last rejects with `not_ready` (`gaps: ["content"]`).
     - Deleting it also rejects.
     - In a non-Default Scene, hiding the last block is allowed.
  8. **"a block of another profile is not found".** Every function rejects with `not_found` and nothing changes.
- [ ] **Step 2: Verify it fails.**
- [ ] **Step 3: Implement** `blocks.ts` (server-only). Every function runs `db.transaction` → `lockOwnedProfile` first:
```ts
async function ownedBlock(tx: Db, profileId: string, blockId: string) {
  const [block] = await tx
    .select({ id: schema.sceneBlocks.id, sceneId: schema.sceneBlocks.sceneId, type: schema.sceneBlocks.type, visible: schema.sceneBlocks.visible })
    .from(schema.sceneBlocks)
    .innerJoin(schema.scenes, eq(schema.scenes.id, schema.sceneBlocks.sceneId))
    .where(and(eq(schema.sceneBlocks.id, blockId), eq(schema.scenes.profileId, profileId)));
  if (!block) throw new ProfileError("not_found");
  return block;
}

// Positions stay 0..n-1 in display order; written only while the profile row is locked.
async function writeOrder(tx: Db, ids: string[]) {
  for (const [position, id] of ids.entries()) await tx.update(schema.sceneBlocks).set({ position }).where(eq(schema.sceneBlocks.id, id));
}
const orderedIds = async (tx: Db, sceneId: string) =>
  (await tx.select({ id: schema.sceneBlocks.id }).from(schema.sceneBlocks).where(eq(schema.sceneBlocks.sceneId, sceneId)).orderBy(asc(schema.sceneBlocks.position), asc(schema.sceneBlocks.createdAt))).map((row) => row.id);

// D6: removing the last visible item of a Published profile's Default Scene would leave it empty.
async function guardLastVisible(tx: Db, profile: { status: string; defaultSceneId: string | null }, block: { sceneId: string; visible: boolean }) {
  if (profile.status === "published" && block.visible && block.sceneId === profile.defaultSceneId && (await visibleBlockCount(tx, block.sceneId)) <= 1) {
    throw new ProfileError("not_ready", ["content"]);
  }
}
```
  - **`addBlock`:**
    1. Check the scene belongs to the Profile (the same `ownedScene` check as Task 11; reuse it by exporting it from `scenes.ts`).
    2. `parseBlockContent(type, content)`; on `!ok` throw `invalid`.
    3. If the scene's block count is at least `LIMITS.blocksPerScene`, throw `limit_reached`.
    4. For `type === "form"`: require `preset` (else `invalid`); if the Profile's `form_definitions` count is at least `LIMITS.formsPerProfile`, throw `limit_reached`; insert the form from `PRESETS[preset]`.
    5. Insert the block with `position` = the current count.
  - **`updateBlock`:** `ownedBlock`; `type === "form"` → `invalid`; parse; update `content`.
  - **`moveBlock`:** `ownedBlock`; ids = `orderedIds`; `i` = `indexOf`; `j = i ± 1`; if `j` is out of range, return; swap; `writeOrder`.
  - **`setBlockVisible`:** `ownedBlock`; if hiding, `guardLastVisible`; update.
  - **`deleteBlock`:** `ownedBlock`; `guardLastVisible`; delete; `writeOrder(orderedIds(sceneId))`.

  Add the file to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules/profiles`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/modules/profiles src/server-only-boundary.test.ts && git commit -m "feat(profiles): ordered blocks — add, edit, move, show/hide and remove"`
- [ ] **Step 6: Ledger.**

## Task 13: Profiles list, overview and details editing

**Files:**
- Create: `src/app/(customer)/app/profiles/page.tsx` + `page.test.tsx`, `src/app/(customer)/app/profiles/[profileId]/page.tsx` + `page.test.tsx`, `src/app/(customer)/app/profiles/[profileId]/identity/page.tsx` + `page.test.tsx`
- Modify: `src/app/(customer)/app/profiles/[profileId]/actions.ts` (+ tests) and `profile-forms.tsx`

**Interfaces:**
- Consumes: `ownedProfiles`, `getOwnedProfile`, `updateIdentity`, `identitySchema`, `createScene`, `showScene`, `deleteProfile`, `unpublishAction`/`publishAction`.
- Produces: `updateIdentityAction(prev, data)`, `showSceneAction(data)`, `createSceneAction(prev, data)`, `deleteProfileAction(prev, data)`.

- [ ] **Step 1: Write the failing tests.**

  **Pages:**
  - **List:** names, or "Untitled profile", with status words "Draft", "Published" and "Unpublished", and links to `/app/profiles/<id>`.
  - **Overview:**
    - The "Now showing" Scene name, plus a "Show this" button for each other Scene.
    - Scene links to `/app/profiles/<id>/scenes/<sceneId>`, with the "(Default)" marker.
    - "Add a scene" with the name field and the "Start from" select (Empty plus each Scene).
    - Links to `identity`, `appearance` and `preview`.
    - The Messages count linking to `/app/inbox`.
    - Card suffixes.
    - A "Publish" button for a Draft, "Unpublish" for a Published Profile.
    - `?published=1` shows "Your Neffi is live." in `role="status"`.
    - Delete section: with cards connected it shows the `has_cards` text and no delete button. Without cards it shows the confirm checkbox text and the "Delete profile" button.
    - Unknown profile → `NOT_FOUND`.
  - **Identity:** all 8 labelled fields prefilled from the Profile, and a "Save" button.

  **Actions (mocked domain):**
  - `updateIdentityAction`: an invalid email returns `fields: ["email"]` and the domain is not called. Success returns `{ ok: "Saved." }`. `not_ready` returns gap copy.
  - `showSceneAction` calls `showScene`, then `REDIRECT:/app/profiles/<id>`.
  - `createSceneAction` (`name`, `copyFrom` = `"empty"` or a uuid) → `REDIRECT:/app/profiles/<id>/scenes/<newId>`. `limit_reached` returns its copy.
  - `deleteProfileAction` without `confirm=on` returns `{ error: "Tick the box to confirm." }` and the domain is not called. Success → `REDIRECT:/app/profiles`. `has_cards` returns its copy. After success it calls `destroyImage` only if an `imageAssetId` was returned; Task 16 wires that, so for now assert only the redirect.
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement.**
  - Pages are Server Components with `instant = false`, `requireAccount`, then `notFound()` on null. Use the copy and layout from §6.
  - Client forms (`useActionState`) live in `profile-forms.tsx`: `IdentityForm`, `AddSceneForm` and `DeleteProfileForm`. Server-only buttons (`showSceneAction`, `unpublishAction`) are plain `<form action>` elements with `size="touch"` Buttons.
  - The identity form posts every field. The action parses with `identitySchema` and maps issue paths to `fields`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run "src/app/(customer)"`, then `corepack pnpm typecheck` and `corepack pnpm lint`. Expected: PASS, including the touch-target guard.
- [ ] **Step 5: Commit.** `git add "src/app/(customer)/app/profiles" && git commit -m "feat(app): profiles list, overview and details editing"`
- [ ] **Step 6: Ledger.**

## Task 14: Scene editor and block editing UI (all types except form configuration)

**Files:**
- Create: `src/app/(customer)/app/profiles/[profileId]/scenes/[sceneId]/page.tsx` + `page.test.tsx`
- Create: `…/scenes/[sceneId]/blocks/new/page.tsx` + `page.test.tsx`, `…/scenes/[sceneId]/blocks/[blockId]/page.tsx` + `page.test.tsx`
- Create: `…/scenes/[sceneId]/actions.ts` + `actions.test.ts`, `…/scenes/[sceneId]/block-forms.tsx`
- Create: `src/modules/profiles/editor.ts` (server-only read model) + `editor.db.test.ts`

**Interfaces:**
- Consumes: Task 11–12 functions, `LINK_KINDS`, `LINK_KIND_LABELS`, `PRESETS`.
- Produces:
  - `sceneForEditing(db, accountId, profileId, sceneId): Promise<{ scene: { id; name; isDefault }; blocks: { id; type; visible; summary: string; content: Record<string, unknown> }[] } | null>`;
  - `blockForEditing(db, accountId, profileId, blockId)`.

  The summary is the about text's first 60 characters, the project title, the link label or kind label, "Save Contact on/off", the booking label or "Book a time", or the form title.
- Actions: `renameSceneAction`, `deleteSceneAction`, `addBlockAction`, `updateBlockAction`, `moveBlockAction`, `toggleBlockAction`, `removeBlockAction`.

- [ ] **Step 1: Write the failing tests.**
  - **`editor.db.test.ts`:**
    - Blocks come back in position order with correct summaries.
    - Another account → `null`.
    - A scene of another profile → `null`.
  - **Scene page:**
    - The rename form.
    - Each row's type label and summary.
    - "Move up" disabled on the first row and "Move down" disabled on the last (the `disabled` attribute).
    - "Hide"/"Show" according to visibility.
    - "Edit" link to `…/blocks/<id>`.
    - "Remove" with the confirm checkbox.
    - "Add …" links (`?type=`), with types already present listed after absent ones.
    - "Delete scene" absent for the Default Scene.
  - **New block page:**
    - For each `?type`, the exact §7 labels.
    - `type=form` shows the three preset options and an "Add" button.
    - An unknown type → `NOT_FOUND`.
  - **Edit block page:**
    - Fields prefilled from the content.
    - A form block renders Task 17's `FormEditor`. Until Task 17, that is the text "Form settings" plus a link back.
  - **Actions:**
    - Each calls its domain function with the ids and parsed fields, then `REDIRECT:/app/profiles/<id>/scenes/<sceneId>`.
    - `invalid`, `limit_reached`, `not_ready` and `default_scene` map to the §6 copy.
    - `removeBlockAction` and `deleteSceneAction` require `confirm=on`.
    - `deleteSceneAction` redirects to `/app/profiles/<id>`.
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement** per §6, §7 and the tests.
  - Block forms (`block-forms.tsx`, client) render the type-specific fields, using `name` attributes equal to the content keys (`text`, `title`, `description`, `url`, `kind`, `label`, `saveContact`).
  - Actions build `content` from `FormData` with `Object.fromEntries` restricted to those keys, then call the domain function. Validation stays in `parseBlockContent`.
  - Add `src/modules/profiles/editor.ts` to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run "src/app/(customer)" src/modules/profiles`, then `corepack pnpm typecheck` and `corepack pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add "src/app/(customer)/app/profiles" src/modules/profiles src/server-only-boundary.test.ts && git commit -m "feat(app): scene editor with ordered, editable blocks"`
- [ ] **Step 6: Ledger.**

## Task 15: Cloudinary integration and environment (user prerequisite: dev Cloudinary account)

**Before starting, stop and confirm with the user** that `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` for a **development** Cloudinary account are in `.env.local`. Record the confirmation, never the values, under `Rulings`. Automated tests do not need them.

**Files:**
- Create: `src/integrations/media/cloudinary.ts` + `cloudinary.test.ts`
- Modify: `src/config/env-schema.ts` (+ `env-schema.test.ts` fixtures), `.env.example`, `.github/workflows/ci.yml`, `scripts/check-client-bundle.mjs`, `src/server-only-boundary.test.ts`

**Interfaces:**
- Produces: `CloudinaryConfig`, `signImageUpload`, `isProfileImageId`, `checkImage`, `getImage`, `destroyImage`, `imageUrl`, `IMAGE_FORMATS`, `MAX_IMAGE_BYTES`.
- Produces: `env.cloudinaryCloudName`, `env.cloudinaryApiKey`, `env.cloudinaryApiSecret`.

- [ ] **Step 1: Write the failing tests.**

  `cloudinary.test.ts`. Mock `fetch` with `vi.stubGlobal`.
```ts
import { afterEach, expect, test, vi } from "vitest";
import { checkImage, destroyImage, getImage, imageUrl, isProfileImageId, sign, signImageUpload } from "./cloudinary";

const CONFIG = { cloudName: "demo", apiKey: "123", apiSecret: "abcd" };
const PROFILE = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
afterEach(() => vi.unstubAllGlobals());

test("signature matches Cloudinary's published example", () => {
  expect(sign({ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 }, "abcd")).toBe(
    "bfd09f95f331f558cbd1320e67aa8d488770583e",
  );
});

test("upload tickets are signed for one profile-scoped id, restricted formats and a size cap, without the secret", () => {
  const ticket = signImageUpload(CONFIG, { profileId: PROFILE, now: new Date("2026-10-11T00:00:00Z") });
  expect(ticket.url).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
  expect(ticket.fields).toMatchObject({ api_key: "123", allowed_formats: "jpg,png,webp,heic", transformation: "c_limit,h_2048,w_2048", timestamp: "1760140800" });
  expect(isProfileImageId(PROFILE, ticket.fields.public_id)).toBe(true);
  const { signature, api_key: _key, ...signed } = ticket.fields;
  expect(signature).toBe(sign(signed, "abcd"));
  expect(JSON.stringify(ticket)).not.toContain("abcd");
});

test("profile image ids cannot be borrowed from another profile or path", () => {
  expect(isProfileImageId(PROFILE, `neffi/profiles/${PROFILE}/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`)).toBe(true);
  for (const id of [`neffi/profiles/${PROFILE}/../x`, `neffi/profiles/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`, "sample"]) expect(isProfileImageId(PROFILE, id)).toBe(false);
});

test("uploaded images must be small, raster and at most 2048px", () => {
  expect(checkImage({ bytes: 1_000_000, width: 800, height: 800, format: "jpg" })).toBe(true);
  for (const bad of [{ bytes: 5_000_001 }, { width: 2049 }, { format: "svg" }, { format: "gif" }]) {
    expect(checkImage({ bytes: 1, width: 1, height: 1, format: "png", ...bad })).toBe(false);
  }
});

test("getImage uses basic auth and returns only size facts; 404 is null", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ bytes: 10, width: 2, height: 3, format: "png", secure_url: "x" })).mockResolvedValueOnce(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await getImage(CONFIG, "a/b")).toEqual({ bytes: 10, width: 2, height: 3, format: "png" });
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.cloudinary.com/v1_1/demo/resources/image/upload/a/b");
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Basic ${btoa("123:abcd")}`);
  expect(await getImage(CONFIG, "a/c")).toBeNull();
});

test("destroyImage posts a signed request and fails opaquely", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(destroyImage(CONFIG, "a/b")).rejects.toThrow("Media delete failed");
  const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
  expect(body.get("public_id")).toBe("a/b");
  expect(body.get("signature")).toMatch(/^[0-9a-f]{40}$/);
});

test("delivery uses one of two fixed, optimized transformations", () => {
  expect(imageUrl("demo", "a/b", false)).toBe("https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_256,h_256,f_auto,q_auto/a/b");
  expect(imageUrl("demo", "a/b", true)).toBe("https://res.cloudinary.com/demo/image/upload/c_fit,w_256,h_256,f_auto,q_auto/a/b");
});
```
  In `env-schema.test.ts`, add the three vars to the valid fixture, and add one case that a missing `CLOUDINARY_API_SECRET` fails with "CLOUDINARY_API_SECRET is required".
- [ ] **Step 2: Verify they fail.** Run `node node_modules/vitest/vitest.mjs run src/integrations/media src/config`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/integrations/media/cloudinary.ts`:
```ts
import "server-only";
import { createHash, randomUUID } from "node:crypto";

// Browser → Cloudinary signed uploads, verified server-side before Neffi stores the id. No SDK: one signing rule
// and two HTTP calls. The API secret never leaves this module.
export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };
export const IMAGE_FORMATS = ["jpg", "png", "webp", "heic"] as const;
export const MAX_IMAGE_BYTES = 5_000_000;
const MAX_SIDE = 2048;
const INCOMING = `c_limit,h_${MAX_SIDE},w_${MAX_SIDE}`;

// Cloudinary's signature: SHA-1 of the sorted key=value pairs joined by "&", followed by the API secret.
export function sign(params: Record<string, string | number>, apiSecret: string): string {
  const payload = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

export type ImageUploadTicket = { url: string; fields: Record<string, string> };

export function signImageUpload(config: CloudinaryConfig, { profileId, now = new Date() }: { profileId: string; now?: Date }): ImageUploadTicket {
  const params = {
    allowed_formats: IMAGE_FORMATS.join(","),
    public_id: `neffi/profiles/${profileId}/${randomUUID()}`,
    timestamp: String(Math.floor(now.getTime() / 1000)),
    transformation: INCOMING,
  };
  return { url: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, fields: { ...params, api_key: config.apiKey, signature: sign(params, config.apiSecret) } };
}

export const isProfileImageId = (profileId: string, publicId: string) =>
  publicId.startsWith(`neffi/profiles/${profileId}/`) && /^[0-9a-f-]{36}$/.test(publicId.slice(`neffi/profiles/${profileId}/`.length));

export const checkImage = (image: { bytes: number; width: number; height: number; format: string }) =>
  image.bytes <= MAX_IMAGE_BYTES && image.width <= MAX_SIDE && image.height <= MAX_SIDE && (IMAGE_FORMATS as readonly string[]).includes(image.format);

export async function getImage(config: CloudinaryConfig, publicId: string) {
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${publicId}`, {
    headers: { Authorization: `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}` },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Media check failed");
  const { bytes, width, height, format } = (await response.json()) as { bytes: number; width: number; height: number; format: string };
  return { bytes, width, height, format };
}

export async function destroyImage(config: CloudinaryConfig, publicId: string): Promise<void> {
  const params = { invalidate: "true", public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)) };
  const body = new URLSearchParams({ ...params, api_key: config.apiKey, signature: sign(params, config.apiSecret) });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, { method: "POST", body });
  if (!response.ok) throw new Error("Media delete failed");
}

export function imageUrl(cloudName: string, publicId: string, isLogo: boolean): string {
  const transformation = isLogo ? "c_fit,w_256,h_256,f_auto,q_auto" : "c_fill,g_face,w_256,h_256,f_auto,q_auto";
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`;
}
```
  The signature test vector is Cloudinary's documented example. If it fails, the signing implementation is wrong; do not change the vector.

  **Environment:**
  - `env-schema.ts`: add `cloudinaryCloudName`, `cloudinaryApiKey` and `cloudinaryApiSecret` to `ServerEnv`, and `CLOUDINARY_CLOUD_NAME: required("CLOUDINARY_CLOUD_NAME")` (same for the other two) to `serverSchema`. Map them in the parse result exactly as the existing provider keys are mapped.
  - `.env.example`: add a section after "Physical card provisioning":
```
# --- Profile media (server-only) ---
# Development Cloudinary account (never production). Uploads go browser → Cloudinary with a short-lived signature
# from Neffi; the secret stays on the server.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```
    Also change the line "# Cloudinary, Turnstile, SENTRY_AUTH_TOKEN" to "# Turnstile, SENTRY_AUTH_TOKEN".
  - `ci.yml`: add `CLOUDINARY_CLOUD_NAME: ci-dummy-cloud`, `CLOUDINARY_API_KEY: ci-dummy-cloudinary-key-0123456789` and `CLOUDINARY_API_SECRET: ci-dummy-cloudinary-secret-0123456789abcdef` next to the existing synthetic values.
  - `check-client-bundle.mjs`: add `"CLOUDINARY_API_SECRET"` to `SECRET_VARS`.
  - Add `src/integrations/media/cloudinary.ts` to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/integrations src/config src/server-only-boundary.test.ts`, then `corepack pnpm typecheck` and `corepack pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/integrations/media src/config .env.example .github/workflows/ci.yml scripts/check-client-bundle.mjs src/server-only-boundary.test.ts && git commit -m "feat(media): signed Cloudinary uploads without exposing the secret"`
- [ ] **Step 6: Ledger.** Record that the user confirmed the dev credentials are present, and **remind the user** that Vercel Preview needs the same three variables before the PR. That is an external action the executor does not perform.

## Task 16: Appearance and profile image

**Files:**
- Create: `src/app/(customer)/app/profiles/[profileId]/appearance/page.tsx` + `page.test.tsx`, `src/app/(customer)/app/profiles/[profileId]/image-upload.tsx` (client)
- Modify: `src/app/(customer)/app/profiles/[profileId]/actions.ts` (+ tests): add `updateAppearanceAction`, `startImageUploadAction`, `confirmImageAction` and `removeImageAction`, and make `deleteProfileAction` clean up the image
- Modify: `src/modules/profiles/view.ts` (+ `view.db.test.ts`): image URL

**Interfaces:**
- Consumes: `updateAppearance`, `setProfileImage`, `deleteProfile`, `getOwnedProfile`, `ACCENTS`, the Cloudinary functions, `consumeQuota`, `hmacHex`.
- Produces:
  - `startImageUploadAction(profileId: string): Promise<{ ticket?: ImageUploadTicket; error?: string }>`;
  - `confirmImageAction(profileId: string, publicId: string): Promise<{ ok?: true; error?: string }>`;
  - `removeImageAction(profileId: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests.** Mock `@/integrations/media/cloudinary`, the domain and `@/auth/otp-quota`.
  - **`startImageUploadAction`:**
    - Not owned (`getOwnedProfile` → null) → `NOT_FOUND`, and nothing is signed.
    - Over quota (20 per Account per 10 minutes, key `hmacHex(env.betterAuthSecret, "media-sign", accountId)`) → `{ error: "Too many uploads. Please wait a few minutes and try again." }`.
    - Success → `{ ticket }` from `signImageUpload(config, { profileId })`.
  - **`confirmImageAction`:**
    - A wrong-prefix id → `{ error }`, and neither `getImage` nor the domain is called.
    - `getImage` → `null` → `{ error }`.
    - `checkImage` false → `destroyImage(publicId)` is called and returns `{ error: "Use a JPG, PNG, WebP or HEIC image up to 5 MB." }`.
    - Success → `setProfileImage` with `assetId: publicId`, then `destroyImage(previous)`; it returns `{ ok: true }`. If `destroyImage` of the previous asset rejects, the result is still `{ ok: true }`.
  - **`removeImageAction`:** `setProfileImage(null)`, then destroys the previous asset.
  - **`deleteProfileAction`:** after the domain returns `{ imageAssetId: "x" }`, calls `destroyImage("x")` (best effort).
  - **`updateAppearanceAction`:**
    - A non-palette colour → `{ error: "Check the highlighted fields and try again." }`.
    - Success → `{ ok: "Saved." }`.
  - **Appearance page:**
    - 8 swatch radios (name + `value=hex`), with the current one checked.
    - "Show my image as" Photo/Logo.
    - The current image `<img>` when present.
    - An "Upload image" button (client component stubbed in the page test).
  - **`view.db.test.ts`:** when `imageAssetId` is set, `identity.image` is `{ url: imageUrl(cloud, id, isLogo), isLogo }` (mock `@/config/env` with a `cloudinaryCloudName`).
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement.**
  - **Actions:**
    - `startImageUploadAction` and `confirmImageAction` are called directly from the client component, not through a form. They begin with `ownerId()`, validate `profileId` as a UUID, and check ownership with `getOwnedProfile` (null → `notFound()`).
    - Cleanup of replaced or rejected assets is `await destroyImage(...).catch(() => undefined)`. The database is updated first, so a failed delete leaves at worst an orphan in Cloudinary, never a broken profile.
    - Add the comment `// ponytail: orphaned Cloudinary assets from abandoned uploads are not swept; add a periodic sweep in M10 if storage matters.`
  - **`image-upload.tsx` (client):**
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmImageAction, removeImageAction, startImageUploadAction } from "./actions";

const FAILED = "We couldn't upload that image. Use a JPG, PNG, WebP or HEIC image up to 5 MB.";

// The file goes straight from the phone to Cloudinary with a short-lived signature; Neffi then checks it before using it.
export function ImageUpload({ profileId, hasImage }: { profileId: string; hasImage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function upload(file: File) {
    if (file.size > 5_000_000) return setMessage(FAILED);
    setBusy(true);
    setMessage(undefined);
    try {
      const { ticket, error } = await startImageUploadAction(profileId);
      if (!ticket) return setMessage(error ?? FAILED);
      const body = new FormData();
      for (const [key, value] of Object.entries(ticket.fields)) body.set(key, value);
      body.set("file", file);
      const response = await fetch(ticket.url, { method: "POST", body });
      const uploaded = response.ok ? ((await response.json()) as { public_id?: string }) : {};
      const result = uploaded.public_id ? await confirmImageAction(profileId, uploaded.public_id) : { error: FAILED };
      if (result.error) return setMessage(result.error);
      router.refresh();
    } catch {
      setMessage(FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-4 text-sm font-medium">
        {busy ? "Uploading…" : hasImage ? "Replace image" : "Upload image"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" disabled={busy} onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
      </label>
      {hasImage ? (
        <Button type="button" variant="ghost" size="touch" disabled={busy} onClick={async () => { await removeImageAction(profileId); router.refresh(); }}>
          Remove image
        </Button>
      ) : null}
      {message ? <p role="alert" className="rounded-lg bg-muted px-3 py-2 text-sm">{message}</p> : null}
      <p className="text-sm text-muted-foreground">JPG, PNG, WebP or HEIC, up to 5 MB.</p>
    </div>
  );
}
```
  - **`view.ts`:** select `imageAssetId` and pass `imageUrl: p.imageAssetId ? imageUrl(env.cloudinaryCloudName, p.imageAssetId, p.imageIsLogo) : null`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run "src/app/(customer)" src/modules/profiles`, then `corepack pnpm typecheck` and `corepack pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add "src/app/(customer)/app/profiles" src/modules/profiles && git commit -m "feat(app): accent colour and profile image or logo"`
- [ ] **Step 6: Ledger.**

## Task 17: Form settings (domain and editor)

**Files:**
- Create: `src/modules/forms/forms.ts` + `forms.db.test.ts`
- Create: `src/app/(customer)/app/profiles/[profileId]/scenes/[sceneId]/form-editor.tsx` (client)
- Modify: `…/scenes/[sceneId]/actions.ts` (+ tests): `updateFormAction`; `…/blocks/[blockId]/page.tsx` (+ test): render `FormEditor` for form blocks; `src/modules/profiles/editor.ts` (`blockForEditing` also returns `form: { id, title, config }` for form blocks); `src/server-only-boundary.test.ts`

**Interfaces:**
- Consumes: `lockOwnedProfile`, `parseFormConfig`, `FIELD_LABELS`, `MAX_QUESTIONS`.
- Produces: `updateForm` (§5), `updateFormAction(prev, data)`.

- [ ] **Step 1: Write the failing tests.**
  - **`forms.db.test.ts`:**
    - It saves the title and a valid config with one custom question.
    - An invalid config (no way to reply) or a blank title rejects with `invalid`.
    - Another profile's form → `not_found`.
    - Existing submissions are untouched by edits; their `answers` snapshot is unchanged.
  - **Action test:**
    - The `FormData` fields `title`, `field.name`, `field.email`, `field.phone`, `field.company`, `field.message`, `question.0.id`, `question.0.label`, `question.0.required`, and `question.1.label` (with no id) build `{ fields, questions }`.
    - Blank question labels are dropped.
    - New questions receive an 8-character `[a-z0-9]` id.
    - More than 3 non-blank questions → `{ error: "You can add up to 3 questions." }` with no domain call.
    - Success → `REDIRECT:` to the scene editor.
  - **Edit page:** a form block shows "Form title" and, for each field, a select with Hidden/Optional/Required. "Your name" is shown as "Required" and is not changeable (rendered as text plus a hidden input `field.name=required`).
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement.**
  - **`forms.ts` (server-only):** `updateForm` runs `parseFormConfig`, and checks the title is 1–60 characters after trimming (else `invalid`). Then, in a transaction: `lockOwnedProfile`, then `update form_definitions set title, config where id = formId and profile_id = profileId returning id`. No row → `not_found`.
  - **`form-editor.tsx`:** a client component with `useActionState(updateFormAction)` and local state for up to 3 question rows. Each row has a label input (≤80), a "Required" checkbox and a "Remove" button. There is an "Add a question" button, hidden at 3 rows, and the Save button `size="touch"`.
  - **`updateFormAction`:** builds `config` from `FormData` as tested. Validation stays in `parseFormConfig`.
  - Add `src/modules/forms/forms.ts` to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules/forms "src/app/(customer)"`, then `corepack pnpm typecheck` and `corepack pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/modules/forms src/modules/profiles/editor.ts "src/app/(customer)/app/profiles" src/server-only-boundary.test.ts && git commit -m "feat(forms): owner form settings with presets and custom questions"`
- [ ] **Step 6: Ledger.**

## Task 18: Visitor submissions (domain and same-origin Route Handler)

**Files:**
- Create: `src/lib/client-ip.ts` + `client-ip.test.ts`
- Modify: `src/app/(public)/activate/actions.ts` (import `clientIp` from `@/lib/client-ip`; delete the local constant; behaviour identical, and the existing M5 tests stay green)
- Create: `src/modules/forms/submissions.ts` + `submissions.db.test.ts`
- Create: `src/app/api/forms/[formId]/submissions/route.ts` + `route.test.ts`
- Modify: `src/server-only-boundary.test.ts`

**Interfaces:**
- Consumes: `parseFormConfig`, `validateAnswers`, `consumeQuota`, `hmacHex`, `env.betterAuthSecret`, `env.authBaseUrl`.
- Produces:
  - `clientIp`;
  - `submitForm` returning `{ status: "created"; submissionId; replyTo: string | null } | { status: "duplicate"; submissionId } | { status: "unavailable" } | { status: "invalid"; fields }`;
  - `POST /api/forms/[formId]/submissions`.

- [ ] **Step 1: Write the failing tests.**
  - **`client-ip.test.ts`:**
    - `x-vercel-forwarded-for` wins.
    - Then the first comma value of `x-forwarded-for`, trimmed.
    - Otherwise `"unknown"`.
  - **`submissions.db.test.ts`** (Published profile from the `network` starter with its Connect form; publish with `publishProfile`):
    1. **"stores a validated snapshot".** `submitForm({ formId, clientKey, answers: { name: "Vic", email: "VIC@e.test", message: "" } })` → `{ status: "created", submissionId, replyTo: "vic@e.test" }`. The stored row has `answers = [{label:"Your name",value:"Vic"},{label:"Email",value:"vic@e.test"}]`, `profileId` set and `readAt`/`notifiedAt` null.
    2. **"the same browser key stores once".** Repeating with the same `clientKey` → `{ status: "duplicate", submissionId: <same> }`, and 1 row.
    3. **"invalid answers are refused".** A missing name → `{ status: "invalid", fields: ["name"] }`, and no row.
    4. **"only a Published profile's visible form accepts messages".**
       - Unpublish → `unavailable`.
       - Republish; hide the form block → `unavailable`.
       - Show it; delete the block → `unavailable`, and earlier rows remain.
       - Unknown form id → `unavailable`.
  - **`route.test.ts`.** Mock `@/db`, `@/config/env` (`authBaseUrl: "http://localhost:3000"`, `betterAuthSecret`), `@/auth/otp-quota` `consumeQuota`, and `@/modules/forms/submissions`. Call `POST(new Request(url, { method: "POST", headers, body }), { params: Promise.resolve({ formId }) })`.
    1. Missing or foreign `Origin` → 403, with no quota or domain call.
    2. Quota exhausted → 429 with no domain call. The key is `hmacHex(secret, "form-ip", "203.0.113.9")` and the limit is 10.
    3. A body over 16,000 characters → 413.
    4. Non-JSON or a bad shape (`key` not a uuid, an answer over 2000 chars) → 400 `{ error: "invalid" }`.
    5. A non-uuid `formId` → 404.
    6. Honeypot `website: "x"` → 201 `{ ok: true }`, and `submitForm` is not called.
    7. `unavailable` → 404. `invalid` → 400 `{ error: "invalid", fields }`. `created`/`duplicate` → 201 `{ ok: true }`.
    8. No response body ever contains the answers.
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement.**

  **`src/lib/client-ip.ts`:**
```ts
// The client IP used to key abuse limits. Vercel overwrites both headers, so callers cannot spoof them; locally they
// may be absent and everyone shares one "unknown" bucket (mirrors Better Auth's ipAddressHeaders in src/auth/options.ts).
export const clientIp = (headers: Headers) =>
  (headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
```
  **`src/modules/forms/submissions.ts`** (server-only; Task 20 appends Inbox functions):
```ts
export async function submitForm(db: Db, input: { formId: string; clientKey: string; answers: Record<string, unknown> }): Promise<SubmitResult> {
  const [form] = await db
    .select({ id: schema.formDefinitions.id, profileId: schema.formDefinitions.profileId, config: schema.formDefinitions.config })
    .from(schema.formDefinitions)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.formDefinitions.profileId))
    .where(
      and(
        eq(schema.formDefinitions.id, input.formId),
        eq(schema.profiles.status, "published"),
        // Only a form the owner currently shows somewhere accepts messages (D11).
        sql`exists (select 1 from ${schema.sceneBlocks} where ${schema.sceneBlocks.formId} = ${schema.formDefinitions.id} and ${schema.sceneBlocks.visible})`,
      ),
    );
  const config = form ? parseFormConfig(form.config) : null;
  if (!form || !config?.ok) return { status: "unavailable" };
  const result = validateAnswers(config.config, input.answers);
  if (!result.ok) return { status: "invalid", fields: result.fields };
  const [row] = await db
    .insert(schema.formSubmissions)
    .values({ formId: form.id, profileId: form.profileId, clientKey: input.clientKey, answers: result.answers })
    .onConflictDoNothing({ target: [schema.formSubmissions.formId, schema.formSubmissions.clientKey] })
    .returning({ id: schema.formSubmissions.id });
  if (row) return { status: "created", submissionId: row.id, replyTo: result.replyTo };
  const [existing] = await db
    .select({ id: schema.formSubmissions.id })
    .from(schema.formSubmissions)
    .where(and(eq(schema.formSubmissions.formId, form.id), eq(schema.formSubmissions.clientKey, input.clientKey)));
  return { status: "duplicate", submissionId: existing.id };
}
```
  **`route.ts`:**
```ts
import { z } from "zod";
import { consumeQuota, hmacHex } from "@/auth/otp-quota";
import { env } from "@/config/env";
import { db } from "@/db";
import { clientIp } from "@/lib/client-ip";
import { submitForm } from "@/modules/forms/submissions";

const MAX_BODY = 16_000;
const SUBMISSIONS_PER_IP = 10;
const body = z.object({ key: z.uuid(), answers: z.record(z.string(), z.string().max(2000)), website: z.string().max(200).optional() });
const json = (data: object, status: number) => Response.json(data, { status });

// Public, unauthenticated endpoint for Neffi Forms (M7 renders the form). Same-origin only; nothing is echoed back.
export async function POST(request: Request, { params }: RouteContext<"/api/forms/[formId]/submissions">) {
  if (request.headers.get("origin") !== new URL(env.authBaseUrl).origin) return json({ error: "forbidden" }, 403);
  if (!(await consumeQuota(db, hmacHex(env.betterAuthSecret, "form-ip", clientIp(request.headers)), SUBMISSIONS_PER_IP))) {
    return json({ error: "rate_limited" }, 429);
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);
  let parsed: z.infer<typeof body>;
  try {
    parsed = body.parse(JSON.parse(raw));
  } catch {
    return json({ error: "invalid" }, 400);
  }
  const { formId } = await params;
  if (!z.uuid().safeParse(formId).success) return json({ error: "unavailable" }, 404);
  // Bots fill the hidden field; accept and drop it so they learn nothing.
  if (parsed.website) return json({ ok: true }, 201);
  const result = await submitForm(db, { formId, clientKey: parsed.key, answers: parsed.answers });
  if (result.status === "unavailable") return json({ error: "unavailable" }, 404);
  if (result.status === "invalid") return json({ error: "invalid", fields: result.fields }, 400);
  return json({ ok: true }, 201);
}
```
  Add `src/modules/forms/submissions.ts` to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/lib src/modules/forms "src/app/api" "src/app/(public)/activate"`, then `corepack pnpm typecheck`. Expected: PASS; the M5 activation tests are unchanged.
- [ ] **Step 5: Commit.** `git add src/lib/client-ip.ts src/lib/client-ip.test.ts "src/app/(public)/activate/actions.ts" src/modules/forms "src/app/api/forms" src/server-only-boundary.test.ts && git commit -m "feat(forms): same-origin visitor submissions with dedupe and limits"`
- [ ] **Step 6: Ledger.**

## Task 19: Inquiry notification email

**Files:**
- Modify: `src/integrations/email/resend.ts` (+ `resend.test.ts`)
- Create: `src/integrations/email/sender.ts` (server-only)
- Modify: `src/auth/server.ts`
- Create: `src/modules/forms/notify.ts` + `notify.db.test.ts`
- Modify: `src/app/api/forms/[formId]/submissions/route.ts` (+ `route.test.ts`) and `src/server-only-boundary.test.ts`

**Interfaces:**
- Consumes: `submitForm` (`created` carries `replyTo`), `after` from `next/server`.
- Produces:
  - `Email` gains `replyTo?` and `idempotencyKey?`;
  - `sendEmail` (shared sender);
  - `submissionEmail(...)`;
  - `notifySubmission(db, send, { submissionId, appOrigin, replyTo })`.

- [ ] **Step 1: Write the failing tests.**
  - **`resend.test.ts`:**
    - `idempotencyKey` is sent as the `Idempotency-Key` header.
    - `replyTo` is sent as `reply_to: [address]`.
    - Without them, the header is a random UUID (existing behaviour) and the body has no `reply_to` key.
  - **`notify.db.test.ts`.** Use a submission created through `submitForm`, and a fake `send` (`vi.fn()`).
    1. **"emails the profile owner's sign-in address once".** `notifySubmission(tx, send, { submissionId, appOrigin: "https://app.example.test", replyTo: "vic@e.test" })` calls `send` once with:
       - `to` = the owner Account's email;
       - `subject: "New message from your Neffi"`;
       - `text` containing `"Your name: Vic"` and `"https://app.example.test/app/inbox/<submissionId>"`;
       - `replyTo: "vic@e.test"`;
       - `idempotencyKey: "form-submission-<submissionId>"`.

       `notifiedAt` is then set. A second call sends nothing.
    2. **"a failed send keeps the message and never throws".** `send` rejects → `notifySubmission` resolves, `notifiedAt` stays null, and the row still exists.
    3. **"an unknown submission is ignored".**
  - **`route.test.ts`:** for `created`, `after` (mocked from `next/server`) is called once, and its callback calls `notifySubmission` with `{ submissionId, appOrigin: "http://localhost:3000", replyTo }`. For `duplicate`, `after` is not called.
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement.**
  - **`resend.ts`:**
    - Extend `Email` with `replyTo?` and `idempotencyKey?`.
    - In the body, add `...(replyTo ? { reply_to: [replyTo] } : {})`.
    - The header becomes `"Idempotency-Key": idempotencyKey ?? crypto.randomUUID()`.
    - Update the header comment to say the idempotency key is caller-supplied for notifications and random for sign-in codes.
  - **`sender.ts`:**
```ts
import "server-only";
import { env } from "@/config/env";
import { createResendSender } from "./resend";

// One EmailService instance for the app: sign-in codes and inquiry notifications share the sender address.
export const sendEmail = createResendSender({ apiKey: env.resendApiKey, from: env.authEmailFrom });
```
  - **`auth/server.ts`:** import `sendEmail` from `@/integrations/email/sender` instead of creating its own.
  - **`notify.ts` (server-only):**
```ts
export function submissionEmail(input: { profileName: string | null; formTitle: string; answers: Answer[]; link: string; canReply: boolean }) {
  const lines = input.answers.map((answer) => `${answer.label}: ${answer.value}`).join("\n");
  return {
    subject: "New message from your Neffi",
    text: [
      `Someone sent a message through "${input.formTitle}" on ${input.profileName ?? "your Neffi"}.`,
      lines,
      `See it in your Neffi inbox: ${input.link}`,
      ...(input.canReply ? ["Reply to this email to answer them directly."] : []),
    ].join("\n\n"),
  };
}

// The submission is already stored (D12). Email is a courtesy: one attempt, deduplicated by Resend, never thrown.
export async function notifySubmission(db: Db, send: EmailSender, input: { submissionId: string; appOrigin: string; replyTo: string | null }): Promise<void> {
  try {
    const [row] = await db
      .select({ answers: schema.formSubmissions.answers, notifiedAt: schema.formSubmissions.notifiedAt, formTitle: schema.formDefinitions.title, profileName: schema.profiles.fullName, to: schema.accounts.email })
      .from(schema.formSubmissions)
      .innerJoin(schema.formDefinitions, eq(schema.formDefinitions.id, schema.formSubmissions.formId))
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.formSubmissions.profileId))
      .innerJoin(schema.accounts, eq(schema.accounts.id, schema.profiles.accountId))
      .where(eq(schema.formSubmissions.id, input.submissionId));
    if (!row || row.notifiedAt) return;
    const email = submissionEmail({ ...row, answers: row.answers as Answer[], link: `${input.appOrigin}/app/inbox/${input.submissionId}`, canReply: Boolean(input.replyTo) });
    await send({ to: row.to, ...email, replyTo: input.replyTo ?? undefined, idempotencyKey: `form-submission-${input.submissionId}` });
    await db.update(schema.formSubmissions).set({ notifiedAt: new Date() }).where(and(eq(schema.formSubmissions.id, input.submissionId), isNull(schema.formSubmissions.notifiedAt)));
  } catch {
    // Nothing about the visitor or the message is logged; the Inbox still shows it.
    console.error("Form notification failed");
  }
}
```
  - **`route.ts`:** after the `invalid` branch, add:
```ts
  if (result.status === "created") {
    const appOrigin = new URL(env.authBaseUrl).origin;
    after(() => notifySubmission(db, sendEmail, { submissionId: result.submissionId, appOrigin, replyTo: result.replyTo }));
  }
```
  - Add `sender.ts` and `notify.ts` to `SERVER_ONLY_ENTRYPOINTS`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/integrations src/modules/forms "src/app/api" src/auth`, then `corepack pnpm typecheck`. Expected: PASS; the M3 auth tests are unchanged.
- [ ] **Step 5: Commit.** `git add src/integrations/email src/auth/server.ts src/modules/forms "src/app/api/forms" src/server-only-boundary.test.ts && git commit -m "feat(forms): notify the profile owner after a message is saved"`
- [ ] **Step 6: Ledger.**

## Task 20: Inbox

**Files:**
- Modify: `src/modules/forms/submissions.ts`
- Create: `src/modules/forms/inbox.db.test.ts`, `src/lib/format-date.ts` + `format-date.test.ts`
- Create: `src/app/(customer)/app/inbox/page.tsx` + `page.test.tsx`, `src/app/(customer)/app/inbox/[submissionId]/page.tsx` + `page.test.tsx`, `src/app/(customer)/app/inbox/actions.ts` + `actions.test.ts`

**Interfaces:**
- Produces:
  - `listInbox`, `openSubmission`, `deleteSubmission`, `unreadCount` (§5);
  - `InboxItem = { id; profileName: string | null; formTitle: string; preview: string; createdAt: Date; unread: boolean }`;
  - `SubmissionDetail = { id; profileName; formTitle; answers: Answer[]; createdAt: Date; replyEmail: string | null }`;
  - `formatDateTime(date: Date): string`;
  - `deleteSubmissionAction(prev, data)`.

- [ ] **Step 1: Write the failing tests.**
  - **`inbox.db.test.ts`:**
    1. **"lists the account's messages newest first, 20 per page, across its profiles".** Insert 21 submissions across two of the Account's profiles, with explicit `createdAt` values a minute apart.
       - Page 1 has 20 items, newest first, plus `next`.
       - `listInbox({ before: next })` returns 1 item and `next: null`.
       - Another Account's messages never appear.
    2. **"preview is the first answer, at most 80 characters; unread until opened".**
    3. **"opening marks read once and returns the snapshot".**
       - `openSubmission` → the answers and `replyEmail` (the "Email" answer value, or null).
       - `readAt` is set.
       - A second open keeps the first `readAt`.
       - Another Account → `null`, and nothing changes.
    4. **"unreadCount counts only the account's unread".**
    5. **"delete removes only the account's own message".** Another Account → `not_found`, and the row remains.
  - **`format-date.test.ts`:** `formatDateTime(new Date("2026-10-11T04:05:00Z"))` → `"Oct 11, 2026, 12:05 PM"`. This is Manila time; adjust only the separator if the runtime ICU data differs, never the time zone.
  - **Pages:**
    - The list shows the preview, profile name, form title, formatted date and "New" for unread.
    - "Show older" links to `?before=<iso>_<uuid>`.
    - A malformed `before` is ignored.
    - The empty state copy.
    - Detail: labels and values, a "Reply by email" `mailto:` link only when `replyEmail` is set, and the delete confirm.
    - Unknown → `NOT_FOUND`.
  - **Action:**
    - Without confirm → `{ error: "Tick the box to confirm." }`.
    - Success → `REDIRECT:/app/inbox`.
    - `not_found` → `NOT_FOUND`.
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement.**
  - **`listInbox`:** select `s.id`, `s.answers`, `s.createdAt`, `s.readAt`, `f.title` and `p.fullName` from `form_submissions s` join `form_definitions f` join `profiles p`, `WHERE p.account_id = $account`. When `before` is set, add `(s.created_at, s.id) < ($createdAt, $id)` (row comparison via `sql`). Order by `s.created_at desc, s.id desc` and limit 21. Return 20 items plus `next` taken from the 20th.
  - **`openSubmission`:** an owned select, then `update … set read_at = now() where id = $id and read_at is null`.
  - **`deleteSubmission`:** `delete from form_submissions where id = $id and profile_id in (select id from profiles where account_id = $account) returning id`. No row → `ProfileError("not_found")`.
  - **`unreadCount`:** `count(*)` with the same join and `read_at is null`.
  - **`format-date.ts`:**
```ts
// Absolute dates only: rendering must not read the clock (M5 lesson; cacheComponents).
const formatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
export const formatDateTime = (date: Date) => formatter.format(date);
```
  - **`before` cursor:** encode as `${createdAt.toISOString()}_${id}`. Parse with a split on the last `_`, then `Date.parse` and `z.uuid()`; anything invalid becomes `undefined`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules/forms src/lib "src/app/(customer)"`, then `corepack pnpm typecheck` and `corepack pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/modules/forms src/lib/format-date.ts src/lib/format-date.test.ts "src/app/(customer)/app/inbox" && git commit -m "feat(app): lightweight inbox for Neffi form messages"`
- [ ] **Step 6: Ledger.**

## Task 21: Cards management and digital Sharing QR

**Files:**
- Run: `corepack pnpm add uqr@0.1.3 --save-exact` (updates `package.json` and `pnpm-lock.yaml`)
- Create: `src/modules/cards/qr.ts` + `qr.test.ts`
- Modify: `src/modules/cards/manage.ts` (+ `manage.db.test.ts`)
- Create: `src/app/(customer)/app/cards/page.tsx` + `page.test.tsx`, `src/app/(customer)/app/cards/[cardId]/page.tsx` + `page.test.tsx`, `src/app/(customer)/app/cards/actions.ts` + `actions.test.ts`

**Interfaces:**
- Consumes: `lockOwnedCard`, `recordActivity`, `cardUrl(origin, token)` (`src/modules/cards/token.ts`), `env.cardUrlOrigin`, `ownedProfiles`.
- Produces:
  - `CardSummary = { id: string; publicToken: string; suffix: string; profileId: string | null; profileName: string | null; disabled: boolean }`;
  - `cardSummaries`, `getOwnedCard`, `setCardDisabled`, `qrSvgDataUri`;
  - `connectCardAction(prev, data)`, `setCardDisabledAction(prev, data)`.

- [ ] **Step 1: Write the failing tests.**
  - **`manage.db.test.ts` (append):**
    - `cardSummaries` lists only the Account's DBCs, with profile name and disabled flag.
    - `getOwnedCard` for another Account → `null`.
    - `setCardDisabled(true)` sets `disabledAt` and records `card_disabled`; repeating changes nothing (no second event).
    - `setCardDisabled(false)` clears it and records `card_enabled`.
    - Another Account's card → `not_found`.
  - **`qr.test.ts`:**
```ts
import { encode } from "uqr";
import { expect, test } from "vitest";
import { qrSvgDataUri } from "./qr";

test("the Sharing QR is an SVG picture of exactly the card's permanent URL", () => {
  const url = "https://tap.example.test/c/AAAAAAAAAAAAAAAAAAAAAAAAAA";
  const uri = qrSvgDataUri(url);
  expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
  expect(decodeURIComponent(uri.slice(uri.indexOf(",") + 1))).toContain("<svg");
  // Same input, same symbol: the QR is derived, not stored.
  expect(qrSvgDataUri(url)).toBe(uri);
  expect(encode(url, { ecc: "M" }).size).toBeGreaterThan(20);
});
```
  - **Pages:**
    - The list shows "Neffi ending in WXYZ", "Shows Ana" or "Not set up yet", and "Turned off".
    - The detail page:
      - the "Shows" select listing owned profiles with the current one selected;
      - the "Turn off this card" form with the §6 confirm text;
      - `<img alt="QR code for your Neffi link" src="data:image/svg+xml…">`;
      - the link text equals `cardUrl(env.cardUrlOrigin, token)`;
      - `<a download="neffi-qr.svg">Download QR code</a>`;
      - the note copy.
    - A card that is not set up shows a "Set up this Neffi" link to `/app/setup/<id>` and no QR. A QR is still valid, but sharing before setup would show an unavailable page, so it is hidden until a Profile is connected.
    - Unknown → `NOT_FOUND`.
  - **Actions:**
    - `connectCardAction` calls `connectCardToProfile`, then `REDIRECT:/app/cards/<id>`.
    - `setCardDisabledAction` for turning off requires `confirm=on` (else `{ error: "Tick the box to confirm." }`); turning on needs no confirm.
    - `not_found` → `NOT_FOUND`.
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement.**
  - **`qr.ts`:** pure, but it imports `uqr`; keep it server-side by importing it only from Server Components.
```ts
import { renderSVG } from "uqr";

// The Sharing QR is a picture of the card's existing permanent URL (D15). It creates no second link or identity.
export const qrSvgDataUri = (text: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSVG(text, { ecc: "M", border: 2 }))}`;
```
  - **`manage.ts`:**
    - `cardSummaries` is one query: `cards LEFT JOIN profiles ON profiles.id = cards.profile_id WHERE cards.owner_account_id = $account AND cards.kind = 'dbc' ORDER BY cards.created_at`. Map `suffix = publicToken.slice(-4)` and `disabled = disabledAt !== null`. Cap at 50, with the same ponytail note as M5 `ownedCards`.
    - `setCardDisabled`: `lockOwnedCard`; if `Boolean(card.disabledAt) === disabled`, return; update `disabledAt: disabled ? new Date() : null`; record `card_disabled` or `card_enabled` with `actorAccountId`, `accountId` and `cardId`.
  - **Pages** use the §6 copy. Show the QR at 240px (`className="size-60"`), with `image-rendering: pixelated` unnecessary for SVG.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/modules/cards "src/app/(customer)"`, then `corepack pnpm typecheck`, `corepack pnpm lint` and `corepack pnpm build` (confirms `uqr` bundles server-side). Expected: PASS.
- [ ] **Step 5: Commit.** `git add package.json pnpm-lock.yaml src/modules/cards "src/app/(customer)/app/cards" && git commit -m "feat(app): manage cards and share the card link as a QR"`
- [ ] **Step 6: Ledger.** Record the `uqr` version installed (it must be exactly 0.1.3).

## Task 22: Account controls

**Files:**
- Modify: `src/auth/options.ts`, `src/auth/server.ts`, `src/integrations/email/resend.ts` (+ tests) and `src/auth/test-auth.ts` (only if the `sendAuthCode` message type changes)
- Create: `src/auth/account-controls.db.test.ts`
- Create: `src/app/(customer)/app/account/page.tsx` + `page.test.tsx`, `src/app/(customer)/app/account/actions.ts` + `actions.test.ts`, `src/app/(customer)/app/account/account-forms.tsx`
- Modify: `src/app/(customer)/app/page.tsx` (+ test): the "Signed in as" / sign-in methods section and `AccountActions` move to `/app/account`; Home keeps no account controls. Move `account-actions.tsx` into `account/` and update the import.

**Interfaces:**
- Consumes: `auth.api.unlinkAccount`, `auth.api.requestEmailChangeEmailOTP`, `auth.api.changeEmailEmailOTP`, `auth.api.revokeSessions`, `getLinkedMethods`, `consumeQuota`.
- Produces: `removeGoogleAction(prev, data)`, `requestEmailChangeAction(prev, data)`, `confirmEmailChangeAction(prev, data)`, `signOutEverywhereAction()`, and `changeEmailCodeEmail(code, minutes)`.

- [ ] **Step 1: Write the failing tests.**

  `src/auth/account-controls.db.test.ts` uses `createTestAuth` from `src/auth/test-auth.ts`. Establish sessions exactly as the existing linking tests in `src/auth/google.db.test.ts` do (email-code sign-in through the test client, then `linkSocial` through the mocked Google flow). Call the server API with the client's cookie header.
  1. **"Google can be removed and the email code still signs in".** After linking Google, `auth.api.unlinkAccount({ headers, body: { providerId: "google" } })` succeeds. The identity row is gone. A fresh email-code sign-in for the same address still reaches the same Account. If Better Auth rejects with `FAILED_TO_UNLINK_LAST_ACCOUNT`, set `account.accountLinking.allowUnlinkingAll: true` in `options.ts` with the comment `// The verified email code always remains a sign-in method, so removing Google never locks anyone out (Step 2).`, then re-run the test.
  2. **"changing the sign-in email needs a code sent to the new address".**
     - `requestEmailChangeEmailOTP({ headers, body: { newEmail: "new@example.test" } })` delivers one message to `new@example.test` with `type: "change-email"`.
     - `changeEmailEmailOTP` with that code changes `accounts.email`.
     - A wrong code fails and leaves the email unchanged.
     - A `newEmail` that belongs to another Account sends nothing and changes nothing. This is Better Auth's built-in enumeration-safe behaviour.
  3. **"sign out everywhere ends every session".** Two sessions (two test clients signed in to the same Account) exist. After `revokeSessions` with one client's headers, `auth_sessions` has no rows for the Account.
  4. **"the HTTP routes stay disabled".** POSTing to `/unlink-account`, `/revoke-sessions`, `/email-otp/request-email-change` or `/email-otp/change-email` through the test client returns 404.

  Action tests (mock `@/auth/server` `auth.api.*` and `@/auth/otp-quota`):
  - **`requestEmailChangeAction`:**
    - An invalid email → `{ error: "Enter a valid email address." }`.
    - Over quota (3 per Account per 10 minutes, key `hmacHex(env.betterAuthSecret, "email-change", accountId)`) → too-many copy.
    - Better Auth error status 403 (stale session) → `{ error: "For your security, sign out and sign in again, then change your email." }`.
    - Success → `{ step: "code", email }`.
  - **`confirmEmailChangeAction`:**
    - Success → `REDIRECT:/app/account?changed=1`.
    - Failure → `{ error: "That code is not valid. Check it, or request a new one." }`.
  - **`removeGoogleAction`** → `REDIRECT:/app/account`.
  - **`signOutEverywhereAction`** → `revokeSessions`, then `REDIRECT:/sign-in`.

  Page test:
  - "Signed in as", "Sign-in methods", "Email code" and "Google" when linked.
  - "Remove Google" plus the note when linked; "Connect Google" otherwise.
  - The change-email form, "Sign out everywhere", the delete-account support text, and `?changed=1` status "Your sign-in email has been changed."
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement.**
  - **`options.ts`:**
    - Add `changeEmail: { enabled: true }` to `emailOTP({…})`.
    - Change `sendVerificationOTP` to `async ({ email, otp, type }) => sendAuthCode({ email, code: otp, type })`, and widen `sendAuthCode`'s message type to `{ email: string; code: string; type: string }`.
    - Keep all four HTTP paths in `DISABLED_PATHS`; server-side `auth.api.*` calls are unaffected (existing comment).
    - The before-hook that limits `/email-otp/send-verification-otp` to `type: "sign-in"` stays unchanged.
  - **`server.ts`:** `sendAuthCode: ({ email, code, type }) => sendEmail({ to: email, ...(type === "change-email" ? changeEmailCodeEmail(code, 5) : authCodeEmail(code, 5)) })`.
  - **`resend.ts`:**
```ts
export function changeEmailCodeEmail(code: string, lifetimeMinutes: number): Pick<Email, "subject" | "text"> {
  return {
    subject: "Confirm your new Neffi sign-in email",
    text: `Your Neffi code is ${code}.\n\nEnter it to use this address for signing in. It expires in ${lifetimeMinutes} minutes and works once. If you did not ask for this, ignore this message.`,
  };
}
```
  - **Actions** call `auth.api.*({ headers: await headers(), body })` server-side inside `try`/`catch`, mapping `APIError` status to the copy above. They never expose provider messages.
  - **`account-forms.tsx` (client):** `ChangeEmailForm` with two steps held in `useActionState` state. Step 1 is the new address and "Send code". Step 2 is the 6-digit code, the "Change email" button and "Use a different address". All controls are 44px.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run src/auth src/integrations "src/app/(customer)"`, then `corepack pnpm typecheck` and `corepack pnpm lint`. Expected: PASS, including every existing M3 auth test.
- [ ] **Step 5: Commit.** `git add src/auth src/integrations/email "src/app/(customer)/app" && git commit -m "feat(app): account sign-in methods, email change and sign out everywhere"`
- [ ] **Step 6: Ledger.** Record whether `allowUnlinkingAll` was needed, as a Ruling backed by the test evidence.

## Task 23: App navigation and Home

**Files:**
- Create: `src/app/(customer)/app/app-nav.tsx` (client; uses `usePathname` for `aria-current`) + `app-nav.test.tsx`
- Modify: `src/app/(customer)/app/layout.tsx` (render `<AppNav />` and add bottom padding `pb-24` to the content wrapper so the fixed bar never covers content)
- Modify: `src/app/(customer)/app/page.tsx` + `page.test.tsx`

**Interfaces:**
- Consumes: `ownedCards` (M5), `ownedProfiles`, `unreadCount`.
- Produces: `AppNav`.

- [ ] **Step 1: Write the failing tests.**
  - **`app-nav.test.tsx`.** Mock `next/navigation` `usePathname`. Expect four links in order: Home `/app`, Profiles `/app/profiles`, Cards `/app/cards`, Account `/app/account`. Each has `min-h-11`. The current section gets `aria-current="page"`: `/app/profiles/x` marks Profiles, and `/app` marks only Home.
  - **Home `page.test.tsx`.** Mock `ownedCards`, `ownedProfiles` and `unreadCount`.
    - "Ready to set up" links (Task 9, retained).
    - A Draft profile shows "Preview and publish Ana" linking to `/app/profiles/<id>/publish`.
    - `unread = 3` shows "3 new messages" and `unread = 1` shows "1 new message", linking to `/app/inbox`; `0` hides it.
    - "Your profiles" lists name and status, linking to the overview.
    - `?added=1` shows the M5 status line.
    - The "Activate another Neffi" / "Activate a Neffi" link is kept.
    - No "Signed in as" text (moved to Account in Task 22).
- [ ] **Step 2: Verify they fail.**
- [ ] **Step 3: Implement.**
  - The nav is `<nav aria-label="Main" className="fixed inset-x-0 bottom-0 border-t bg-background"><ul className="mx-auto grid max-w-md grid-cols-4">`. Each link is `inline-flex min-h-11 w-full flex-col items-center justify-center text-xs`; set `font-medium text-foreground` when current, `text-muted-foreground` otherwise.
  - Home queries run in one `Promise.all`.
- [ ] **Step 4: Verify.** Run `node node_modules/vitest/vitest.mjs run "src/app/(customer)"`, then `corepack pnpm typecheck` and `corepack pnpm lint`. Expected: PASS, including the touch-target guard.
- [ ] **Step 5: Commit.** `git add "src/app/(customer)/app" && git commit -m "feat(app): mobile navigation and home overview"`
- [ ] **Step 6: Ledger.**

## Task 24: Concurrency proof on real PostgreSQL (loopback only)

**Files:**
- Create: `scripts/check-profile-concurrency.mts`
- Modify: `package.json` (`"check:profile-concurrency": "node --conditions=react-server --import tsx scripts/check-profile-concurrency.mts"`)

**Interfaces:**
- Consumes: `createProfileFromStarter`, `addBlock`, `moveBlock`, `submitForm`, `publishProfile`.
- Produces: the npm script `check:profile-concurrency`.

- [ ] **Step 1: Prepare the disposable cluster.** If no disposable cluster is running on `127.0.0.1:55432`, start one exactly as the M5 plan, Task 5 Step 1 describes. Its database `neffi_m2_test` is reused. Never touch the machine's PostgreSQL service.
- [ ] **Step 2: Write the script.**
  - Copy the guard, `connect`, `database`, `settle` and `check` scaffolding **verbatim** from `scripts/check-claim-concurrency.mts`:
    - `DATABASE_URL_TEST` must be `127.0.0.1/neffi_m2_test`;
    - `neon.project_id` must be empty;
    - migrate before running;
    - never load `.env.local`.
  - Fixture, in raw SQL as in that script: one owner account, one customer account, an inactive DBC product, stock, a purchaser/order/order item, and a helper `ownedReleasedCard()` that inserts a released DBC owned by the customer.
  - Scenarios:
    1. **"two setups for one card create one profile".** `Promise.all` of `createProfileFromStarter` on `dbA` and `dbB` with the same card. The `created` flags sort to `[false, true]`, both return the same `profileId`, the customer has exactly 1 profile and 1 `card_profile_changed` event.
    2. **"concurrent adds keep positions dense and unique".** 6 parallel `addBlock(link)` calls on one Default Scene, alternating pools. `SELECT array_agg(position ORDER BY position)` equals `0..n-1` with no duplicates.
    3. **"moves racing with adds keep a permutation".** 4 `moveBlock` calls and 3 `addBlock` calls in parallel. Positions are still exactly `0..n-1`.
    4. **"the same browser key stores one message".** Publish the profile, then call `submitForm` twice in parallel with one `clientKey`. The statuses sort to `["created", "duplicate"]`, there is 1 row, and both `submissionId`s are equal.
  - End with `All profile concurrency checks passed.`
- [ ] **Step 3: Run it.** `DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test corepack pnpm check:profile-concurrency`. Expected: 4 × PASS and exit 0. Then run the remote-host guard check (any non-loopback URL) and expect an assertion before connecting.
- [ ] **Step 4: Commit.** `git add scripts/check-profile-concurrency.mts package.json && git commit -m "test(profiles): prove setup, ordering and submission safety under concurrency"`
- [ ] **Step 5: Ledger.** Record the 4 PASS labels.

## Task 25: Local acceptance helper and documentation

**Files:**
- Create: `scripts/dev-form-submission.mts`
- Modify: `package.json` (`"dev:form-submission": "node --conditions=react-server --import tsx scripts/dev-form-submission.mts"`), `README.md`

- [ ] **Step 1: Write the script.** It is local-only; reuse the M5 loopback guard and the Neon assertion from `scripts/dev-activation-fixture.mts`.
  1. Read `DATABASE_URL` (loopback only) and `APP_ORIGIN` (default `http://localhost:3000`, which must be `localhost`/`127.0.0.1`).
  2. Select the newest Published profile's form that a visible block shows (`id`, `config`).
  3. Build answers: `name: "Synthetic Visitor"`, `email: process.env.VISITOR_EMAIL ?? "visitor@example.test"`, `message: "Synthetic acceptance message"`, and `"Synthetic answer"` for every custom question id.
  4. POST to `${APP_ORIGIN}/api/forms/${id}/submissions` with `Origin: APP_ORIGIN` and `{ key: randomUUID(), answers }`. A `--repeat-key` flag sends the same key twice, to show deduplication.
  5. Print only the HTTP status codes.
- [ ] **Step 2: Check it.** Against a running local dev server on the loopback database with a published profile, it prints `201`; with `--repeat-key` it prints `201 201` and the Inbox shows one new message. With a non-loopback `DATABASE_URL` it refuses before connecting.
- [ ] **Step 3: README.** Add a `## Customer experience (Milestone 6)` section. Replace any sentence saying profiles are not built yet. It covers:
  - the setup flow;
  - Profiles, Scenes and Blocks;
  - the limits (D18);
  - forms and the submission endpoint (same-origin; rendered publicly in M7);
  - the notification behaviour;
  - the Inbox;
  - Cloudinary env vars and that the secret is server-only;
  - the Sharing QR, which encodes the permanent card URL;
  - `check:profile-concurrency`;
  - `dev:form-submission` (loopback only);
  - the M7 boundary: no `/c/{token}` page yet.
- [ ] **Step 4: Verify.** Run `corepack pnpm lint` and `corepack pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add scripts/dev-form-submission.mts package.json README.md && git commit -m "chore(profiles): local form submission helper and M6 documentation"`
- [ ] **Step 6: Ledger.**

## Task 26: Manual browser acceptance (390×844, local PostgreSQL) — user participation required

**Setup:**
- Disposable cluster database `neffi_m6_dev`: `createdb -h 127.0.0.1 -p 55432 -U postgres neffi_m6_dev`.
- Dev server: `DATABASE_URL=postgres://postgres@127.0.0.1:55432/neffi_m6_dev corepack pnpm dev`. The process env overrides `.env.local`; never use Neon.
- Claimable cards come from the M5 fixture (`dev:activation-fixture`, run privately; codes are never recorded). Claim them through `/activate` as in M5 Task 10.
- Cloudinary uses the dev account. Email notifications go to the user's own verified Resend inbox, so the claiming Account must use that address.

**Recording:** each item is `pass`/`fail`, with the viewport, and `executor-observed` or `user-reported`. Never record codes, OTPs, cookies, secrets or message contents.

- [ ] **A — Setup from a claimed card.** `/app` shows "Set up Neffi ending in …" → choose **Get Clients** → essentials (name, booking link `cal.com/…`) → "Your Neffi is ready" with a preview showing Booking, the Project inquiry form and Contact → **Publish** → "Your Neffi is live."
- [ ] **B — Resume.** Claim a second card and start **Network**. Submit essentials, then close the tab before publishing. Sign out, then back in. Home shows "Preview and publish …" → publish.
- [ ] **C — Existing profile.** Claim a third card. Setup offers "Use {name}" → the card shows that profile, and no new profile appears in Profiles.
- [ ] **D — Show My Work.** A fourth card set up as **Show My Work** with a portfolio link has About (if an intro was given), Portfolio and Contact. The Scene editor lists "Add Project" first.
- [ ] **E — Scenes.**
  - Add "Events" as a copy of the main scene, and "Empty" from Empty.
  - Rename one.
  - "Show this" on Events; the overview shows "Now showing: Events". Delete Events; the overview falls back to the main scene.
  - The main scene shows no delete option.
  - A sixth scene shows the limit message.
- [ ] **F — Blocks.**
  - Add each type. A Link given `example.com` saves as `https://example.com/`; `javascript:…` is refused with the plain message.
  - Move up and down; Hide and Show; Remove with confirm.
  - On the Published profile, hiding the last visible item of the main scene shows "Show at least one item in your main scene."
- [ ] **G — Form settings.** Set Phone to Required and Company to Hidden. Add the custom question "Budget" (required). Save, then reopen; the settings persist. Setting both Email and Phone to Hidden is refused.
- [ ] **H — Messages and notification.**
  - `VISITOR_EMAIL=<a controlled address> DATABASE_URL=… corepack pnpm dev:form-submission` prints `201`.
  - Home shows "1 new message". The Inbox shows "New"; opening the message removes "New".
  - The notification email arrives at the owner inbox with subject "New message from your Neffi", the inbox link works, and Reply goes to the visitor address.
  - `--repeat-key` adds only one message.
  - Delete the message with confirm.
- [ ] **I — Image.**
  - Upload a JPG photo; it shows round in the preview.
  - Switch to Logo; it shows uncropped.
  - Replace it, then confirm in the Cloudinary console that the old asset is gone (user-reported).
  - Remove it; the preview falls back to initials on the accent colour.
  - A 6 MB file shows the size message without uploading.
  - Change the accent colour; the preview changes.
- [ ] **J — Cards and QR.**
  - The Cards list shows each card with what it shows.
  - Switch a card to another profile.
  - Turn a card off (with confirm), then on again.
  - On the card page, scan the QR with a phone camera. The decoded link is exactly the shown card link. Opening it is not yet the public page; that is M7 and expected.
  - Download the QR.
- [ ] **K — Account.**
  - Remove Google if it is linked; the note is shown, and an email-code sign-in still works.
  - Change the sign-in email to a second controlled address with the code. The new address signs in and the old one no longer reaches this Account.
  - "Sign out everywhere" in one browser; a second signed-in browser is signed out on its next navigation.
  - The "Delete your account" text appears.
- [ ] **L — Isolation and leakage.**
  - As Account B, opening Account A's `/app/profiles/<id>`, `/app/inbox/<id>` and `/app/cards/<id>` URLs gives 404.
  - Page source and network show no `CLOUDINARY_API_SECRET` value. The upload request to `api.cloudinary.com` carries a `signature` and no secret.
  - `curl -s -o /dev/null -w "%{http_code}" -X POST -H "Origin: https://evil.example" -H "content-type: application/json" -d "{}" http://localhost:3000/api/forms/<any-uuid>/submissions` prints `403`.
  - `/app` responses are not publicly cacheable (`curl -sI` shows no `public` in `Cache-Control`).
- [ ] **M — 390px layout.** No horizontal scroll on any M6 screen. Every control is at least 44px; measure as in M5 Task 10I. Every input has a visible label.
- [ ] **N — Vocabulary.** No screen shows token, HMAC, OAuth, API, webhook, JSON, credential, transaction, challenge, record or resolver, and no internal id appears in visible text.
- [ ] **Ledger:** record results with `Commit: none (verification only)`. Fix any failure in the owning task's files with a failing test first, commit it as `fix(<area>): <defect>`, re-run that task's verification and this item, and record both.

## Task 27: M6 software gate

- [ ] **Step 1: Fresh verification.** Record every result in the ledger.
```bash
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm db:check
corepack pnpm db:generate && git diff --exit-code drizzle            # only 0010 exists; no drift
corepack pnpm build
corepack pnpm check:bundle                                            # includes CLOUDINARY_API_SECRET
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test corepack pnpm check:db-concurrency
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test corepack pnpm check:provisioning-concurrency
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test corepack pnpm check:claim-concurrency
DATABASE_URL_TEST=postgres://postgres@127.0.0.1:55432/neffi_m2_test corepack pnpm check:profile-concurrency
git ls-files "src/app/c" "src/app/(public)/c"                         # expect no output: no M7 route
git grep -nE "revalidateTag|unstable_cache|\"use cache\"" -- src     # expect no output: no public caching in M6
git grep -n "profileLinks" -- src ":!src/db"                           # expect no output: legacy table unused
git grep -nE "console\.(log|info|debug|warn)" -- src/modules src/app src/integrations   # expect no output
git diff --name-only main..HEAD -- drizzle                             # expect only drizzle/0010_*.sql, drizzle/meta/0010_snapshot.json, drizzle/meta/_journal.json
```
- [ ] **Step 2: Whole-branch review.** Use superpowers:requesting-code-review, or an independent reviewer, against this plan. Required checks:
  - §3 exclusions respected (no M7/M8/M9/post-V1 work);
  - D1–D20 implemented as written;
  - every customer read filters by `account_id`, and every mutation locks the owned row first, in the D20 lock order;
  - no customer-supplied JSON;
  - only `https:` links stored;
  - no secret in a client file;
  - the touch-target guard covers every `/app` file;
  - no clock reads during render;
  - M5 activation behaviour unchanged apart from the shared `clientIp` and `inputClass` imports.

  Fix findings test-first and re-run Step 1.
- [ ] **Step 3: Ledger.** Record the status **"M6 software gate passed"**, or the failing items. M6 has no hardware gate of its own; the M4/M5 physical acceptance stays pending. Also record:
  - the Rulings;
  - the known limitations: public rendering, the vCard download and public caching are M7; account deletion is M9; notification has no automatic retry; orphaned Cloudinary uploads are not swept; Vercel Preview needs the Cloudinary env vars.
- [ ] **Step 4: Stop.** Stop the disposable cluster only if no further work needs it. Do not push, open a PR or update Notion without explicit user approval.

---

## 8. M7 handoff and explicit non-M6 work

M7 builds on, without redesigning:
- **Resolution:** `profiles.default_scene_id` / `active_scene_id`, resolved as `coalesce(active, default)`.
- **Rendering:** `buildSceneView`, `SceneViewPreview`'s presentational markup (M7 adds an interactive form and the vCard action) and the `POST /api/forms/[formId]/submissions` contract (`{ key: uuid, answers: Record<string,string>, website?: honeypot }`, same-origin).
- **Cache invalidation:** every Profile, Scene, Block and Form mutation is one of the exported functions in `src/modules/profiles/{profiles,scenes,blocks}.ts` and `src/modules/forms/forms.ts`. Those functions are the only points where M7 must add public-DTO cache invalidation.

**Not done in M6:**
- **M7:** the `/c/{token}` resolver and its states (Unclaimed, Disabled, no profile, Draft, Unpublished, Published); the public DTO cache; the vCard; the owner Edit/Switch affordance on the public page; public `noindex`; real NFC tap tests against Published/Draft/Disabled.
- **M8/M9/M10:** see §3.

## 9. Known debt (deliberate, with owners)

| Item | Ceiling | Upgrade path / owner |
|---|---|---|
| `profile_links` kept and unused after the 0010 backfill | One dead table | Drop in a reviewed migration in M10 once rollback to pre-M6 is no longer needed |
| Orphaned Cloudinary uploads (started, never confirmed) | Storage only; never shown | Periodic sweep of the `neffi/profiles/*` prefix against `profiles.image_asset_id` (M10) |
| One notification attempt, no retry | A failed email is not resent; the message is still in the Inbox | Add a retry from `notified_at IS NULL` rows if delivery problems show up (M9/M10) |
| Home and Cards summaries capped at 50 | Accounts with more than 50 cards | Keyset pagination on the Cards page when needed |
| Single theme (`profiles.theme = 'default'`) | No theme choice | Add a theme picker when a second maintained theme exists (Public Profile Templates) |

## 10. Self-review record (planner, 2026-10-11)

- **Locked M6 scope → tasks:**

  | Scope item | Tasks |
  |---|---|
  | Onboarding | 6, 7, 9, 10 |
  | Identity | 4, 8, 13 |
  | Starter Experiences | 6, 7 |
  | Scenes | 2, 11, 13, 14 |
  | Ordered Blocks | 2, 4, 12, 14 |
  | Appearance | 8, 15, 16 |
  | Forms | 5, 12, 17 |
  | Submissions | 18 |
  | Inbox | 20 |
  | Notification | 19 |
  | Sharing QR | 21 |
  | Cards | 7, 21 |
  | Account | 22 |
  | Media | 15, 16 |
  | Migrations | 2, 3 |
  | Navigation and Home | 23 |
  | Concurrency | 24 |
  | Acceptance | 26 |
  | Gate | 27 |

  Every item in Step 8's "M6 Done when" list is covered by Task 26 A–N.
- **Locked rules honoured:**
  - no Card→Scene link;
  - Theme at Profile level, with no per-Scene theme;
  - Starter not persisted;
  - submission persisted before email;
  - no API keys, webhooks, OAuth integrations or customer JSON;
  - GitHub and booking are simple https links;
  - `/c/{token}` untouched;
  - M5 claim, challenge and eligibility untouched;
  - Google linking stays deliberate;
  - account deletion deferred (decision 1).
- **Type consistency:** the §5 names are used verbatim in Tasks 7–23. `SubmitResult.created.replyTo` and `notifySubmission`'s `replyTo` match. `ProfileError` codes match the §6 copy table.
- **Placeholders:** none. Bracketed values are runtime inputs: the generated migration file name, the scratch directory, controlled email addresses and UUIDs.
- **Unresolved software issues:** none. External prerequisites the user owns:
  - Cloudinary dev credentials in `.env.local` (Task 15);
  - the same variables in Vercel Preview before the PR;
  - a real inbox and Google account for Task 26.

