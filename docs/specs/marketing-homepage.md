# Marketing homepage

The homepage (`/`, [`src/app/(marketing)/page.tsx`](../../src/app/(marketing)/page.tsx)) tells the Neffi story in a fixed order. **Home introduces; dedicated pages explain.** Visual rules are in the [marketing UI reference](../architecture/marketing-ui.md). Marketing intent is owned by Notion (see [sources of truth](../README.md#sources-of-truth)); this spec records the approved homepage so agents do not re-decide it.

## Status

| Label | Meaning |
|---|---|
| **LOCKED** | Approved and implemented. Change only on explicit instruction |
| **IMPLEMENTING** | Design brief approved, implementation in progress and not yet approved. The brief below is canonical; implementation details are not |
| **PLANNED** | Purpose and boundaries agreed; not designed. Do not build without a brief |

| # | Section | Status |
|---|---|---|
| 1 | Hero | LOCKED |
| 2 | Identity / value system | LOCKED |
| 3 | Profile experience | LOCKED |
| 4 | Real-world use cases | IMPLEMENTING |
| 5 | Setup teaser | PLANNED |
| 6 | Final CTA | PLANNED |

Major sections are separated by the shared [`SectionDivider`](../../src/app/(marketing)/section-divider.tsx).

## Section 1 — Hero

**Purpose:** first impression of the physical product.

- Eyebrow: **Digital business card, made physical.**
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
| Signal Stack | Tap to share | A quick tap opens your Neffi profile instantly — nothing to download. | `TapSignalIllustration` |
| Identity Assembly | Everything in one place | Links, contact details, and your profile stay organized together. | `IdentityStructureIllustration` |
| Update Ribbon / Progression Spine | Always up to date | Update your details anytime, and your card never needs replacing. | `StayCurrentIllustration` |

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

**Status: IMPLEMENTING.** The brief below is canonical; implementation file names are not yet.

**Purpose:** where Neffi fits into someone's life and work.

- Heading: **For every kind of introduction.** No supporting paragraph.
- An image-led editorial carousel with exactly six use cases:

| Page | Use case | Copy |
|---|---|---|
| 1 | Client meetings | Share your details before the conversation moves on. |
| 1 | Networking events | Turn quick introductions into connections people can keep. |
| 2 | Freelance & creative work | Put your portfolio, socials, and contact details within reach. |
| 2 | Sales conversations | Give prospects one place to find you after the meeting. |
| 3 | Careers & opportunities | Share your experience and work when an opportunity opens up. |
| 3 | Everyday connections | Be ready to share when the right connection happens unexpectedly. |

- Desktop: two complete items visible, advancing two at a time across three pages. No autoplay, no infinite loop.
- Mobile: one item at a time, swipe/scroll-snap, all six reachable.
- Art direction: premium contextual photography (planned). Do not repeat Section 3's UI.
- Planned images in `public/marketing/use-cases/`: `client-meetings.webp`, `networking-events.webp`, `freelance-creative.webp`, `sales-conversations.webp`, `careers-opportunities.webp`, `everyday-connections.webp`.

## Section 5 — Setup teaser

**Status: PLANNED.** Answers "is Neffi easy to start using?" in a concise story, likely **Activate → Build your profile → Start sharing**. Detailed activation and setup belong to `/guide`; Home must not become the setup guide.

## Section 6 — Final CTA

**Status: PLANNED.** Closes the page, possibly with the brand statement **One tap. Instant connection.**, a Get Neffi action and a link to pricing or the guide. Not designed.

## Page ownership

| Route | Owns | Exists today |
|---|---|---|
| `/` Home | Story, first impression, strongest benefits, digital-experience teaser, use cases, setup teaser, final CTA | Yes |
| `/product` | Deeper features, physical/digital relationship, editable profile, NFC and QR behaviour, profile capabilities, detailed product exploration | No |
| `/guide` | Activation, setup, packaging activation flow, first use, QR/NFC guidance, what happens after activation, editing afterwards, setup FAQ | No |
| `/pricing` | Prices, product options, what is included, quantities and business options, ordering decision | No |
| `/help` | FAQs, troubleshooting, compatibility, account, support and recovery | No |
| `/privacy`, `/terms` | Legal content only (linked from the footer) | No |

Existing customer routes linked from the dock's More: `/activate`, `/sign-in`, `/support`. Home never takes content that belongs to another page; no prices, setup steps or FAQs on Home.

## Known differences from the approved direction

- **Section 2 on mobile** is a horizontal scroll-snap row of subtle bordered tiles, unlike the card-free desktop language. Revisit before treating it as a pattern.
- **Section 3 selector** is integrated into the stage's lower-left notch only from 1280px; from 769px to 1279px it sits above an un-notched stage (to clear Back to Top). Below 769px it is the approved vertically stacked text-and-icon list. Its active state is semibold Ink text with no Vermilion marker.
