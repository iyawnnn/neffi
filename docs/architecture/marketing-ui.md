# Marketing UI

The public site uses one Marketing Shell: `(marketing)` pages plus `/activate`, `/sign-in`, `/support` and `/support/recover`. The authenticated [`/app` reference](customer-ui.md) shares its tokens and Ink navigation material while retaining product-specific navigation. Guided setup is a focused app variant; public `/c/{token}` and unavailable card states remain independent.

This document records the maintainer-approved marketing direction and how it is implemented. Brand, marketing and customer-experience intent are owned by Notion (see [sources of truth](../README.md#sources-of-truth)); if Notion and this document disagree, report drift rather than changing either side. Homepage narrative, copy, section status and page ownership live in the [marketing homepage spec](../specs/marketing-homepage.md).

Where approved direction and current code differ, both are stated. Do not silently change one to match the other.

## Brand and principles

**Neffi** is a physical NFC card joined to an editable digital profile. Brand statement: **One tap. Instant connection.**

The site is modern, editorial, premium, minimal and product-led: strong typography, generous whitespace, restrained colour and custom, purposeful interaction. Every section shows the product (the physical card or the real digital experience) rather than generic SaaS decoration.

Influences, not themes to copy: Linear (editorial hierarchy, technical illustration discipline, motion restraint), Vercel (grid discipline, whitespace, contrast), Cloudflare (confident brand colour and storytelling), Polar (custom, atmospheric product presentation), Design Monks (dock navigation and its geometry), Tailark (layout structure only).

## Colour

Use the existing tokens in [`globals.css`](../../src/app/globals.css); add no new colour values for marketing.

| Role | Token | Use |
|---|---|---|
| Snow | `canvas` (`#F7F8FA`) | The default page canvas. The whole marketing layout, including the dock clearance, is `bg-canvas` |
| Ink | `foreground` | Type, structural contrast, the dock and other high-emphasis surfaces |
| Neutrals | `fg-secondary` (`#62646A`), `fg-faint` (`#8B8E95`), `subtle` (`#F2F3F5`), `border`, `border-strong` (`#D5D7DC`) | Secondary text, quiet surfaces, hairlines |
| Vermilion | `brand` (`#E64A35`), `action` (`#D6402D`), `action-hover` (`#C93A29`), `action-text` | The primary action, meaningful active states and small product-semantic details |

Snow dominates, Ink carries structure, Vermilion is the accent: roughly 70 / 20 / 10 as a balance check, not a rule. Vermilion never covers large decorative areas, never becomes a generic outline colour and does not appear in every component. Dark or Ink section backgrounds are deliberate exceptions, never an alternating-section pattern.

## Typography and layout

- **Geist Sans** for everything (`--font-sans`, loaded in the root layout). **Geist Mono** only for technical/editorial annotations, such as the hero card callouts.
- Marketing headings use clamped sizes in their components rather than the `/app` type tokens. Hero H1 and section headings are distinct: only the hero reads as a hero.
- Left-aligned editorial headings for content sections; centred compositions are reserved for page introductions where appropriate. Supporting pages share the visual language, not one repeated hero layout.
- Breakpoints in use: **768/769px** switches the dock and many layouts (mobile at 768px and below); **900px** switches editorial heading and grid layouts; **1024px** switches the use-case carousel from single-item scrolling to desktop pairs. These are local layout decisions, not new global breakpoints.
- Mobile layouts are restructured, not shrunk: keep 44px touch targets, no horizontal page overflow, swipe-first carousels, simplified selectors.

## Navigation dock

Implemented in [`marketing-nav.tsx`](../../src/app/(marketing)/marketing-nav.tsx). Home is reached through the Neffi wordmark, never a dock slot.

**Desktop (769px and up):** a floating Ink bottom dock, 16px above the viewport edge, text only: **Product · Guide · Get Neffi ↗ · Pricing · More**. Get Neffi is the Vermilion crystal CTA (fixed reflection, one narrow light travelling the rim, the arrow rotates toward → on hover). Active links and open More use Vermilion text without an underline or other marker. More opens a large panel above the dock on hover or focus (image left, links right), with a light static blur behind it (`backdrop-blur-[3px]`, no animated blur).

**Mobile (768px and below):** a full-width Ink bar fixed to the bottom edge and filling the safe area, with rounded top corners. Icon-and-label items: **Product · Guide · [Neffi key] · Pricing · More**. The centre Get Neffi key is Vermilion with the Snow/Ink [`neffi-mark-on-vermilion.svg`](../../public/neffi-mark-on-vermilion.svg) symbol, seated in a squared, softened recess. More opens a typography-only Snow sheet above the bar.

**More destinations:** Home, Help, Activate your card, Sign in, Support. Privacy and Terms belong in the marketing footer, not the dock.

A **Back to Top** control appears after 50% scroll progress in the current implementation. Any overlay behind More must leave page content readable without ghosting; on mobile the sheet overlay uses a faint Ink tint; the content wrapper has a static 2px blur. The desktop dock has no decorative Snow scrim. Its position and geometry are unchanged by the supporting pages.

Warm edge accents on the dock are thin, local light catches, never a full orange outline. Get Neffi in the dock links to `/pricing` (`GET_NEFFI_HREF`) so buyers see the offer before continuing to Facebook.

## Footer and supporting pages

The shared [`marketing-footer.tsx`](../../src/app/(marketing)/marketing-footer.tsx) is mounted by the shared [`PublicSiteShell`](../../src/components/public-site-shell.tsx), used by the marketing layout and Support page. Sign in and Activate keep MarketingNav and the wordmark header without a footer; their contextual help stays inside the card. Desktop cards sit below the header with viewport-aware spacing and a capped usual minimum height, without full-height centering; taller content can grow naturally. The shell reserves dock and safe-area clearance. Recovery retains its quiet Back to support, Privacy and Terms footer. The full MarketingFooter composition is preserved: asymmetric Explore / Neffi / Follow Neffi groups and real Facebook, Instagram and TikTok links, a three-part legal row, and the real pale Ink wordmark on Snow. There is no Vermilion underglow. Terms is left aligned, copyright mathematically centred, and Privacy right aligned on desktop; mobile uses legal links above copyright. The decorative monument provides mobile dock/safe-area clearance. All implemented marketing destinations are now links.

Guide, Pricing, Help, Privacy and Terms use the same layout/chrome. Activate, Sign in, Support and Recovery use that same shell and canonical wordmark header around focused task content, with no duplicated page-local branding/header. Support retains the full footer; Recovery uses the small contextual footer; Sign in and Activate have no footer. Shell composition adds no auth gate or redirect; forms and their server decisions remain page-owned. Their structures, source files, content authority and remaining pricing/legal publication requirements live in the [supporting-pages spec](../specs/marketing-pages.md). Shared `marketing-page.tsx` / `marketing-pages.css` provide server-rendered reading primitives, static CTA surfaces and native disclosure answers. Guide is instructional, Pricing product-led, Help an answer index, and the legal routes reading layouts; these do not repeat Home or Product section-for-section. Privacy and Terms are single-column policy drafts with `noindex, follow` until owner/legal review is complete.

The current Product page retains its newer refinements: the capabilities introduction uses `pp-intro`, the comparison puts Neffi first with check/X values and a mobile pinned sharing-method column, and Product Facts uses two lead facts above three compact facts. Product and Home both close with the canonical `FinalCtaSection` (`final-cta-section.tsx` / `final-cta.css`). The old Product-only CTA and its styles are absent; Pricing reuses that component with optional copy and action props; Help uses its support variant. Other supporting-page next steps serve their own instructional/support purposes.

## Section divider

One reusable divider between major marketing storytelling sections: [`section-divider.tsx`](../../src/app/(marketing)/section-divider.tsx), a neutral hairline with a central architectural step that widens at 769px and 1024px. Never create per-section divider styles.

## Actions

- One primary Vermilion action per view. Secondary actions are solid Snow with a neutral border and Ink text.
- Content CTAs reuse the approved hero materials: Vermilion with white text for primary actions, Snow with Ink text for secondary actions. Purchase arrows turn from right to upper-right on hover/focus with reduced-motion support; the dock retains its own rim animation.
- Plain text links are preferred to buttons inside editorial sections.

## Illustration, product scenes and photography

- **Architectural illustrations** (Section 2): the current inline SVG sculptures in [`identity-illustrations.tsx`](../../src/app/(marketing)/identity-illustrations.tsx) are `TapKeyIllustration`, `ConvergenceIllustration` and `LivingSpineIllustration`. They share a 2:1 isometric projection, Snow/neutral material faces, thin Ink strokes and restrained Vermilion details. `identity-illustrations.css` handles finished static artwork, one-time reveals and small hover/focus shifts with reduced-motion support. The older standalone technical SVGs are not the live Section 2 implementation. No FIG labels, nodes or decorative dots.
- **Product scenes** (Section 3): curated read-only renderings in the real Neffi profile language. Marketing demo controls are inert and never navigate or download. Show only fields Neffi supports.
- **Physical product** (hero): the real card artwork ([`neffi-card-front-preview.svg`](../../public/neffi-card-front-preview.svg)), lightweight CSS pseudo-3D. No phone mockups in the hero.
- **Use-case / editorial illustrations:** clean static inline SVG with object-led storytelling, distinct silhouettes, minimal decoration and restrained accents. Neutral material fills support the shared Snow / Ink palette. Keep the artwork still; avoid repeated wireless/signal motifs and generic SaaS diagrams. Use-case context does not require stock photography or repeat product UI.
- **Atmospheric backgrounds**: monochrome, light, tactile and secondary to the foreground product.

## Motion

Motion explains, reveals, reinforces hierarchy and responds to interaction; it never dances or competes with reading.

- Techniques: CSS transforms and opacity, SVG stroke drawing, small translations, restrained hover, and the shared [`Reveal`](../../src/app/(marketing)/reveal.tsx) IntersectionObserver primitive for entrances.
- Timing: small state changes ~250–350ms; larger stage or carousel moves ~450–550ms; first entrances ~600–1000ms. Refined ease-out (the shared `cubic-bezier(0.22, 1, 0.36, 1)`); no spring or bounce.
- Avoid WebGL/Three.js, heavy parallax, animated or heavy backdrop filters, and continuous idle movement. Approved existing exceptions: the hero card's slow float and tap-field pulse, and the dock CTA's rim light.
- Always honour `prefers-reduced-motion`: render the finished state, with no entrance, loops or hover movement.

## Accessibility

Visible focus rings (Vermilion `outline-brand` on marketing controls), 44px minimum touch targets, semantic landmarks and headings, real `aria-pressed`/`aria-expanded` state on interactive controls, and accessible labels on inert product scenes. Nothing essential depends on animation or hover.

## Assets

Use semantic names grouped by area under `public/marketing/<area>/`, for example [`neffi-profile-background.png`](../../public/marketing/profile-experience/neffi-profile-background.png) in `profile-experience/`. Keep code-based illustrations alongside the marketing components; the use-case artwork is inline SVG rather than external campaign images. Never `image1.png`, `final-final.png` or `background-new.png`.

## Anti-patterns

Do not add:

- generic SaaS bento grids, excessive rounded feature cards, or sections that all share one structure
- random gradients, glassmorphism, neon, glow-heavy UI or floating 3D decoration
- generic dashboards, fake analytics, fake technical values or unsupported product claims
- decorative section numbering, FIG labels, excessive pills or random decorative dots
- repeated hero-like headings or filler copy
- stock-business photography
- heavy continuous animation, or WebGL without a real need
- Vermilion everywhere, or black backgrounds used only for variation
