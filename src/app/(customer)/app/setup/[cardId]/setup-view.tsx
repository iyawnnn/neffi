import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  FolderOpen,
  Link as LinkIcon,
  Mail,
  Phone,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isPurpose, type Purpose } from "@/modules/profiles/starters";

const options = {
  network: { label: "Network", description: "Share your details and make it easy to stay connected.", icon: Users, linkPlaceholder: "linkedin.com/in/yourname" },
  get_clients: { label: "Get clients", description: "Show what you offer and give people an easy way to reach you.", icon: BriefcaseBusiness, linkPlaceholder: "cal.com/yourname" },
  show_my_work: { label: "Show my work", description: "Put your projects and portfolio front and center.", icon: FolderOpen, linkPlaceholder: "yourportfolio.com" },
} satisfies Record<Purpose, { label: string; description: string; icon: typeof Users; linkPlaceholder: string }>;

export function SetupView({ suffix, purpose, children }: { suffix: string; purpose?: string; children?: ReactNode }) {
  const essentials = isPurpose(purpose);
  const choosingProfile = !essentials && !!children;
  return (
    <main data-setup className="w-full flex-1">
      <div className="mx-auto flex w-full max-w-[440px] flex-col px-4 pt-4 pb-10 sm:px-6 sm:pt-5 sm:pb-12 md:max-w-[1080px] md:pt-6 md:pb-14">
        <div className="mx-auto flex w-full max-w-[440px] flex-col">
          {essentials && (
            <div className="mb-3 sm:mb-3.5">
              <Link
                href="?step=purpose"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-meta font-medium text-fg-secondary transition-colors duration-[220ms] hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
              >
                <ArrowLeft aria-hidden className="size-3.5" />Back
              </Link>
            </div>
          )}
          {!choosingProfile && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-meta text-fg-secondary">
                <p className="font-medium text-fg-secondary">Step {essentials ? "2" : "1"} of 2</p>
                <p className="text-label text-fg-faint sm:text-meta">Card ending in {suffix}</p>
              </div>
              <div
                role="progressbar"
                aria-label="Setup progress"
                aria-valuemin={0}
                aria-valuemax={2}
                aria-valuenow={essentials ? 2 : 1}
                className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-border/60"
              >
                <div className={essentials ? "h-full w-full rounded-full bg-brand" : "h-full w-1/2 rounded-full bg-brand"} />
              </div>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:mt-6 sm:text-[1.75rem]">
                {essentials ? "Make it yours" : "Choose your starting point"}
              </h1>
              <p className="mt-2 text-[0.8125rem] text-fg-secondary leading-normal sm:text-body sm:leading-relaxed">
                {essentials
                  ? "Add the details people should see first. You can edit everything later."
                  : "Choose what you want your Neffi to focus on first. You can change this later."}
              </p>
            </>
          )}
          {essentials ? (
            <div className="mt-5 sm:mt-6">{children}</div>
          ) : children ? (
            <div className="flex flex-col gap-4 sm:gap-[18px]">
              <p className="text-label text-fg-faint sm:text-meta">Card ending in {suffix}</p>
              {children}
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:gap-3">
              {Object.entries(options).map(([key, { label, description, icon: Icon }]) => (
                <Link
                  key={key}
                  href={`?purpose=${key}`}
                  className="group flex min-h-[86px] items-center gap-3.5 rounded-xl border border-border bg-background px-4 py-3.5 interact transition-[background-color,border-color] hover:border-border-strong hover:bg-brand/[0.03] focus-visible:border-brand focus-visible:bg-brand/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-[88px] sm:gap-4 sm:px-5 sm:py-4"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/[0.05] text-action-text">
                    <Icon aria-hidden className="size-4" strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold leading-snug">{label}</span>
                    <span className="mt-0.5 block text-meta leading-normal text-fg-secondary sm:text-body sm:leading-relaxed">{description}</span>
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 nav-interact nav-arrow group-focus-visible:text-brand motion-safe:group-focus-visible:-rotate-45" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
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
