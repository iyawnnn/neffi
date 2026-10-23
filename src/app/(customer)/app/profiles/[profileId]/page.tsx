import { ArrowRight, Eye, Globe, Layers, Mail, Nfc, Palette, Pencil, Settings, Trash2, Type, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { ButtonLink, ProfileStatus, SectionLink } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { getOwnedProfile } from "@/modules/profiles/profiles";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
import { unpublishAction } from "./actions";
import { DeleteProfileDialog, ManageModesDialog } from "./editor-dialogs";
import { PublishButton } from "./profile-forms";

export const instant = false;

export default async function ProfilePage({ params, searchParams }: PageProps<"/app/profiles/[profileId]">) {
  const viewer = await requireAccount("/app");
  const [{ profileId }, query] = await Promise.all([params, searchParams]);
  const profile = await getOwnedProfile(db, viewer.accountId, profileId);
  if (!profile) notFound();

  const name = profile.fullName ?? "Untitled profile";
  const base = `/app/profiles/${profile.id}`;
  const published = (Array.isArray(query.published) ? query.published[0] : query.published) === "1";
  const contacts = [profile.phone, profile.email].filter(Boolean);
  const accent = ACCENTS.find((a) => a.hex === profile.accentColor)?.name;
  const motion = "interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none";

  const shown = profile.scenes.find((s) => s.isShown) ?? profile.scenes.find((s) => s.isDefault) ?? profile.scenes[0];
  const activeModeName = shown?.name ?? "Default mode";

  const layoutName = { classic: "Classic", editorial: "Editorial", showcase: "Showcase" }[profile.layout ?? "classic"];
  const appearanceSummary = `${layoutName} \u00b7 ${profile.colorMode === "dark" ? "Dark" : "Light"}${accent ? ` \u00b7 ${accent} accent` : ""}`;
  const cardsSummary = profile.cards.length
    ? `${profile.cards.length} ${profile.cards.length === 1 ? "connected card" : "connected cards"}`
    : "No connected cards";

  return (
    <main data-canvas className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-10 md:gap-8 md:px-6 md:pt-12 md:pb-12">
      {/* Header */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 max-w-full break-words text-title">{name}</h1>
            <ProfileStatus status={profile.status} />
          </div>
          <p className="mt-2 text-body text-fg-secondary">Edit what people see when they tap your Neffi.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row sm:items-center">
          <ButtonLink
            href={`${base}/preview`}
            variant="outline"
            className={`order-2 gap-2 min-h-11 sm:h-[42px] ${motion} sm:order-1`}
          >
            <Eye aria-hidden className="size-4" />
            Preview
          </ButtonLink>
          <div className="order-1 sm:order-2">
            {profile.status === "published" ? (
              <form action={unpublishAction}>
                <input type="hidden" name="profileId" value={profile.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="touch"
                  className={`w-full min-h-11 sm:w-auto sm:h-[42px] rounded-[10px] ${motion}`}
                >
                  Unpublish
                </Button>
              </form>
            ) : (
              <PublishButton profileId={profile.id} />
            )}
          </div>
        </div>
      </header>

      {published ? <p role="status" className="rounded-panel border bg-background px-4 py-3 text-body">Your Neffi is live.</p> : null}

      {profile.gaps.length && profile.status !== "published" ? (
        <section aria-labelledby="publish-requirements" className="rounded-panel border bg-background p-5">
          <h2 id="publish-requirements" className="text-section font-semibold">Before you publish</h2>
          <ul className="mt-2 list-inside list-disc text-body text-fg-secondary">
            {profile.gaps.map((gap) => <li key={gap}>{PUBLISH_GAP_COPY[gap]}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-x-4">
            <SectionLink href={`${base}/identity`}>Edit details</SectionLink>
            <SectionLink href={`${base}/scenes/${profile.defaultSceneId}`}>Edit profile mode</SectionLink>
          </div>
        </section>
      ) : null}

      {/* Profile mode summary card */}
      <section aria-labelledby="profile-mode-heading" className="overflow-hidden rounded-panel border bg-background">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 border-b p-4 sm:px-5 sm:py-4 md:px-6 md:py-5">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 self-center">
            <Layers aria-hidden className="size-5 shrink-0 text-foreground" />
            <h2 id="profile-mode-heading" className="text-section font-semibold text-foreground">Profile mode</h2>
          </div>
          <p className="col-span-full row-start-2 text-body text-fg-secondary">
            <span className="sm:hidden">Choose what visitors see.</span>
            <span className="hidden sm:inline">Choose what visitors see when they tap your Neffi.</span>
          </p>
          <div className="col-start-2 row-start-1 self-center justify-self-end">
            <ManageModesDialog profile={profile} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 p-5 md:px-6 md:py-5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="truncate text-entity font-semibold text-foreground">
              {activeModeName}
            </span>
            <span className="inline-flex w-fit items-center rounded-md bg-brand/10 px-2 py-0.5 text-label font-medium text-brand select-none cursor-default">
              Currently showing
            </span>
          </div>
          <Link
            href={`${base}/scenes/${shown.id}`}
            className="inline-flex min-h-11 h-10 shrink-0 cursor-pointer items-center self-center gap-1.5 rounded-[10px] border border-border bg-background px-3.5 text-body font-medium text-foreground hover:border-border-strong hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:h-9 sm:rounded-[8px] sm:border-0 sm:bg-transparent sm:px-2.5"
          >
            <Pencil aria-hidden className="size-3.5 text-fg-secondary" />
            Edit
          </Link>
        </div>
      </section>

      {/* Your details summary card */}
      <section aria-labelledby="details-heading" className="overflow-hidden rounded-panel border bg-background">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 border-b p-4 sm:px-5 sm:py-4 md:px-6 md:py-5">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 self-center">
            <UserRound aria-hidden className="size-5 shrink-0 text-foreground" />
            <h2 id="details-heading" className="text-section font-semibold text-foreground">Your details</h2>
          </div>
          <p className="col-span-full row-start-2 text-body text-fg-secondary">
            Shared across all profile modes.
          </p>
          <Link
            href={`${base}/identity`}
            className="col-start-2 row-start-1 inline-flex min-h-11 h-10 cursor-pointer items-center self-center justify-self-end gap-1.5 rounded-[10px] border border-border bg-background px-3.5 text-body font-medium text-foreground hover:border-border-strong hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:h-9"
          >
            <Pencil aria-hidden className="size-3.5 text-fg-secondary" />
            <span className="sm:hidden">Edit</span><span className="hidden sm:inline">Edit profile</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2 md:p-6">
          <div className="flex items-start gap-3.5">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-border bg-canvas text-fg-secondary">
              <UserRound className="size-4" strokeWidth={1.6} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-label font-medium text-fg-secondary">Name</span>
              <span className="text-body font-semibold text-foreground break-words">{profile.fullName ?? "Not set"}</span>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-border bg-canvas text-fg-secondary">
              <Type className="size-4" strokeWidth={1.6} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-label font-medium text-fg-secondary">Headline</span>
              <span className="text-body font-semibold text-foreground break-words">{profile.headline ?? "Not set"}</span>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-border bg-canvas text-fg-secondary">
              <Mail className="size-4" strokeWidth={1.6} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-label font-medium text-fg-secondary">Contact methods</span>
              <span className="text-body font-semibold text-foreground break-words">{contacts.length ? contacts.join(" · ") : "Not set"}</span>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-border bg-canvas text-fg-secondary">
              <Globe className="size-4" strokeWidth={1.6} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-label font-medium text-fg-secondary">Website</span>
              <span className="text-body font-semibold text-foreground break-words">{profile.website ?? "Not set"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Profile Management — Shared full-width surface */}
      <section aria-labelledby="profile-management" className="overflow-hidden rounded-panel border bg-background">
        <div className="flex flex-col gap-1 border-b px-5 py-4 md:px-6 md:py-5">
          <div className="flex items-center gap-2.5">
            <Settings aria-hidden className="size-5 shrink-0 text-foreground" />
            <h2 id="profile-management" className="text-section font-semibold text-foreground">Profile management</h2>
          </div>
          <p className="text-body text-fg-secondary">
            Customize how your profile looks, communicate with visitors, and manage connected cards.
          </p>
        </div>
        <ul className="divide-y">
          <li>
            <Link
              href={`${base}/appearance`}
              className="group flex min-h-11 sm:min-h-[4.75rem] cursor-pointer items-center justify-between gap-4 px-5 py-4 nav-interact transition-colors hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand md:px-6"
            >
              <div className="flex min-w-0 items-center gap-3.5 md:gap-4">
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas nav-interact transition-colors group-hover:bg-subtle">
                  <Palette className="size-[1.125rem] text-foreground" strokeWidth={1.6} />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-entity font-semibold text-foreground">Appearance</span>
                  <span className="truncate text-meta text-fg-secondary">Customize your profile image, accent and profile style.</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden text-meta text-fg-secondary sm:inline">{appearanceSummary}</span>
                <ArrowRight aria-hidden className="size-4 shrink-0 nav-interact nav-arrow" />
              </div>
            </Link>
          </li>
          <li>
            <Link
              href="/app/inbox"
              className="group flex min-h-11 sm:min-h-[4.75rem] cursor-pointer items-center justify-between gap-4 px-5 py-4 nav-interact transition-colors hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand md:px-6"
            >
              <div className="flex min-w-0 items-center gap-3.5 md:gap-4">
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas nav-interact transition-colors group-hover:bg-subtle">
                  <Mail className="size-[1.125rem] text-foreground" strokeWidth={1.6} />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-entity font-semibold text-foreground">Messages</span>
                  <span className="truncate text-meta text-fg-secondary">View messages from people who visit your profile.</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden text-meta text-fg-secondary sm:inline">{profile.unread} unread</span>
                <ArrowRight aria-hidden className="size-4 shrink-0 nav-interact nav-arrow" />
              </div>
            </Link>
          </li>
          <li>
            <Link
              href="/app/cards"
              className="group flex min-h-11 sm:min-h-[4.75rem] cursor-pointer items-center justify-between gap-4 px-5 py-4 nav-interact transition-colors hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand md:px-6"
            >
              <div className="flex min-w-0 items-center gap-3.5 md:gap-4">
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas nav-interact transition-colors group-hover:bg-subtle">
                  <Nfc className="size-[1.125rem] text-foreground" strokeWidth={1.6} />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-entity font-semibold text-foreground">Connected cards</span>
                  <span className="truncate text-meta text-fg-secondary">Manage the Neffi cards that show this profile.</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden text-meta text-fg-secondary sm:inline">{cardsSummary}</span>
                <ArrowRight aria-hidden className="size-4 shrink-0 nav-interact nav-arrow" />
              </div>
            </Link>
          </li>
        </ul>
      </section>

      {/* Danger Zone — Separate full-width section at the bottom */}
      <section aria-labelledby="danger-zone" className="rounded-panel border border-destructive/20 bg-destructive/[0.02] p-5 md:p-6">
        <div className="flex items-center gap-2 text-destructive">
          <Trash2 aria-hidden className="size-5 shrink-0" />
          <h2 id="danger-zone" className="text-section font-semibold">Danger zone</h2>
        </div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-entity font-semibold text-foreground">Delete profile</h3>
            <p className="mt-1 max-w-lg text-body text-fg-secondary">
              {profile.cards.length
                ? "Move the cards showing this profile to another profile before deleting it."
                : "Permanently delete this profile and its content."}
            </p>
          </div>
          <DeleteProfileDialog profileId={profile.id} name={name} cards={profile.cards} cardCount={profile.cards.length} />
        </div>
      </section>
    </main>
  );
}
