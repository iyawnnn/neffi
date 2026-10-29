"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeSlots } from "@/components/code-slots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeRecoveryAction } from "./actions";

export function RecoveryForm() {
  const [state, action, pending] = useActionState(completeRecoveryAction, undefined);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const canSubmit = email.trim().length > 0 && code.length === 6;

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
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-action px-6 text-base font-semibold !text-white shadow-xs transition-colors duration-[220ms] hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-brand"
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 h-12 rounded-[10px] border-border bg-background px-4 text-body text-foreground placeholder:text-fg-secondary/40 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
        />
      </div>

      <div className="mt-5 flex flex-col text-left">
        <label
          htmlFor="code"
          className="text-body font-medium text-foreground"
        >
          Recovery code
        </label>
        <div className="mt-2">
          <CodeSlots
            label="6-digit recovery code"
            describedBy="recovery-code-help"
            value={code}
            onChange={setCode}
            disabled={pending}
            hasError={Boolean(state?.error)}
          />
        </div>
        <div className="mt-2.5 flex flex-col gap-0.5 text-meta text-fg-secondary leading-normal">
          <p id="recovery-code-help">
            Sent to your new email. This code expires after 24 hours.
          </p>
          <p className="text-[0.75rem] text-fg-faint">
            Three incorrect attempts cancel recovery.
          </p>
        </div>
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
        disabled={!canSubmit}
        loading={pending}
        loadingText="Completing…"
        className={`mt-6 h-12 w-full rounded-[10px] text-base font-semibold shadow-xs transition-all duration-[220ms] ${!pending ? "disabled:bg-subtle disabled:text-fg-secondary/60 disabled:border-border/60 disabled:shadow-none disabled:cursor-not-allowed" : ""}`}
      >
        <>
          Complete recovery
          <ArrowRight aria-hidden className="size-4.5" />
        </>
      </Button>
    </form>
  );
}
