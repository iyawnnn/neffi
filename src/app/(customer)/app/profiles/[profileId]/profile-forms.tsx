"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { publishAction } from "./actions";

export function PublishButton({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState(publishAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      {state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      {state?.gaps?.length ? <ul className="list-inside list-disc text-sm">{state.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul> : null}
      <Button type="submit" size="touch" className="w-full" disabled={pending}>Publish</Button>
    </form>
  );
}
