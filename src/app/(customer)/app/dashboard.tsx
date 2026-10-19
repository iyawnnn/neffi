import { ArrowRight, Check, Eye, Nfc, Pencil, Plus, QrCode, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink, CardGlyph, EmptyState, ListPanel, ProfileGlyph, ProfileStatus, Row, RowList, SectionHeader, SectionLink } from "@/components/app-ui";
import { authErrorMessage } from "@/auth/messages";
import { db } from "@/db";
import { cardSummaries, type CardSummary } from "@/modules/cards/manage";
import { getOwnedProfile, ownedProfiles, type OwnedProfile } from "@/modules/profiles/profiles";
import { PUBLISH_GAP_COPY, type PublishGap } from "@/modules/profiles/rules";
import { cn } from "@/lib/utils";

type ProfileRow = Awaited<ReturnType<typeof ownedProfiles>>[number];

const LIST_LIMIT = 4;
const GAP_ORDER: PublishGap[] = ["name", "contact", "content"];
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const profileName = (name: string | null) => name ?? "Untitled profile";

// Data half of Home; the page checks the session first and streams this behind a skeleton.
// Unread messages are surfaced by the header's Inbox bell, which the layout loads.
export async function Dashboard({ accountId, searchParams }: { accountId: string; searchParams: PageProps<"/app">["searchParams"] }) {
  const [params, cards, profiles] = await Promise.all([searchParams, cardSummaries(db, accountId), ownedProfiles(db, accountId)]);
  const waiting = cards.filter((card) => !card.profileId);
  // The profile that most needs attention: a draft first, then a live one.
  const focus = profiles.find((p) => p.status === "draft") ?? profiles.find((p) => p.status === "published") ?? profiles[0];
  const draft = !waiting.length && focus?.status === "draft" ? await getOwnedProfile(db, accountId, focus.id) : null;
  const error = authErrorMessage(first(params.error));
  const added = first(params.added) === "1";
  const onboarding = !cards.length && !profiles.length;
  const connected = cards.length - waiting.length;
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {error || added ? (
        <div className="flex flex-col gap-2">
          {error ? <Notice role="alert">{error}</Notice> : null}
          {added ? <Notice role="status">Your Neffi has been added to your account. Next, you&apos;ll set it up.</Notice> : null}
        </div>
      ) : null}

      {waiting.length ? <SetupCard card={waiting[0]} /> : draft ? <DraftCard profile={draft} cards={cards} /> : focus ? <LiveCard profile={focus} cards={cards} /> : <FirstNeffi />}

      {onboarding ? null : (
        <section aria-labelledby="quick-actions">
          <SectionHeader id="quick-actions" title="Quick actions" />
          {/* One surface: a grouped list on phones, equal cells side by side from md (as many as there are actions).
              Desktop separators are short centered hairlines via the qa-strip class in globals.css. */}
          <ul className="qa-strip divide-y overflow-hidden rounded-panel border bg-background md:grid md:auto-cols-[minmax(0,1fr)] md:grid-flow-col md:divide-y-0">
            <QuickAction href="/activate" icon={Plus} label={cards.length ? "Activate another Neffi" : "Activate a Neffi"} meta="Enter your package code" />
            {focus ? <QuickAction href={`/app/profiles/${focus.id}/preview`} icon={Eye} label="Preview profile" meta={profileName(focus.fullName)} /> : null}
            {cards.length ? <QuickAction href="/app/cards" icon={Nfc} label="Manage cards" meta={connected === cards.length ? plural(connected, "connected card") : `${plural(cards.length, "card")}, ${connected} connected`} /> : null}
          </ul>
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <ListPanel id="your-profiles" title="Your profiles" count={profiles.length} action={profiles.length ? <SectionLink href="/app/profiles">View all</SectionLink> : null}>
          {profiles.length ? (
            <RowList>
              {profiles.slice(0, LIST_LIMIT).map((profile) => <ProfileItem key={profile.id} profile={profile} cards={cards} />)}
            </RowList>
          ) : (
            <EmptyState icon={UserRound} title="No profiles yet" description={waiting.length ? "Set up your Neffi to create your first profile." : "Your profile is created when you set up an activated Neffi."} />
          )}
        </ListPanel>

        <ListPanel id="your-cards" title="Your cards" count={cards.length} action={cards.length ? <SectionLink href="/app/cards">View all</SectionLink> : null}>
          {cards.length ? (
            <RowList>
              {cards.slice(0, LIST_LIMIT).map((card) => <CardItem key={card.id} card={card} />)}
            </RowList>
          ) : (
            <EmptyState
              icon={Nfc}
              title="No cards activated yet"
              description="Activate a Neffi card to connect it to a profile and start sharing."
              action={onboarding ? null : <ButtonLink href="/activate" variant="outline">Activate a Neffi</ButtonLink>}
            />
          )}
        </ListPanel>
      </div>
    </div>
  );
}

function Notice({ role, children }: { role: "alert" | "status"; children: ReactNode }) {
  return <p role={role} className="rounded-panel border bg-background px-4 py-3 text-body">{children}</p>;
}

// The page's working object. From md the actions sit top-right beside the identity; on phones they drop below the
// readiness block (one set of links, placed by the grid). Pass actions secondary-first: the primary is right-most
// on desktop and, through the reversed column, first on phones.
function NextStep({ leading, title, badge, summary, children, actions }: { leading?: ReactNode; title: string; badge?: ReactNode; summary: ReactNode; children?: ReactNode; actions: ReactNode }) {
  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <h2 className="max-w-full truncate text-entity">{title}</h2>
        {badge}
      </div>
      <p className="text-body text-fg-secondary">{summary}</p>
    </div>
  );
  return (
    <section aria-label="Next step" className={cn("grid gap-y-5 rounded-panel border bg-background p-5 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-8 md:gap-y-6 md:p-6", !children && "md:items-center")}>
      {leading ? (
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          {content}
        </div>
      ) : (
        content
      )}
      <div className={cn("order-last flex w-full flex-col-reverse gap-2 md:order-none md:w-auto md:flex-row", children ? "md:items-start" : "md:items-center")}>{actions}</div>
      {children ? <div className="min-w-0 md:col-span-2">{children}</div> : null}
    </section>
  );
}

// A card outline carrying the tap glyph in brand Vermilion: the activation moment, not a logo.
const CardMark = () => (
  <span aria-hidden className="inline-flex h-11 w-16 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-background shadow-[0_2px_6px_-2px_color-mix(in_oklab,var(--foreground)_12%,transparent)]">
    <Nfc className="size-5 text-brand" strokeWidth={2} />
  </span>
);

function FirstNeffi() {
  const steps = ["Activate it with the code in your package", "Set up the profile people will see", "Tap your card to share it"];
  return (
    <NextStep
      leading={<CardMark />}
      title="Activate your first Neffi"
      summary="Add your card to your account, then set up what people see when they tap it."
      actions={<ButtonLink href="/activate" variant="action">Activate a Neffi</ButtonLink>}
    >
      <ol className="grid gap-3 sm:grid-cols-3 sm:gap-6">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-body text-fg-secondary">
            <span aria-hidden className="text-meta tabular-nums text-foreground">{String(i + 1).padStart(2, "0")}</span>
            {step}
          </li>
        ))}
      </ol>
    </NextStep>
  );
}

function SetupCard({ card }: { card: CardSummary }) {
  return (
    <NextStep
      leading={<CardMark />}
      title="Set up your Neffi"
      summary={<>Neffi ending in <span className="text-foreground">{card.suffix}</span> is on your account but isn&apos;t showing a profile yet.</>}
      actions={<ButtonLink href={`/app/setup/${card.id}`} variant="action">Set up this Neffi</ButtonLink>}
    >
      <p className="text-body text-fg-secondary">Choose what it&apos;s for, add your details and publish.</p>
    </NextStep>
  );
}

// The three publish requirements, worded short enough to sit in three equal cells even on phones.
const STEPS: Record<PublishGap, string> = { name: "Your name", contact: "Contact", content: "Content" };
const MOBILE_STEPS: Record<PublishGap, string> = { name: "Name", contact: "Contact", content: "Content" };
const PROGRESS_WIDTH = ["w-0", "w-1/3", "w-2/3", "w-full"];

function DraftCard({ profile, cards }: { profile: OwnedProfile; cards: CardSummary[] }) {
  const done = GAP_ORDER.length - profile.gaps.length;
  const next = profile.gaps[0];
  const fixHref = (gap: PublishGap) => (gap === "content" ? `/app/profiles/${profile.id}/scenes/${profile.defaultSceneId}` : `/app/profiles/${profile.id}/identity`);
  const shownOn = cards.filter((card) => card.profileId === profile.id).length;
  return (
    <NextStep
      title={profileName(profile.fullName)}
      badge={<ProfileStatus status="draft" />}
      summary={next ? PUBLISH_GAP_COPY[next] : `Ready to go live${shownOn ? ` on ${plural(shownOn, "card")}` : ""}.`}
      actions={next ? (
        <>
          <ButtonLink href={`/app/profiles/${profile.id}/publish`} variant="outline">Preview and publish</ButtonLink>
          <ButtonLink href={fixHref(next)} variant="action">Continue setup</ButtonLink>
        </>
      ) : (
        <div className="flex flex-col gap-2 md:contents">
          <ButtonLink href={`/app/profiles/${profile.id}`} variant="outline">Edit profile</ButtonLink>
          <ButtonLink href={`/app/profiles/${profile.id}/publish`} variant="action">Preview and publish</ButtonLink>
        </div>
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-label text-foreground">Profile readiness</span>
        <span className="text-label font-normal tabular-nums text-fg-secondary">{done} of {GAP_ORDER.length} complete</span>
      </div>
      <div role="progressbar" aria-label="Profile readiness" aria-valuemin={0} aria-valuemax={GAP_ORDER.length} aria-valuenow={done} className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-subtle">
        <div className={cn("h-full rounded-full bg-action transition-[width] duration-300 motion-reduce:transition-none", PROGRESS_WIDTH[done])} />
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-2 md:gap-0 md:divide-x md:rounded-lg md:bg-canvas">
        {GAP_ORDER.map((gap) => {
          const missing = profile.gaps.includes(gap);
          const content = (
            <>
              {missing ? (
                <span aria-hidden className="size-4 shrink-0 rounded-full border-[1.5px] border-dashed border-border-strong md:size-5" />
              ) : (
                <span aria-hidden className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-action text-white md:size-5">
                  <Check className="size-2.5 text-white md:size-3" strokeWidth={3} />
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="whitespace-nowrap text-label md:text-body md:font-medium">
                  <span className="md:hidden">{MOBILE_STEPS[gap]}</span>
                  <span className="hidden md:inline">{STEPS[gap]}</span>
                </span>
                <span className={cn("hidden truncate text-meta md:block", missing ? "text-action-text" : "text-fg-secondary")}>{missing ? "Add it now" : "Looks great"}</span>
                <span className="sr-only md:hidden">{missing ? "(missing)" : "(done)"}</span>
              </span>
            </>
          );
          const cell = "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 md:justify-start md:gap-3 md:rounded-none md:px-5";
          return (
            <li key={gap} className="flex min-w-0">
              {missing ? (
                <Link href={fixHref(gap)} className={cn(cell, "group h-11 md:h-16 cursor-pointer border border-dashed border-border-strong text-fg-secondary transition-colors duration-150 hover:text-action-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand md:border-0 md:hover:bg-subtle")}>{content}</Link>
              ) : (
                <span className={cn(cell, "h-11 md:h-16 bg-canvas text-foreground md:bg-transparent")}>{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </NextStep>
  );
}

function LiveCard({ profile, cards }: { profile: ProfileRow; cards: CardSummary[] }) {
  const shownOn = cards.filter((card) => card.profileId === profile.id);
  const live = profile.status === "published";
  return (
    <NextStep
      leading={<ProfileGlyph />}
      title={profileName(profile.fullName)}
      badge={<ProfileStatus status={profile.status} />}
      summary={
        !live
          ? "Unpublished. People who tap your card won't see this profile until you publish it again."
          : shownOn.length
            ? `Live on ${plural(shownOn.length, "card")}. Changes show the next time someone taps.`
            : "Published, but no card shows it yet. Connect a card from Cards."
      }
      actions={
        <div role="group" aria-label="Profile actions" className="flex w-full items-center gap-2 md:w-auto">
          <Link
            href={`/app/profiles/${profile.id}/preview`}
            aria-label="Preview profile"
            title="Preview profile"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-border bg-background text-foreground transition-colors duration-[220ms] hover:border-border-strong hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
          >
            <Eye aria-hidden className="size-4 shrink-0 text-foreground" />
          </Link>
          {live && shownOn[0] ? (
            <Link
              href={`/app/cards/${shownOn[0].id}`}
              aria-label="Share QR code"
              title="Share QR code"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-border bg-background text-foreground transition-colors duration-[220ms] hover:border-border-strong hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
            >
              <QrCode aria-hidden className="size-4 shrink-0 text-foreground" />
            </Link>
          ) : null}
          <ButtonLink
            href={`/app/profiles/${profile.id}`}
            variant="action"
            className="order-first h-11 flex-1 px-4 duration-[220ms] motion-reduce:transition-none md:order-last md:flex-initial md:w-auto"
          >
            <Pencil aria-hidden className="size-4 shrink-0" />
            <span className="truncate">Manage profile</span>
          </ButtonLink>
        </div>
      }
    />
  );
}

// One shortcut: a fixed height and single-line text, so every row (phones) or cell (md+) is identical.
function QuickAction({ href, icon: Icon, label, meta }: { href: string; icon: LucideIcon; label: string; meta: string }) {
  return (
    <li className="min-w-0">
      <Link href={href} className="group flex h-[4.25rem] min-h-11 cursor-pointer items-center gap-3.5 px-4 nav-interact transition-colors hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand md:h-[5.25rem] md:gap-4 md:px-6">
        <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong/70 bg-subtle nav-interact transition-colors group-hover:border-brand/15 group-hover:bg-brand/5">
          <Icon className="size-[1.125rem] text-foreground nav-interact transition-colors group-hover:text-brand" strokeWidth={1.6} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body font-medium">{label}</span>
          <span className="truncate text-meta text-fg-secondary">{meta}</span>
        </span>
        <ArrowRight aria-hidden className="size-4 shrink-0 nav-interact nav-arrow" />
      </Link>
    </li>
  );
}

function ProfileItem({ profile, cards }: { profile: ProfileRow; cards: CardSummary[] }) {
  const shownOn = cards.filter((card) => card.profileId === profile.id).length;
  const connected = shownOn ? plural(shownOn, "connected card") : "No card connected";
  return (
    <Row
      href={`/app/profiles/${profile.id}`}
      leading={<ProfileGlyph />}
      title={profileName(profile.fullName)}
      meta={profile.unread ? `${connected} · ${profile.unread} new` : connected}
      status={<ProfileStatus status={profile.status} />}
    />
  );
}

function CardItem({ card }: { card: CardSummary }) {
  const title = <>Neffi <span aria-hidden className="tracking-[0.12em] text-fg-faint">••••</span><span className="sr-only">ending in</span> {card.suffix}</>;
  return card.profileId ? (
    <Row
      href={`/app/cards/${card.id}`}
      leading={<CardGlyph />}
      title={title}
      meta={`Connected to ${profileName(card.profileName)}`}
      status={card.disabled ? <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-label text-fg-secondary">Turned off</span> : null}
    />
  ) : (
    <Row href={`/app/setup/${card.id}`} leading={<CardGlyph />} title={title} meta="Ready to set up" trailing={<span className="text-meta font-medium text-action-text">Set up</span>} />
  );
}
