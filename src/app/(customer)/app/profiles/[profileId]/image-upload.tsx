"use client";

import { Toast } from "@base-ui/react/toast";
import { ArrowLeft, Eye, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { ButtonLink } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { confirmImageAction, removeImageAction, startImageUploadAction, updateAppearanceAction } from "./actions";
import { AccentPicker, AppearanceImage, ImagePresentationPicker } from "./appearance/appearance-controls";
import { EditorFooter } from "./identity/editor-footer";

const FAILED = "We couldn't upload that image. Use a JPG, PNG, WebP or HEIC image up to 5 MB.";
const motion = "rounded-[10px] interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none";

// Files go directly to Cloudinary; the server verifies each upload before storing its id.
export function ImageUpload({ profileId, hasImage, image, logo, fullName, disabled = false, onBusyChange }: { profileId: string; hasImage: boolean; image: string | null; logo: boolean; fullName?: string | null; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [message, setMessage] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const id = useId();
  const unavailable = disabled || !!busy;
  function pending(next: "upload" | "remove" | null) {
    locked.current = next !== null; setBusy(next); onBusyChange?.(next !== null);
  }
  async function upload(file: File) {
    if (disabled || locked.current) return;
    setSaved(undefined);
    if (file.size > 5_000_000 || !(/^image\/(jpeg|png|webp|heic)$/i.test(file.type) || /\.(jpe?g|png|webp|heic)$/i.test(file.name))) { setMessage(FAILED); return; }
    pending("upload"); setMessage(undefined);
    try {
      const { ticket, error } = await startImageUploadAction(profileId);
      if (!ticket) { setMessage(error ?? FAILED); return; }
      const body = new FormData();
      for (const [key, value] of Object.entries(ticket.fields)) body.set(key, value);
      body.set("file", file);
      const response = await fetch(ticket.url, { method: "POST", body });
      const uploaded = response.ok ? ((await response.json()) as { public_id?: string }) : {};
      const result = uploaded.public_id ? await confirmImageAction(profileId, uploaded.public_id) : { error: FAILED };
      if (result.error) { setMessage(result.error); return; }
      setSaved("Image updated."); router.refresh();
    } catch { setMessage(FAILED); }
    finally { pending(null); }
  }
  async function remove() {
    if (disabled || locked.current) return;
    pending("remove"); setMessage(undefined); setSaved(undefined);
    try { await removeImageAction(profileId); setSaved("Image removed."); router.refresh(); }
    catch { setMessage("Couldn’t remove your image. Try again."); }
    finally { pending(null); }
  }
  return <div data-dropzone={!hasImage ? "" : undefined} className="flex flex-col items-center gap-4 text-center"
    onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void upload(file); }}>
    <AppearanceImage image={image} logo={logo} />
    <div className="flex w-full min-w-0 flex-col items-center gap-3">
      <div><p className="break-words text-body font-medium">{hasImage ? fullName?.trim() || "Your profile image" : "Add a profile image"}</p>{!hasImage ? <p className="mt-1 text-meta text-fg-secondary">Upload a photo or business logo.</p> : null}<p id={id + "-help"} className="mt-1 text-label text-fg-secondary">JPG, PNG, WebP or HEIC · Max 5 MB</p></div>
      <div className={hasImage ? "grid w-full max-w-xs grid-cols-1 gap-2 min-[360px]:grid-cols-2" : "flex justify-center"}>
        <Button type="button" size="touch" variant="outline" disabled={unavailable} aria-describedby={id + "-help"} onClick={() => input.current?.click()} className={"gap-2 " + motion}>
          {busy === "upload" ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Upload aria-hidden className="size-4" />}
          {busy === "upload" ? "Uploading…" : hasImage ? "Change image" : "Choose image"}
        </Button>
        {hasImage ? <Button type="button" size="touch" variant="outline" disabled={unavailable} onClick={() => void remove()} className={"gap-2 border-destructive/40 text-destructive hover:border-destructive/60 hover:bg-destructive/5 hover:text-destructive focus-visible:border-destructive focus-visible:ring-destructive/20 " + motion}>{busy === "remove" ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Trash2 aria-hidden className="size-4" />}{busy === "remove" ? "Removing…" : "Remove"}</Button> : null}
      </div>
      <input ref={input} type="file" aria-label="Choose profile image" aria-describedby={id + "-help" + (message ? " " + id + "-error" : "")} aria-invalid={!!message} accept="image/jpeg,image/png,image/webp,image/heic,.heic" className="sr-only" tabIndex={-1} disabled={unavailable} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
      {message ? <p id={id + "-error"} role="alert" className="text-meta text-destructive">{message}</p> : null}
      {busy || saved ? <p role="status" className="text-label text-fg-secondary">{busy ? busy === "upload" ? "Uploading image…" : "Removing image…" : saved}</p> : null}
    </div>
  </div>;
}

type AppearanceProps = { profileId: string; accentColor: string | null; imageIsLogo: boolean; photoUrl: string | null; logoUrl: string | null; fullName?: string | null };

export function AppearanceForm(props: AppearanceProps) {
  return <Toast.Provider limit={1}><AppearanceEditor {...props} /><AppearanceToasts /></Toast.Provider>;
}

function AppearanceToasts() {
  const { toasts } = Toast.useToastManager();
  return <Toast.Portal><Toast.Viewport className="app-type fixed top-[calc(env(safe-area-inset-top)_+_5.5rem)] right-4 z-[60] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-2">
    {toasts.map(toast => <Toast.Root key={toast.id} toast={toast} className="flex items-center justify-between gap-3 rounded-panel border bg-background p-4 text-foreground shadow-sm"><div><Toast.Title className="text-body font-medium" /><Toast.Description className="mt-1 text-meta text-fg-secondary" /></div><Toast.Close aria-label="Dismiss notification" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"><X aria-hidden className="size-4" /></Toast.Close></Toast.Root>)}
  </Toast.Viewport></Toast.Portal>;
}

function AppearanceEditor({ profileId, accentColor, imageIsLogo, photoUrl, logoUrl, fullName }: AppearanceProps) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const [values, setValues] = useState({ accent: accentColor ?? ACCENTS[0].hex, logo: imageIsLogo });
  const [saved, setSaved] = useState(values);
  const [saving, setSaving] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [error, setError] = useState<string>();
  const lock = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const dirty = values.accent !== saved.accent || values.logo !== saved.logo;
  const pending = saving || mediaBusy;
  const image = values.logo ? logoUrl : photoUrl;
  function failure(message: string) {
    setError(message);
    toast.add({ title: "Couldn’t save changes", description: "Your changes are still here. Try again.", priority: "high" });
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || lock.current || mediaBusy) return;
    const data = new FormData(event.currentTarget);
    lock.current = true; setSaving(true); setError(undefined);
    try {
      const result = await updateAppearanceAction(undefined, data);
      if (result.error) failure(result.error);
      else { setSaved(values); router.refresh(); toast.add({ title: "Appearance updated" }); }
    } catch { failure("Couldn’t save changes. Your changes are still here. Try again."); }
    finally { lock.current = false; setSaving(false); }
  }
  return <form onSubmit={submit} className="flex min-w-0 flex-col gap-6">
    <input type="hidden" name="profileId" value={profileId} />
    <input type="hidden" name="imageIsLogo" value={String(values.logo)} />
    <header className="flex flex-col gap-4">
      <Link href={"/app/profiles/" + profileId} className="-ml-2 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-md px-2 text-meta font-medium text-fg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"><ArrowLeft aria-hidden className="size-3.5" />Back to profile</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><h1 className="text-title">Appearance</h1><p className="mt-2 text-body text-fg-secondary">Customize how your profile looks to visitors.</p></div>
        <ButtonLink href={`/app/profiles/${profileId}/preview`} variant="outline" className="min-h-11 w-full shrink-0 gap-2 sm:w-auto"><Eye aria-hidden className="size-4" />Preview profile</ButtonLink>
      </div>
    </header>
    <div className="min-w-0 rounded-panel border bg-background">
      <section aria-labelledby="profile-image-title" className="p-4 sm:p-6">
        <h2 id="profile-image-title" className="text-section">Profile image</h2>
        <p className="mt-1 mb-4 text-meta text-fg-secondary">Choose the photo or logo visitors see on your profile.</p>
        <ImageUpload profileId={profileId} hasImage={!!photoUrl} image={image} logo={values.logo} fullName={fullName} disabled={saving} onBusyChange={setMediaBusy} />
      </section>
      <ImagePresentationPicker logo={values.logo} hasImage={!!photoUrl} disabled={pending} onChange={logo => setValues({ ...values, logo })} />
      <AccentPicker value={values.accent} disabled={pending} onChange={accent => setValues({ ...values, accent })} />
      {error ? <p ref={errorRef} role="alert" tabIndex={-1} className="px-4 pb-4 text-body text-destructive outline-none sm:px-6">{error}</p> : null}
      <EditorFooter dirty={dirty} saving={saving} disabled={mediaBusy} sticky={false} showStatus={false} onCancel={() => router.push("/app/profiles/" + profileId)} />
    </div>
  </form>;
}
