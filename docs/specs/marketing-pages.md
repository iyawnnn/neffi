# Supporting marketing pages

The supporting routes use the existing `(marketing)` layout, which delegates navigation, Back to Top and footer to the canonical `PublicSiteShell`. `/activate`, `/sign-in`, `/support` and `/support/recover` use the same shell and keep their focused forms. Support retains the full MarketingFooter. Sign in and Activate have no footer and retain their in-card contextual help, with dock clearance reserved by the shell. Recovery keeps its focused support/Privacy/Terms footer. There is one public navigation implementation. `/app/**` has separate product navigation; guided setup is focused; `/c/{token}` and unavailable card states inherit neither site shell. Home and Product remain the visual references; their source and composition are unchanged by these pages. See the [marketing UI reference](../architecture/marketing-ui.md) for tokens and shared chrome, and the [homepage spec](marketing-homepage.md) for page ownership.

## Content authority

Customer instructions follow implemented behavior and the current [activation](cards-and-activation.md), [profiles](profiles-and-public-card.md), [accounts](accounts-and-access.md), and [support](support-and-corrections.md) specs. The [two QR codes decision](../decisions/0004-two-qr-codes.md) distinguishes package activation from sharing. The maintainer approved a ₱799 product price and official Facebook ordering destination for the Digital Business Card. Privacy Policy and Terms drafts are derived from the [operations audit](../legal/privacy-terms-operations-audit.md) and still need owner/legal approval.

## Routes and structure

| Route | Purpose and structure | Implementation under `src/app/(marketing)/` |
|---|---|---|
| `/guide` | A plain-language setup journey: package contents, activation, essentials and publishing, tap/Sharing QR, later updates and activation next step | `guide/page.tsx`, `guide/guide.css`, `guide/package-contents.tsx` |
| `/pricing` | ₱799 package/card hero, four inclusions, Facebook/payment/J&T ordering journey and final purchase CTA. Setup stays in Guide; FAQs stay in Help | `pricing/page.tsx`, `pricing/pricing.css` |
| `/help` | Help Center with 29 answers in six categories: buying & payment, shipping & delivery, activation, using & sharing, account & card issues, troubleshooting. All six FAQ categories are visible in a two-column desktop directory; four shortcut links jump to category anchors | `help/page.tsx`, `help/help-browser.tsx`, `help/help-data.ts`, `help/help.css` |
| `/privacy` | Dated single-column Privacy Policy draft (10 numbered sections) awaiting owner/legal review | `privacy/page.tsx`, shared `legal-page.tsx` and `legal.css` |
| `/terms` | Dated single-column Terms & Conditions draft (12 numbered sections) awaiting owner/legal review | `terms/page.tsx`, shared `legal-page.tsx` and `legal.css` |

`marketing-page.tsx` and `marketing-pages.css` supply the wordmark header, reading/spacing/action primitives, native disclosure answers and closing next step. Page shells remain server components. Help mounts a client FAQ directory with independently expandable button-based accordions; other shared disclosures use native `details`/`summary`. Help preserves category fragments, including `#sharing`, and maps `#getting-started` to Activation and `#profile` to Using & sharing. Its FAQ category sections form a two-column desktop directory and a single-column mobile list. The support panel reuses the shared final CTA with centered copy and its approved lower-right card artwork. The canonical `SectionDivider` marks major storytelling transitions. Legal pages use reading hairlines instead.

## Product instructions

- The package contains the card, a common activation QR insert and the private unique activation code. The QR opens `/activate`; the customer types the code, signs in and confirms **Add to my account**.
- Claiming a card does not itself create a profile. The customer resumes under **Ready to set up**, then follows [guided setup](profile-customization-onboarding.md#8-guided-setup): Goal, You, Photo/Logo, Contact, Links, Look, Colours, Review/Publish and Done. Goal only recommends; it does not restrict content or layouts.
- Sharing QR is printed as a sticker on the back of the physical card and is also available on a claimed, connected card's page, downloadable as SVG. It has the same permanent URL as NFC. The package QR does not share a profile.
- Recipients view a published profile in their browser without a Neffi account or separate app. The card must be connected and turned on.
- Account recovery goes through support verification. Customers should complete recovery before signing in with a new address; no self-service card transfer is promised.

## Illustrations and responsive behavior

Pricing uses five final Figma-exported WebP product photographs under `public/marketing/pricing/`, covering the product, card front, card back with Sharing QR, closed packaging and open package. The real card SVG remains in Guide package contents and the shared closing CTA, including Help. Legal pages use no illustration. The Pricing Snow canvas stays continuous; Home/Product CTA defaults remain unchanged.

All pages use 24px gutters and a maximum 1168px content container, clamped Geist headings, visible focus and fluid artwork. Guide/Pricing columns stack below 900px. Help uses one FAQ category column below 900px and two above it; all questions remain visible and answers expand independently. Legal pages are one centred document column (maximum 46rem) with no contents navigation; they scroll with the page only. No new page adds fixed chrome, wide tables, animation libraries or dependencies. The shared footer provides dock and safe-area clearance; the dock geometry and footer decorative composition are preserved.

## Links and shared chrome

Home, Product and dock Get Neffi actions go to `/pricing`. Pricing purchase actions and Guide’s Order on Facebook action use `https://www.facebook.com/p/Neffi-61595507571192/`, opening a new tab with `noopener noreferrer`. Support remains for assistance, not purchases. The footer links to that Facebook page, `https://www.instagram.com/neffi.ph` and `https://www.tiktok.com/@neffi.ph`; newsletter controls are removed.

Ordering proceeds through Facebook conversation, confirmation and payment, packing and J&T shipping, then tracking. Approved payment mentions are GCash, Maya, MariBank, GoTyme and bank transfer. Use: “Delivery details and any applicable shipping fee are confirmed before payment.” ₱799 is the product price; no free/included shipping, unlimited use or lifetime subscription promise is made. There is no website checkout.

Integration preserves Home, Product and navigation behavior. Product uses the shared `FinalCtaSection`, the Neffi-first check/X comparison and the two-lead/three-compact facts layout. Desktop dock active state is color-only and its bottom offset is 16px. Footer navigation, legal links and monument remain; Follow Neffi replaces the inactive newsletter column.

## Content required before public launch

- **Privacy and Terms:** both routes carry first drafts written from the [operations audit](../legal/privacy-terms-operations-audit.md). They emit `noindex, follow` until the owners work through its remaining internal items (operator identity, address, retention schedule, deletion workflow, refund operations) and approve publication. Contacts are `privacy@`, `support@` and `hello@getneffi.com`.
- No contact email or newsletter backend is invented.

These are content gaps, not substitutes for the engineering launch-gate status in [roadmap.md](../roadmap.md).

## Verification boundary

`marketing-pages.test.tsx` checks landmarks, duplicate IDs, real routes/fragments, artwork, legal status, the ₱799 offer, safe Facebook purchase links, buying answers and real footer socials without newsletter controls. Guide tests cover its order link; shared-shell tests keep both nav purchase actions at `/pricing`. Pricing stacks its hero and ordering sequence below 900px; inclusions become two columns at 600px. Visual acceptance remains manual; no screenshots or browser visual QA are used.
