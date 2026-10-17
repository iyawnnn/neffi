"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, inputClass } from "@/components/ui/input";
import type { OwnedProfile } from "@/modules/profiles/profiles";
import { createSceneAction, deleteProfileAction, publishAction } from "./actions";

export function PublishButton({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState(publishAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      {state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      {state?.gaps?.length ? <ul className="list-inside list-disc text-sm">{state.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul> : null}
      <Button type="submit" size="touch" variant="action" className="w-full rounded-[10px] font-semibold interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none" disabled={pending}>Publish</Button>
    </form>
  );
}

export function AddSceneForm({ profileId, scenes, cancel }: { profileId: string; scenes: OwnedProfile["scenes"]; cancel?: ReactNode }) {
  const [state, action, pending] = useActionState(createSceneAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={profileId} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Scene name
        <Input name="name" placeholder="e.g. Personal, Networking, Portfolio" required maxLength={40} className="h-11 rounded-[10px]" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Start from
        <select name="copyFrom" className={`${inputClass} h-11 cursor-pointer rounded-[10px]`} defaultValue="empty">
          <option value="empty">Empty</option>
          {scenes.map(scene => <option key={scene.id} value={scene.id}>Copy of {scene.name}</option>)}
        </select>
      </label>
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
        {cancel}
        <Button type="submit" variant="default" size="touch" className="h-11 rounded-[10px] bg-primary text-primary-foreground font-medium interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none" disabled={pending}>
          Add scene
        </Button>
      </div>
    </form>
  );
}

export function DeleteProfileForm({ profileId, cancel }: { profileId: string; cancel?: ReactNode }) {
  const [state, action, pending] = useActionState(deleteProfileAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="confirm" value="on" />
      {state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {cancel}
        <Button type="submit" size="touch" variant="destructive" className="min-h-11 rounded-[10px] interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none sm:h-[42px]" disabled={pending}>Delete profile</Button>
      </div>
    </form>
  );
}
