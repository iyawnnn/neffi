# Spec: Profiles, Scenes and the public card

For current engineering milestone status, see [the roadmap](../roadmap.md). Related: [0001](../decisions/0001-permanent-card-url.md), [0003](../decisions/0003-profile-scene-model.md), [0004](../decisions/0004-two-qr-codes.md), [0011](../decisions/0011-fresh-card-state-cached-scene-content.md).

## Purpose

Let a non-technical customer publish a useful, action-first page from a phone, and let any visitor reach it with one tap and no account.

## Actors

Customer (Account owner), visitor, and the Card's owner viewing their own public page.

## Profile

- Created only during first-card setup from a claimed DBC (a purpose, then essentials), idempotently for the same card. Purposes are recipes, not stored: **Network**, **Get Clients**, **Show My Work**.
- Holds identity (name, headline, company, bio, phone, email, website, location) and appearance (one of 8 accent colours; an image or logo via Cloudinary). Appearance applies to every Scene.
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

- The shown Scene's visible Blocks render in order. Visitors can follow links, call or email, open booking links, send the Form, and **Save contact** (`/c/{token}/contact` returns a vCard only when the shown Scene has a Contact Block with Save Contact).
- If the signed-in viewer owns the Card, they see the same page plus **Edit** and **Switch scene**; for an unavailable card they get a **Manage this card** link. Other signed-in users see the ordinary visitor view.
- Scene content is cached per `(profile, scene, content_version)`. Card state, routing and publish status are never cached. Pages are `noindex`.
- The **Sharing QR** on the Card page encodes exactly `/c/{token}`. The package activation QR is a different, common QR ([0004](../decisions/0004-two-qr-codes.md)).

## Planned changes

[Profile layouts, appearance and guided setup](profile-customization-onboarding.md) ([0013](../decisions/0013-universal-layouts-profile-appearance.md), [0014](../decisions/0014-guided-setup-and-goal.md)) is planned and not implemented. It will:
- add Classic, Editorial and Showcase layouts, Light/Dark mode and dark accent variants;
- group public content by role instead of rendering one list;
- render every link kind with an icon;
- show the short intro;
- replace the three purposes with four stored Goals and a step-by-step guided setup that creates no starter Blocks;
- let Showcase show an optional cover image, separate from the photo/logo, with the accent band as the fallback ([0015](../decisions/0015-showcase-cover-image.md)).

This spec describes current behavior until those tasks land.

## Failure behavior

Edits are validated on the server; invalid, unsafe or oversize input is rejected. If content changes while a page is being resolved, the page fails closed (404 or re-read).

## Non-goals (current)

Flat profile links (the table is unused), per-Scene themes, per-Card overrides, Scene scheduling, analytics, third-party form sync, customer search indexing, CRM statuses on messages.
