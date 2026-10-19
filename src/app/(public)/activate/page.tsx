import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, ArrowRight, CircleHelp, CircleUser } from "lucide-react";
import { getViewer } from "@/auth/access";
import { NeffiLogo } from "@/components/neffi-logo";
import { SignInForm } from "../sign-in/sign-in-form";
import {
  ClaimForm,
  CodeForm,
  StartOverButton,
  SwitchAccountButton,
} from "./activate-forms";
import { readChallenge } from "./challenge-cookie";

export const metadata: Metadata = {
  title: "Activate your Neffi",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Activate your Neffi",
    description: "Enter your activation code to add your Neffi to your account.",
    images: [{ url: "/images/neffi-activation-hero-desktop.png" }],
  },
};

// Reads the session and the activation cookie, so it renders per request.
export const instant = false;

// Copied from actions.ts MESSAGES: a "use server" file can only export async functions.
const UNAVAILABLE =
  "This code can't be used. Please contact Neffi support for help.";
const UNAVAILABLE_SIGNED_OUT =
  "This code can't be used. If you already added this Neffi, sign in to find it. Otherwise, please contact Neffi support for help.";

function AccountContextRow({ email }: { email: string }) {
  return (
    <div className="flex h-13 w-full items-center gap-3 rounded-[10px] border border-border/70 bg-subtle/40 px-3.5">
      <CircleUser aria-hidden className="size-4.5 shrink-0 text-fg-secondary" />
      <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
        <span className="text-[0.75rem] font-normal leading-tight text-fg-secondary">
          Adding to your account
        </span>
        <span
          className="truncate text-body font-medium text-foreground leading-snug"
          title={email}
        >
          {email}
        </span>
      </div>
    </div>
  );
}

export default async function ActivatePage({ searchParams }: PageProps<"/activate">) {
  const [viewer, challenge, params] = await Promise.all([
    getViewer(),
    readChallenge(),
    searchParams,
  ]);
  const raw = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const notices: Record<string, string> = {
    expired: "For your security, please enter your code again.",
    unavailable: viewer ? UNAVAILABLE : UNAVAILABLE_SIGNED_OUT,
  };
  const notice = raw && Object.hasOwn(notices, raw) ? notices[raw] : undefined;

  let heading: string;
  let description: string;
  let body: ReactNode;

  if (challenge && !viewer) {
    heading = "Code accepted";
    description =
      "Sign in or create your account to add this Neffi. No password needed.";
    body = (
      <div className="mt-5 flex flex-col gap-4 sm:mt-6">
        <SignInForm next="/activate" embedded />
        <StartOverButton />
      </div>
    );
  } else if (challenge && viewer) {
    heading = "Add this Neffi to your account";
    description =
      "Your Neffi is ready. This card will be added to:";
    body = (
      <div className="mt-5 flex flex-col gap-5 sm:mt-6">
        <AccountContextRow email={viewer.email} />
        <div className="flex flex-col gap-3">
          <ClaimForm />
          <SwitchAccountButton />
          <StartOverButton />
        </div>
      </div>
    );
  } else {
    // Heading is always "Activate your Neffi" per design direction
    heading = "Activate your Neffi";
    description =
      "Enter the activation code inside your package to add this card to your account.";
    body = (
      <div className="mt-5 flex flex-col gap-5 sm:mt-6">
        {viewer ? <AccountContextRow email={viewer.email} /> : null}
        <CodeForm />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background md:items-center md:justify-center md:p-6 lg:p-10">
      {/* 1. DEDICATED MOBILE HEADER (compact, solid background, above hero) */}
      <header className="flex h-14 w-full items-center justify-between border-b border-border/60 bg-background px-5 sm:px-6 md:hidden">
        <Link
          href="/"
          aria-label="Neffi home"
          className="inline-flex min-h-11 items-center rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <NeffiLogo aria-hidden className="h-5.5 w-auto text-foreground" />
        </Link>
        {viewer ? (
          <Link
            href="/app"
            className="group inline-flex min-h-11 items-center gap-1.5 text-meta font-medium text-foreground transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span>My Neffi</span>
            <ArrowRight aria-hidden className="size-3.5 text-fg-secondary transition-colors group-hover:text-brand" />
          </Link>
        ) : (
          <Link
            href="/sign-in?next=/activate"
            className="group inline-flex min-h-11 items-center gap-1.5 text-meta font-medium text-foreground transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span>Sign in</span>
            <ArrowRight aria-hidden className="size-3.5 text-fg-secondary transition-colors group-hover:text-brand" />
          </Link>
        )}
      </header>

      {/* 2. MAIN CONTAINER (mobile stacked under header / desktop centered split shell) */}
      <main className="relative flex w-full flex-col bg-background md:grid md:grid-cols-[48%_52%] md:max-w-[1080px] md:min-h-[640px] md:overflow-hidden md:rounded-2xl md:border md:border-border/80 md:bg-card md:shadow-xs">
        {/* HERO REGION (mobile top feature panel with rounded corners / desktop left split panel) */}
        <div className="w-full p-4 pb-0 sm:p-6 sm:pb-0 md:p-0 md:h-full">
          <div className="relative w-full overflow-hidden rounded-2xl border border-border/70 bg-[#FAF9F5] shadow-xs aspect-[4/3] min-h-[250px] max-h-[380px] md:aspect-auto md:h-full md:min-h-[640px] md:max-h-none md:rounded-none md:border-0 md:border-r md:border-border/60 md:shadow-none">
            {/* Desktop Integrated Logo (top-left of hero panel) */}
            <div className="hidden md:block absolute top-7 left-7 z-10 lg:top-9 lg:left-9">
              <Link
                href="/"
                aria-label="Neffi home"
                className="inline-flex min-h-11 items-center rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand"
              >
                <NeffiLogo aria-hidden className="h-6 w-auto text-foreground" />
              </Link>
            </div>

            {/* Responsive Hero Artwork: mobile asset (< 768px) and desktop asset (>= 768px) */}
            <picture className="block h-full w-full">
              <source
                media="(min-width: 768px)"
                srcSet="/images/neffi-activation-hero-desktop.png"
                width={1672}
                height={941}
              />
              <img
                src="/images/neffi-activation-hero-mobile.png"
                alt=""
                width={1024}
                height={1536}
                className="h-full w-full object-cover object-[center_28%] md:object-center select-none pointer-events-none"
              />
            </picture>
          </div>
        </div>

        {/* FORM & ONBOARDING REGION (right panel on desktop) */}
        <div className="relative flex flex-col justify-center px-5 py-7 sm:px-6 sm:py-8 md:px-8 md:py-10 lg:px-14">
          {/* Desktop Top-right text link */}
          <div className="hidden md:flex absolute top-7 right-7 z-10 lg:top-9 lg:right-9">
            {viewer ? (
              <Link
                href="/app"
                className="group inline-flex min-h-11 items-center gap-1.5 text-meta font-medium text-fg-secondary hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span>My Neffi</span>
                <ArrowRight aria-hidden className="size-3.5 text-fg-secondary transition-colors group-hover:text-foreground" />
              </Link>
            ) : (
              <Link
                href="/sign-in?next=/activate"
                className="group inline-flex min-h-11 items-center gap-1.5 text-meta font-medium text-fg-secondary hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span>Sign in</span>
                <ArrowRight aria-hidden className="size-3.5 text-fg-secondary transition-colors group-hover:text-foreground" />
              </Link>
            )}
          </div>

          {/* Form column container */}
          <div className="w-full max-w-[420px] mx-auto flex flex-col">
            {/* Intro heading & supporting text */}
            <div className="flex flex-col items-center text-center gap-2.5 sm:gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem] text-center">
                {heading}
              </h1>
              <p className="text-[0.8125rem] sm:text-[0.84rem] text-fg-secondary leading-normal text-center tracking-[-0.005em]">
                {description}
              </p>
            </div>

            {/* Status notice */}
            {notice ? (
              <div
                role="status"
                className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-border/70 bg-subtle/50 px-3.5 py-2.5 text-meta text-foreground"
              >
                <AlertCircle
                  aria-hidden
                  className="size-4 shrink-0 text-fg-secondary mt-0.5"
                />
                <span>{notice}</span>
              </div>
            ) : null}

            {/* Body content */}
            {body}

            {/* Help UX: compact tertiary row beneath Continue */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-center">
              <CircleHelp aria-hidden className="size-3.5 shrink-0 text-fg-secondary" />
              <span className="text-meta text-fg-secondary">
                Having trouble with your code?
              </span>
              <Link
                href="/support?topic=activation"
                className="inline-flex min-h-11 items-center text-meta font-medium text-foreground transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
              >
                Get activation help
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
