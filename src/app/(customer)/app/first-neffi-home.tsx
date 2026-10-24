import { Nfc, Plus, UserRound } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { ButtonLink, EmptyState, ListPanel } from "@/components/app-ui";

export function FirstNeffiHome({ error, added }: { error?: ReactNode; added?: boolean }) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* 1. Compact Editorial Welcome / Hero */}
      <header className="relative overflow-hidden rounded-panel border border-border/60 bg-canvas">
        <div className="relative z-10 flex max-w-[62%] flex-col gap-1.5 px-5 py-6 sm:max-w-[460px] md:gap-2 md:px-8 md:py-8">
          <h1 className="text-title font-semibold tracking-tight text-foreground">Your Neffi</h1>
          <p className="max-w-[380px] text-body text-fg-secondary">
            Activate your card, build your profile and you&apos;re ready to share.
          </p>
        </div>
        {/* The transparent artwork keeps the product crisp against the hero canvas. */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-[38%] [mask-image:linear-gradient(to_right,transparent,black_24%)] sm:w-[42%] md:w-[46%] md:[mask-image:none]"
        >
          <Image
            src="/neffi-dashboard-hero.svg"
            alt=""
            fill
            priority
            className="object-cover object-[80%_45%] md:object-right"
          />
        </div>
      </header>

      {error || added ? (
        <div className="flex flex-col gap-2">
          {error ? <Notice role="alert">{error}</Notice> : null}
          {added ? <Notice role="status">Your Neffi has been added to your account. Next, you&apos;ll set it up.</Notice> : null}
        </div>
      ) : null}

      {/* 2. Primary Activation Journey Surface */}
      <section aria-label="Get your Neffi ready" className="rounded-panel border border-border/80 bg-background p-5 sm:p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-entity font-semibold text-foreground md:text-[1.0625rem] md:leading-snug">
              Get your Neffi ready
            </h2>
            <p className="text-body text-fg-secondary">
              Activate your card, set up your profile, then you&apos;re ready to tap and share.
            </p>
          </div>
          <div className="shrink-0">
            <ButtonLink href="/activate" variant="action" className="w-full gap-2 sm:w-auto">
              <Plus aria-hidden className="size-4" />
              Activate my Neffi
            </ButtonLink>
          </div>
        </div>

        <div className="mt-6 border-t border-border/50 pt-6 md:mt-8 md:pt-7">
          <OnboardingJourney />
        </div>
      </section>

      {/* 3. Subdued Secondary Empty State Panels: Profiles & Cards */}
      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <ListPanel id="your-profiles" title="Your profiles">
          <EmptyState
            icon={UserRound}
            title="No profiles yet"
            description="Your profile is created when you set up an activated Neffi."
            className="py-5 sm:py-6"
          />
        </ListPanel>

        <ListPanel id="your-cards" title="Your cards">
          <EmptyState
            icon={Nfc}
            title="No cards activated yet"
            description="Activate a Neffi card to connect it to a profile and start sharing."
            className="py-5 sm:py-6"
          />
        </ListPanel>
      </div>
    </div>
  );
}

export function OnboardingJourney() {
  return (
    <div className="flex flex-col gap-3">
      {/* 3-stage progress line & nodes */}
      <div className="relative">
        {/* Hairline connecting line running between nodes */}
        <div
          aria-hidden
          className="absolute top-[10px] right-2.5 left-2.5 h-[1.5px] -translate-y-1/2 bg-border-strong/60"
        />

        <ol aria-label="Onboarding stages" className="relative grid grid-cols-3">
          {/* Stage 1: Activate (Current / Active) */}
          <li className="flex flex-col items-start text-left" aria-current="step">
            <span className="relative z-10 flex size-5 items-center justify-center bg-background pr-1">
              <span className="size-2.5 rounded-full bg-action ring-4 ring-brand/15" />
            </span>
            <span className="mt-2 text-meta font-semibold text-foreground">
              <span className="sr-only">Current stage: </span>Activate
            </span>
            <span className="mt-0.5 hidden text-meta text-fg-secondary sm:inline">
              Use the code inside your package.
            </span>
          </li>

          {/* Stage 2: Set up (Upcoming) */}
          <li className="flex flex-col items-center text-center">
            <span className="relative z-10 flex size-5 items-center justify-center bg-background px-1">
              <span className="size-2 rounded-full border-[1.5px] border-border-strong bg-background" />
            </span>
            <span className="mt-2 text-meta font-medium text-fg-secondary">
              <span className="sr-only">Upcoming stage: </span>Set up
            </span>
            <span className="mt-0.5 hidden text-meta text-fg-faint sm:inline">
              Add your details, links and appearance.
            </span>
          </li>

          {/* Stage 3: Ready (Upcoming) */}
          <li className="flex flex-col items-end text-right">
            <span className="relative z-10 flex size-5 items-center justify-center bg-background pl-1">
              <span className="size-2 rounded-full border-[1.5px] border-border-strong bg-background" />
            </span>
            <span className="mt-2 text-meta font-medium text-fg-secondary">
              <span className="sr-only">Upcoming stage: </span>Ready
            </span>
            <span className="mt-0.5 hidden text-meta text-fg-faint sm:inline">
              Tap your Neffi and share.
            </span>
          </li>
        </ol>
      </div>

      {/* Active step explanation below on phones (sm:hidden) */}
      <p className="mt-1 text-meta text-fg-secondary sm:hidden">
        <span className="font-medium text-foreground">Current step:</span> Use the code inside your package.
      </p>
    </div>
  );
}

function Notice({ role, children }: { role: "alert" | "status"; children: ReactNode }) {
  return (
    <p role={role} className="rounded-panel border bg-background px-4 py-3 text-body">
      {children}
    </p>
  );
}
