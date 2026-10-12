"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { Purpose } from "@/modules/profiles/starters";
import { createProfileAction } from "./actions";

export function EssentialsForm({ cardId, purpose, linkLabel, defaultEmail }: { cardId: string; purpose: Purpose; linkLabel: string; defaultEmail: string }) {
  const [state, action, pending] = useActionState(createProfileAction, undefined);
  const invalid = (name: string) => state?.fields?.includes(name) || undefined;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="purpose" value={purpose} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Full name
        <Input name="fullName" required autoComplete="name" maxLength={80} aria-invalid={invalid("fullName")} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        What you do
        <Input name="headline" maxLength={80} aria-invalid={invalid("headline")} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Short intro
        <Textarea name="bio" maxLength={300} aria-invalid={invalid("bio")} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <Input name="email" type="email" defaultValue={defaultEmail} autoComplete="email" aria-invalid={invalid("email")} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Phone
        <Input name="phone" type="tel" autoComplete="tel" aria-invalid={invalid("phone")} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {linkLabel}
        <Input name="link" inputMode="url" aria-invalid={invalid("link")} />
      </label>
      <p className="text-sm text-muted-foreground">You can change all of this later.</p>
      {state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      <Button type="submit" size="touch" className="w-full" disabled={pending}>Create my Neffi</Button>
    </form>
  );
}
