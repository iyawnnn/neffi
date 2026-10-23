import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CreditCard, KeyRound, LifeBuoy, LogIn, Mail } from "lucide-react";
import { z } from "zod";
import { getViewer } from "@/auth/access";
import { categories } from "@/modules/support/domain";
import { SupportForm } from "./support-form";

export const metadata: Metadata = {
  title: "Neffi support",
  robots: { index: false, follow: false },
};

export const instant = false;

const SUPPORT_TOPICS = [
  {
    icon: KeyRound,
    title: "Activation issues",
    description: "Get help with lost or missing activation codes.",
  },
  {
    icon: LogIn,
    title: "Account access",
    description: "Trouble signing in or getting back to your account.",
  },
  {
    icon: CreditCard,
    title: "Card or profile problem",
    description: "Issues with your card, profile, or account details.",
  },
] as const;

function RecoverySection({ className }: { className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-body font-semibold text-foreground">
        Need help with your sign-in email?
      </h2>
      <div className="mt-3.5 flex flex-col gap-3.5 sm:gap-4">
        {/* OPTION 1 */}
        <div className="flex items-start gap-3">
          <Mail
            aria-hidden
            className="size-4 shrink-0 mt-0.5 text-fg-secondary"
          />
          <div className="flex flex-col">
            <h3 className="text-meta font-medium text-foreground">
              Still have access to your current email?
            </h3>
            <p className="hidden sm:block mt-0.5 text-meta text-fg-secondary leading-normal">
              Sign in first, then update your sign-in email from Account settings.
            </p>
            <Link
              href="/sign-in?next=/app/account"
              className="group mt-0.5 inline-flex min-h-11 items-center gap-1.5 text-meta font-medium text-brand transition-colors duration-[220ms] focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span className="nav-interact transition-colors group-hover:text-brand">
                Sign in and change email
              </span>
              <ArrowRight
                aria-hidden
                className="size-3.5 shrink-0 nav-interact nav-arrow"
              />
            </Link>
          </div>
        </div>

        {/* OPTION 2 */}
        <div className="flex items-start gap-3">
          <LifeBuoy
            aria-hidden
            className="size-4 shrink-0 mt-0.5 text-fg-secondary"
          />
          <div className="flex flex-col">
            <h3 className="text-meta font-medium text-foreground">
              Lost access to your current email?
            </h3>
            <p className="hidden sm:block mt-0.5 text-meta text-fg-secondary leading-normal">
              Contact support and we’ll help verify your account.
            </p>
            <Link
              href="/support?topic=recovery#support-request"
              className="group mt-0.5 inline-flex min-h-11 items-center gap-1.5 text-meta font-medium text-brand transition-colors duration-[220ms] focus-visible:outline-2 focus-visible:outline-brand"
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
        </div>
      </div>

      {/* BOTTOM PATH */}
      <div className="mt-3.5 border-t border-border/60 pt-2.5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-meta">
          <span className="text-fg-secondary">
            Already have a recovery code?
          </span>
          <Link
            href="/support/recover"
            className="group inline-flex min-h-11 items-center gap-1.5 font-medium text-foreground transition-colors duration-[220ms] hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="nav-interact transition-colors group-hover:text-brand">
              Complete recovery
            </span>
            <ArrowRight
              aria-hidden
              className="size-3.5 shrink-0 nav-interact nav-arrow"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}

async function RequestForm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewer();
  const params = await searchParams;
  const topic =
    typeof params.topic === "string" && Object.hasOwn(categories, params.topic)
      ? (params.topic as keyof typeof categories)
      : "other";
  const cardId =
    typeof params.cardId === "string" && z.uuid().safeParse(params.cardId).success
      ? params.cardId
      : undefined;
  return (
    <SupportForm
      email={viewer?.email}
      clientKey={crypto.randomUUID()}
      topic={topic}
      cardId={cardId}
    />
  );
}

export default async function SupportPage({
  searchParams,
}: PageProps<"/support">) {
  const viewer = await getViewer();

  return (
    <div className="flex flex-col bg-canvas">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col px-4 pt-4 sm:px-6 sm:pt-6 md:pt-8 pb-10 sm:pb-12 md:pb-16 gap-5 sm:gap-6 md:gap-7">

        {/* Main Content Area */}
        <main className="w-full">
          {/* Main split shell on desktop, streamlined stack on mobile */}
          <div id="account-recovery" className="w-full overflow-hidden rounded-none border-0 bg-transparent md:rounded-[20px] md:border md:border-border/80 md:bg-background md:shadow-xs md:grid md:grid-cols-[40%_60%]">
            {/* LEFT CONTEXT PANEL */}
            <div className="flex flex-col justify-between p-0 md:border-r md:border-border/70 md:bg-[#FAF9F5] md:p-7 lg:p-9">
              {/* Top intro */}
              <div>
                <span className="text-[0.75rem] font-semibold tracking-wider text-fg-secondary uppercase">
                  NEFFI SUPPORT
                </span>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                  Need help?
                </h1>
                <p className="mt-1.5 text-body text-fg-secondary leading-normal">
                  Tell us what happened and we’ll help you get back on track.
                </p>

                <Link href={viewer ? "/app" : "/sign-in"} className="mt-3 inline-flex min-h-11 items-center rounded-md text-meta font-medium text-foreground hover:text-action-text focus-visible:outline-2 focus-visible:outline-brand">
                  {viewer ? "My Neffi" : "Sign in"}
                </Link>

                {/* Middle Support Topics (desktop only) */}
                <div className="hidden md:flex flex-col gap-4 mt-6">
                  {SUPPORT_TOPICS.map((topic) => {
                    const Icon = topic.icon;
                    return (
                      <div key={topic.title} className="flex items-start gap-3">
                        <Icon
                          aria-hidden
                          className="size-4 shrink-0 mt-0.5 text-fg-secondary"
                        />
                        <div className="flex flex-col">
                          <span className="text-body font-medium text-foreground">
                            {topic.title}
                          </span>
                          <span className="text-meta text-fg-secondary leading-normal">
                            {topic.description}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Recovery Area (desktop only, anchored to bottom to avoid dead space) */}
              <RecoverySection className="hidden md:block mt-6 border-t border-border/70 pt-5" />
            </div>

            {/* RIGHT SUPPORT FORM PANEL */}
            <div id="support-request" className="mt-5 rounded-2xl border border-border/80 bg-background p-5 sm:p-6 shadow-xs md:mt-0 md:rounded-none md:border-0 md:p-7 lg:p-9 md:shadow-none flex flex-col justify-center">
              <Suspense
                fallback={
                  <div className="flex flex-col gap-4 py-8">
                    <p className="text-meta text-fg-secondary">
                      Loading support form…
                    </p>
                  </div>
                }
              >
                <RequestForm searchParams={searchParams} />
              </Suspense>
            </div>
          </div>

          {/* Recovery section on mobile (rendered below the form card) */}
          <div className="mt-6 md:hidden">
            <RecoverySection className="rounded-xl border border-border/70 bg-subtle/40 p-4 sm:p-5" />
          </div>
        </main>
      </div>
    </div>
  );
}
