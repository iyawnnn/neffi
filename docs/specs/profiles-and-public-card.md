# Spec: Profiles, Scenes and the public card

For current engineering milestone status, see [the roadmap](../roadmap.md). Related: [0001](../decisions/0001-permanent-card-url.md), [0003](../decisions/0003-profile-scene-model.md), [0004](../decisions/0004-two-qr-codes.md), [0011](../decisions/0011-fresh-card-state-cached-scene-content.md).

## Purpose

Let a non-technical customer publish a useful, action-first page from a phone, and let any visitor reach it with one tap and no account.

## Actors

Customer (Account owner), visitor, and the Card's owner viewing their own public page.

## Profile

- Created at the You step of guided setup from a claimed DBC, idempotently for the same card. Goal comes first: four advisory Goals or Not sure yet. The nullable Goal is stored; no starter Blocks or Forms are created. Detailed steps and resume rules belong to the [guided setup spec](profile-customization-onboarding.md#8-guided-setup).
- Holds identity (photo/logo, name, headline, company, bio, location), contact (phone, email, website) and Profile-level appearance (Classic/Editorial/Showcase, Light/Dark, one of eight accents and optional Showcase cover). Scenes hold socials, links, work and other Blocks. The [customization spec](profile-customization-onboarding.md#4-canonical-profile-model) owns the detailed model.
- Status: **Draft**, **Published**, **Unpublished**. Publishing requires a name, at least one of phone, email or website, and a visible Block in the Default Scene. The database also checks that a Published Profile has a name and a Default Scene; the contact-method and visible-Block rules are enforced in code. While Published, edits that would break this are refused, as is hiding or deleting the last visible Default-Scene Block.
- Deleting a Profile is blocked while Cards are connected.
- Limits: 10 Profiles per Account, 5 Scenes per Profile, 20 Blocks per Scene, 5 Forms per Profile.

## Scenes and Blocks

- Every Profile has a protected **Default Scene**. One other Scene may be the **shown** Scene (`active_scene_id`; empty means the Default). Deleting the shown Scene reverts to the Default. A new Scene may start as a copy of another (copies share Form definitions).
- Block types: **About** (text), **Project** (title, description, optional URL), **Link** (kind, label, URL), **Contact** (Save Contact and contact fields), **Booking** (URL), **Form**. Links are https only; non-https link and booking Blocks are dropped at render time. A Block can be hidden and reordered.
- No per-Scene theme and no per-Card Scene override.

## Forms and Inbox

Presets **Connect**, **Project Inquiry**, **Contact**. Fixed fields (name, email, phone, company, message) are hidden, optional or required (name required; email or phone required), plus up to 3 custom questions. A submission is accepted only for a Published Profile with a visible Form Block, is stored first, deduplicated by a per-view client key, then triggers one best-effort notification email to the owner's sign-in address. A failed email leaves the message in the **Inbox**; there is no automatic retry. Opening a message marks it read; deleting needs confirmation. Public endpoint protections: same-origin, per-IP quota, 16 KB cap, honeypot.

## Public card `/c/{token}`

On every request the server reads the Card by token. The page renders only if the Card is a DBC, **Released**, has an owner, is not turned off, has a Profile that is **Published**, and resolves a Scene. Otherwise visitors see the same generic "This Neffi isn't available right now" 404 for every reason (unknown, unclaimed, off, no Profile, Draft, Unpublished, retired). No account or ownership data is revealed.

- The shown Scene's visible Blocks render grouped by role, preserving stored position order within each group ([rendering contract](profile-customization-onboarding.md#6-rendering-contract)). Visitors can follow links, call or email, open booking links, send the Form, and **Save contact** (`/c/{token}/contact` returns a vCard only when the shown Scene has a Contact Block with Save Contact).
- If the signed-in viewer owns the Card, they see the same page plus **Edit** and **Switch scene**; for an unavailable card they get a **Manage this card** link. Other signed-in users see the ordinary visitor view.
- Scene content is cached per `(profile, scene, content_version)`. Card state, routing and publish status are never cached. Pages are `noindex`.
- **First-view intro.** An available page starts with a brief full-screen Neffi logo that fades out over 800 ms. It is server-rendered and animated by CSS only, so the Profile is usable without hydration or JavaScript. It is skipped when `prefers-reduced-motion: reduce` is set, and on later views in the same browser tab via the `sessionStorage` flag `neffi:profile-intro-seen:v1`. The flag holds no personal or secret data; if storage fails, the intro is skipped.
- The **Sharing QR** on the Card page encodes exactly `/c/{token}`. The package activation QR is a different, common QR ([0004](../decisions/0004-two-qr-codes.md)).

## Layouts, appearance and guided setup

[Profile layouts, appearance and guided setup](profile-customization-onboarding.md) ([0013](../decisions/0013-universal-layouts-profile-appearance.md), [0014](../decisions/0014-guided-setup-and-goal.md)) is implemented. Together they:
- add Classic, Editorial and Showcase layouts, Light/Dark mode and dark accent variants;
- group public content by role instead of rendering one list;
- render every link kind with an icon;
- show the short intro;
- replace the three purposes with four stored Goals and a step-by-step guided setup that creates no starter Blocks;
- let Showcase show an optional cover image, separate from the photo/logo, with the accent band as the fallback ([0015](../decisions/0015-showcase-cover-image.md)).

## Failure behavior

Edits are validated on the server; invalid, unsafe or oversize input is rejected. If content changes while a page is being resolved, the page fails closed (404 or re-read).

## Non-goals (current)

Flat profile links (the table is unused), per-Scene themes, per-Card overrides, Scene scheduling, analytics, third-party form sync, customer search indexing, CRM statuses on messages.
