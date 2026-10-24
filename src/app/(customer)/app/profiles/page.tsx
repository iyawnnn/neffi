import { Eye, IdCard, Nfc, Plus } from "lucide-react";
import Image from "next/image";
import { requireAccount } from "@/auth/access";
import { ButtonLink, EmptyState, ProfileGlyph, ProfileStatus } from "@/components/app-ui";
import { db } from "@/db";
import { cardSummaries } from "@/modules/cards/manage";
import { ownedProfiles } from "@/modules/profiles/profiles";

export const instant = false;

const statusCopy = { draft: "Not published yet.", published: "Your profile is published.", unpublished: "Not currently published." };

export default async function ProfilesPage() {
  const viewer = await requireAccount("/app");
  const [profiles, cards] = await Promise.all([ownedProfiles(db, viewer.accountId), cardSummaries(db, viewer.accountId)]);
  const waiting = cards.find((card) => !card.profileId);
  const createHref = waiting ? `/app/setup/${waiting.id}?step=purpose` : "/activate";
  return (
    <main data-canvas className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-10 md:gap-8 md:px-6 md:pt-12 md:pb-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-title">Your profiles</h1>
          <p className="max-w-md text-body text-fg-secondary">Manage what people see when someone taps your Neffi.</p>
        </div>
        <span className="mt-1 shrink-0 rounded-full border bg-background px-2.5 py-1 text-label tabular-nums text-fg-secondary">
          {profiles.length} {profiles.length === 1 ? "profile" : "profiles"}
        </span>
      </header>

      <section aria-label="Profiles" className="overflow-hidden rounded-panel border bg-background">
        {profiles.length ? (
          <ul className="divide-y py-2">
            {profiles.map((profile) => {
              const name = profile.fullName ?? "Untitled profile";
              const connected = cards.filter((card) => card.profileId === profile.id).length;
              return (
                <li key={profile.id} className="flex min-h-20 cursor-default flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6 md:py-2">
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <ProfileGlyph />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="truncate text-entity" title={name}>{name}</span>
                        <ProfileStatus status={profile.status} />
                      </span>
                      <span className="text-meta text-fg-secondary">{statusCopy[profile.status]}</span>
                      <span className="flex items-center gap-2 text-meta text-fg-secondary">
                        <Nfc aria-hidden className="size-3.5 shrink-0" strokeWidth={1.6} />
                        {connected ? `${connected} connected ${connected === 1 ? "card" : "cards"}` : "No card connected"}
                      </span>
                    </span>
                  </div>
                  <div className="flex gap-2 md:shrink-0">
                    <ButtonLink href={`/app/profiles/${profile.id}`} variant="outline" aria-label={`Edit profile: ${name}`} className="h-11 flex-1 px-3 interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none md:h-[42px] md:flex-none">Edit profile</ButtonLink>
                    <ButtonLink href={`/app/profiles/${profile.id}/preview`} variant="outline" aria-label={`Preview profile: ${name}`} className="h-11 flex-1 gap-2 px-3 interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none md:h-[42px] md:flex-none">
                      <Eye aria-hidden className="size-4" />
                      Preview
                    </ButtonLink>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={IdCard} title="No profiles yet" description="Create your first profile when you set up a Neffi." />
        )}
      </section>

      <section aria-labelledby="create-profile" className="grid items-center gap-2 overflow-hidden rounded-panel border bg-background px-5 py-6 text-center md:px-8 md:py-8">
        <Image src="/neffi-create-profile.svg" alt="" width={1448} height={1086} sizes="240px" className="mx-auto -my-2 h-auto w-[240px] max-w-full" />
        <div className="min-w-0">
          <h2 id="create-profile" className="text-[1.375rem] leading-7 font-semibold tracking-[-0.01em] md:text-2xl md:leading-8">{profiles.length ? "Create another profile" : "Create your first profile"}</h2>
          <p className="mx-auto mt-2 max-w-[400px] text-[0.9375rem] leading-[1.375rem] text-fg-secondary">Set up different profiles for different needs, like personal and work.</p>
          <ButtonLink href={createHref} variant="action" className="mt-5 h-11 w-full gap-2 interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:w-auto">
            <Plus aria-hidden className="size-4" />
            {profiles.length ? "Create another profile" : "Create profile"}
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
