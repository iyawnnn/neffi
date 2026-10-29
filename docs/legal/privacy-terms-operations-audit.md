# Privacy & Terms operations audit

Internal working document, audited from the repository on 2026-10-25. It records what Neffi actually does so the Privacy Policy (`/privacy`) and Terms & Conditions (`/terms`) describe real behavior. It is not legal advice and not a compliance certification. Re-audit whenever schema, providers, auth, commerce or support behavior changes.

Sources: `src/db/schema/*`, `src/auth/options.ts`, `src/lib/sentry-scrub.ts`, `src/integrations/*`, `src/modules/*`, `src/app/(public)/**`, `src/app/(customer)/**`, `docs/operations.md`, `PRODUCT.md`, [0004](../decisions/0004-two-qr-codes.md), [0012](../decisions/0012-support-controlled-account-recovery.md), Help FAQ data (`src/app/(marketing)/help/help-data.ts`) and the maintainer-locked commercial terms supplied with the drafting task.

## 1. Data and operations matrix

| Data / operation | Collected from | Public or private | Purpose | Storage / location | Third party involved | Current retention behavior | User control / deletion | Policy section | Status / issue |
|---|---|---|---|---|---|---|---|---|---|
| Account ID (UUID) | Generated | Private | Permanent account identity | Neon Postgres `accounts.id` | Neon, Vercel | Kept for the life of the Account; recovery preserves it | None self-service; no deletion tool exists | P2, P9, P12 | No account-deletion process (see §4) |
| Sign-in email | User (email code) or Google | Private | Sign-in, security notices, support replies | `accounts.email` | Resend (delivery), Google (if Google sign-in) | Kept for the Account's life; replaced on change/recovery | Change in `/app/account` (verified); recovery via Support | P2, P5 | — |
| Account name | Google profile or set at creation | Private (separate from public profile name) | Account display | `accounts.name` | Google | Account life | No edit UI found for account name | P2 | Minor |
| Account image URL | Google profile picture URL | Private (account menu) | Avatar | `accounts.image` (URL to `*.googleusercontent.com`) | Google hosts the image | Account life | None self-service | P2 | — |
| Role (customer/owner) | System | Private | Authorization | `accounts.role` | — | Account life | Not user-editable | — | — |
| Google identity link | Google OAuth | Private | Google sign-in | `auth_identities` (provider subject id). Access/refresh/ID tokens are **not** stored | Google | Until removed | Remove Google in `/app/account` (email code always remains) | P5 | — |
| Session (token, expiry, IP address, user agent) | Browser / request | Private | Keep the user signed in; security | `auth_sessions` | Neon, Vercel | 30-day rolling expiry (renewed after 1 day); deleted on sign-out or "sign out everywhere"; expired rows are not shown to be purged | Sign out; sign out everywhere | P5, P8, P9 | Purge of expired session rows not confirmed |
| Session cookie | Set by Better Auth | Private | Authentication | Browser cookie, HttpOnly, SameSite=Lax, Secure on HTTPS | — | Matches session (≤30 days rolling) | Sign out / clear cookies | P8 | Essential only |
| OAuth state cookies | Better Auth during Google sign-in | Private | CSRF/state for OAuth | Browser cookie | Google | Short-lived (library default) | — | P8 | Library behavior, not Neffi-authored |
| Email sign-in code (OTP) | Generated | Private | Passwordless sign-in | `auth_verifications`, stored as keyed HMAC; identifier hashed | Resend delivers | Expires in 5 minutes; 3 attempts | — | P5, P9 | — |
| Abuse/rate-limit counters | Request IP / email | Private | Abuse prevention | `auth_rate_limits` (≤60 s windows, cleaned on traffic); `auth_otp_quotas` keyed by HMAC of email/IP, not raw values | — | ~60 s (auth) / 24 h (app quotas) | — | P5, P9, P10 | Better Auth rate-limit keys may include raw IP+path for ≤60 s |
| Activation code | Printed in package | Private secret | Prove possession of a sold card | Only a keyed HMAC in `activation_credentials` | — | Used/revoked rows kept (append-only history) | — | T6 | Never in URLs, logs, email |
| Activation challenge cookie `neffi_activation` | Set after a valid code entry | Private | Carry a verified code through sign-in | HttpOnly, SameSite=Lax, path `/activate` | — | 15 minutes | Cleared on claim | P8 | Essential |
| Card public token (`/c/{token}`) | Generated at provisioning | Public by design (on NFC tag and Sharing QR) | Permanent card URL | `cards.public_token` | — | Permanent | Card can be turned off by owner | T5, T7 | Not proof of ownership |
| Card ownership, connected profile, on/off | Activation and card settings | Private (effect visible: profile shows or "unavailable") | Route card to profile | `cards.owner_account_id`, `profile_id`, `disabled_at` | — | Kept; ownership corrections via Support | Owner can connect another profile or turn the card off/on | T5, T13 | Turn-off control exists (`setCardDisabled`) |
| Public profile identity: full name, headline, company, bio, phone, public contact email, website, location | Owner | **Public when published** | Digital business card | `profiles` | Neon, Vercel | Until edited or profile deleted | Edit, unpublish, delete (delete blocked while a card is connected) | P3, T4, T15 | Public email is separate from sign-in email |
| Profile photo / logo, Showcase cover image | Owner upload | **Public when published** | Profile display | Cloudinary (`neffi/profiles/{profileId}/…`); only asset id in Postgres | Cloudinary | Until replaced/removed/profile deleted; Neffi requests Cloudinary deletion on replace/remove/delete (best effort, failures ignored) | Replace/remove/delete | P3, P7, P9 | Cloudinary-side retention after destroy not verified |
| Links (Facebook, Instagram, TikTok, LinkedIn, YouTube, GitHub, Messenger, WhatsApp, Viber, Telegram, X, Threads, Discord, Reddit, Pinterest, Behance, Dribbble, portfolio, booking, shop, menu, custom) | Owner | **Public when visible and published** | Profile links | `profile_links` | — | Until edited/deleted | Edit, hide, delete | P3 | — |
| Scenes and blocks (About, Project with title/description/URL, Link, Contact/Save Contact vCard, Booking URL, Form) | Owner | **Public when visible in the shown Scene** | Context-specific profile content | `scenes`, `scene_blocks` | — | Until edited/deleted | Edit, hide, delete | P3 | Save Contact downloads a vCard of the public contact fields |
| Appearance (layout, light/dark, accent) | Owner | Public (rendering) | Look of profile | `profiles` | — | Until edited | Edit | P3 | Not personal data on its own |
| Setup goal (networking/freelance/business/student) | Owner, optional | Private | Setup recommendation only | `profiles.goal` | — | Until changed | Change/clear | P2 | — |
| Sharing QR | Generated from the card URL | Public (printed on card back; downloadable SVG in account) | Open the public profile | Not stored separately; encodes `/c/{token}` | — | Permanent (same as token) | Turn card off | T7 | Matches [0004](../decisions/0004-two-qr-codes.md) |
| Package QR | Common printed insert | Public, identical on every package | Opens `/activate` | Not stored; contains no code | — | — | — | T6, T7 | Matches [0004](../decisions/0004-two-qr-codes.md) |
| Visitor form submissions (name, email, phone, company, message, custom answers — per form config) | Profile **visitors** (non-account holders) | Private to the profile owner | Let visitors contact the owner | `form_submissions` (answer snapshot) | Resend (notification email to owner, reply-to visitor email when provided) | Until owner deletes it, or the profile is deleted (cascade) | Owner can delete; visitor has no self-service control | P2, P6 | Visitors are data subjects too; owner is effectively responsible for how they use received messages (see §4) |
| Purchaser (name, contact number) | Customer via Facebook Messenger, entered by owners | Private | Orders | `purchasers` | Meta (conversation), Neon | Kept; no deletion | Request via Support | P6 | Unrelated to Account by design |
| Orders, items, prices, notes, cancellation reason | Owners from Messenger conversation | Private | Commerce records | `orders`, `order_items` | Neon | Kept (append-only history) | — | P6, P9 | — |
| Payments and refunds (amount, method, date, reference) | Customer payment confirmation, recorded by owners | Private | Money tracking | `payments`, `refunds` (voids, never edits) | Payment channels used by the customer (GCash, Maya, MariBank, GoTyme, bank) — outside Neffi's system | Kept | — | P6, T9, T11 | No card/wallet credentials collected; schema enum is `gcash`, `bank_transfer`, `cash` (see drift) |
| Shipment (courier, tracking number, recipient name, contact, address, status, cost) | Customer delivery details | Private | Delivery | `shipments` | J&T (courier receives recipient details) | Kept | — | P6, T10 | — |
| Support case (requester email, name, category, message ≤2000, linked card/account/order, status, notes) | `/support` form (signed in or not), owners | Private | Support, recovery, corrections | `support_cases`, `support_case_cards`, `activity_events` | Resend (acknowledgement/replies) | Kept; no deletion | — | P6 | Public requests are unverified and never auto-linked |
| Support emails (ack, reply, resolution, recovery code, security notices, sign-in code, change-email code, inbox notification) | System | Private | Transactional | Sent through Resend from `Neffi <hello@getneffi.com>` (Production `AUTH_EMAIL_FROM`); optional `SUPPORT_REPLY_TO`; only "sent/failed" activity recorded for case emails | Resend | Neffi stores no email bodies except case reply text in activity; Resend-side log retention unknown | — | P4, P7 | No marketing email exists |
| Account recovery (old email, new email, code HMAC, attempts, expiry) | Owners after verification | Private | Support-controlled recovery | `account_recoveries` | Resend | Code valid 24 h; 3 attempts; record kept | — | P5, P12 | — |
| Activity/audit events | System and owners | Private | History of meaningful actions | `activity_events` | — | Kept (append-only) | — | P9, P10 | No public view/tap analytics recorded |
| Error monitoring events | Server/browser errors | Private | Fix faults | Sentry (errors only; no tracing/replay/logs). Cookies, bodies, query strings, most headers, user info and SQL params removed; user-agent and accept-language may remain | Sentry | Sentry plan retention (unknown) | — | P7, P8 | Enabled only when DSN set; Production delivery verified 2026-10-23 |
| Hosting/request logs | Requests | Private | Operate the service | Vercel platform | Vercel | Vercel plan retention (unknown) | — | P7 | Neffi code logs only generic auth error text |
| Owner business data (stock, expenses, suppliers) | Owners | Private | Operations | `stock_purchases`, `expenses` | — | Kept | — | — | Not customer personal data |

Key: P = Privacy Policy section, T = Terms section. These numbers refer to the first-pass drafts (Privacy 15 sections, Terms 23); §6 maps the locked decisions to the current simplified sections.

## 2. Verified providers (current system)

| Purpose | Provider | Evidence |
|---|---|---|
| Hosting and serverless runtime | Vercel | `docs/operations.md`, Vercel env scopes |
| Database (PostgreSQL) | Neon — Production in Singapore (`aws-ap-southeast-1`) | `docs/operations.md` |
| Transactional email | Resend | `src/integrations/email/resend.ts`, required env |
| Sign in with Google | Google | `src/auth/options.ts`, required env |
| Profile images | Cloudinary | `src/integrations/media/cloudinary.ts`, required env, CSP |
| Error monitoring | Sentry | `src/instrumentation*.ts`, Production verification |
| Ordering conversations (outside Neffi's system) | Meta / Facebook Messenger | Official order URL; Neffi stores only what owners enter |
| Delivery (outside Neffi's system) | J&T | Locked commercial terms; Help FAQ |
| Payment channels used by customers | GCash, Maya, MariBank, GoTyme, bank transfer | Locked commercial terms; Help FAQ |

Not used: Cloudflare is DNS only (grey cloud, no proxying). No analytics, Vercel Analytics/Speed Insights, Google Analytics, Meta Pixel, TikTok Pixel, advertising, session replay or marketing tools. Fonts are bundled (`geist` package); no Google Fonts requests. No payment processor or website checkout.

## 3. Cookies, storage and tracking

- Cookies: Better Auth session cookie (HttpOnly, SameSite=Lax, Secure on HTTPS, ≤30-day rolling); Better Auth short-lived OAuth state cookies during Google sign-in; `neffi_activation` (15 minutes, `/activate` only).
- `localStorage` / `sessionStorage` / `document.cookie`: no use found in `src/`.
- Analytics/trackers: none. Card taps and profile views are not recorded.
- Conclusion: essential cookies only. No consent banner is implied by current behavior; reassess if any analytics or marketing tool is added.

## 4. Drift and observations

- **Payment-method drift.** `payment_method` enum is `gcash`, `bank_transfer`, `cash`, and `PRODUCT.md` says "GCash, bank transfer, cash". The locked customer-facing terms are GCash, Maya, MariBank, GoTyme and bank transfer, with no COD. Maya/MariBank/GoTyme have no distinct recorded method. Reported as drift; code not changed. Internal cleanup item: align the enum/`PRODUCT.md` with the locked methods (the public pages never list cash).
- **No account deletion.** Better Auth `/delete-user` is disabled and no owner tool deletes Accounts, purchasers, orders or support cases. Deletion requests currently need a manual process. The policy routes deletion and other privacy requests to `privacy@getneffi.com` and promises no tool. A proper account-deletion workflow remains a **pre-launch product improvement** (not built in the legal-page work).
- **Visitor messages.** Profile visitors submit personal data that is delivered to the profile owner. The policy explains this; whether Neffi or the owner is the controller for owner-side use is a legal question for review.
- **Lost card.** The customer-facing "turn card off" control exists and stops NFC and Sharing QR from showing the profile (both use the same URL). Terms mention it as an existing account control, not as a dedicated lost-card feature.
- **Docs.** `docs/specs/marketing-pages.md` described both routes as unapproved templates; updated to describe the drafts awaiting review.

## 5. Legal research notes

Checked against official National Privacy Commission material (privacy.gov.ph): data subject rights to be informed, access, object (including withdrawal of consent), erasure or blocking, damages, data portability, rectification/correction, and to file a complaint with the NPC; rights transmissible to heirs/assigns. An NPC draft circular on data subject rights was published for comment in September 2026; its final status was not verified. The Consumer Act (RA 7394) and Internet Transactions Act (RA 11967) were not re-read from an official source in this pass; the Terms only preserve non-excludable consumer rights in general words. Legal review should confirm applicability, registration duties (DPO designation, NPC registration thresholds) and any required disclosures.

## 6. Locked decisions (third pass, 2026-10-25)

Section references use the simplified pages: Privacy 01–10, Terms 01–12.

| Decision | Locked value | Where reflected |
|---|---|---|
| Privacy contact | `privacy@getneffi.com` (privacy questions, rights, access, correction, deletion, complaints) | Privacy 07, 10; Terms 12 |
| Support contact | `support@getneffi.com` (accounts, cards, recovery, orders, damaged/defective, lost cards) | Terms 05, 06, 12; Privacy 10 |
| General contact | `hello@getneffi.com` (general enquiries only) | Terms 12 |
| Forwarding inbox | Never published; the branded addresses route to the monitored inbox | Tests assert the forwarding address is absent |
| Eligibility | The strict 18+ rule is **removed**. Under-18 use is allowed with the permission and involvement of a parent or legal guardian; a parent or guardian must approve purchases made by a minor. A guardian may contact Neffi on a minor's behalf for privacy matters. No date of birth, age verification, guardian accounts or consent checkboxes are implemented or planned by this decision | Terms 01, Privacy 08 |
| Account deletion | Not self-service; requests via `privacy@getneffi.com`; retention may apply for legal obligations, disputes, security, legal claims | Privacy 07 |
| Cancellation | Allowed until shipped; no fee | Terms 05 |
| Refunds | Coordinated with the customer using an appropriate payment method; no SLA stated | Terms 05 |
| Order acceptance | Accepted once Neffi confirms payment; messaging alone is not a purchase | Terms 04 |
| Lost card | Not a defect; profile stays with the account; finder may still open it while the card is on; owner can turn the card off; replacement costs may apply and are confirmed first | Terms 06 |
| Payment methods | GCash, Maya, MariBank, GoTyme, bank transfer; no COD; cash not listed | Terms 04 |
| Terms changes | Effective date updated plus additional notice for material changes; no retroactivity promise | Terms 11 |
| Operator, registration, address, DPO | Intentionally omitted from the public drafts until available; brand used neutrally | Both pages |
| Service providers | The public Privacy Policy describes **classes** of providers (hosting, data and image storage, email delivery, sign-in, technical monitoring) plus courier, payment method and Meta for order conversations. The exact provider inventory (§2) stays internal | Privacy 04 |
| Retention | Purpose-based only on the public page. The short periods (sign-in code 5 min, recovery code 24 h, activation cookie 15 min) are kept here, not published | Privacy 06 |
| Cookies | Essential only, described in plain words without an inventory; no pixels, ad tracking or profile-view tracking | Privacy 05 |
| Layout | Single centred document column with numbered sections; no contents sidebar, mobile contents disclosure, active-section tracking or heading anchor icons. Section ids remain for deep links | Both pages |
| Content scope | Public content deliberately minimized while preserving the factual disclosures above; Privacy reduced from 15 to 10 sections, Terms from 23 to 12 | Both pages |
| Search indexing | `noindex, follow` while under manual review | Both pages |

## Remaining internal items before publication

These are business or engineering follow-ups. They do not appear as placeholders on the public pages.

1. **Legal operator identity** (sole proprietor or registered business name) and any registration details, once they exist.
2. **Business address** for legal notices, once available.
3. **Data Protection Officer** designation and whether NPC registration applies.
4. **Operational retention schedule.** No defined periods or purge jobs exist for accounts, orders, payments, shipments, support cases, visitor messages, activity events or expired session rows, nor for Sentry, Resend or Vercel logs. The policy is purpose-based; schedules and deletion jobs still need hardening.
5. **Account-deletion workflow** (pre-launch product improvement): who handles a `privacy@` request, what is deleted versus retained, and the response time.
6. **Refund operations**: actual method and timing, and treatment of shipping fees on refunds.
7. **Lost-card replacement price** (the Terms only say costs may apply and are confirmed first).
8. **Official invoicing / receipts** once business registration is ready.
9. **Payment-method drift** cleanup (§4).
10. **Provider data locations**: Neon is in Singapore; confirm regions for Vercel functions, Cloudinary, Resend and Sentry before adding cross-border detail.
11. **Mail routing**: incoming branded mail is routed by the DNS provider; reassess whether that needs disclosure once the setup is final.
12. **Consumer law review**: Consumer Act and Internet Transactions Act applicability was not re-read from an official source.

## Addendum (2026-10-29)

Repository changes after this audit, recorded without rewriting the sections above:

- **Payment-method drift (§4, item 9) is resolved in the schema.** Migration `0019` added Maya, MariBank and GoTyme. Normal DBC orders use GCash, Maya, MariBank, GoTyme or bank transfer, with no cash. The `cash` value remains for historical rows and the general payment form ([money and costs](../specs/money-and-costs.md#payments)).
- **Activation-code storage (§1) changed.** Since migration `0021`, a usable activation code is stored as a keyed HMAC plus an AES-256-GCM envelope that an OWNER can reveal, with each reveal recorded. The envelope is cleared when the code is used or revoked ([0016](../decisions/0016-retrievable-encrypted-activation-credentials.md)). The public Privacy and Terms pages make no storage claim, so no public copy changed. Re-check this matrix at the next privacy review.
- **Public profile intro.** `/c/{token}` stores a non-personal `sessionStorage` flag (`neffi:profile-intro-seen:v1`) to skip the intro on repeat views in a tab ([profiles spec](../specs/profiles-and-public-card.md#public-card-ctoken)). §3 should list it at the next review.
