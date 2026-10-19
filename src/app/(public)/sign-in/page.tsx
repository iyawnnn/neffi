import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { getViewer } from "@/auth/access";
import { authErrorMessage } from "@/auth/messages";
import { safeNext } from "@/auth/policy";
import { NeffiLogo } from "@/components/neffi-logo";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Continue to Neffi",
  robots: { index: false, follow: false },
};

// Reads the session and the URL, so it renders per request instead of joining the static shell.
export const instant = false;

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);
  if (await getViewer()) redirect(next);

  return (
    <div className="flex min-h-dvh flex-col bg-background md:items-center md:justify-center md:p-6 lg:p-10">
      <main className="flex w-full flex-col bg-background md:grid md:grid-cols-[48%_52%] md:max-w-[1080px] md:min-h-[640px] md:overflow-hidden md:rounded-2xl md:border md:border-border/80 md:bg-card md:shadow-xs">
        {/* HERO REGION (mobile banner / desktop left panel) */}
        <div className="relative w-full overflow-hidden bg-[#FAF9F5] border-b border-border/50 aspect-[16/9] min-h-[185px] max-h-[225px] md:aspect-auto md:h-full md:min-h-[640px] md:max-h-none md:border-b-0 md:border-r md:border-border/60">
          {/* Integrated Neffi Logo top-left */}
          <div className="absolute top-5 left-5 z-10 sm:top-6 sm:left-6 md:top-7 md:left-7 lg:top-9 lg:left-9">
            <Link
              href="/"
              aria-label="Neffi home"
              className="inline-flex min-h-11 items-center rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <NeffiLogo aria-hidden className="h-5.5 md:h-6 w-auto text-foreground" />
            </Link>
          </div>

          {/* Responsive Hero Artwork: mobile asset (< 768px) and desktop asset (>= 768px) */}
          <picture className="block h-full w-full">
            <source
              media="(min-width: 768px)"
              srcSet="/images/neffi-signin-hero-profile-preview.png"
              width={1122}
              height={1402}
            />
            <img
              src="/images/neffi-signin-hero-mobile.png"
              alt=""
              width={1536}
              height={1024}
              className="h-full w-full object-cover object-center scale-[1.06] origin-center md:scale-100 md:object-top lg:object-center select-none pointer-events-none"
            />
          </picture>
        </div>

        {/* AUTH REGION */}
        <div className="flex flex-col justify-center px-5 py-7 sm:px-6 sm:py-8 md:px-8 md:py-10 lg:px-14">
          <div className="w-full max-w-[420px] mx-auto flex flex-col">
            <SignInForm next={next} notice={authErrorMessage(error)} />

            {/* Centered Support Link beneath CTA */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-center">
              <CircleHelp aria-hidden className="size-3.5 shrink-0 text-fg-secondary" />
              <span className="text-meta text-fg-secondary">
                Having trouble signing in?
              </span>
              <Link
                href="/support"
                className="inline-flex min-h-11 items-center text-meta font-medium text-foreground transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
              >
                Get help
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
