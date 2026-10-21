# Supporting marketing pages

The supporting routes use the existing `(marketing)` layout and its navigation, Back to Top and footer. Home and Product remain the visual references; their source and composition are unchanged by these pages. See the [marketing UI reference](../architecture/marketing-ui.md) for tokens and shared chrome, and the [homepage spec](marketing-homepage.md) for page ownership.

## Content authority

Customer instructions follow implemented behavior and the current [activation](cards-and-activation.md), [profiles](profiles-and-public-card.md), [accounts](accounts-and-access.md), and [support](support-and-corrections.md) specs. The [two QR codes decision](../decisions/0004-two-qr-codes.md) distinguishes package activation from sharing. No public price, checkout destination, approved Privacy Policy or approved Terms text was found in the repository for this implementation. Seed prices are not public offers.

## Routes and structure

| Route | Purpose and structure | Implementation under `src/app/(marketing)/` |
|---|---|---|
| `/guide` | A plain-language setup journey: package contents, activation, essentials and publishing, tap/Sharing QR, later updates, questions and activation next step | `guide/page.tsx`, `guide/guide.css`, `guide/package-contents.tsx` |
| `/pricing` | One physical/digital product offer, buying enquiry, inclusions, short arrival journey and purchase questions. No invented software tiers or price | `pricing/page.tsx`, `pricing/pricing.css` |
| `/help` | Real topic index and six answer groups: getting started, activation, profile, sharing, account and troubleshooting; support and recovery next steps | `help/page.tsx`, `help/help.css` |
| `/privacy` | Clearly labelled review template, publication notice and eight-section policy outline | `privacy/page.tsx`, shared `legal-page.tsx` and `legal.css` |
| `/terms` | Clearly labelled review template, publication notice and eight-section contractual outline | `terms/page.tsx`, shared `legal-page.tsx` and `legal.css` |

`marketing-page.tsx` and `marketing-pages.css` supply the wordmark header, reading/spacing/action primitives, native disclosure answers and closing next step. Pages stay server components. Disclosures use native `details`/`summary`; there is no fake search, ordering or legal acceptance control. The canonical `SectionDivider` marks major storytelling transitions on Guide, Pricing and Help. Legal pages use reading hairlines instead of decorative storytelling sections.

## Product instructions

- The package contains the card, a common activation QR insert and the private unique activation code. The QR opens `/activate`; the customer types the code, signs in and confirms **Add to my account**.
- Claiming a card does not itself create a profile. The customer resumes under **Ready to set up**, chooses a starting purpose, enters essentials, previews and publishes.
- Sharing QR is available on a claimed, connected card's page and downloadable as SVG. It has the same permanent URL as NFC. The package QR does not share a profile.
- Recipients view a published profile in their browser without a Neffi account or separate app. The card must be connected and turned on.
- Account recovery goes through support verification. Customers should complete recovery before signing in with a new address; no self-service card transfer is promised.

## Illustrations and responsive behavior

Guide adds one static inline SVG package composition: card, tray and activation insert. It is a conceptual contents illustration, not a promise about packaging dimensions or manufacture. It reuses the real card SVG and existing canonical setup assets for the deeper instructional chapters. Pricing presents the real card asset on a restrained CSS sleeve composition. Help and legal pages need no illustration.

All pages use 24px gutters and a maximum 1168px content container, clamped Geist headings, visible focus and fluid artwork. Guide/Pricing columns stack below 900px. Help's topic index becomes two columns at 769px and its useful-links rail becomes sticky at 1024px. Legal contents are a two-column compact index below 900px and a sticky rail above it; prose has a maximum 43rem measure. No new page adds fixed chrome, wide tables, animation libraries or dependencies. The shared footer provides dock and safe-area clearance; the dock geometry and footer decorative composition are preserved.

## Links and shared chrome

Home, Product and dock links already pointed to the new routes. Footer Product, Guide, Pricing, Help, Privacy and Terms labels now link to their implemented pages. Activation, sign-in, support and recovery remain their existing routes. Social destinations remain non-interactive because no official accounts/email are configured. The existing newsletter preview remains inert.

Integration preserves the current Home, Product, navigation and footer design. In particular, Product uses the shared `FinalCtaSection`, the Neffi-first check/X comparison and the two-lead/three-compact facts layout. Desktop dock active state is color-only and its bottom offset is 16px. Only footer route interactivity changes; its typography, wordmark, spacing and responsive treatment remain intact.

## Content required before public launch

- **Pricing:** approve the public price, availability and commercial details, plus a real order destination if online purchasing is intended. `/support` currently opens a buying enquiry, explicitly not checkout. No delivery fee, warranty, recurring charge or lifetime service promise is invented.
- **Privacy and Terms:** supply reviewed, approved legal copy, business/entity and contact details, applicable provisions and actual effective dates. Both routes visibly say **Not yet published**, describe themselves as review templates, and mark every outline section **Approved copy required**. Both emit `noindex, follow`. These outlines are not approved legal documents and must not be presented as such.
- No official social URL, contact email or newsletter backend has been invented.

These are content gaps, not substitutes for the engineering launch-gate status in [roadmap.md](../roadmap.md).

## Verification boundary

`marketing-pages.test.tsx` renders the new pages and footer to check landmarks, duplicate IDs, real routes/fragments, local artwork, legal status/noindex, the enquiry-only offer and inert newsletter/socials. Responsive source review covers the existing 768/769px dock split, 900px editorial split and 1024px rails. Visual acceptance remains manual; no screenshots or browser visual iteration were requested for this implementation.
