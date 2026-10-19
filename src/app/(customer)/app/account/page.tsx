import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Laptop,
  LogOut,
  Mail,
  Trash2,
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
      className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 md:gap-7 md:pt-10 md:pb-16"
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
            className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-body text-emerald-800 dark:text-emerald-200"
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
            className="mt-4 flex items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-body text-destructive"
          >
            <AlertCircle aria-hidden className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>

      {/* 2. Main unified settings surface: Sign-in methods + Change email + Sessions */}
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-panel border border-border bg-background shadow-2xs">
        {/* Section A: Sign-in methods */}
        <section
          aria-labelledby="signin-methods-heading"
          className="flex flex-col gap-5 p-6 sm:p-7 md:p-8"
        >
          <div className="flex flex-col gap-1">
            <h2 id="signin-methods-heading" className="text-section font-semibold text-foreground">
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
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas text-fg-secondary">
                  <Mail aria-hidden className="size-5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-body font-medium text-foreground">
                    Email code
                  </span>
                  <p className="text-meta text-fg-secondary">
                    Sign in using a 6-digit verification code sent to your email.
                  </p>
                  <p className="text-meta text-fg-faint">
                    Always available
                  </p>
                </div>
              </div>
            </div>

            {/* Method 2: Google */}
            <div className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-white shadow-2xs">
                  <GoogleLogo className="size-5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-body font-medium text-foreground">
                    Google
                  </span>
                  <p className="text-meta text-fg-secondary">
                    {methods.google
                      ? "Connected to your Google account."
                      : "Sign in with your Google account."}
                  </p>
                  {methods.google ? (
                    <p className="text-meta text-fg-faint">
                      Email code remains available as a backup.
                    </p>
                  ) : null}
                </div>
              </div>

              {methods.google ? (
                <div className="w-full sm:w-auto sm:shrink-0">
                  <RemoveGoogleForm />
                </div>
              ) : (
                <div className="w-full sm:w-auto sm:shrink-0">
                  <AccountActions googleLinked={false} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section B: Change sign-in email */}
        <section
          aria-labelledby="change-email-heading"
          className="flex flex-col gap-5 p-6 sm:p-7 md:p-8"
        >
          <div className="flex flex-col gap-1">
            <h2 id="change-email-heading" className="text-section font-semibold text-foreground">
              Change sign-in email
            </h2>
            <p className="text-body text-fg-secondary">
              Update the email address associated with your Neffi account and active cards.
            </p>
          </div>

          <ChangeEmailForm />
        </section>

        {/* Section C: Sessions */}
        <section
          aria-labelledby="sessions-heading"
          className="flex flex-col gap-5 p-6 sm:p-7 md:p-8"
        >
          <div className="flex flex-col gap-1">
            <h2 id="sessions-heading" className="text-section font-semibold text-foreground">
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
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas text-fg-secondary">
                  <LogOut aria-hidden className="size-4.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-body font-medium text-foreground">Sign out</span>
                  <p className="text-meta text-fg-secondary">
                    Sign out on this device.
                  </p>
                </div>
              </div>
              <form action={signOutAction} className="shrink-0 pl-[3.375rem] sm:pl-0">
                <Button
                  type="submit"
                  size="touch"
                  variant="outline"
                  className="h-11 w-full border-border bg-background px-4 font-medium text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-canvas active:bg-subtle sm:w-auto"
                >
                  Sign out
                </Button>
              </form>
            </div>

            {/* Sign out of all devices */}
            <div className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas text-fg-secondary">
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
              <form action={signOutEverywhereAction} className="shrink-0 pl-[3.375rem] sm:pl-0">
                <Button
                  type="submit"
                  size="touch"
                  variant="outline"
                  className="h-11 w-full border-border bg-background px-4 font-medium text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-canvas active:bg-subtle sm:w-auto"
                >
                  Sign out of all devices
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>

      {/* 3. Help & support */}
      <section
        aria-labelledby="help-support-heading"
        className="flex flex-col gap-4 rounded-panel border border-border bg-background p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas text-fg-secondary">
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
            className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 text-body font-medium text-foreground transition-all duration-200 hover:border-border-strong hover:bg-canvas hover:text-action active:bg-subtle focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span>Contact support</span>
            <ArrowRight aria-hidden className="size-4 text-fg-secondary nav-arrow interact" />
          </Link>
        </div>
      </section>

      {/* 4. Danger zone */}
      <section
        aria-labelledby="danger-zone-heading"
        className="flex flex-col gap-5 rounded-panel border border-destructive/25 bg-[color-mix(in_oklab,var(--destructive)_3%,var(--background))] p-5 sm:p-6 md:p-7"
      >
        <div className="flex items-start gap-3.5 border-b border-destructive/15 pb-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-destructive/20 bg-destructive/10 text-destructive">
            <AlertTriangle aria-hidden className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h2 id="danger-zone-heading" className="text-section font-semibold text-destructive">
              Danger zone
            </h2>
            <p className="text-body text-fg-secondary">
              To delete your account, please contact Neffi support.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-destructive/20 bg-destructive/5 text-destructive/80">
              <Trash2 aria-hidden className="size-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-body font-medium text-foreground">
                Delete account
              </span>
              <p className="text-meta text-fg-secondary">
                Permanently remove your account and all associated data.
              </p>
            </div>
          </div>
          <Link
            href="/support?topic=account-deletion"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-destructive/35 bg-background px-4 text-body font-medium text-destructive transition-colors duration-200 hover:border-destructive hover:bg-destructive/10 active:bg-destructive/15 focus-visible:outline-2 focus-visible:outline-destructive"
          >
            Request account deletion
          </Link>
        </div>
      </section>
    </main>
  );
}
