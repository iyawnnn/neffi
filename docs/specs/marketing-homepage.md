# Marketing homepage

The homepage (`/`, [`src/app/(marketing)/page.tsx`](../../src/app/(marketing)/page.tsx)) tells the Neffi story in a fixed order. **Home introduces; dedicated pages explain.** Visual rules are in the [marketing UI reference](../architecture/marketing-ui.md). Marketing intent is owned by Notion (see [sources of truth](../README.md#sources-of-truth)); this spec records the approved homepage so agents do not re-decide it.

## Status

| Label | Meaning |
|---|---|
| **LOCKED** | Approved and implemented. Change only on explicit instruction |
| **IMPLEMENTING** | Design brief approved, implementation in progress and not yet approved. The brief below is canonical; implementation details are not |
| **PLANNED** | Purpose and boundaries agreed; not designed. Do not build without a brief |
| **IMPLEMENTED** | Present in the current marketing implementation; this label does not assert a new design approval |

| # | Section | Status |
|---|---|---|
| 1 | Hero | LOCKED |
| 2 | Identity / value system | LOCKED |
| 3 | Profile experience | LOCKED |
| 4 | Real-world use cases | LOCKED |
| 5 | Setup teaser | IMPLEMENTED |
| 6 | Final CTA | IMPLEMENTED |

Major sections are separated by the shared [`SectionDivider`](../../src/app/(marketing)/section-divider.tsx).

## Section 1 — Hero

**Purpose:** first impression of the physical product.

- Eyebrow: **Your profile, ready to tap.**
- H1: **Share who you are with a tap.**
- Support: **Neffi is an NFC digital business card that lets you share your contact details, links, and profile instantly — no app required.**
- Actions: **Explore Neffi** → `/product` (primary, Vermilion) and **View Guide** → `/guide` (secondary, Snow). No arrows.
- Visual: the real Neffi card, centred, in pseudo-3D with subtle pointer tilt, on a faint radial tap field. Desktop callouts **Tap to share** and **Edit anytime** connect to the card edges and are hidden below 900px. No phone mockup, no fake technical values, no feature lists, no left/right SaaS split.
- One opening screen sized with `svh`, with clearance for the dock.

Files: [`page.tsx`](../../src/app/(marketing)/page.tsx), [`hero-card.tsx`](../../src/app/(marketing)/hero-card.tsx).

## Section 2 — Identity / value system

**Purpose:** what Neffi represents beyond the card.

- Statement: **More than a card.** *Neffi brings your contact details, links, and digital profile into one place — ready to share with a tap and update anytime.* (second sentence in muted Ink)
- Three custom technical illustrations with captions:

| Figure | Title | Caption | Component |
|---|---|---|---|
| Tap Key | Tap to share | A quick tap opens your Neffi profile instantly — nothing to download. | `TapKeyIllustration` |
| Convergence | Everything in one place | Links, contact details, and your profile stay organized together. | `ConvergenceIllustration` |
| Living Spine | Always up to date | Update your details anytime, and your card never needs replacing. | `LivingSpineIllustration` |

- Desktop: three columns divided by hairlines, no cards, subtle entrance and hover motion, reduced-motion safe. No FIG labels.

Files: [`identity-section.tsx`](../../src/app/(marketing)/identity-section.tsx), [`identity-illustrations.tsx`](../../src/app/(marketing)/identity-illustrations.tsx).

## Section 3 — Profile experience

**Purpose:** what someone actually sees after tapping.

- Heading: **Your profile, ready when they tap.**
- Support: **One place for your contact details, links, and the ways people connect with you.**
- One contained, clipped product stage (top-right diagonal cut; lower-left selector notch on wide desktop) holding three **distinct foreground scenes**, not one profile with highlights:
  1. **Your profile**: Mika Santos, Brand Designer, Manila, Philippines; local avatar ([`avatar-example.jpg`](../../public/avatar-example.jpg)); Save contact; LinkedIn, Instagram, Dribbble, Behance; Portfolio, Book a call, Contact.
  2. **Save contact**: the contact handoff into the visitor's contacts.
  3. **Share your work**: a wide portfolio/project composition.
- Each scene has its own atmospheric background in `public/marketing/profile-experience/` (`neffi-profile-background.png`, `neffi-save-contact-background.png`, `neffi-share-work-background.png`).
- Demo controls are inert: they never navigate or download.
- Scenes scale down progressively from about 500px viewport width.

Files: [`profile-experience-section.tsx`](../../src/app/(marketing)/profile-experience-section.tsx), [`profile-experience-stage.tsx`](../../src/app/(marketing)/profile-experience-stage.tsx), [`profile-preview.tsx`](../../src/app/(marketing)/profile-preview.tsx), [`save-contact-scene.tsx`](../../src/app/(marketing)/save-contact-scene.tsx), [`share-work-scene.tsx`](../../src/app/(marketing)/share-work-scene.tsx), [`profile-experience.css`](../../src/app/(marketing)/profile-experience.css).

## Section 4 — Real-world use cases

**Status: LOCKED.** Manually reviewed and approved; the implementation below is canonical.

**Purpose:** show where Neffi fits into real-world introductions and professional/social situations, without repeating product features, profile UI or setup instructions.

- Heading, on two lines: **For every kind of** / **introduction.**
- Support: **From work to everyday moments, Neffi gives every introduction an easy next step.** The heading and support form two columns from 900px and stack below that.
- An editorial carousel with exactly six use cases, in this order:

| Desktop page | Use case | Copy | Intent |
|---|---|---|---|
| 1 | Client meetings | Share your details before the conversation moves on. | Professional follow-up |
| 1 | Networking events | Keep the conversation going after the event. Share your details in a tap, so new connections know where to find you. | Event introductions |
| 2 | Freelance & creative work | Put your portfolio, socials, and contact details within reach. | Portfolio / personal brand |
| 2 | Sales conversations | Give prospects a clear next step. Keep your details and work together, so they can pick up the conversation later. | Prospect follow-up |
| 3 | Careers & opportunities | Share your experience and work when an opportunity opens up. | Professional opportunities |
| 3 | Everyday connections | A good connection can happen anywhere. Share who you are in the moment, with an easy way to get back in touch. | Spontaneous sharing |

- **Desktop (1024px and up):** two complete panels per page, always smaller left / larger right, at 36% / 64% of the width after the 24px gap. Exactly three positions, starting at cards 1, 3 and 5; arrows advance one pair. Panels share the same height and caption baseline. The content container is at most 1168px wide inside 24px page padding.
- **Tablet/mobile (below 1024px):** all six panels have equal width and height at a given viewport; arrows advance one item. Native swipe and CSS scroll snap keep all six accessible, with an intentional next-card peek. The track stays inside the 24px page gutters so the continuous Snow canvas remains visible on the right, without horizontal page overflow.
- **Panels:** a light neutral surface, subtle border and 20px radius contain the illustration, title and description together. On smaller devices the caption fits its content, with 20px bottom padding; on desktop captions share a 128px row.
- **Controls:** compact circular Previous / Next arrows centred below the track. Accessible names are **Previous use cases** and **Next use cases**; the first previous and final next states are disabled. The track supports ArrowLeft, ArrowRight, Home and End. No autoplay, infinite loop, pagination dots or per-card navigation.
- **Motion:** controlled 500ms ease-out arrow movement; native scrolling remains snap-based. Reduced motion makes controlled movement immediate and skips the shared section entrance reveal.
- **Artwork:** finished inline SVG with neutral material fills, thin linework and restrained Vermilion. Illustrations are static/editorial and decorative (`aria-hidden`, non-focusable), with no hover animation, wireless/signal-wave motifs or external stock photography. Distinct object-led compositions show meeting materials; an event lanyard/badge and phone/card; a creative presentation board, tablet and stylus; a proposal handoff; a resume/portfolio; and a notebook/cup with phone/card. The three larger panels use landscape SVG canvases.

Implementation: [`page.tsx`](../../src/app/(marketing)/page.tsx) places `UseCasesSection` immediately after Section 3 and the shared divider. [`use-cases-section.tsx`](../../src/app/(marketing)/use-cases-section.tsx) owns the copy and server-rendered content; [`use-cases-carousel.tsx`](../../src/app/(marketing)/use-cases-carousel.tsx) scopes client state and native-scroll controls; [`use-case-card.tsx`](../../src/app/(marketing)/use-case-card.tsx) owns the panel structure; [`use-case-illustrations.tsx`](../../src/app/(marketing)/use-case-illustrations.tsx) owns the six SVG compositions; [`use-cases.css`](../../src/app/(marketing)/use-cases.css) owns responsive sizing, snap layout and presentation. No carousel dependency is added.

## Section 5 — Setup teaser

**Status: IMPLEMENTED.** The existing **From the box to your first tap.** sequence shows **Activate your card → Make it yours → Start sharing** with three custom setup SVGs. Detailed activation and setup belong to `/guide`; Home does not become the setup guide. Files: `setup-journey-section.tsx`, `setup-journey.css`, and `public/marketing/setup/`. This source is preserved by the supporting-page implementation.

## Section 6 — Final CTA

**Status: IMPLEMENTED.** The existing **Turn one tap into a connection.** close combines a compact Vermilion Get Neffi action to `/pricing` and the real physical card artwork. Files: `final-cta-section.tsx` and `final-cta.css`. This source is preserved by the supporting-page implementation.

## Page ownership

| Route | Owns | Exists today |
|---|---|---|
| `/` Home | Story, first impression, strongest benefits, digital-experience teaser, use cases, setup teaser, final CTA | Yes |
| `/product` | Deeper features, physical/digital relationship, editable profile, NFC and QR behaviour, profile capabilities, detailed product exploration | Yes ([`product/`](../../src/app/(marketing)/product/page.tsx)) |
| `/guide` | Activation, setup, package contents, first use, QR/NFC guidance, publishing, later updates and setup FAQ | Yes |
| `/pricing` | One physical/digital product offer, inclusions and buying enquiry; approved price/order destination still required | Yes; no invented price or checkout |
| `/help` | FAQs, troubleshooting, compatibility, account, support and recovery | Yes |
| `/privacy`, `/terms` | Legal reading layouts linked from the footer; approved legal content required | Review templates only; noindex |

See [Supporting marketing pages](marketing-pages.md) for page architecture, implementation files, content sources and pricing/legal publication gaps. These routes do not change Home Sections 1–6 or Product.

Existing customer routes linked from the dock's More: `/activate`, `/sign-in`, `/support`. Home never takes content that belongs to another page; no prices, setup steps or FAQs on Home.

## Known differences from the approved direction

- **Section 2 on mobile** is a horizontal scroll-snap row of subtle bordered tiles, unlike the card-free desktop language. Revisit before treating it as a pattern.
- **Section 3 selector** is integrated into the stage's lower-left notch only from 1280px; from 769px to 1279px it sits above an un-notched stage (to clear Back to Top). Below 769px it is the approved vertically stacked text-and-icon list. Its active state is semibold Ink text with no Vermilion marker.
