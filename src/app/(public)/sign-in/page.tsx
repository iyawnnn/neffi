import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { getViewer } from "@/auth/access";
import { authErrorMessage } from "@/auth/messages";
import { safeNext } from "@/auth/policy";
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
  if (await getViewer() && next !== "/app/account") redirect(next);

  return (
    <div data-auth-page className="flex flex-col items-center px-4 pt-6 pb-10 sm:px-6 sm:pt-8 md:pb-14">
      <main data-auth-card className="flex w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xs md:grid md:grid-cols-[48%_52%] md:max-w-[1080px]">
        {/* HERO REGION (mobile banner / desktop left panel) */}
        <div data-auth-hero className="relative w-full overflow-hidden bg-[#FAF9F5] border-b border-border/50 aspect-[16/9] min-h-[185px] max-h-[225px] md:aspect-auto md:h-full md:max-h-none md:border-b-0 md:border-r md:border-border/60">
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
        <div data-auth-body className="flex flex-col justify-center px-5 py-7 sm:px-6 sm:py-8 md:px-8 md:py-10 lg:px-14">
          <div className="w-full max-w-[420px] mx-auto flex flex-col">
            <SignInForm next={next} notice={authErrorMessage(error)} />

            {/* Centered Support Link beneath CTA */}
            <div data-auth-help className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-center">
              <CircleHelp aria-hidden className="size-3.5 shrink-0 text-fg-secondary" />
              <Link
                href="/support#account-recovery"
                className="inline-flex min-h-11 items-center text-meta font-medium text-foreground transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
              >
                Lost access to your email?
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
