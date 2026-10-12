"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmEmailChangeAction, removeGoogleAction, requestEmailChangeAction } from "./actions";

export function ChangeEmailForm() {
  const [request, requestAction, requesting] = useActionState(requestEmailChangeAction, undefined);
  const [confirmation, confirmAction, confirming] = useActionState(confirmEmailChangeAction, undefined);
  const [different, setDifferent] = useState(false);
  const showCode = request?.step === "code" && !different;
  return <div className="flex flex-col gap-3">{showCode ? <form action={confirmAction} className="flex flex-col gap-3">
    <input type="hidden" name="email" value={request.email} />
    <label className="flex flex-col gap-1 text-sm">Email code<Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
    {confirmation?.error ? <p role="alert" className="text-sm">{confirmation.error}</p> : null}
    <Button type="submit" size="touch" disabled={confirming}>Change email</Button>
    <Button size="touch" type="button" variant="ghost" onClick={() => setDifferent(true)}>Use a different address</Button>
  </form> : <form action={async data => { setDifferent(false); await requestAction(data); }} className="flex flex-col gap-3">
    <label className="flex flex-col gap-1 text-sm">New email address<Input name="email" type="email" autoComplete="email" required /></label>
    {request?.error ? <p role="alert" className="text-sm">{request.error}</p> : null}
    <Button type="submit" size="touch" disabled={requesting}>Send code</Button>
  </form>}</div>;
}
export function RemoveGoogleForm() {
  const [state, action, pending] = useActionState(removeGoogleAction, undefined);
  return <form action={action} className="flex flex-col gap-3"><p className="text-sm text-muted-foreground">You can still sign in with an email code.</p>{state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}<Button type="submit" size="touch" variant="outline" disabled={pending}>Remove Google</Button></form>;
}
