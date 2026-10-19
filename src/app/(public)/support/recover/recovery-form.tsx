"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeRecoveryAction } from "./actions";

export function RecoveryForm() {
  const [state, action, pending] = useActionState(completeRecoveryAction, undefined);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center text-center py-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <CheckCircle2 aria-hidden className="size-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Recovery completed
        </h2>
        <p role="status" className="mt-2 text-meta text-fg-secondary leading-normal">
          {state.ok}
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-action px-6 text-base font-semibold !text-white shadow-xs transition-colors duration-[220ms] hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-brand"
        >
          <span>Sign in with your new address</span>
          <ArrowRight aria-hidden className="size-4.5" />
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col">
      <div className="flex flex-col text-left">
        <label
          htmlFor="email"
          className="text-body font-medium text-foreground"
        >
          New email
        </label>
        <Input
          id="email"
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
          className="mt-2 h-[50px] rounded-xl border-border bg-background px-4 text-body text-foreground placeholder:text-fg-secondary/40 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
        />
      </div>

      <div className="mt-5 flex flex-col text-left">
        <label
          htmlFor="code"
          className="text-body font-medium text-foreground"
        >
          Recovery code
        </label>
        <Input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{8}"
          minLength={8}
          maxLength={8}
          aria-describedby="recovery-code-help"
          required
          placeholder="12345678"
          className="mt-2 h-[50px] rounded-xl border-border bg-background px-4 font-mono text-base tracking-widest text-foreground placeholder:text-fg-secondary/40 placeholder:tracking-normal focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
        />
        <p id="recovery-code-help" className="mt-2 text-meta text-fg-secondary leading-normal">
          Neffi support sends this code after your recovery request is verified. It expires after 24 hours. Three incorrect attempts cancel recovery.
        </p>
      </div>

      {state?.error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-destructive/35 bg-destructive/5 px-3.5 py-2.5 text-meta text-destructive"
        >
          <AlertCircle
            aria-hidden
            className="size-4 shrink-0 mt-0.5 text-destructive"
          />
          <span>{state.error}</span>
        </div>
      ) : null}

      <Button
        type="submit"
        size="touch"
        variant="action"
        disabled={pending}
        className="mt-6 h-[50px] w-full rounded-xl text-base font-semibold shadow-xs transition-all duration-[220ms] disabled:cursor-wait"
      >
        {pending ? (
          <>
            <LoaderCircle
              aria-hidden
              className="size-4.5 animate-spin motion-reduce:animate-none"
            />
            Recovering…
          </>
        ) : (
          <>
            Complete recovery
            <ArrowRight aria-hidden className="size-4.5" />
          </>
        )}
      </Button>
    </form>
  );
}
