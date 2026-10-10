import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/auth/access";
import { authErrorMessage } from "@/auth/messages";
import { safeNext } from "@/auth/policy";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

// Reads the session and the URL, so it renders per request instead of joining the static shell.
export const instant = false;

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (await getViewer()) redirect("/app");

  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Neffi</h1>
        <p className="text-muted-foreground">Use Google or an email code. No password needed.</p>
      </div>
      <SignInForm next={next} notice={authErrorMessage(error)} />
    </main>
  );
}
