import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlignLeft,
  ArrowRight,
  BriefcaseBusiness,
  FolderOpen,
  Link as LinkIcon,
  Mail,
  Phone,
  UserRound,
  Users,
} from "lucide-react";
import { ButtonLink } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type Purpose } from "@/modules/profiles/purpose-options";

import { GOALS, NO_GOAL } from "@/modules/profiles/goals";
import { SetupProgress } from "@/components/setup-header";
import { nextStep, SKIPPABLE_STEPS, STEP_TITLES, type SetupStep } from "./setup-steps";

const options = {
  network: { label: "Network", description: "Share your details and make it easy to stay connected.", icon: Users, linkPlaceholder: "linkedin.com/in/yourname" },
  get_clients: { label: "Get clients", description: "Show what you offer and give people an easy way to reach you.", icon: BriefcaseBusiness, linkPlaceholder: "cal.com/yourname" },
  show_my_work: { label: "Show my work", description: "Put your projects and portfolio front and center.", icon: FolderOpen, linkPlaceholder: "yourportfolio.com" },
} satisfies Record<Purpose, { label: string; description: string; icon: typeof Users; linkPlaceholder: string }>;

export function SetupView({ suffix, step, children, backHref, preview }: {
  suffix: string; step?: SetupStep; children?: ReactNode; backHref?: string; preview?: ReactNode;
}) {
  return (
    <main data-setup className="w-full flex-1">
      <div className="mx-auto w-full max-w-[528px] px-4 pt-5 pb-12 sm:px-6 sm:pt-8 md:pb-16">
        <SetupProgress step={step} backHref={backHref} preview={preview} />
        <p className="mt-5 text-meta text-fg-secondary">Card ending in {suffix}</p>
        {step && <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">{STEP_TITLES[step]}</h1>}
        <div className="mt-5 flex flex-col gap-4 sm:mt-6">{children}</div>
      </div>
    </main>
  );
}

export function GoalFields({ goal, disabled = false }: { goal?: string | null; disabled?: boolean }) {
  return (
    <>
      <p className="text-body text-fg-secondary">A few simple steps, then you&apos;re ready to share.</p>
      <fieldset className="flex min-w-0 flex-col gap-2.5">
        <legend className="mb-3 text-body font-medium">What will you use Neffi for?</legend>
        {[...Object.entries(GOALS), ["", NO_GOAL] as const].map(([value, option]) => (
          <label key={value} className="flex min-h-[76px] cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand/[0.03] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
            <input type="radio" name="goal" value={value} required defaultChecked={goal !== undefined && (goal ?? "") === value} className="size-4 shrink-0 accent-brand" />
            <span className="min-w-0"><span className="block text-body font-semibold">{option.label}</span><span className="mt-1 block text-meta text-fg-secondary">{option.helper}</span></span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" variant="action" size="touch" className="h-12 w-full" disabled={disabled}>Continue <ArrowRight aria-hidden className="size-4" /></Button>
    </>
  );
}

export function SetupPlaceholder({ step, profileId, sceneId }: { step: SetupStep; profileId: string; sceneId: string }) {
  const next = nextStep(step);
  const optional = SKIPPABLE_STEPS.includes(step);
  return (
    <>
      <p className="text-body text-fg-secondary">This step&apos;s editor is coming in the next setup tasks. Your saved profile is unchanged.</p>
      {(step === "you" || step === "contact") && <ButtonLink href={`/app/profiles/${profileId}/identity`} variant="outline" className="w-full">Edit your details</ButtonLink>}
      {step === "contact" && <ButtonLink href={`/app/profiles/${profileId}/scenes/${sceneId}`} variant="outline" className="w-full">Edit profile content</ButtonLink>}
      {!optional && next && step !== "review" && step !== "done" && <Button variant="action" size="touch" className="h-12 w-full" disabled>Continue</Button>}
      {optional && next && <Link href={`?step=${next}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 font-medium focus-visible:outline-2 focus-visible:outline-brand">Skip for now</Link>}
    </>
  );
}

const inputFieldClass =
  "h-12 w-full rounded-xl border-0 bg-transparent pl-10 pr-3.5 text-body text-foreground placeholder:text-fg-faint focus-visible:outline-none focus-visible:ring-0 caret-brand";
const textareaFieldClass =
  "h-[100px] min-h-[100px] w-full resize-none rounded-xl border-0 bg-transparent pl-10 pr-3.5 py-3 text-body text-foreground placeholder:text-fg-faint focus-visible:outline-none focus-visible:ring-0 caret-brand";
const labelClass = "flex flex-col gap-1.5 text-body font-medium text-foreground";

function FieldShell({
  icon: Icon,
  textarea = false,
  invalid = false,
  children,
}: {
  icon: typeof Users;
  textarea?: boolean;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative flex rounded-xl border border-border bg-background transition-[border-color,box-shadow] duration-[220ms]",
        textarea ? "items-start" : "h-12 items-center",
        "focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/20",
        invalid && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20"
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-3.5 size-4 text-fg-secondary transition-colors duration-[220ms] group-focus-within:text-brand",
          textarea ? "top-3.5" : "top-1/2 -translate-y-1/2",
          invalid && "text-destructive group-focus-within:text-destructive"
        )}
        strokeWidth={1.75}
      />
      {children}
    </div>
  );
}

export function EssentialsFields({ purpose, linkLabel, defaultEmail, state, disabled }: {
  purpose: Purpose;
  linkLabel: string;
  defaultEmail: string;
  state?: { error?: string; fields?: string[] };
  disabled?: boolean;
}) {
  const invalid = (name: string) => state?.fields?.includes(name) || undefined;
  return (
    <>
      <label className={labelClass}>
        Full name
        <FieldShell icon={UserRound} invalid={Boolean(invalid("fullName"))}>
          <Input className={inputFieldClass} name="fullName" placeholder="Juan Dela Cruz" required autoComplete="name" maxLength={80} aria-invalid={invalid("fullName")} />
        </FieldShell>
      </label>
      <label className={labelClass}>
        Role or headline
        <FieldShell icon={BriefcaseBusiness} invalid={Boolean(invalid("headline"))}>
          <Input className={inputFieldClass} name="headline" placeholder="Web Developer" maxLength={80} aria-invalid={invalid("headline")} />
        </FieldShell>
      </label>
      <label className={labelClass}>
        Short intro
        <FieldShell icon={AlignLeft} textarea invalid={Boolean(invalid("bio"))}>
          <Textarea className={textareaFieldClass} name="bio" placeholder="I build simple digital experiences for businesses and teams." maxLength={300} aria-invalid={invalid("bio")} />
        </FieldShell>
      </label>
      <label className={labelClass}>
        Email
        <FieldShell icon={Mail} invalid={Boolean(invalid("email"))}>
          <Input className={inputFieldClass} name="email" type="email" placeholder="you@example.com" defaultValue={defaultEmail} autoComplete="email" aria-invalid={invalid("email")} />
        </FieldShell>
      </label>
      <label className={labelClass}>
        Phone (optional)
        <FieldShell icon={Phone} invalid={Boolean(invalid("phone"))}>
          <Input className={inputFieldClass} name="phone" type="tel" placeholder="09XX XXX XXXX" autoComplete="tel" aria-invalid={invalid("phone")} />
        </FieldShell>
      </label>
      <label className={labelClass}>
        {linkLabel}
        <FieldShell icon={LinkIcon} invalid={Boolean(invalid("link"))}>
          <Input className={inputFieldClass} name="link" placeholder={options[purpose].linkPlaceholder} inputMode="url" aria-invalid={invalid("link")} />
        </FieldShell>
      </label>
      {state?.error ? <p role="alert" className="text-meta text-destructive">{state.error}</p> : null}
      <div className="mt-1 flex flex-col gap-2.5 sm:mt-1.5">
        <Button type="submit" variant="action" size="touch" className="h-12 w-full gap-2 rounded-xl text-body font-semibold interact disabled:bg-subtle disabled:text-fg-secondary disabled:opacity-100" disabled={disabled}>
          Create my Neffi <ArrowRight aria-hidden className="size-4 motion-safe:transition-transform motion-safe:duration-[220ms] motion-safe:group-hover/button:-rotate-45 motion-safe:group-focus-visible/button:-rotate-45" />
        </Button>
        <p className="text-center text-meta text-fg-secondary">You can change everything later.</p>
      </div>
    </>
  );
}
