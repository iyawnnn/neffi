"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Laptop, LoaderCircle } from "lucide-react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { GoogleLogo } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  confirmEmailChangeAction,
  removeGoogleAction,
  requestEmailChangeAction,
} from "./actions";

export function ChangeEmailForm() {
  const [request, requestAction, requesting] = useActionState(
    requestEmailChangeAction,
    undefined
  );
  const [confirmation, confirmAction, confirming] = useActionState(
    confirmEmailChangeAction,
    undefined
  );
  const [different, setDifferent] = useState(false);
  const showCode = request?.step === "code" && !different;
  const stale = confirmation?.stale || request?.stale;

  return (
    <div className="flex flex-col gap-4">
      {/* Quiet security guidance */}
      <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-canvas px-3.5 py-2.5 text-meta text-fg-secondary">
        <Laptop aria-hidden className="size-4 shrink-0 text-fg-faint" />
        <span>Other devices will be signed out after your email changes.</span>
      </div>

      {stale ? (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p role="alert" className="text-meta font-medium text-destructive">
            {confirmation?.stale ? confirmation.error : request?.error}
          </p>
          <div>
            <Link
              href="/sign-in?next=/app/account"
              className="group inline-flex min-h-11 items-center gap-1.5 text-body font-medium text-action hover:text-action-hover interact transition-colors focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span>Sign in again</span>
              <ArrowRight aria-hidden className="size-4 nav-arrow interact" />
            </Link>
          </div>
        </div>
      ) : confirmation?.changed ? (
        <div className="rounded-lg border border-border/70 bg-canvas p-4">
          <p role="alert" className="text-meta text-foreground">
            {confirmation.error}
          </p>
        </div>
      ) : showCode ? (
        <form action={confirmAction} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={request.email} />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email-change-code"
              className="text-body font-medium text-foreground"
            >
              Email code
            </label>
            <p className="text-meta text-fg-secondary">
              Enter the 6-digit verification code sent to{" "}
              <span className="font-medium text-foreground">{request.email}</span>.
            </p>
            <p className="text-meta text-fg-secondary">
              No code? Check the address and spam folder. The address may be unavailable.
            </p>
            <Input
              id="email-change-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              className="h-12 max-w-xs rounded-[10px] border border-border bg-background px-4 font-mono text-base tracking-widest text-foreground outline-none transition-all duration-150 placeholder:text-fg-secondary/50 hover:border-border-strong focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
              required
            />
          </div>

          {confirmation?.error ? (
            <p role="alert" className="text-meta text-destructive">
              {confirmation.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Button
              type="submit"
              size="touch"
              variant="action"
              loading={confirming}
              loadingText="Changing email…"
              className="h-12 w-full rounded-[10px] px-6 text-base font-semibold sm:w-auto sm:text-body"
            >
              Change email
            </Button>
            <Button
              size="touch"
              type="button"
              variant="ghost"
              onClick={() => setDifferent(true)}
              className="h-12 w-full rounded-[10px] text-fg-secondary hover:text-foreground sm:w-auto sm:text-body"
            >
              Use a different address
            </Button>
          </div>
        </form>
      ) : (
        <form
          action={async (data) => {
            setDifferent(false);
            await requestAction(data);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="new-email-address"
              className="text-body font-medium text-foreground"
            >
              New email address
            </label>
            <p className="text-meta text-fg-secondary">
              We&apos;ll send a 6-digit verification code to confirm your new address.
            </p>
            <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <Input
                id="new-email-address"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-12 w-full rounded-[10px] border border-border bg-background px-4 text-base text-foreground transition-all duration-150 outline-none placeholder:text-fg-secondary/50 hover:border-border-strong focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 sm:text-body"
                required
              />
              <Button
                type="submit"
                size="touch"
                variant="action"
                loading={requesting}
                loadingText="Sending code…"
                className="h-12 w-full shrink-0 rounded-[10px] px-6 text-base font-semibold sm:w-auto sm:text-body"
              >
                Send code
              </Button>
            </div>
          </div>

          {request?.error ? (
            <p role="alert" className="text-meta text-destructive">
              {request.error}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}

export function RemoveGoogleForm() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [state, action, pending] = useActionState(removeGoogleAction, undefined);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        size="touch"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-11 w-full border-border bg-background px-4 font-medium text-foreground transition-colors duration-200 hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive active:bg-destructive/10 sm:w-auto"
      >
        Disconnect Google
      </Button>

      <AlertDialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-xs transition-opacity duration-200" />
          <AlertDialog.Popup
            initialFocus={cancelRef}
            finalFocus={triggerRef}
            className="app-type fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-border bg-background p-6 text-foreground shadow-lg outline-none transition-all duration-200"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-white shadow-2xs">
                <GoogleLogo className="size-5" />
              </div>
              <div className="flex flex-col gap-1">
                <AlertDialog.Title className="text-section font-semibold text-foreground">
                  Disconnect Google?
                </AlertDialog.Title>
                <AlertDialog.Description className="text-body text-fg-secondary">
                  Google will be removed as a sign-in method for your Neffi account.
                </AlertDialog.Description>
              </div>
            </div>

            <p className="mt-4 text-meta text-fg-secondary">
              You can still sign in using an email verification code, and you can reconnect Google later.
            </p>

            {state?.error ? (
              <div
                role="alert"
                className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-meta text-destructive"
              >
                <AlertCircle aria-hidden className="size-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            ) : null}

            <form
              action={action}
              className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end"
            >
              <AlertDialog.Close
                render={
                  <Button
                    ref={cancelRef}
                    type="button"
                    size="touch"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setOpen(false)}
                    className="h-11 w-full border-border bg-background px-4 font-medium text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-canvas active:bg-subtle sm:w-auto"
                  >
                    Cancel
                  </Button>
                }
              />
              <Button
                type="submit"
                size="touch"
                disabled={pending}
                className="h-11 w-full bg-destructive px-5 font-semibold text-white shadow-2xs transition-colors duration-200 hover:bg-destructive/90 active:bg-destructive/95 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
              >
                {pending ? (
                  <>
                    <LoaderCircle
                      aria-hidden
                      className="size-4 animate-spin motion-reduce:animate-none"
                    />
                    Disconnecting…
                  </>
                ) : (
                  "Disconnect Google"
                )}
              </Button>
            </form>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
