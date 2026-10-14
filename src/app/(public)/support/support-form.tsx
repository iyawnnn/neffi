"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { categories } from "@/modules/support/domain";
import { submitSupportAction } from "./actions";

export function SupportForm({ email, clientKey, topic, cardId }: { email?: string; clientKey: string; topic: keyof typeof categories; cardId?: string }) {
  const [state, action, pending] = useActionState(submitSupportAction, undefined);
  if (state?.ok) return <p role="status">{state.ok}</p>;
  return <form action={action} className="flex flex-col gap-4">
    <input type="hidden" name="clientKey" value={clientKey} />
    {cardId ? <input type="hidden" name="cardId" value={cardId} /> : null}
    <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="flex flex-col gap-1">Contact email<Input name="email" type="email" maxLength={254} required defaultValue={email} readOnly={Boolean(email)} autoComplete="email" /></label>
    <label className="flex flex-col gap-1">Name (optional)<Input name="name" maxLength={100} autoComplete="name" /></label>
    <label className="flex flex-col gap-1">What do you need help with?<select name="category" defaultValue={topic} className="min-h-11 rounded-lg border bg-background px-3">{Object.entries(categories).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
    <label className="flex flex-col gap-1">Message<Textarea name="message" maxLength={2000} required rows={6} /></label>
    <p className="text-sm text-muted-foreground">Do not include sign-in codes, activation codes or other secrets.</p>
    {state?.error ? <p role="alert">{state.error}</p> : null}
    <Button type="submit" size="touch" disabled={pending}>{pending ? "Sending…" : "Send request"}</Button>
  </form>;
}
