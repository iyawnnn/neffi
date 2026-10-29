"use client";

import { useActionState, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { checkCodeAction, claimAction, startOverAction, switchAccountAction } from "./actions";

// The typed code lives only in this component's memory; it is posted, never stored or put in the URL.
export function CodeForm() {
  const [state, formAction, pending] = useActionState(checkCodeAction, undefined);
  const [entry, setEntry] = useState({ code: "", caret: 0 });
  const { code } = entry;
  const inputRef = useRef<HTMLInputElement>(null);
  const isComplete = code.length === 8;
  const clean = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const display = code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement === input) input.setSelectionRange(entry.caret, entry.caret);
  }, [entry]);
  function update(next: string, position: number) {
    setEntry({ code: next, caret: position > 4 ? position + 1 : position });
  }

  return (
    <form action={(data) => { data.set("code", code); formAction(data); }} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-left">
        <label
          htmlFor="code"
          className="text-body font-medium text-foreground text-left"
        >
          Activation code
        </label>
        <input
          ref={inputRef}
          id="code"
          name="code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="XXXX-XXXX"
          maxLength={9}
          pattern="[A-Z0-9]{4}-[A-Z0-9]{4}"
          required
          value={display}
          onChange={(event) => {
            const input = event.currentTarget;
            const next = clean(input.value).slice(0, 8);
            const position = clean(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
            const type = (event.nativeEvent as InputEvent).inputType;
            // Deleting only the automatic hyphen also removes the adjacent real character.
            if (next === code && code.length > 4 && position === 4 && type === "deleteContentBackward") {
              update(code.slice(0, 3) + code.slice(4), 3);
            } else if (next === code && code.length > 4 && position === 4 && type === "deleteContentForward") {
              update(code.slice(0, 4) + code.slice(5), 4);
            } else {
              update(next, Math.min(position, 8));
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const input = event.currentTarget;
            const start = clean(display.slice(0, input.selectionStart ?? display.length)).length;
            const end = clean(display.slice(0, input.selectionEnd ?? display.length)).length;
            const inserted = clean(event.clipboardData.getData("text")).slice(0, 8 - (code.length - (end - start)));
            update(code.slice(0, start) + inserted + code.slice(end), start + inserted.length);
          }}
          disabled={pending}
          data-complete={isComplete}
          aria-invalid={Boolean(state?.error)}
          aria-describedby={state?.error ? "code-error" : undefined}
          className={cn(
            "h-[54px] w-full min-w-0 rounded-xl border bg-background px-4 text-center font-mono text-lg font-medium tracking-[0.12em] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-fg-secondary/45 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
            state?.error
              ? "border-destructive/60 focus-visible:ring-destructive/15"
              : "border-border focus-visible:border-brand focus-visible:ring-brand/20",
            isComplete && !state?.error && "border-foreground/30"
          )}
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
        variant="action"
        className="h-[52px] w-full gap-2 rounded-xl text-base font-semibold sm:h-[54px]"
        disabled={!isComplete}
        loading={pending}
        loadingText="Checking…"
      >
        Continue
        <ArrowRight aria-hidden className="size-4.5" />
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
        className="h-[52px] w-full rounded-xl text-base font-semibold gap-2 sm:h-[54px]"
        loading={pending}
        loadingText="Adding…"
      >
        Add to my account
        <ArrowRight aria-hidden className="size-4.5" />
      </Button>
    </form>
  );
}

export function SwitchAccountButton() {
  return (
    <form action={switchAccountAction} className="w-full">
      <SubmitButton
        variant="outline"
        size="touch"
        className="h-[52px] w-full rounded-xl text-body font-medium sm:h-[54px]"
        pendingText="Switching…"
      >
        Use a different account
      </SubmitButton>
    </form>
  );
}

export function StartOverButton() {
  return (
    <form action={startOverAction} className="w-full">
      <SubmitButton
        variant="ghost"
        size="touch"
        className="h-11 w-full text-meta font-medium text-fg-secondary hover:text-foreground"
        pendingText="Starting over…"
      >
        Enter a different code
      </SubmitButton>
    </form>
  );
}
