"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, LoaderCircle } from "lucide-react";
import { CodeSlots } from "@/components/code-slots";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { checkCodeAction, claimAction, startOverAction, switchAccountAction } from "./actions";

// The typed code lives only in this component's memory; it is posted, never stored or put in the URL.
export function CodeForm() {
  const [state, formAction, pending] = useActionState(checkCodeAction, undefined);
  const [code, setCode] = useState("");
  const isComplete = code.length === 8;

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-left">
        <label
          htmlFor="code"
          className="text-body font-medium text-foreground text-left"
        >
          Activation code
        </label>
        <CodeSlots
          label="Activation code"
          length={8}
          characterSet="alphanumeric"
          autoComplete="off"
          value={code}
          onChange={setCode}
          disabled={pending}
          hasError={Boolean(state?.error)}
          describedBy={state?.error ? "code-error" : undefined}
        />

        {state?.error ? (
          <div
            id="code-error"
            role="alert"
            className="mt-1 flex items-start gap-2 text-meta text-destructive"
          >
            <AlertCircle aria-hidden className="size-4 shrink-0 mt-0.5" />
            <span>{state.error}</span>
          </div>
        ) : null}
      </div>

      <Button
        type="submit"
        size="touch"
        variant={isComplete && !pending ? "action" : "outline"}
        className={cn(
          "h-[52px] sm:h-[54px] w-full rounded-xl text-base font-semibold transition-all duration-[220ms] select-none",
          !isComplete && !pending && "bg-subtle text-fg-secondary border border-border-strong/70 cursor-not-allowed hover:bg-subtle hover:text-fg-secondary disabled:opacity-100",
          isComplete && !pending && "gap-2 shadow-xs !text-white bg-action hover:bg-action-hover active:translate-y-px [&_*]:!text-white",
          pending && "gap-2 bg-action/90 cursor-not-allowed !text-white [&_*]:!text-white"
        )}
        disabled={!isComplete || pending}
      >
        {pending ? (
          <>
            <LoaderCircle
              aria-hidden
              className="size-4.5 animate-spin motion-reduce:animate-none !text-white shrink-0"
            />
            <span className="!text-white">Checking…</span>
          </>
        ) : (
          <>
            <span className={cn(isComplete ? "!text-white" : "text-fg-secondary")}>
              Continue
            </span>
            {isComplete ? (
              <ArrowRight aria-hidden className="size-4.5 !text-white shrink-0" />
            ) : null}
          </>
        )}
      </Button>
    </form>
  );
}

export function ClaimForm() {
  const [state, formAction, pending] = useActionState(claimAction, undefined);
  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      {state?.error ? (
        <div
          role="alert"
          className="flex items-start gap-2 text-meta text-destructive"
        >
          <AlertCircle aria-hidden className="size-4 shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      ) : null}
      <Button
        type="submit"
        size="touch"
        variant="action"
        className="h-[52px] sm:h-[54px] w-full rounded-xl text-base font-semibold gap-2 shadow-xs !text-white bg-action hover:bg-action-hover [&_*]:!text-white"
        disabled={pending}
      >
        {pending ? (
          <>
            <LoaderCircle
              aria-hidden
              className="size-4.5 animate-spin motion-reduce:animate-none !text-white"
            />
            <span className="!text-white">Adding…</span>
          </>
        ) : (
          <>
            <span className="!text-white">Add to my account</span>
            <ArrowRight aria-hidden className="size-4.5 !text-white shrink-0" />
          </>
        )}
      </Button>
    </form>
  );
}

export function SwitchAccountButton() {
  return (
    <form action={switchAccountAction} className="w-full">
      <Button
        type="submit"
        variant="outline"
        size="touch"
        className="h-[52px] sm:h-[54px] w-full rounded-xl text-body font-medium hover:bg-subtle/60"
      >
        Use a different account
      </Button>
    </form>
  );
}

export function StartOverButton() {
  return (
    <form action={startOverAction} className="w-full">
      <Button
        type="submit"
        variant="ghost"
        size="touch"
        className="h-11 w-full text-meta font-medium text-fg-secondary hover:text-foreground"
      >
        Enter a different code
      </Button>
    </form>
  );
}
