# Authenticated customer UI

`/app` is the approved authenticated customer-product visual anchor. Future customer pages inherit its typography, tokens, app chrome, object treatment and interaction language, with layouts appropriate to their own tasks. Profiles, Cards and guided setup use these conventions with task-specific compositions; do not copy the dashboard composition onto every route.

The public marketing site has its own reference, [marketing-ui.md](marketing-ui.md); it shares tokens but not this chrome.

This reference describes implemented engineering conventions. Business and higher-level product intent remain in the sources identified by the [documentation index](../README.md#sources-of-truth).

## Implementation reference

- [Global tokens and utilities](../../src/app/globals.css): palette, typography, `app-type`, `app-shell`, `interact`, `nav-interact`, `nav-arrow`.
- [Customer layout](../../src/app/(customer)/app/layout.tsx) and [app navigation](../../src/app/(customer)/app/app-nav.tsx): shared chrome, real Inbox state, account menu and mobile clearance.
- [Home shell](../../src/app/(customer)/app/page.tsx) and [dashboard](../../src/app/(customer)/app/dashboard.tsx): approved responsive composition and state-dependent content.
- [Authenticated primitives](../../src/components/app-ui.tsx): button links, section links, panels, rows, entity glyphs and status badges.
- [Class merging](../../src/lib/utils.ts): preserves the custom type-size tokens alongside text colors. Use this `cn` when composing authenticated type tokens.

shadcn/ui is the primitive/component foundation, built on the installed Base UI components. It is **not** the Neffi visual identity. Reuse primitives in `src/components/ui/` where appropriate, then apply Neffi tokens and task-specific composition; avoid default-shadcn page styling.

## Typography

**Geist Sans is the authenticated Neffi product UI font.** The [root layout](../../src/app/layout.tsx) loads the full `geist/font/sans` build through `--font-geist-sans`; `--font-sans` maps to it. `app-type` enables standard/contextual ligatures and `ss02`, with optical sizing and no synthesized glyphs. These features are scoped to the customer layout.

The implemented Tailwind type tokens are the hierarchy:

| Token | Size / line height | Weight | Tracking |
|---|---|---|---|
| `text-title` below 768px | 30 / 34px | 600 | -0.02em |
| `text-title` from 768px | 36 / 40px | 600 | -0.025em |
| `text-section`, `text-entity` | 15 / 20px | 600 | -0.01em |
| `text-body` | 14 / 20px | Normal (400) | Normal |
| `text-meta` | 13 / 18px | Normal (400) | Normal |
| `text-label` | 12 / 16px | 500 | Normal |
| `text-nav` | 14 / 20px | 500 | Normal |

Use the restrained 400 / 500 / 600 hierarchy. Metadata remains secondary; size, weight, line height and contrast establish hierarchy without excessive bold. Preserve the compact product rhythm. Do not restore PP Neue Montreal, FT Kunst Grotesk or Inter as the authenticated primary font; experimental/trial font files are not shipped.

## Palette and surfaces

Use the existing semantic tokens, not new color values:

| Role | Implemented token |
|---|---|
| App canvas / Snow-like surround | `canvas` (`--canvas: #F7F8FA`) |
| White primary panels and chrome | `background` (`--background: oklch(1 0 0)`) |
| Ink text and structure | `foreground` (`--foreground: oklch(0.145 0 0)`) |
| Stronger neutral fill | `subtle` (`#F2F3F5`) |
| Secondary / faint foreground | `fg-secondary` (`#62646A`) / `fg-faint` (`#8B8E95`) |
| Hairlines / stronger borders | `border` / `border-strong` (`#D5D7DC`) |
| Vermillion accents | `brand` (`#E64A35`) |
| Primary action / hover | `action` (`#D6402D`) / `action-hover` (`#C93A29`) |
| Restrained accent text | `action-text` (`#C93A29`) |

Vermillion primarily marks primary CTAs, progress/completion, focus, real unread indicators, active mobile navigation and meaningful hover accents. Do not add decorative semantic color blocks, a generic blue palette, decorative gradients, glassmorphism or glow.

The dashboard canvas belongs to the outer customer layout, selected by `main[data-canvas]`, so the area around the inset header matches the content. The sticky wrapper inherits that background; the shell stays white. Preserve this canvas/panel hierarchy.

Use rounded rectangles, thin neutral borders and minimal shadow. The implemented radii are 12px for panels, 16px for `app-shell`, 10px for button links and object tiles, 12px for the account control, 18px for the Ink dock and 12px for its navigation items. Avoid excessive nested cards and `rounded-full` on large application shells. Circular account avatars, small icon containers and compact status badges do not define the shell silhouette.

## Shared chrome and navigation

Primary customer navigation is **Home, Profiles, Cards**. Account settings and sign out belong in the account control. The bell links to the real Inbox, with a Vermillion dot only for actual unread messages; it is not a separate notification product.

The top header retains a white `app-shell` surface with the Neffi home link, Inbox bell and account menu. It is inset/sticky, 58px high below 768px and 64px from 768px, aligned to the content. Scrolling strengthens its border/shadow without morphing or blur. Primary sections no longer appear in the header.

`AppNav` is a separate floating Ink bottom dock at every breakpoint. It shares the `nav-ink-surface` material (18px corners, white hairline, restrained Ink shadow) with the public desktop dock, while keeping product navigation and a quiet Snow active surface. Mobile shows icons and labels; desktop shows labels. Equal-width implicit grid columns accommodate a fourth primary section without a three-item CSS assumption. Inbox and Account remain in the top header on every screen.

- Below 768px: 66px dock, 12px horizontal/bottom inset plus safe-area bottom, capped at `max-w-md`. Links are at least 48px high; the current icon uses a restrained brand accent.
- From 768px: 72px dock, 16px plus safe-area inset above the bottom edge, capped at `max-w-lg`.
- The layout reserves bottom clearance at every breakpoint. The details editor's narrow-screen sticky Save/Cancel footer sits above the dock.
- `/app/setup/**` remains a focused authenticated variant: `SetupHeader`, progress, Back/Continue and Finish later; no normal app dock/account controls. Existing authorization and session maintenance still apply.

Keep account hover/open feedback on one coherent rectangular control, with the existing dropdown items, accessible focus and real sign-out behavior.

The public site uses one Marketing Shell, including authentication/activation/support routes. The app shares its design language, not its acquisition links or footer. Public `/c/{token}` and unavailable card states remain independent profile surfaces.

## Product objects and reusable composition

Profiles and Cards are product objects. Use `ProfileGlyph` (neutral rounded-square contact/ID object) and `CardGlyph` (neutral NFC object). Profile fallback visuals must not be random initials, a generic person avatar or the Neffi logo. Account avatars are distinct from Profile objects. Real media can replace fallbacks only where actual product data supports it.

Reuse `ListPanel`, `RowList`, `Row`, `SectionHeader`, `SectionLink`, `ProfileStatus` and `ButtonLink` where their roles fit. Button links retain matching geometry across variants: 48px on phones, 44px from `sm`, with a 10px radius. Use `action` for the purposeful primary CTA and `outline` for secondary actions. Completed-draft actions show Edit profile before Preview and publish on mobile, and Edit left / Preview and publish right on desktop.

The Home title is **Your Neffi**. Its locked subtitle is **Manage your cards and what people see when they tap.** Keep the existing [hero artwork](../../public/neffi-dashboard-hero.png).

## Interactions and responsive behavior

The shared `interact` and `nav-interact` utilities use **220ms**, `cubic-bezier(0.22, 1, 0.36, 1)`. Prefer subtle surface transitions and purposeful icon emphasis. Avoid bouncing, exaggerated scaling and glow.

Supported Quick Actions, Profile/Card rows and View all links use the same `ArrowRight` icon in both states. `nav-arrow` starts muted and right-facing; hovering the whole link on a hover-capable fine-pointer device changes it to Vermillion and applies `translate(2px, -1px) rotate(-45deg)` around its center. Do not swap icon shapes. Reduced motion removes the transform and transitions; touch devices retain the right-facing arrow and do not rely on hover for usability.

Guided setup and the profile editors inherit these `/app` tokens and chrome. The public profile layouts (`/c/{token}`) have their own visual rules in the [profile layouts spec](../specs/profile-customization-onboarding.md#7-layouts).

Authenticated customer UI is mobile-first: preserve clear tap targets of at least 44px, visible keyboard focus, meaningful labels, task-specific responsive layouts and consistent chrome. Use available desktop width intentionally. Validate mobile wrapping, overflow, safe-area clearance, keyboard/menu behavior and reduced motion when extending these patterns. Consistency means shared typography, tokens, chrome, interactions and object language, not identical page layouts.
