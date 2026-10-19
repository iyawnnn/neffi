import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Laptop,
  LogOut,
  Mail,
} from "lucide-react";
import { requireAccount } from "@/auth/access";
import { signOutAction } from "@/auth/actions";
import { authErrorMessage } from "@/auth/messages";
import { getLinkedMethods } from "@/auth/methods";
import { GoogleLogo } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import { AccountActions } from "./account-actions";
import { ChangeEmailForm, RemoveGoogleForm } from "./account-forms";
import { signOutEverywhereAction } from "./actions";

export const instant = false;

export default async function AccountPage({ searchParams }: PageProps<"/app/account">) {
  const viewer = await requireAccount("/app");
  const [methods, params] = await Promise.all([getLinkedMethods(), searchParams]);
  const error = authErrorMessage(
    typeof params.error === "string" ? params.error : undefined
  );

  return (
    <main
      data-canvas
      className="mx-auto flex w-full max-w-[680px] flex-1 flex-col gap-6 px-4 pt-6 pb-12 md:gap-8 md:px-6 md:pt-8 md:pb-16"
    >
      {/* 1. Account overview */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">Account</h1>
        <p className="text-body text-fg-secondary">
          Manage your sign-in details, connected methods, and security.
        </p>
        <p className="mt-1 text-body text-fg-secondary">
          Signed in as{" "}
          <span className="font-medium text-foreground">{viewer.email}</span>
        </p>

        {/* Status & Error alerts */}
        {params.changed === "1" ? (
          <div
            role="status"
            className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-body text-emerald-800 dark:text-emerald-200"
          >
            <CheckCircle2
              aria-hidden
              className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <span>Your sign-in email has been changed.</span>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-3 flex items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-body text-destructive"
          >
            <AlertCircle aria-hidden className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>

      {/* 2. Sign-in methods */}
      <section
        aria-labelledby="signin-methods-heading"
        className="flex flex-col gap-5 rounded-panel border border-border bg-background p-5 sm:p-6 md:p-8"
      >
        <div className="flex flex-col gap-1 border-b border-border/60 pb-4">
          <h2 id="signin-methods-heading" className="text-section font-semibold">
            Sign-in methods
          </h2>
          <p className="text-body text-fg-secondary">
            Authentication methods connected to your account.
          </p>
        </div>

        <div className="flex flex-col divide-y divide-border/60">
          {/* Method 1: Email code */}
          <div className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-canvas text-fg-secondary">
                <Mail aria-hidden className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-body font-medium text-foreground">
                  Email code
                </span>
                <p className="text-meta text-fg-secondary">
                  Always available as a sign-in option using a 6-digit verification code.
                </p>
              </div>
            </div>
          </div>

          {/* Method 2: Google */}
          <div className="flex flex-col gap-3 py-4 last:pb-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-white shadow-2xs">
                  <GoogleLogo className="size-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-body font-medium text-foreground">
                    Google
                  </span>
                  <p className="text-meta text-fg-secondary">
                    {methods.google
                      ? "Connected to your Google account."
                      : "Sign in with your Google account."}
                  </p>
                </div>
              </div>

              {!methods.google ? (
                <div className="shrink-0 pt-1 sm:pt-0">
                  <AccountActions googleLinked={false} />
                </div>
              ) : null}
            </div>

            {methods.google ? (
              <div className="mt-2 pl-0 sm:pl-[3.375rem]">
                <RemoveGoogleForm />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* 3. Change sign-in email */}
      <section
        aria-labelledby="change-email-heading"
        className="flex flex-col gap-5 rounded-panel border border-border bg-background p-5 sm:p-6 md:p-8"
      >
        <div className="flex flex-col gap-1 border-b border-border/60 pb-4">
          <h2 id="change-email-heading" className="text-section font-semibold">
            Change sign-in email
          </h2>
          <p className="text-body text-fg-secondary">
            Update the email address associated with your Neffi account and active cards.
          </p>
        </div>

        <ChangeEmailForm />
      </section>

      {/* 4. Sessions */}
      <section
        aria-labelledby="sessions-heading"
        className="flex flex-col gap-5 rounded-panel border border-border bg-background p-5 sm:p-6 md:p-8"
      >
        <div className="flex flex-col gap-1 border-b border-border/60 pb-4">
          <h2 id="sessions-heading" className="text-section font-semibold">
            Sessions
          </h2>
          <p className="text-body text-fg-secondary">
            Manage your active logins across browsers and devices.
          </p>
        </div>

        <div className="flex flex-col divide-y divide-border/60">
          {/* Sign out on this device */}
          <div className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-canvas text-fg-secondary">
                <LogOut aria-hidden className="size-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-body font-medium text-foreground">Sign out</span>
                <p className="text-meta text-fg-secondary">
                  Sign out on this device.
                </p>
              </div>
            </div>
            <form action={signOutAction} className="shrink-0">
              <Button
                type="submit"
                size="touch"
                variant="outline"
                className="w-full sm:w-auto"
              >
                Sign out
              </Button>
            </form>
          </div>

          {/* Sign out of all devices */}
          <div className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-canvas text-fg-secondary">
                <Laptop aria-hidden className="size-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-body font-medium text-foreground">
                  Sign out of all devices
                </span>
                <p className="text-meta text-fg-secondary">
                  End all active sessions across devices.
                </p>
              </div>
            </div>
            <form action={signOutEverywhereAction} className="shrink-0">
              <Button
                type="submit"
                size="touch"
                variant="outline"
                className="w-full sm:w-auto"
              >
                Sign out of all devices
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* 5. Help & support */}
      <section
        aria-labelledby="help-support-heading"
        className="flex flex-col gap-4 rounded-panel border border-border bg-background p-5 sm:p-6 md:p-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-canvas text-fg-secondary">
              <HelpCircle aria-hidden className="size-5" />
            </div>
            <div className="flex flex-col">
              <h2
                id="help-support-heading"
                className="text-section font-semibold text-foreground"
              >
                Help & support
              </h2>
              <p className="text-body text-fg-secondary">
                Need help with account access or managing your cards?
              </p>
            </div>
          </div>
          <Link
            href="/support?topic=recovery"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 text-body font-medium text-foreground transition-colors hover:border-border-strong hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:outline-brand"
          >
            Contact support
            <ArrowRight aria-hidden className="size-4 text-fg-secondary" />
          </Link>
        </div>
      </section>

      {/* 6. Danger zone */}
      <section
        aria-labelledby="danger-zone-heading"
        className="flex flex-col gap-4 rounded-panel border border-destructive/20 bg-background p-5 sm:p-6 md:p-8"
      >
        <div className="flex flex-col gap-1 border-b border-border/60 pb-4">
          <h2 id="danger-zone-heading" className="text-section font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="text-body text-fg-secondary">
            To delete your account, please contact Neffi support.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <span className="text-body font-medium text-foreground">
              Delete account
            </span>
            <p className="text-meta text-fg-secondary">
              Permanently remove your account and all associated data.
            </p>
          </div>
          <Link
            href="/support?topic=account-deletion"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-destructive/30 px-4 text-body font-medium text-destructive transition-colors hover:border-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-destructive"
          >
            Request account deletion
          </Link>
        </div>
      </section>
    </main>
  );
}
