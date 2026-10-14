"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeRecoveryAction } from "./actions";
export function RecoveryForm() {
  const [state, action, pending] = useActionState(completeRecoveryAction, undefined);
  if (state?.ok) return <div className="space-y-3"><p role="status">{state.ok}</p><Link href="/sign-in" className="flex min-h-11 items-center underline">Sign in with your new address</Link></div>;
  return <form action={action} className="flex flex-col gap-4">
    <label className="flex flex-col gap-1">New email<Input type="email" name="email" required maxLength={254} autoComplete="email" /></label>
    <label className="flex flex-col gap-1">Recovery code<Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" minLength={8} maxLength={8} required /></label>
    {state?.error ? <p role="alert">{state.error}</p> : null}
    <Button type="submit" size="touch" disabled={pending}>{pending ? "Checking…" : "Complete recovery"}</Button>
  </form>;
}
