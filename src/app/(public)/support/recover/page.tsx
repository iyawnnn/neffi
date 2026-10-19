import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Shield } from "lucide-react";
import { NeffiLogo } from "@/components/neffi-logo";
import { cn } from "@/lib/utils";
import { RECOVERY_INSTRUCTION } from "@/modules/support/domain";
import { RecoveryForm } from "./recovery-form";

export const metadata: Metadata = {
  title: "Complete Neffi recovery",
  robots: { index: false, follow: false },
};

export const instant = false;

const RECOVERY_STEPS = [
  {
    step: "01",
    title: "Verified by support",
    description: "Your recovery request has been approved.",
  },
  {
    step: "02",
    title: "Enter your recovery details",
    description: "Use the new email and code sent by Neffi support.",
  },
  {
    step: "03",
    title: "Access your account",
    description: "After recovery, sign in using your new email.",
  },
] as const;

function RecoveryProgress() {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      {RECOVERY_STEPS.map((item) => (
        <div
          key={item.step}
          className="flex items-start gap-3.5 sm:gap-4"
        >
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-brand/25 bg-brand/[0.08] font-mono text-xs font-semibold tracking-tight text-brand"
          >
            {item.step}
          </div>
          <div className="flex flex-col pt-1">
            <span className="text-body font-medium text-foreground">
              {item.title}
            </span>
            <span className="mt-1 text-meta text-fg-secondary leading-normal">
              {item.description}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SecurityGuidance({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-subtle text-fg-secondary mt-0.5">
        <Shield aria-hidden className="size-4 shrink-0" />
      </div>
      <div className="flex flex-col">
        <h2 className="text-body font-semibold text-foreground">
          Don’t sign in with your new email yet
        </h2>
        <p className="mt-1 text-meta text-fg-secondary leading-normal">
          {RECOVERY_INSTRUCTION}
        </p>
      </div>
    </div>
  );
}

function ContactSupportLink() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-center text-meta">
      <span className="text-fg-secondary">
        Didn’t receive a recovery code?
      </span>
      <Link
        href="/support"
        className="group inline-flex min-h-11 items-center gap-1.5 font-medium text-brand transition-colors duration-[220ms] focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="nav-interact transition-colors group-hover:text-brand">
          Contact support
        </span>
        <ArrowRight
          aria-hidden
          className="size-3.5 shrink-0 nav-interact nav-arrow"
        />
      </Link>
    </div>
  );
}

export default async function RecoveryPage() {
  await connection();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Shared-width container ensures exact pixel-perfect alignment between header and main shell */}
      <div className="mx-auto flex w-full max-w-[1040px] flex-col px-4 pt-4 sm:px-6 sm:pt-6 md:pt-8 pb-10 sm:pb-12 md:pb-16 gap-5 sm:gap-6 md:gap-7">
        {/* Floating Public Header */}
        <header className="w-full">
          <div className="flex h-14 sm:h-15 w-full items-center justify-between rounded-[16px] border border-border/80 bg-background px-4 sm:px-6 shadow-xs transition-[border-color,box-shadow] duration-200">
            <Link
              href="/"
              aria-label="Neffi home"
              className="inline-flex min-h-11 items-center rounded-md transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <NeffiLogo aria-hidden className="h-5.5 sm:h-6 w-auto text-foreground" />
            </Link>
            <Link
              href="/support"
              className="group inline-flex min-h-11 items-center gap-1.5 text-meta font-medium text-foreground transition-colors duration-[220ms] hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span className="nav-interact transition-colors group-hover:text-brand">
                Support
              </span>
              <ArrowRight
                aria-hidden
                className="size-3.5 shrink-0 nav-interact nav-arrow"
              />
            </Link>
          </div>
        </header>

        {/* Mobile Intro Header (< md only) */}
        <div className="flex md:hidden flex-col text-left">
          <span className="text-[0.75rem] font-semibold tracking-wider text-fg-secondary uppercase">
            ACCOUNT RECOVERY
          </span>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
            Recover your account
          </h1>
          <p className="mt-2 text-body text-fg-secondary leading-normal">
            Your recovery request was approved. Use the new email and recovery code sent by Neffi support to finish.
          </p>
        </div>

        {/* Main Content Area */}
        <main className="w-full">
          {/* Main split shell on desktop, streamlined stack on mobile */}
          <div className="w-full overflow-hidden rounded-none border-0 bg-transparent md:rounded-[20px] md:border md:border-border/80 md:bg-background md:shadow-xs md:grid md:grid-cols-[42%_58%]">
            {/* LEFT RECOVERY CONTEXT PANEL (Desktop only) */}
            <div className="hidden md:flex flex-col justify-between border-r border-border/70 bg-[#FAF9F5] p-8 lg:p-10">
              <div>
                <span className="text-[0.75rem] font-semibold tracking-wider text-fg-secondary uppercase">
                  ACCOUNT RECOVERY
                </span>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                  Recover your account
                </h1>
                <p className="mt-2.5 text-body text-fg-secondary leading-normal max-w-[440px]">
                  Your recovery request was approved. Use the new email and recovery code sent by Neffi support to finish.
                </p>

                {/* Recovery 3-step progression */}
                <div className="mt-8">
                  <RecoveryProgress />
                </div>
              </div>

              {/* Security Guidance (anchored to bottom of left panel) */}
              <div className="mt-8 border-t border-border/70 pt-6">
                <SecurityGuidance />
              </div>
            </div>

            {/* RIGHT RECOVERY FORM PANEL */}
            <div className="rounded-2xl border border-border/80 bg-background p-5 sm:p-6 shadow-xs md:rounded-none md:border-0 md:p-8 lg:p-12 md:shadow-none flex flex-col justify-center">
              <div className="w-full max-w-[420px] mx-auto flex flex-col">
                <div className="flex flex-col text-left">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                    Complete recovery
                  </h2>
                  <p className="mt-2 text-body text-fg-secondary leading-normal">
                    Enter the new email and recovery code sent after Neffi support approved your request.
                  </p>
                </div>

                <div className="mt-6 sm:mt-7">
                  <RecoveryForm />
                </div>

                {/* Desktop Support Link inside form column */}
                <div className="hidden md:flex mt-7 justify-center">
                  <ContactSupportLink />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Security Guidance (below the form card) */}
          <div className="mt-5 md:hidden">
            <div className="rounded-xl border border-border/70 bg-subtle/40 p-4 sm:p-5">
              <SecurityGuidance />
            </div>
          </div>

          {/* Mobile Support Link */}
          <div className="mt-6 flex md:hidden justify-center">
            <ContactSupportLink />
          </div>
        </main>
      </div>
    </div>
  );
}
