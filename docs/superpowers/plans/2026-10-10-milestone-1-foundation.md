# TapCard Milestone 1 — Foundation Implementation Plan
> **Historical implementation plan — implemented and merged. This is not the current specification.** Current behavior is in [PRODUCT.md](../../../PRODUCT.md) and [docs/README.md](../../README.md). Where this plan disagrees with them, they win.

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to carry out this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.
> On approval, Task 0 copies this file to `docs/superpowers/plans/2026-10-10-milestone-1-foundation.md` inside the feature worktree. Plan mode only allows writing here, so that copy happens in Task 0.

**Goal:** Set up a secure, boring Next.js 16 modular-monolith foundation for TapCard. It must clone, install, lint, typecheck, test, build, connect to and migrate a development Neon database, and deploy to a Vercel Preview, all with non-production credentials only.

**Architecture:** One Next.js 16 App Router app (TypeScript, pnpm) with route groups for the public, customer, and admin surfaces. Server-only modules for config (`src/config`), database (`src/db`), and auth (`src/auth`). Drizzle ORM runs on the plain `pg` driver against Neon, so Neon stays replaceable and transactions are supported. Better Auth is an unconfigured-provider shell. Sentry is errors-only with PII scrubbing. Zod validates env and enforces environment isolation, and fails closed.

**Tech stack:** Next.js 16, React 19, TypeScript, pnpm 11, Tailwind CSS v4, shadcn/ui, Zod 4, Drizzle ORM + Drizzle Kit, `pg`, Neon (dev project only), Better Auth, `@sentry/nextjs`, Vitest, ESLint (flat config via `eslint-config-next`), GitHub Actions, Vercel.

**Spec:** Notion (locked). Precedence: `TapCard — Locked Plan` → `Step 7 — Technical Architecture` → `Step 8 — Implementation Plan` (Milestone 1 + Dependency/Verification Matrix) → `Step 9 — Build & Physical Pilot` (Milestone 1 deliverables, security requirements, verification, DoD). `AI Build Handoff — Read First` covers resume rules.

---

## 1. Findings (read-only inspection, 2026-10-10)

**Repository**
- Root: `C:\Users\iannm\orca\projects\tapcard`. It is a git repo on branch `master` with one empty commit (`2aebd5d Initial commit`, no files). The working tree is clean.
- There are no remotes, no `package.json`, no `CLAUDE.md`, no `AGENTS.md`, and no project-level skills or MCP config. **No existing codebase.** Bootstrap is part of this plan (Task 1).
- GitHub (`iyawnnn`, authenticated via `gh`, `repo` and `workflow` scopes): no repo whose name matches `tap*`.
- Neon (MCP connected, write mode): **no TapCard project exists.**
- Vercel (MCP connected, team `iyawnnns-projects`): **no TapCard project exists.** The Vercel CLI is **not installed** locally, so Preview deploys go through the Vercel Git integration.
- Toolchain: Node `v24.16.0`, pnpm `11.9.0`, corepack `0.35.0`, gh `2.97.0`. Windows 11 with PowerShell and Git Bash.

**Notion pages read (all 11 succeeded):** AI Build Handoff — Read First; TapCard — Locked Plan; Step 1 — Product Catalog; Step 2 — Product Definitions; Step 3 — Order & Fulfillment Workflow; Step 4 — System Objects & Relationships; Step 5 — Admin Pages & Capabilities; Step 6 — Data Model & Integrity Rules; Step 7 — Technical Architecture; Step 8 — Implementation Plan; Step 9 — Build & Physical Pilot.
- Confirmed stale passages, ignored per your audit notes:
  - Step 1 still lists Standard/Custom packages and Quick Demo. Step 3 supersedes it: one DBC definition, and Quick Demo is removed.
  - Step 3's customer setup flow shows "Sign in → Enter activation code". The Locked Plan, Step 2 (activation flow), and the Handoff all say code-first. Neither stale passage affects Foundation.
- Organizational note, not a blocker: Steps 6, 7, and 8 sit under `TapCard — Business Hub / Previous notes & research / Engineering` in Notion. The Handoff and Locked Plan cite them explicitly as locked sources, so this plan treats them as authoritative. Consider moving them out of "Previous notes & research" later so a future agent doesn't discount them.

**Ponytail:** installed as plugin `ponytail@4.8.4` (`~/.claude/plugins/cache/ponytail`). It is **active at level "full"** through a SessionStart hook, and its instructions were read (the injected SKILL.md content). It contributes YAGNI, the stdlib-first ladder, fewest files, and `ponytail:` comments for deliberate shortcuts. It explicitly never simplifies away validation at trust boundaries, security, or explicitly requested work, so it does not conflict with the locked spec. The spec always wins. Optional later use: `ponytail-review` as an over-engineering pass during final review.

**Superpowers skills used for execution:** `using-git-worktrees` (Task 0), `test-driven-development` (Tasks 2, 3, 5), `subagent-driven-development` or `executing-plans`, `systematic-debugging` (any failure), `requesting-code-review` / `receiving-code-review` (security-relevant tasks + whole branch), `verification-before-completion` (Task 9), `finishing-a-development-branch` (after the report, no merge/push without approval).

---

## 2. Scope

**In scope (Step 9 Milestone 1 deliverables):**
- Next.js 16 App Router + TS + pnpm
- Tailwind + shadcn baseline
- Route groups for public, customer, and admin
- Module boundary map
- Zod env/config validation
- Drizzle + Drizzle Kit against a **development Neon project**
- Proven migration workflow
- Better Auth server-side shell
- `server-only` boundaries
- Conservative Sentry setup
- lint/typecheck/test/build scripts
- GitHub CI
- `.env.example`
- Dev/Preview/Production isolation
- Vercel Preview deploy with a health route

**Non-goals (deferred, do not build):**
- Step 6 domain tables and seed data, **including the persistent Account/Auth schema Better Auth needs, and wiring Better Auth's Drizzle adapter to it** (M2 Database Implementation)
- Google/email OTP, sessions as product behavior, identity-linking rules, OWNER and ownership authorization, auth abuse controls, all built on the M2 schema (M3)
- Card tokens and activation credentials (M4)
- `/activate` logic (M5)
- Customer dashboard, Profiles, Cloudinary/MediaService (M6)
- `/c/{token}` resolver and Profile caching (M7)
- Orders, Inventory, Payments, Expenses (M8)
- Support, Resend/EmailService (M9)
- CSP/security headers, Turnstile, rate-limit tuning, MFA, Sentry source-map upload, production Neon project (M10/M12)
- Redis, queues, GraphQL, a separate API, microservices
- No `src/integrations/*` directories: no integration exists yet, and each one gets its home in M6/M9.

---

## 3. File structure (created by this plan)

```
.github/workflows/ci.yml            CI: frozen install, lint, typecheck, test, build, bundle secret scan
.env.example                        names + categories only, no values
.gitignore                          scaffold + .env*.local, .worktrees/
.nvmrc                              24
README.md                           setup / env / DB / migration / deploy runbook
package.json                        scripts, packageManager, engines
drizzle.config.ts                   loads .env.local (stdlib), migration env + isolation guard
drizzle/                            reviewed migrations (baseline only)
eslint.config.mjs, tsconfig.json, postcss.config.mjs, next.config.ts, components.json
vitest.config.ts                    node env, '@' alias, 'server-only' → empty stub
instrumentation.ts                  Sentry server/edge init + onRequestError
instrumentation-client.ts           Sentry browser init
scripts/check-client-bundle.mjs     fails if any server secret value appears in .next/static
src/
  app/
    layout.tsx, globals.css
    (public)/page.tsx               minimal landing (uses shadcn Button)
    (customer)/app/layout.tsx, page.tsx   /app placeholder, noindex, dynamic
    admin/layout.tsx, page.tsx      /admin placeholder, noindex, dynamic
    api/health/route.ts             GET → {status, db} with no-store, 503 on DB failure, no detail
    api/auth/[...all]/route.ts      Better Auth handler mount
  auth/server.ts                    server-only Better Auth instance (no providers)
  components/ui/button.tsx          shadcn
  config/
    isolation.ts                    AppEnv, resolveAppEnv, assertDatabaseIsolation, PRODUCTION_DATABASE_HOSTS
    env-schema.ts                   parseServerEnv, parseMigrationEnv (pure, testable)
    env.ts                          server-only: export const env = parseServerEnv(process.env)
    *.test.ts
  db/
    index.ts                        server-only: pg Pool + drizzle instance `db`
    schema.ts                       empty until M2
  lib/
    utils.ts                        shadcn cn()
    sentry-scrub.ts (+ .test.ts)    pure event scrubber shared by server and client
  modules/README.md                 module boundary map + rules (dirs appear with real code)
  server-only-boundary.test.ts      asserts server modules import 'server-only' first
```

The modules decision: `src/modules/README.md` maps the domains: accounts (incl. auth identities), cards, activation, profiles, orders, payments, inventory, support, expenses, notifications, and activity. For each domain it states the rules: UI and server actions call domain services; services own rules and persistence; only `src/db` touches the driver; DTOs, not rows, reach Client Components; DBC and GRC stay separate; Purchaser and Account stay separate. No empty folders are created (Step 9: "Do not create empty abstraction layers").

---

## 4. Dependencies

| Package | Why |
|---|---|
| `next@16`, `react`, `react-dom` | locked framework (scaffold) |
| `typescript`, `@types/node`, `@types/react*` | TS (scaffold) |
| `tailwindcss@4`, `@tailwindcss/postcss` | locked styling (scaffold) |
| `eslint`, `eslint-config-next` | lint. Next 16 removed `next lint`, so the ESLint CLI runs directly |
| shadcn init deps (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`) | locked UI kit baseline, whatever `shadcn init` installs |
| `zod@4` | locked validation |
| `drizzle-orm`, `drizzle-kit` | locked ORM and migrations |
| `pg`, `@types/pg` | plain PostgreSQL driver: interactive transactions (required for M5 claim) and provider-agnostic. Uses Neon's pooled URL at runtime |
| `better-auth` | locked auth (shell only) |
| `@sentry/nextjs` | locked monitoring |
| `server-only` | build-time guard against Client Component imports |
| `vitest` | test runner (none exists; small, fast, native TS/ESM) |

**Not added:**
- `@t3-oss/env-nextjs`: Zod plus 30 lines covers it.
- `dotenv`: Node 24 provides `process.loadEnvFile`.
- `@neondatabase/serverless`: `pg` already covers it and keeps Neon replaceable.
- Testing Library and Playwright: no UI behavior exists yet, so E2E starts when real flows exist.
- `@vercel/functions` `attachDatabasePool`: marked `ponytail:` in `src/db/index.ts`, to be added if idle-connection issues show up on Fluid compute.

Versions: pin whatever is current and stable at install. The lockfile is committed. If Drizzle Kit's current stable release uses the folder-per-migration layout (v1), follow it; the workflow is the same.

---

## 5. Environment and isolation strategy

**Variable categories (names only, never values):**
- *Server runtime (required):* `DATABASE_URL` (Neon **pooled** URL), `BETTER_AUTH_SECRET` (≥32 chars).
- *Server runtime (conditional):* `BETTER_AUTH_URL`. Required in development and production. In Preview it may be omitted and is derived from the platform-provided `VERCEL_BRANCH_URL`.
- *Migration-only:* `DATABASE_URL_UNPOOLED` (Neon direct URL; used only by `drizzle.config.ts`, never by the app).
- *Public (not secret):* `NEXT_PUBLIC_SENTRY_DSN` (optional; Sentry is disabled when absent).
- *Platform-provided:* `VERCEL_ENV`, `VERCEL_BRANCH_URL`, `NEXT_PUBLIC_VERCEL_ENV`.
- *Deliberately absent until their milestone:* Google OAuth, Resend, Cloudinary, Turnstile, activation HMAC key, `SENTRY_AUTH_TOKEN`.

**Isolation mechanism (three layers):**
1. **Separate Neon projects.** M1 creates only `tapcard-dev`. A production Neon project does not exist until the pilot gate, so production data cannot leak in M1.
2. **Vercel env scoping.** Development and Preview scopes get `tapcard-dev` values. **The Production scope gets nothing in M1.**
3. **Code guard (`src/config/isolation.ts`, TDD).** `appEnv = VERCEL_ENV ?? "development"`. A committed constant `PRODUCTION_DATABASE_HOSTS` holds Neon endpoint hostnames. Hostnames are not secrets; this list stays empty until the production project exists. The guard compares hostnames normalized by stripping `-pooler`, then:
   - non-production `appEnv` connecting to a listed host → throws;
   - `production` connecting to an **unlisted** host → throws.

   With the list empty, any production runtime or build fails closed, so an accidental production deploy cannot boot. The same guard runs in `drizzle.config.ts`, so migrations get identical protection.

Error messages name the failing variable or rule and **never echo values** (tested).

---

## 6. Key boundary decisions

**A. Migration proof without stealing M2.** `src/db/schema.ts` stays empty. Steps:
1. `pnpm db:generate` → expect "No schema changes" (proves config and schema wiring).
2. `pnpm db:generate --custom --name=foundation_baseline` → empty SQL file. Its body is a no-op `SELECT 1;` with a header comment: "Foundation baseline: proves the reviewed migration workflow; no domain objects (Milestone 2 owns schema)."
3. Review the file and commit it.
4. `pnpm db:migrate` → applied.
5. Rerun → no-op.
6. Evidence: a read-only query of `drizzle.__drizzle_migrations` shows exactly 1 row.

This is the smallest valid proof: Drizzle Kit officially supports `--custom`. It creates no TapCard tables, and the file stays harmlessly in permanent history. **No conflict with M2, so no stop is needed.** If the no-op fails under the installed drizzle-kit, switch to systematic-debugging. Do not add tables.

**B. Better Auth shell without stealing M2/M3.** `src/auth/server.ts` contains:

```ts
betterAuth({
  secret,
  baseURL,
  trustedOrigins: [baseURL],
  emailAndPassword: { enabled: false },
})
```

There is **no `database` option and no Drizzle adapter**, because those would assume Better Auth tables that intentionally don't exist yet. The shell does not import `@/db`. There are no social providers, no plugins, no tables or migrations, and no UI, session reads, or authorization helpers. The normal Next.js handler is mounted at `/api/auth/[...all]`, and `GET /api/auth/ok → {"ok":true}` proves the wiring.

Ownership: **M2** creates the persistent Account/Auth schema (including what Better Auth requires) and wires the adapter to it. **M3** implements Google, email OTP, sessions, identity linking, OWNER and ownership authorization, and abuse controls on top of that schema. *Risk:* if this Better Auth version refuses to initialize without `database`, stop and report the exact error. Do not add persistence or tables.

**C. Server-only boundary.** The sensitive runtime entrypoints `src/config/env.ts`, `src/db/index.ts`, and `src/auth/server.ts` each start with `import "server-only"`. A Client Component importing any of them then fails `next build`. Pure schema, type, and config files (`src/db/schema.ts`, `src/config/env-schema.ts`, `src/config/isolation.ts`) hold no runtime secrets and must stay importable by Drizzle Kit and other Node tooling, so they are deliberately **not** marked. Three checks back this up:
1. A Vitest test asserts the import is present in exactly those three entrypoints. It uses an explicit list, not a recursive walk.
2. A one-time negative build check during verification: a temporary `"use client"` file imports `@/db`, `pnpm build` must fail, then the file is removed.
3. `scripts/check-client-bundle.mjs` scans `.next/static` for the actual values of `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `BETTER_AUTH_SECRET`. It runs in CI with distinctive dummy values and locally with real dev values.

`drizzle.config.ts` imports only the pure `env-schema.ts`, because `server-only` would throw outside Next.

**D. Sentry privacy baseline.** `@sentry/nextjs` uses manual minimal files, not the wizard:
- `enabled: !!dsn`, `sendDefaultPii: false`, `tracesSampleRate: 0` (errors only), no Replay, no logs, `environment: appEnv`.
- `beforeSend: scrubEvent` deletes `request.cookies`, `request.data`, and `request.query_string`; strips `cookie`, `authorization`, and `set-cookie` headers; deletes `user.ip_address` and `user.email`.
- `beforeBreadcrumb` drops `fetch`/`xhr` breadcrumb `data.url` query strings.
- `withSentryConfig` without an auth token, so there is no source-map upload (M10).

**E. Driver and runtime.** `src/db/index.ts` uses a `pg.Pool` with the pooled `DATABASE_URL`, `drizzle({ client: pool })`, and Node runtime (default). The pool connects lazily, so builds never touch the DB.

**F. Routes.** `(public)/page.tsx` is static. `(customer)/app` and `admin` are placeholder pages with `robots: { index: false }` and `dynamic = "force-dynamic"`, and they render no data. They are **not** protected yet: M3 owns that, and they expose nothing. `/api/health` runs `select 1` through `db` and returns `{status:"ok", db:"ok"}` or a 503 `{status:"degraded"}` with no error detail, plus `Cache-Control: no-store`. No CORS headers anywhere.

---

## 7. Manual and external setup you need to do

Credentials never pass through chat.

1. **M-1 (before Task 5): Neon.** Create project `tapcard-dev` (Free, a region near PH, e.g. AWS ap-southeast-1). From its default branch, copy the **pooled** and **direct** connection strings into `.env.local` as `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32` (Git Bash). Set `BETTER_AUTH_URL=http://localhost:3000`. *(Alternative: I create the project through the Neon MCP with your explicit go-ahead. The connection string would then show up in tool output inside my session, so the manual route is recommended.)*
2. **M-2 (optional): Sentry.** Create a free Sentry project (Next.js) and put the DSN in `.env.local` and in Vercel Preview/Development. If skipped, Sentry stays disabled and this is recorded as a limitation; the DoD does not require it to be live.
3. **M-3 (Task 8, needs approval): GitHub + Vercel.** I create a **private** GitHub repo `tapcard` with `gh`, push the default branch first, then the feature branch. *(Pushing the feature branch first would make it the default and production branch.)* You then import the repo in the Vercel dashboard (Hobby, Node 24.x) and set env vars:
   - Preview + Development: the `tapcard-dev` values. `BETTER_AUTH_URL` can be omitted in Preview.
   - **Production: none.**
   - Enable "Automatically expose System Environment Variables".

   The initial production build of the empty default branch will fail; that is expected and harmless.

**Decided:** rename `master` → `main` before the first push. You create `tapcard-dev` manually and fill `.env.local` (M-1).

---

## 8. Review focus (failure modes the spec implies but nobody would naturally test)

1. Neon pooled (`ep-x-pooler…`) vs direct (`ep-x…`) hostnames for the same production endpoint: the isolation guard must treat them as the same host. Test in Task 2.
2. Env validation errors must name the variable without echoing the secret value, even when Zod rejects the value. Test in Task 2.
3. A Preview deployment with no `BETTER_AUTH_URL` derives the URL from `VERCEL_BRANCH_URL`. With neither present, it fails clearly. Test in Task 2.
4. A Sentry event carrying cookies, an Authorization header, a request body, or a query string (a future `/activate` POST) arrives scrubbed. Test in Task 3.
5. The production runtime with an empty production-host list must fail closed: no accidental production boot in M1. Test in Task 2, plus the build check in Task 9.

---

## 9. Tasks

Each task ends green on `pnpm lint && pnpm typecheck && pnpm test` (once those exist) and gets **one commit**. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Execution mode (approved): proportional hybrid.**
- The coordinator implements.
- No separate reviewer for trivial generated or scaffold-only work (Tasks 0, 1, 4).
- An independent `code-reviewer` subagent pass for Task 2 (env/isolation), Task 3 (Sentry privacy), Task 5 (Drizzle/migrations), Task 6 (Better Auth shell), Task 7 (CI/secret scan), and the final whole-branch review in Task 9.
- Systematic debugging for any failure; verification-before-completion at the end.
- A reviewer's "pass" is never evidence. The coordinator re-runs the commands.

**Approval gates:** GitHub repo creation, any push, Vercel import, merge, and Production deploy each need explicit approval when reached. Do not start Milestone 2 after Foundation.

### Task 0: Worktree and plan copy
- [ ] Rename `master` → `main` (`git branch -m master main`). Approved.
- [ ] Use `superpowers:using-git-worktrees`: create the worktree `.worktrees/m1-foundation` on branch `feat/m1-foundation` from `main`. The `.worktrees/` ignore rule goes in Task 1's `.gitignore`. Until then, use `.git/info/exclude` so nothing gets committed.
- [ ] Copy this plan to `docs/superpowers/plans/2026-10-10-milestone-1-foundation.md`. Commit `docs: add Milestone 1 Foundation plan`.

### Task 1: Scaffold Next.js 16 with pnpm (generated code, so no TDD)
**Files:** scaffold output, `package.json`, `.gitignore`, `.nvmrc`
- [ ] In the worktree, run `pnpm create next-app@16 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --disable-git`. Answer *no* to React Compiler. If it refuses the non-empty dir because of `docs/`, scaffold into a temp dir and move the files in.
- [ ] `package.json`:
  - `"packageManager": "pnpm@11.9.0"`, `"engines": { "node": ">=24" }`.
  - Scripts: `dev: next dev`, `build: next build`, `start: next start`, `lint: eslint .`, `typecheck: next typegen && tsc --noEmit`.
- [ ] `.nvmrc` → `24`. `.gitignore`: make sure it covers `.env*` except `!.env.example`, plus `.worktrees/`.
- [ ] Move `src/app/page.tsx` to `src/app/(public)/page.tsx` and replace the boilerplate with a minimal TapCard placeholder.
- [ ] Verify: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all exit 0. `pnpm dev` serves `/` with 200.
- [ ] Commit `chore: scaffold Next.js 16 app with pnpm`.

### Task 2: Vitest, env schema, and isolation guard (TDD)
**Files:** `vitest.config.ts`, `src/config/isolation.ts`, `src/config/env-schema.ts`, `src/config/env.ts`, tests beside each, `package.json` (`test: vitest run`, devDep `vitest`, deps `zod`, `server-only`)
**Interfaces produced:**
```ts
export type AppEnv = "development" | "preview" | "production";
export const PRODUCTION_DATABASE_HOSTS: readonly string[]; // [] in M1
export function resolveAppEnv(vercelEnv: string | undefined): AppEnv;
export function assertDatabaseIsolation(appEnv: AppEnv, databaseUrl: string, productionHosts?: readonly string[]): void;
export type ServerEnv = { appEnv: AppEnv; databaseUrl: string; betterAuthSecret: string; authBaseUrl: string; sentryDsn?: string };
export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv;
export function parseMigrationEnv(raw: Record<string, string | undefined>): { appEnv: AppEnv; migrationDatabaseUrl: string };
export const env: ServerEnv; // src/config/env.ts, server-only
```
- [ ] `vitest.config.ts`: `environment: "node"`, alias `@` → `src`, alias `server-only` → `node_modules/server-only/empty.js`.
- [ ] **RED:** write `isolation.test.ts`:
```ts
const PROD = ["ep-prod-123.ap-southeast-1.aws.neon.tech"];
const url = (h: string) => `postgresql://u:p@${h}/db?sslmode=require`;
test("unknown VERCEL_ENV and undefined map safely", () => {
  expect(resolveAppEnv(undefined)).toBe("development");
  expect(resolveAppEnv("preview")).toBe("preview");
  expect(() => resolveAppEnv("staging")).toThrow(/VERCEL_ENV/);
});
test("preview may not use a production host, pooled or direct", () => {
  expect(() => assertDatabaseIsolation("preview", url(PROD[0]), PROD)).toThrow(/production database/);
  expect(() => assertDatabaseIsolation("development", url("ep-prod-123-pooler.ap-southeast-1.aws.neon.tech"), PROD)).toThrow();
});
test("production must use a listed production host; empty list fails closed", () => {
  expect(() => assertDatabaseIsolation("production", url("ep-dev-9.aws.neon.tech"), PROD)).toThrow();
  expect(() => assertDatabaseIsolation("production", url(PROD[0]), [])).toThrow();
  expect(() => assertDatabaseIsolation("production", url(PROD[0]), PROD)).not.toThrow();
});
test("development with a dev host passes; malformed URL fails", () => {
  expect(() => assertDatabaseIsolation("development", url("ep-dev-9.aws.neon.tech"), PROD)).not.toThrow();
  expect(() => assertDatabaseIsolation("development", "not a url", PROD)).toThrow(/DATABASE_URL/);
});
```
- [ ] Run `pnpm test`. It should fail because the module doesn't exist yet.
- [ ] **GREEN:** implement `isolation.ts`:
  - `normalize = host.toLowerCase().replace(/-pooler(?=\.)/, "")`
  - `new URL()` for parsing; on failure, throw `"DATABASE_URL is not a valid URL"` with no value echoed.
  - Only `"preview"`, `"production"`, `"development"`, and `undefined` are accepted.
- [ ] **RED:** write `env-schema.test.ts`. Use a `base` raw env with valid dev values and secret `"s".repeat(40)`. Cover:
  - `parseServerEnv(base)` returns `appEnv:"development"` and `authBaseUrl:"http://localhost:3000"`.
  - Missing `DATABASE_URL` throws a message containing `DATABASE_URL`.
  - A 10-char `BETTER_AUTH_SECRET` of value `"leakyvalue"` throws a message containing `BETTER_AUTH_SECRET` and **not** `leakyvalue`.
  - An invalid `DATABASE_URL` of `"postgres-secret-xyz"` produces a message without `postgres-secret-xyz`.
  - Preview with no `BETTER_AUTH_URL` but `VERCEL_BRANCH_URL="tapcard-git-x.vercel.app"` gives `authBaseUrl:"https://tapcard-git-x.vercel.app"`. Preview with neither throws, mentioning `BETTER_AUTH_URL`.
  - Development without `BETTER_AUTH_URL` throws.
  - `VERCEL_ENV:"production"` with the M1 empty list throws.
  - `parseMigrationEnv` requires `DATABASE_URL_UNPOOLED` and applies isolation to it.
- [ ] Run; it should fail.
- [ ] **GREEN:** implement `env-schema.ts` with a Zod object (`z.url()` for URLs, `z.string().min(32)` for the secret, optional DSN). Build the error from `issues.map(i => i.path.join(".") + ": " + i.message)` only, and set custom messages so Zod never includes input. Call `resolveAppEnv` and `assertDatabaseIsolation`. Then `env.ts`: `import "server-only"; export const env = parseServerEnv(process.env);`.
- [ ] Run `pnpm test`; it should pass. Then refactor while green, and run lint and typecheck.
- [ ] Commit `feat(config): validated server env with environment-isolation guard`.

### Task 3: Sentry privacy baseline (TDD for the scrubber)
**Files:** `src/lib/sentry-scrub.ts` + test, `instrumentation.ts`, `instrumentation-client.ts`, `next.config.ts`, dep `@sentry/nextjs`
**Produces:** `export function scrubEvent<E extends Event>(event: E): E` and `export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb` (types from `@sentry/nextjs`).
- [ ] **RED:** test that an event with `request: { cookies:{a:"1"}, data:"activation=ABC", query_string:"code=ABC", headers:{ cookie:"x", authorization:"Bearer t", "user-agent":"ua" } }, user:{ id:"1", email:"e@x", ip_address:"1.2.3.4" }, message:"boom"` comes back with:
  - no cookies, data, or query_string;
  - headers equal to `{ "user-agent": "ua" }`;
  - user equal to `{ id: "1" }`;
  - the message kept.

  Also test that a breadcrumb `{category:"fetch", data:{url:"/api/x?code=ABC"}}` comes back with url `/api/x`. Then run and confirm it fails.
- [ ] **GREEN:** implement both functions in about 20 lines. Run and confirm the tests pass.
- [ ] Wire Sentry:
  - `instrumentation.ts`: `register()` initializes Sentry for `nodejs` and `edge` with `{ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, enabled: !!dsn, environment: process.env.VERCEL_ENV ?? "development", sendDefaultPii: false, tracesSampleRate: 0, beforeSend: scrubEvent, beforeBreadcrumb: scrubBreadcrumb }`. Export `onRequestError = Sentry.captureRequestError`.
  - `instrumentation-client.ts`: the same options with `NEXT_PUBLIC_VERCEL_ENV`.
  - `next.config.ts`: `export default withSentryConfig(nextConfig, { silent: true, telemetry: false })` with no auth token.
  - Instrumentation deliberately does **not** import `src/config/env.ts`, so Sentry init can't crash on unrelated env errors.
- [ ] Verify lint, typecheck, test, and build all pass. With a DSN set (M-2), trigger one test error in dev and confirm in the Sentry UI that it shows no cookies or IP. Otherwise record it as skipped.
- [ ] Commit `feat(observability): Sentry errors-only baseline with PII scrubbing`.

### Task 4: shadcn baseline, route groups, and module map (static, verified by build)
**Files:** `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, `src/app/globals.css`, `src/app/(public)/page.tsx`, `src/app/(customer)/app/{layout,page}.tsx`, `src/app/admin/{layout,page}.tsx`, `src/modules/README.md`
- [ ] Run `pnpm dlx shadcn@latest init` (defaults, neutral base) and `pnpm dlx shadcn@latest add button`. Use the Button on the public page.
- [ ] Customer and admin layouts: `export const metadata = { robots: { index: false, follow: false } }` and `export const dynamic = "force-dynamic"`. The pages render a heading only.
- [ ] Write `src/modules/README.md` as described in §3.
- [ ] Verify: build passes, and in `pnpm dev`, `/`, `/app`, and `/admin` return 200. `/app` and `/admin` HTML contains `noindex`.
- [ ] Commit `feat(app): shadcn baseline, surface route groups, module boundary map`.

### Task 5: Drizzle, development Neon, and baseline migration (needs M-1)
**Files:** `drizzle.config.ts`, `src/db/index.ts`, `src/db/schema.ts`, `drizzle/*`, `src/server-only-boundary.test.ts`, `package.json` scripts and deps (`drizzle-orm`, `pg`, `drizzle-kit`, `@types/pg`)
**Produces:** `export const db` from `@/db`, typed as a node-postgres Drizzle database.
- [ ] **RED:** `server-only-boundary.test.ts` uses `test.each` over the explicit list `["src/config/env.ts", "src/db/index.ts"]` (`src/auth/server.ts` is added in Task 6). It asserts that each file's first import statement is `import "server-only"`. Create `src/db/index.ts` *without* the import first and confirm the test fails.
- [ ] **GREEN:** `src/db/index.ts`:
```ts
import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/config/env";
// ponytail: plain Pool; add @vercel/functions attachDatabasePool if idle connections pile up on Fluid compute
export const db = drizzle({ client: new Pool({ connectionString: env.databaseUrl }) });
```
  `src/db/schema.ts` gets a one-line comment saying domain tables arrive in Milestone 2, plus `export {}`. It has no `server-only` import, because Drizzle Kit imports it. Run the test and confirm it passes.
- [ ] `drizzle.config.ts`:
  - `if (existsSync(".env.local")) process.loadEnvFile(".env.local")`
  - `const { migrationDatabaseUrl } = parseMigrationEnv(process.env)`
  - `defineConfig({ dialect: "postgresql", schema: "./src/db/schema.ts", out: "./drizzle", dbCredentials: { url: migrationDatabaseUrl }, strict: true, verbose: true })`
- [ ] Scripts: `db:generate: drizzle-kit generate`, `db:migrate: drizzle-kit migrate`, `db:check: drizzle-kit check`. **No `db:push` script** (Step 7: no automatic destructive push).
- [ ] Migration proof, following §6A:
  - `pnpm db:generate` should report no changes.
  - `pnpm db:generate --custom --name=foundation_baseline`, then write the no-op body and header, and review the diff.
  - `pnpm db:migrate` should succeed. A second `pnpm db:migrate` should be a no-op.
  - Read-only Neon MCP `run_sql` `select id, hash, created_at from drizzle.__drizzle_migrations` on `tapcard-dev` should return 1 row.
  - `pnpm db:check` should pass.
- [ ] Commit `feat(db): Drizzle + pg against development Neon with reviewed baseline migration`.

### Task 6: Better Auth shell and health route
**Files:** `src/auth/server.ts`, `src/app/api/auth/[...all]/route.ts`, `src/app/api/health/route.ts`, dep `better-auth`
**Produces:** `export const auth` from `@/auth/server`.
- [ ] `src/auth/server.ts` with `import "server-only"` and the §6B config, built from `env.betterAuthSecret` and `env.authBaseUrl`. No `database` and no `@/db` import.
- [ ] `route.ts`: `export const { GET, POST } = toNextJsHandler(auth);`.
- [ ] Add `src/auth/server.ts` to the boundary-test list and confirm it passes.
- [ ] `health/route.ts`: `export const dynamic = "force-dynamic"`. `GET` runs `await db.execute(sql\`select 1\`)` inside try/catch and returns the JSON from §6F with the `Cache-Control: no-store` header.
- [ ] Verify:
  - In `pnpm dev`, `GET /api/auth/ok` returns `{"ok":true}`.
  - `GET /api/health` returns 200 `{"status":"ok","db":"ok"}`.
  - With `DATABASE_URL` pointed at an unreachable host, it returns 503 with no detail.
  - `curl -I` shows no `Access-Control-Allow-Origin`.
  - lint, typecheck, test, and build all pass.
- [ ] Commit `feat(auth): Better Auth server shell (no providers) and health route`.

### Task 7: CI, client-bundle secret scan, and docs
**Files:** `scripts/check-client-bundle.mjs`, `.github/workflows/ci.yml`, `.env.example`, `README.md`, `package.json` (`check:bundle`)
- [ ] `check-client-bundle.mjs` (Node stdlib):
  - Collect the non-empty values of `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `BETTER_AUTH_SECRET` from `process.env`, after `process.loadEnvFile(".env.local")` if the file exists.
  - Fail if none are set. A scan with nothing to look for proves nothing.
  - Walk `.next/static` recursively. Exit 1 and print *variable names only* if any value is found.
  - Prove it works once by temporarily injecting a value into a public file and confirming the script fails. Do not commit that.
- [ ] `ci.yml` runs on `push` and `pull_request`, `permissions: contents: read`, on ubuntu-latest:
  - `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` (node 24, `cache: pnpm`)
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm check:bundle`
  - Job env uses distinctive **non-secret dummy** values: `DATABASE_URL=postgresql://ci:ci-dummy-db-password@ep-ci-dummy.example.invalid/ci`, the matching `_UNPOOLED`, `BETTER_AUTH_SECRET=ci-dummy-better-auth-secret-0123456789abcdef`, `BETTER_AUTH_URL=http://localhost:3000`.
  - No DB access in CI. Migrations run against Neon in a later milestone if wanted.
- [ ] `.env.example`: every variable from §5 with its category comment and an empty value.
- [ ] `README.md`: prerequisites, the setup runbook (M-1/M-2), scripts, the migration workflow (generate → review → migrate; never push), environment isolation rules, and the Preview deploy steps.
- [ ] Verify: run the whole CI sequence locally with real `.env.local`, then once with the CI dummy env in a clean shell. Both should pass.
- [ ] Commit `ci: GitHub Actions checks and client-bundle secret scan; docs and .env.example`.

### Task 8: GitHub and Vercel Preview (each push needs your explicit approval)
- [ ] With approval: `gh repo create iyawnnn/tapcard --private --source . --remote origin`, then push `main` (the empty initial commit), then push `feat/m1-foundation`.
- [ ] Confirm the CI run on the branch is green with `gh run watch` and `gh run view --log` (read the actual output).
- [ ] You do M-3 in Vercel. Then confirm with read-only Vercel MCP calls (`list_deployments`, `get_deployment`, `get_project_env` with names and targets only, no decryption):
  - the feature-branch Preview deployment is READY;
  - **Production has no env vars**.
- [ ] Use `web_fetch_vercel_url` (or `curl` if the preview is public) on the Preview URL to check:
  - `/` → 200
  - `/api/health` → `{"status":"ok","db":"ok"}`
  - `/api/auth/ok` → `{"ok":true}`
- [ ] No code commit unless a fix is needed. Fixes go through systematic-debugging and are committed separately.

### Task 9: Full verification, review, and report (no new code)
- [ ] Use `superpowers:verification-before-completion`. Run the §10 commands from a **fresh clone** of the pushed branch into a temp dir and read every output.
- [ ] Use `superpowers:requesting-code-review` with a whole-branch `code-reviewer` subagent, plus optional `ponytail-review` and `security-review`. Handle findings with `receiving-code-review`. Fixes go in small commits.
- [ ] Produce the §22 completion report, the DoD table with evidence, the verdict, and the Notion-ready implementation record. **Do not** edit Notion, merge, or deploy to production without approval.

---

## 10. Verification commands and success criteria

| # | Command / check | Expected |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` (fresh clone) | exit 0, no lockfile change |
| 2 | `pnpm lint` | exit 0, 0 errors |
| 3 | `pnpm typecheck` | exit 0 |
| 4 | `pnpm test` | all tests pass (isolation, env-schema, sentry-scrub, server-only-boundary) |
| 5 | `pnpm build` | exit 0 |
| 6 | `pnpm check:bundle` | exit 0 with real dev values |
| 7 | `pnpm dev` + `curl` on `/`, `/app`, `/admin`, `/api/health`, `/api/auth/ok` | 200s; health `db:"ok"`; auth `{"ok":true}`; `/app` and `/admin` noindex |
| 8 | `pnpm db:generate` / `db:migrate` (twice) / `db:check` + `__drizzle_migrations` query | no changes / applied then no-op / pass / 1 row |
| 9 | `pnpm build` with `DATABASE_URL` unset | fails with a message naming `DATABASE_URL` and no values. If the build doesn't load the env module, show it with `pnpm start` + `curl /api/health` instead |
| 10 | `VERCEL_ENV=production pnpm build` (or start + request) | fails closed with an isolation error |
| 11 | Temporary `"use client"` component importing `@/db` → `pnpm build` | fails with a server-only error, then file removed |
| 12 | Temporary secret injected into a client file → `pnpm check:bundle` | fails naming the variable, then reverted |
| 13 | GitHub Actions run on the branch | green (log read) |
| 14 | Vercel Preview: `/api/health`, `/api/auth/ok` | 200 / ok. Project env shows Production scope empty |

---

## 11. Risks and ambiguities (no blockers found)

- **Better Auth init without `database`** (§6B). If it refuses, stop and report. Never add persistence in M1.
- **Drizzle Kit layout differences across versions** (flat files vs folder-per-migration). The workflow doesn't depend on the layout.
- **Next 16 env loading at build.** If `next build` doesn't import route modules, the missing-env check is shown at runtime instead (row 9). That still satisfies "fails safely".
- **The empty `PRODUCTION_DATABASE_HOSTS` blocks any production boot.** That is intentional for M1. Populating it is a reviewed one-line change when the production Neon project is created (M10/M12).
- **Unprotected placeholder `/app` and `/admin`** render nothing sensitive. M3 adds protection.
- **One dev Neon branch shared by local and Preview.** Step 7 allows preview branches but doesn't require them. Per-PR branches can be added later.
- **Vercel Hobby non-commercial terms** are accepted by the spec for pre-launch.
- **Windows dev, Linux CI.** CI is the cross-platform check. Use forward-slash paths in scripts.

---

## 12. Definition of Done (Step 9 Milestone 1, line by line)

| Step 9 / Step 8 requirement | Evidence (from §10 / tasks) |
|---|---|
| Next.js 16 App Router + TypeScript | `package.json` next@16; T1 build |
| pnpm workflow | `packageManager`; row 1 |
| Tailwind + shadcn baseline | T4; Button rendered; build |
| Route groups: public/customer/admin | T4 files; row 7 |
| Domain/module structure | `src/modules/README.md` + `src/{config,db,auth}` |
| Zod env/config validation | T2 tests; row 9 |
| Drizzle + Kit against development Neon | T5; row 8; health `db:"ok"` |
| Migration workflow proven on dev DB | row 8 (applied, idempotent, 1 history row) |
| Better Auth server-side foundation | T6; `/api/auth/ok` local + Preview |
| Server-only boundary | boundary test; row 11 |
| Sentry conservative baseline | T3 tests; config review; live test event if DSN provided |
| lint/typecheck/test/build scripts | rows 2–5 |
| GitHub CI | row 13 |
| Vercel Preview, non-production credentials only | row 14; env target listing |
| `.env.example`, no secrets | T7; secret-free diff review (`git grep` for known values = none) |
| Fresh install / dev starts / DB connects | rows 1, 7, 8 |
| Missing env fails safely | row 9 + T2 tests |
| Client bundle exposes no secrets | rows 6, 12 + CI |
| Preview/dev cannot use production credentials | T2 guard tests, row 10, Vercel Production scope empty |
| No wildcard CORS / no browser→DB / no deferred infra | `curl -I`; dependency list review |
| Health/basic route works after deploy | row 14 |
| Clone → configure → install → test → build → migrate → deploy with no undocumented fixes | Task 9 fresh-clone run following README only |

**Execution:** proportional hybrid (see the §9 header).
