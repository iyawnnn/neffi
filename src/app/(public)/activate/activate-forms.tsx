"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { checkCodeAction, claimAction, startOverAction, switchAccountAction } from "./actions";

export function formatCodeInput(value: string): string {
  const clean = value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 8);
  if (!clean) return "";
  const parts = clean.match(/.{1,4}/g);
  return parts ? parts.join("-") : clean;
}

// The typed code lives only in this component's memory; it is posted, never stored or put in the URL.
export function CodeForm() {
  const [state, formAction, pending] = useActionState(checkCodeAction, undefined);
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const rawChars = code.replace(/[^0-9A-Z]/gi, "");
  const isComplete = rawChars.length === 8;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    let rawValue = input.value;
    let cursor = input.selectionStart ?? rawValue.length;
    const inputType = (e.nativeEvent as InputEvent).inputType;
    if (rawValue === code.replace("-", "") && (inputType === "deleteContentBackward" || inputType === "deleteContentForward")) {
      const index = inputType === "deleteContentBackward" ? cursor - 1 : cursor;
      if (index >= 0) {
        rawValue = rawValue.slice(0, index) + rawValue.slice(index + 1);
        cursor = index;
      }
    }

    // Count non-hyphen chars before cursor
    const rawCharsBeforeCursor = rawValue.slice(0, cursor).replace(/[^0-9A-Z]/gi, "").length;

    const formatted = formatCodeInput(rawValue);
    setCode(formatted);

    // Calculate new cursor position in formatted string
    let targetCursor = 0;
    let rawCount = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (rawCount === rawCharsBeforeCursor) {
        targetCursor = i;
        break;
      }
      if (formatted[i] !== "-") {
        rawCount++;
      }
      if (rawCount === rawCharsBeforeCursor) {
        targetCursor = i + 1;
        break;
      }
    }
    if (rawCharsBeforeCursor > rawCount) {
      targetCursor = formatted.length;
    }

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(targetCursor, targetCursor);
      }
    });
  };

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-left">
        <label
          htmlFor="code"
          className="text-body font-medium text-foreground text-left"
        >
          Activation code
        </label>
        <div className="relative flex items-center justify-center rounded-xl bg-background">
          <div aria-hidden data-code-groups className="pointer-events-none absolute grid h-10 w-[calc(9ch+1.8em)] select-none grid-cols-[4fr_1fr_4fr] font-mono text-lg sm:text-xl">
            <span data-code-group className="rounded-md bg-canvas" />
            <span />
            <span data-code-group className="rounded-md bg-canvas" />
          </div>
          <input
            ref={inputRef}
            id="code"
            name="code"
            required
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX"
            value={code}
            onChange={handleChange}
            aria-invalid={Boolean(state?.error)}
            aria-describedby={state?.error ? "code-error" : undefined}
            className={cn(
              "relative h-16 w-full rounded-xl border border-border bg-transparent px-8 text-center font-mono text-lg font-medium tracking-[0.2em] uppercase transition-[border-color,box-shadow] duration-150 outline-none sm:text-xl",
              "placeholder:text-fg-secondary/60",
              "focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20",
              state?.error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
              isComplete && !state?.error && "border-brand/40"
            )}
          />
          {isComplete && !state?.error ? (
            <div
              aria-hidden
              className="pointer-events-none absolute right-4 flex items-center justify-center text-brand"
            >
              <Check className="size-4.5 stroke-[2.5]" />
            </div>
          ) : null}
        </div>

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
