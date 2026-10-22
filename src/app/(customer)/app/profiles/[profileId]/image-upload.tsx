"use client";

import { LoaderCircle, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmImageAction, removeImageAction, startImageUploadAction } from "./actions";
import { AppearanceImage } from "./appearance/appearance-controls";

const FAILED = "We couldn't upload that image. Use a JPG, PNG, WebP or HEIC image up to 5 MB.";
const motion = "rounded-[10px] interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none";
export type ImageUploadActions = { start: typeof startImageUploadAction; confirm: typeof confirmImageAction; remove: typeof removeImageAction };

// Files go directly to Cloudinary; the server verifies each upload before storing its id.
export function ImageUpload({ profileId, hasImage, image, logo, fullName, disabled = false, onBusyChange, actions }: { profileId: string; hasImage: boolean; image: string | null; logo: boolean; fullName?: string | null; disabled?: boolean; onBusyChange?: (busy: boolean) => void; actions?: ImageUploadActions }) {
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
      const { ticket, error } = await (actions?.start ?? startImageUploadAction)(profileId);
      if (!ticket) { setMessage(error ?? FAILED); return; }
      const body = new FormData();
      for (const [key, value] of Object.entries(ticket.fields)) body.set(key, value);
      body.set("file", file);
      const response = await fetch(ticket.url, { method: "POST", body });
      const uploaded = response.ok ? ((await response.json()) as { public_id?: string }) : {};
      const result = uploaded.public_id ? await (actions?.confirm ?? confirmImageAction)(profileId, uploaded.public_id) : { error: FAILED };
      if (result.error) { setMessage(result.error); return; }
      setSaved("Image updated."); router.refresh();
    } catch { setMessage(FAILED); }
    finally { pending(null); }
  }
  async function remove() {
    if (disabled || locked.current) return;
    pending("remove"); setMessage(undefined); setSaved(undefined);
    try { await (actions?.remove ?? removeImageAction)(profileId); setSaved("Image removed."); router.refresh(); }
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
