"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { categories } from "@/modules/support/categories";
import { submitSupportAction } from "./actions";

export function SupportForm({ email, clientKey, topic, cardId }: { email?: string; clientKey: string; topic: keyof typeof categories; cardId?: string }) {
  const [state, action, pending] = useActionState(submitSupportAction, undefined);
  const [fields, setFields] = useState({ email: email ?? "", name: "", category: topic, message: "" });
  if (state?.ok) return <p role="status">{state.ok}</p>;
  return <form action={action} className="flex flex-col gap-4">
    <input type="hidden" name="clientKey" value={clientKey} />
    {cardId ? <input type="hidden" name="cardId" value={cardId} /> : null}
    <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="flex flex-col gap-1">Contact email<Input name="email" type="email" maxLength={254} required value={fields.email} onChange={event => setFields({ ...fields, email: event.target.value })} readOnly={Boolean(email)} autoComplete="email" /></label>
    <label className="flex flex-col gap-1">Name (optional)<Input name="name" maxLength={100} autoComplete="name" value={fields.name} onChange={event => setFields({ ...fields, name: event.target.value })} /></label>
    <label className="flex flex-col gap-1">What do you need help with?<select name="category" value={fields.category} onChange={event => setFields({ ...fields, category: event.target.value as keyof typeof categories })} className="min-h-11 rounded-lg border bg-background px-3">{Object.entries(categories).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
    <label className="flex flex-col gap-1">Message<Textarea name="message" maxLength={2000} required rows={6} value={fields.message} onChange={event => setFields({ ...fields, message: event.target.value })} /></label>
    <p className="text-sm text-muted-foreground">Do not include sign-in codes, activation codes or other secrets.</p>
    {state?.error ? <p role="alert">{state.error}</p> : null}
    <Button type="submit" size="touch" disabled={pending}>{pending ? "Sending…" : "Send request"}</Button>
  </form>;
}
