"use client";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { publishAction } from "./actions";
const defaultPublish: typeof publishAction = async (previous, data) => (await import("./actions")).publishAction(previous, data);

export function PublishButton({ profileId, cardId, action: publish, disabled = false }: { profileId: string; cardId?: string; action?: typeof publishAction; disabled?: boolean }) {
  const [state, action, pending] = useActionState(publish ?? defaultPublish, undefined);
  const error = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state?.error) error.current?.focus(); }, [state]);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      {cardId && <input type="hidden" name="cardId" value={cardId} />} 
      {state?.error ? <p ref={error} tabIndex={-1} role="alert" className="text-body text-destructive outline-none">{state.error}</p> : null}
      {state?.gaps?.length ? <ul className="list-inside list-disc text-sm">{state.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul> : null}
      <Button type="submit" size="touch" variant="action" className="h-12 w-full rounded-[10px] font-semibold interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none" disabled={disabled} loading={pending} loadingText="Publishing…">Publish</Button>
    </form>
  );
}

