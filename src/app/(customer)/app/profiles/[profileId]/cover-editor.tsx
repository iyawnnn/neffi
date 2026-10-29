"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Minus, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { initialCoverCrop, maxCoverCropWidth, moveCoverCrop, resizeCoverCrop } from "@/components/profile/cover-crop";
import type { CoverCrop } from "@/modules/profiles/cover";
import { confirmCoverAction, discardCoverUploadAction, removeCoverAction, startImageUploadAction, updateCoverCropAction } from "./actions";
import "./cover-editor.css";

const IMAGE_ERROR = "Use a JPG, PNG, WebP or HEIC image up to 5 MB.";
const CROP_ERROR = "This image needs a 3:1 crop at least 600 pixels wide.";

export type CoverEditorImage = {
  assetId: string;
  src: string;
  width: number;
  height: number;
  crop: CoverCrop;
};

type UploadTicket = { url: string; fields: Record<string, string> };
type UploadedImage = { public_id?: string; width?: number; height?: number; secure_url?: string };

export type CoverEditorActions = {
  start: (profileId: string, kind: "cover") => Promise<{ ticket?: UploadTicket; error?: string }>;
  upload: (ticket: UploadTicket, file: File) => Promise<UploadedImage>;
  confirm: (profileId: string, assetId: string, crop: CoverCrop) => Promise<{ ok?: true; error?: string }>;
  crop: (profileId: string, crop: CoverCrop) => Promise<{ error?: string }>;
  remove: (profileId: string) => Promise<void>;
  discard: (profileId: string, assetId: string) => Promise<void>;
};

type Candidate = CoverEditorImage & { fresh: boolean };

function acceptedFile(file: File) {
  return file.size <= 5_000_000 && (/^image\/(jpeg|png|webp|heic)$/i.test(file.type) || /\.(jpe?g|png|webp|heic)$/i.test(file.name));
}

async function uploadToCloudinary(ticket: UploadTicket, file: File): Promise<UploadedImage> {
  const body = new FormData();
  for (const [key, value] of Object.entries(ticket.fields)) body.set(key, value);
  body.set("file", file);
  const response = await fetch(ticket.url, { method: "POST", body });
  return response.ok ? response.json() as Promise<UploadedImage> : {};
}

function sourceUrl(url: string) {
  return url.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
}

export function CoverEditor({
  profileId,
  cover,
  disabled = false,
  onBusyChange,
  onSaved,
  actions,
}: {
  profileId: string;
  cover: CoverEditorImage | null;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onSaved?: (cover: CoverEditorImage | null) => void;
  actions?: Partial<CoverEditorActions>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const firstAction = useRef<HTMLButtonElement>(null);
  const locked = useRef(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [reposition, setReposition] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [active, setActive] = useState({ source: cover, value: cover });
  const [busy, setBusy] = useState<"upload" | "save" | "remove" | null>(null);
  const [message, setMessage] = useState<string>();
  const id = useId();
  if (active.source !== cover) setActive({ source: cover, value: cover });
  const activeCover = active.source === cover ? active.value : cover;
  const current = candidate ?? (reposition && activeCover ? { ...activeCover, fresh: false } : null);
  const unavailable = disabled || !!busy;

  const api: CoverEditorActions = {
    start: actions?.start ?? ((id, kind) => startImageUploadAction(id, kind)),
    upload: actions?.upload ?? uploadToCloudinary,
    confirm: actions?.confirm ?? ((id, assetId, crop) => confirmCoverAction(id, assetId, crop)),
    crop: actions?.crop ?? ((id, crop) => updateCoverCropAction(id, crop)),
    remove: actions?.remove ?? (id => removeCoverAction(id)),
    discard: actions?.discard ?? ((id, assetId) => discardCoverUploadAction(id, assetId)),
  };

  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);

  function pending(next: "upload" | "save" | "remove" | null) {
    locked.current = next !== null;
    setBusy(next);
    onBusyChange?.(next !== null || !!candidate || reposition || removeOpen);
  }
  function closeCrop() {
    setCandidate(null);
    setReposition(false);
    onBusyChange?.(false);
  }
  async function openUpload(file: File) {
    if (unavailable || locked.current) return;
    setMessage(undefined);
    if (!acceptedFile(file)) { setMessage(IMAGE_ERROR); return; }
    pending("upload");
    let cropOpen = false;
    let uploadedId: string | undefined;
    try {
      const started = await api.start(profileId, "cover");
      if (!started.ticket) { setMessage(started.error ?? IMAGE_ERROR); return; }
      uploadedId = started.ticket.fields.public_id;
      const uploaded = await api.upload(started.ticket, file);
      const assetId = typeof started.ticket.fields.public_id === "string" ? started.ticket.fields.public_id : undefined;
      const width = uploaded.width;
      const height = uploaded.height;
      const crop = typeof width === "number" && typeof height === "number" ? initialCoverCrop(width, height) : null;
      if (!assetId || uploaded.public_id !== assetId || !crop || !uploaded.secure_url || typeof width !== "number" || typeof height !== "number") {
        if (assetId) await api.discard(profileId, assetId).catch(() => undefined);
        setMessage(crop ? IMAGE_ERROR : CROP_ERROR);
        return;
      }
      setCandidate({ assetId, src: sourceUrl(uploaded.secure_url), width, height, crop, fresh: true });
      cropOpen = true;
      onBusyChange?.(true);
    } catch {
      if (uploadedId) await api.discard(profileId, uploadedId).catch(() => undefined);
      setMessage("We couldn't upload that cover. Try again.");
    }
    finally { locked.current = false; setBusy(null); onBusyChange?.(cropOpen); }
  }
  async function cancelCrop() {
    if (!current || locked.current) return;
    if (!current.fresh) { closeCrop(); return; }
    pending("save");
    try { await api.discard(profileId, current.assetId); closeCrop(); }
    catch { setMessage("We couldn't discard that cover. Try again."); }
    finally { locked.current = false; setBusy(null); }
  }
  async function saveCrop() {
    if (!current || locked.current) return;
    pending("save"); setMessage(undefined);
    try {
      const result = current.fresh
        ? await api.confirm(profileId, current.assetId, current.crop)
        : await api.crop(profileId, current.crop);
      if (result.error) { setMessage(result.error); return; }
      const saved = { ...current, fresh: false };
      setActive({ source: cover, value: saved });
      closeCrop(); onSaved?.(saved); router.refresh();
      requestAnimationFrame(() => firstAction.current?.focus());
    } catch { setMessage("We couldn't save that cover. Try again."); }
    finally { locked.current = false; setBusy(null); }
  }
  async function remove() {
    if (!activeCover || locked.current) return;
    pending("remove"); setMessage(undefined);
    try { await api.remove(profileId); setActive({ source: cover, value: null }); setRemoveOpen(false); onBusyChange?.(false); onSaved?.(null); router.refresh(); requestAnimationFrame(() => firstAction.current?.focus()); }
    catch { setMessage("We couldn't remove that cover. Try again."); }
    finally { locked.current = false; setBusy(null); }
  }

  return <section className="border-t px-4 py-6 sm:px-6 sm:py-7" aria-labelledby={id + "-title"}>
    <h2 id={id + "-title"} className="text-section">Cover image</h2>
    <p className="mt-1 text-meta text-fg-secondary">Optional. Without one, your selected accent colour fills the Showcase header.</p>
    {activeCover ? <div className="relative mt-5 aspect-[3/1] w-full overflow-hidden rounded-md bg-canvas">
      <img src={activeCover.src} alt="" className="absolute max-w-none object-cover" style={{ width: `${activeCover.width / activeCover.crop.width * 100}%`, height: "auto", left: `${-activeCover.crop.x / activeCover.crop.width * 100}%`, top: `${-activeCover.crop.y / Math.round(activeCover.crop.width / 3) * 100}%` }} />
    </div> : null}
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {activeCover ? <>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
        <Button ref={firstAction} type="button" size="touch" variant="outline" disabled={unavailable} onClick={() => { setMessage(undefined); setReposition(true); onBusyChange?.(true); }}><Pencil aria-hidden className="size-4" />Reposition</Button>
        <Button type="button" size="touch" variant="outline" disabled={unavailable} onClick={() => input.current?.click()}><Upload aria-hidden className="size-4" />Replace</Button>
        </div>
        <Button type="button" size="touch" variant="outline" disabled={unavailable} onClick={() => { setMessage(undefined); setRemoveOpen(true); onBusyChange?.(true); }} className="w-full gap-2 border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive focus-visible:border-destructive focus-visible:ring-destructive/20 sm:w-auto"><Trash2 aria-hidden className="size-3.5" />Remove cover</Button>
      </> : <Button ref={firstAction} type="button" size="touch" variant="outline" disabled={unavailable} onClick={() => input.current?.click()} className="self-start"><Upload aria-hidden className="size-4" />Add cover</Button>}
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,.heic" className="sr-only" tabIndex={-1} disabled={unavailable} aria-label="Choose cover image" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void openUpload(file); }} />
    {message && !current && !removeOpen ? <p role="alert" className="mt-3 text-meta text-destructive">{message}</p> : null}
    {current ? <CropDialog image={current} busy={busy === "save"} message={message} returnFocus={firstAction}
      onChange={crop => setCandidate({ ...current, crop })} onCancel={() => void cancelCrop()} onSave={() => void saveCrop()} /> : null}
    <Dialog.Root open={removeOpen} onOpenChange={open => { if (!busy) { setRemoveOpen(open); if (!open) onBusyChange?.(false); } }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup finalFocus={firstAction} className="app-type fixed top-1/2 left-1/2 z-50 w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-panel border bg-background p-5 text-foreground shadow-sm">
          <Dialog.Title className="text-section">Remove cover?</Dialog.Title>
          <Dialog.Description className="mt-2 text-body text-fg-secondary">Your Showcase header will return to the accent colour.</Dialog.Description>
          {message ? <p role="alert" className="mt-3 text-meta text-destructive">{message}</p> : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" size="touch" variant="outline" disabled={!!busy} onClick={() => { setRemoveOpen(false); onBusyChange?.(false); }}>Cancel</Button>
            <Button type="button" size="touch" variant="danger" disabled={!!busy} loading={busy === "remove"} loadingText="Removing cover..." onClick={() => void remove()}>Remove</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </section>;
}

function CropDialog({ image, busy, message, returnFocus, onChange, onCancel, onSave }: { image: Candidate; busy: boolean; message?: string; returnFocus: RefObject<HTMLButtonElement | null>; onChange: (crop: CoverCrop) => void; onCancel: () => void; onSave: () => void }) {
  const drag = useRef<{ id: number; x: number; y: number; crop: CoverCrop } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const crop = image.crop;
  const maxWidth = maxCoverCropWidth(image.width, image.height);
  const zoom = maxWidth / crop.width;
  const maxZoom = maxWidth / 600;
  const percentage = `${Math.round(zoom * 100)}%`;
  const zoomId = useId();
  const helpId = useId();
  function move(event: React.PointerEvent<HTMLElement>) {
    if (busy || !loaded || !drag.current || drag.current.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const start = drag.current;
    const dx = (start.x - event.clientX) * start.crop.width / Math.max(rect.width, 1);
    const dy = (start.y - event.clientY) * Math.round(start.crop.width / 3) / Math.max(rect.height, 1);
    onChange(moveCoverCrop(start.crop, image.width, image.height, dx, dy));
  }
  function nudge(event: React.KeyboardEvent<HTMLElement>) {
    if (busy || !loaded) return;
    const offset = event.shiftKey ? 1 : 10;
    const delta = event.key === "ArrowLeft" ? [-offset, 0] : event.key === "ArrowRight" ? [offset, 0] : event.key === "ArrowUp" ? [0, -offset] : event.key === "ArrowDown" ? [0, offset] : null;
    if (delta) {
      event.preventDefault();
      onChange(moveCoverCrop(crop, image.width, image.height, delta[0], delta[1]));
    }
  }
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onCancel(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
      <Dialog.Popup initialFocus={frame} finalFocus={returnFocus} className="app-type fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-panel border bg-background p-4 text-foreground shadow-sm sm:p-6">
        <div className="relative pr-11">
          <div>
            <Dialog.Title className="text-section">Frame your cover</Dialog.Title>
            <Dialog.Description className="mt-2 text-meta text-fg-secondary">Drag to reposition and use Zoom to choose your framing.</Dialog.Description>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="Close cover crop" disabled={busy} onClick={onCancel} className="absolute -top-2 -right-2 size-11 text-fg-secondary"><X aria-hidden className="size-4" /></Button>
        </div>
        <div ref={frame} data-crop-frame tabIndex={0} role="application" aria-label="Cover crop frame" aria-describedby={helpId} aria-busy={!loaded && !loadError}
          className="relative mt-6 aspect-[3/1] w-full shrink-0 touch-none overflow-hidden rounded-md bg-canvas outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onPointerDown={event => {
            if (busy || !loaded || drag.current || (event.pointerType === "mouse" && event.button !== 0)) return;
            event.currentTarget.focus();
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, crop };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={move}
          onPointerUp={event => { if (drag.current?.id === event.pointerId) { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); } }}
          onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={nudge}>
          <img src={image.src} alt="" draggable={false} onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setLoadError(true); }}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ width: `${image.width / crop.width * 100}%`, height: "auto", left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / Math.round(crop.width / 3) * 100}%` }} />
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <label className="text-meta font-medium" htmlFor={zoomId}>Zoom</label>
          <output htmlFor={zoomId} className="text-meta tabular-nums text-fg-secondary">{percentage}</output>
        </div>
        <div className="mt-1 flex shrink-0 items-center gap-2 sm:gap-3">
          <Button type="button" size="icon" variant="ghost" aria-label="Zoom out" className="size-11 text-fg-secondary" disabled={busy || !loaded || crop.width >= maxWidth}
            onClick={() => onChange(resizeCoverCrop(crop, image.width, image.height, maxWidth / (zoom - 0.1)))}><Minus aria-hidden className="size-4" /></Button>
          <div className="relative flex min-w-0 flex-1 items-center">
            <div aria-hidden className="pointer-events-none absolute inset-x-2 h-1 overflow-hidden rounded-full bg-border"><div className="h-full bg-brand" style={{ width: `${maxZoom === 1 ? 0 : (zoom - 1) / (maxZoom - 1) * 100}%` }} /></div>
            <input id={zoomId} aria-label="Cover zoom" aria-valuetext={percentage} type="range" min="1" max={maxZoom} step="0.01" value={zoom} disabled={busy || !loaded}
              onChange={event => onChange(resizeCoverCrop(crop, image.width, image.height, maxWidth / Number(event.currentTarget.value)))} className="neffi-cover-zoom relative h-11 w-full min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="Zoom in" className="size-11 text-fg-secondary" disabled={busy || !loaded || crop.width <= 600}
            onClick={() => onChange(resizeCoverCrop(crop, image.width, image.height, maxWidth / (zoom + 0.1)))}><Plus aria-hidden className="size-4" /></Button>
        </div>
        {loadError || message ? <p role="alert" className="mt-3 text-meta text-destructive">{loadError ? "We couldn't load that image. Cancel and try again." : message}</p> : null}
        <p id={helpId} className="mt-2 text-label text-fg-secondary">Use arrow keys to reposition. Hold Shift for finer adjustments.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button type="button" size="touch" variant="action" disabled={busy || !loaded} loading={busy} loadingText="Saving cover..." onClick={onSave}>Save cover</Button>
          <Button type="button" size="touch" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
