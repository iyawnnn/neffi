import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getViewer } from "@/auth/access";
import { SignInForm } from "../sign-in/sign-in-form";
import { db } from "@/db";
import { ownedCards } from "@/modules/cards/owned";
import { ClaimForm, CodeForm, StartOverButton, SwitchAccountButton } from "./activate-forms";
import { readChallenge } from "./challenge-cookie";

export const metadata: Metadata = {
  title: "Activate your Neffi",
  robots: { index: false, follow: false },
};

// Reads the session and the activation cookie, so it renders per request.
export const instant = false;

// Copied from actions.ts MESSAGES: a "use server" file can only export async functions.
const UNAVAILABLE = "This code can't be used. Please contact Neffi support for help.";
const UNAVAILABLE_SIGNED_OUT = "This code can't be used. If you already added this Neffi, sign in to find it. Otherwise, please contact Neffi support for help.";

export default async function ActivatePage({ searchParams }: PageProps<"/activate">) {
  const [viewer, challenge, params] = await Promise.all([getViewer(), readChallenge(), searchParams]);
  const raw = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const notices: Record<string, string> = {
    expired: "For your security, please enter your code again.",
    unavailable: viewer ? UNAVAILABLE : UNAVAILABLE_SIGNED_OUT,
  };
  const notice = raw && Object.hasOwn(notices, raw) ? notices[raw] : undefined;

  let heading: string;
  let body: ReactNode;
  if (challenge && !viewer) {
    heading = "Code accepted";
    body = (
      <>
        <p className="text-center text-muted-foreground">Sign in or create your account to add this Neffi. No password needed.</p>
        <SignInForm next="/activate" />
        <StartOverButton />
      </>
    );
  } else if (challenge && viewer) {
    heading = "Add this Neffi to your account";
    body = (
      <>
        <p className="text-center text-muted-foreground">
          You&apos;re signed in as <span className="break-all font-medium text-foreground">{viewer.email}</span>.
        </p>
        <ClaimForm />
        <SwitchAccountButton />
        <StartOverButton />
      </>
    );
  } else {
    const ownsCards = viewer ? (await ownedCards(db, viewer.accountId)).length > 0 : false;
    heading = ownsCards ? "Activate another Neffi" : "Activate your Neffi";
    body = (
      <>
        <p className="text-center text-muted-foreground">Enter the activation code inside your package.</p>
        {viewer ? (
          <p className="text-center text-sm">
            Signed in as <span className="break-all font-medium">{viewer.email}</span>
          </p>
        ) : null}
        <CodeForm />
        {viewer ? (
          <Link href="/app" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">
            Go to my Neffi
          </Link>
        ) : (
          <Link href="/sign-in?next=/activate" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4">
            Already activated? Sign in
          </Link>
        )}
      </>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{heading}</h1>
        {notice ? (
          <p role="status" className="w-full rounded-lg bg-muted px-3 py-2 text-sm">
            {notice}
          </p>
        ) : null}
        {body}
      </div>
    </main>
  );
}
