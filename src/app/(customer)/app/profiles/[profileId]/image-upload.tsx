"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { Button } from "@/components/ui/button";
import { confirmImageAction, removeImageAction, startImageUploadAction, updateAppearanceAction } from "./actions";

const FAILED = "We couldn't upload that image. Use a JPG, PNG, WebP or HEIC image up to 5 MB.";

// The file goes straight from the phone to Cloudinary with a short-lived signature; Neffi then checks it before using it.
export function ImageUpload({ profileId, hasImage }: { profileId: string; hasImage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function upload(file: File) {
    if (file.size > 5_000_000) return setMessage(FAILED);
    setBusy(true);
    setMessage(undefined);
    try {
      const { ticket, error } = await startImageUploadAction(profileId);
      if (!ticket) return setMessage(error ?? FAILED);
      const body = new FormData();
      for (const [key, value] of Object.entries(ticket.fields)) body.set(key, value);
      body.set("file", file);
      const response = await fetch(ticket.url, { method: "POST", body });
      const uploaded = response.ok ? ((await response.json()) as { public_id?: string }) : {};
      const result = uploaded.public_id ? await confirmImageAction(profileId, uploaded.public_id) : { error: FAILED };
      if (result.error) return setMessage(result.error);
      router.refresh();
    } catch {
      setMessage(FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-4 text-sm font-medium">
        {busy ? "Uploading…" : hasImage ? "Replace image" : "Upload image"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" disabled={busy} onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
      </label>
      {hasImage ? (
        <Button type="button" variant="ghost" size="touch" disabled={busy} onClick={async () => { await removeImageAction(profileId); router.refresh(); }}>
          Remove image
        </Button>
      ) : null}
      {message ? <p role="alert" className="rounded-lg bg-muted px-3 py-2 text-sm">{message}</p> : null}
      <p className="text-sm text-muted-foreground">JPG, PNG, WebP or HEIC, up to 5 MB.</p>
    </div>
  );
}

export function AppearanceForm({ profileId, accentColor, imageIsLogo }: { profileId: string; accentColor: string | null; imageIsLogo: boolean }) {
  const [state, action, pending] = useActionState(updateAppearanceAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={profileId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Accent colour</legend>
        <div className="grid grid-cols-2 gap-2">
          {ACCENTS.map(accent => <label key={accent.hex} className="flex min-h-11 items-center gap-2 rounded-lg border px-3"><input type="radio" name="accentColor" value={accent.hex} defaultChecked={accent.hex === (accentColor ?? ACCENTS[0].hex)} /><span aria-hidden className="size-4 rounded-full" style={{ backgroundColor: accent.hex }} />{accent.name}</label>)}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Show my image as</legend>
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="imageIsLogo" value="false" defaultChecked={!imageIsLogo} />Photo</label>
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="imageIsLogo" value="true" defaultChecked={imageIsLogo} />Logo</label>
      </fieldset>
      {state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      {state?.ok ? <p role="status" className="text-sm">{state.ok}</p> : null}
      <Button type="submit" size="touch" disabled={pending}>Save</Button>
    </form>
  );
}
