"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, inputClass, Textarea } from "@/components/ui/input";
import type { OwnedProfile } from "@/modules/profiles/profiles";
import { createSceneAction, deleteProfileAction, publishAction, updateIdentityAction } from "./actions";

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

export function IdentityForm({ profile }: { profile: Pick<OwnedProfile, "id" | "fullName" | "headline" | "company" | "bio" | "phone" | "email" | "website" | "location"> }) {
  const [state, action, pending] = useActionState(updateIdentityAction, undefined);
  const fields = [
    { key: "fullName", label: "Full name", max: 80 },
    { key: "headline", label: "What you do", max: 80 },
    { key: "company", label: "Company", max: 80 },
    { key: "bio", label: "Short intro", max: 300 },
    { key: "phone", label: "Phone", max: 30 },
    { key: "email", label: "Email", max: 254 },
    { key: "website", label: "Website", max: 2048 },
    { key: "location", label: "Location", max: 80 },
  ] as const;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={profile.id} />
      {fields.map(field => (
        <label key={field.key} className="flex flex-col gap-1 text-sm font-medium">
          {field.label}
          {field.key === "bio" ? (
            <Textarea name={field.key} defaultValue={profile[field.key] ?? ""} maxLength={field.max} aria-invalid={state?.fields?.includes(field.key) || undefined} />
          ) : (
            <Input name={field.key} defaultValue={profile[field.key] ?? ""} maxLength={field.max} required={field.key === "fullName"} type={field.key === "email" ? "email" : field.key === "phone" ? "tel" : "text"} inputMode={field.key === "website" ? "url" : undefined} aria-invalid={state?.fields?.includes(field.key) || undefined} />
          )}
        </label>
      ))}
      {state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      {state?.gaps?.length ? <ul className="list-inside list-disc text-sm">{state.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul> : null}
      {state?.ok ? <p role="status" className="text-sm">{state.ok}</p> : null}
      <Button type="submit" size="touch" disabled={pending}>Save</Button>
    </form>
  );
}

export function AddSceneForm({ profileId, scenes }: { profileId: string; scenes: OwnedProfile["scenes"] }) {
  const [state, action, pending] = useActionState(createSceneAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      <label className="flex flex-col gap-1 text-sm">Name<Input name="name" required maxLength={40} /></label>
      <label className="flex flex-col gap-1 text-sm">Start from
        <select name="copyFrom" className={inputClass} defaultValue="empty">
          <option value="empty">Empty</option>
          {scenes.map(scene => <option key={scene.id} value={scene.id}>Copy of {scene.name}</option>)}
        </select>
      </label>
      {state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      <Button type="submit" size="touch" disabled={pending}>Add a scene</Button>
    </form>
  );
}

export function DeleteProfileForm({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState(deleteProfileAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" required />
        I understand this deletes this profile, its scenes and its messages
      </label>
      {state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      <Button type="submit" size="touch" variant="destructive" disabled={pending}>Delete profile</Button>
    </form>
  );
}
