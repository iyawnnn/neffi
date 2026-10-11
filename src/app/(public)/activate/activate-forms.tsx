"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { checkCodeAction, claimAction, startOverAction, switchAccountAction } from "./actions";

// The typed code lives only in this component's memory; it is posted, never stored or put in the URL.
export function CodeForm() {
  const [state, formAction, pending] = useActionState(checkCodeAction, undefined);
  const [code, setCode] = useState("");
  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="code">
        Activation code
      </label>
      <input
        id="code"
        name="code"
        required
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={64}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        className={`${inputClass} font-mono uppercase tracking-wider`}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        Continue
      </Button>
    </form>
  );
}

export function ClaimForm() {
  const [state, formAction, pending] = useActionState(claimAction, undefined);
  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending ? "Adding…" : "Add to my account"}
      </Button>
    </form>
  );
}

export function SwitchAccountButton() {
  return (
    <form action={switchAccountAction} className="w-full">
      <Button type="submit" variant="outline" size="lg" className="h-11 w-full">
        Use a different account
      </Button>
    </form>
  );
}

export function StartOverButton() {
  return (
    <form action={startOverAction} className="w-full">
      <Button type="submit" variant="ghost" className="h-11 w-full">
        Enter a different code
      </Button>
    </form>
  );
}
