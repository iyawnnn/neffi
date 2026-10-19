import { Nfc, Plus } from "lucide-react";
import Image from "next/image";
import { requireAccount } from "@/auth/access";
import { ButtonLink, CardGlyph, EmptyState, PositiveStatus } from "@/components/app-ui";
import { db } from "@/db";
import { cardSummaries } from "@/modules/cards/manage";

export const instant = false;

export default async function CardsPage() {
  const viewer = await requireAccount("/app");
  const cards = await cardSummaries(db, viewer.accountId);

  return (
    <main data-canvas className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-10 md:gap-8 md:px-6 md:pt-12 md:pb-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-title">Your cards</h1>
          <p className="max-w-md text-body text-fg-secondary">Manage your Neffi cards and the profiles they connect to.</p>
        </div>
        <span className="mt-1 shrink-0 rounded-full border bg-background px-2.5 py-1 text-label tabular-nums text-fg-secondary">
          {cards.length} {cards.length === 1 ? "card" : "cards"}
        </span>
      </header>

      <section aria-label="Cards" className="overflow-hidden rounded-panel border bg-background">
        {cards.length ? (
          <ul className="divide-y py-2">
            {cards.map((card) => {
              const name = card.profileName ?? "Untitled profile";
              return (
                <li key={card.id} className="flex min-h-20 cursor-default flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6 md:py-2">
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <CardGlyph />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="truncate text-entity" title={`Neffi ending in ${card.suffix}`}>
                          Neffi <span aria-hidden className="tracking-[0.12em] text-fg-faint">••••</span><span className="sr-only"> ending in</span> {card.suffix}
                        </span>
                        {card.disabled ? (
                          <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-label text-fg-secondary">Turned off</span>
                        ) : !card.profileId ? (
                          <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-label text-fg-secondary shadow-[inset_0_0_0_1px_var(--border-strong)]">Needs setup</span>
                        ) : (
                          <PositiveStatus>Connected</PositiveStatus>
                        )}
                      </span>
                      <span className="text-meta text-fg-secondary">
                        {card.profileId ? `Connected to ${name}` : "Not set up yet"}
                      </span>
                    </span>
                  </div>
                  <div className="flex md:shrink-0">
                    <ButtonLink
                      href={`/app/cards/${card.id}`}
                      variant="outline"
                      aria-label={`Manage card: Neffi ending in ${card.suffix}`}
                      className="h-11 flex-1 px-3 interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none md:h-[42px] md:flex-none"
                    >
                      Manage card
                    </ButtonLink>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Nfc}
            title="No cards yet"
            description="Activate a Neffi card to connect it to a profile and start sharing."
          />
        )}
      </section>

      <section aria-labelledby="activate-card" className="grid items-center gap-2 overflow-hidden rounded-panel border bg-background px-5 py-6 text-center md:px-8 md:py-8">
        <Image src="/neffi-create-profile-cards.png" alt="" width={1448} height={1086} sizes="240px" className="mx-auto -my-2 h-auto w-[240px] max-w-full" />
        <div className="min-w-0">
          <h2 id="activate-card" className="text-[1.375rem] leading-7 font-semibold tracking-[-0.01em] md:text-2xl md:leading-8">
            {cards.length ? "Activate another Neffi" : "Activate your first Neffi"}
          </h2>
          <p className="mx-auto mt-2 max-w-[400px] text-[0.9375rem] leading-[1.375rem] text-fg-secondary">
            {cards.length ? "Add another Neffi card to your account and connect it to a profile." : "Add a Neffi card to your account and connect it to a profile."}
          </p>
          <ButtonLink href="/activate" variant="action" className="mt-5 h-11 w-full gap-2 interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:w-auto">
            <Plus aria-hidden className="size-4" />
            Activate Neffi
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
