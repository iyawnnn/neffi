"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
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
      <p className="text-meta text-fg-secondary">Other devices will be signed out after your email changes.</p>
      {stale ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-meta text-destructive">{confirmation?.stale ? confirmation.error : request?.error}</p>
          <Link href="/sign-in?next=/app/account" className="inline-flex min-h-11 items-center text-body font-medium text-brand hover:underline">Sign in again →</Link>
        </div>
      ) : confirmation?.changed ? (
        <p role="alert" className="text-meta text-foreground">{confirmation.error}</p>
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
            <p className="text-meta text-fg-secondary">No code? Check the address and spam folder. The address may be unavailable.</p>
            <Input
              id="email-change-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              className="max-w-xs font-mono tracking-widest"
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
              disabled={confirming}
              className="w-full sm:w-auto"
            >
              {confirming ? (
                <>
                  <LoaderCircle
                    aria-hidden
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                  Changing email…
                </>
              ) : (
                "Change email"
              )}
            </Button>
            <Button
              size="touch"
              type="button"
              variant="ghost"
              onClick={() => setDifferent(true)}
              className="w-full sm:w-auto"
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
            <Input
              id="new-email-address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="max-w-md"
              required
            />
          </div>

          {request?.error ? (
            <p role="alert" className="text-meta text-destructive">
              {request.error}
            </p>
          ) : null}

          <div>
            <Button
              type="submit"
              size="touch"
              variant="action"
              disabled={requesting}
              className="w-full sm:w-auto"
            >
              {requesting ? (
                <>
                  <LoaderCircle
                    aria-hidden
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                  Sending code…
                </>
              ) : (
                "Send code"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function RemoveGoogleForm() {
  const [state, action, pending] = useActionState(removeGoogleAction, undefined);
  return (
    <form
      action={action}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-meta text-fg-secondary">
          You can still sign in with an email code.
        </p>
        {state?.error ? (
          <p role="alert" className="text-meta text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        size="touch"
        variant="outline"
        disabled={pending}
        className="w-full shrink-0 text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive sm:w-auto"
      >
        {pending ? "Removing…" : "Remove Google"}
      </Button>
    </form>
  );
}
