"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import { ArrowLeft, Eye, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { LayoutPicker, ModeToggle, AccentPicker } from "@/components/profile/appearance-pickers";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import type { SceneView } from "@/modules/profiles/scene-view";
import { updateAppearanceAction } from "../actions";
import { EditorFooter } from "../identity/editor-footer";
import { CoverEditor, type CoverEditorImage, type CoverEditorActions } from "../cover-editor";
import "./appearance-form.css";

type AppearanceProps = { profileId: string; view: SceneView; accentColor: string | null; reviewOnly?: boolean; cover?: CoverEditorImage | null; coverActions?: CoverEditorActions };

export function AppearanceForm(props: AppearanceProps) {
  return <Toast.Provider limit={1}><AppearanceEditor {...props} /><AppearanceToasts /></Toast.Provider>;
}

function AppearanceToasts() {
  const { toasts } = Toast.useToastManager();
  return <Toast.Portal><Toast.Viewport className="app-type fixed top-[calc(env(safe-area-inset-top)_+_5.5rem)] right-4 z-[60] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-2">
    {toasts.map(toast => <Toast.Root key={toast.id} toast={toast} className="flex items-center justify-between gap-3 rounded-panel border bg-background p-4 text-foreground shadow-sm"><div><Toast.Title className="text-body font-medium" /><Toast.Description className="mt-1 text-meta text-fg-secondary" /></div><Toast.Close aria-label="Dismiss notification" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"><X aria-hidden className="size-4" /></Toast.Close></Toast.Root>)}
  </Toast.Viewport></Toast.Portal>;
}


function AppearanceEditor({ profileId, view, accentColor, reviewOnly = false, cover = null, coverActions }: AppearanceProps) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const [values, setValues] = useState({ layout: view.appearance.layout, mode: view.appearance.mode, accent: accentColor ?? ACCENTS[0].hex });
  const [saved, setSaved] = useState(values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const lock = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const dirty = values.layout !== saved.layout || values.mode !== saved.mode || values.accent !== saved.accent;
  const validAccent = ACCENTS.some(accent => accent.hex === values.accent);
  const preview = { ...view, appearance: { ...view.appearance, ...values } };

  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  function failure(message: string) {
    setError(message);
    toast.add({ title: "Couldn't save changes", description: "Your changes are still here. Try again.", priority: "high" });
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || !validAccent || coverBusy || lock.current || reviewOnly) return;
    const data = new FormData(event.currentTarget);
    lock.current = true; setSaving(true); setError(undefined);
    try {
      const result = await updateAppearanceAction(undefined, data);
      if (result.error) failure(result.error);
      else { setSaved(values); router.refresh(); toast.add({ title: "Appearance updated" }); }
    } catch { failure("Couldn't save changes. Your changes are still here. Try again."); }
    finally { lock.current = false; setSaving(false); }
  }
  return <>
    <header className="mb-6 flex flex-col gap-4">
      <Link href={"/app/profiles/" + profileId} className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md px-2 text-meta font-medium text-fg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"><ArrowLeft aria-hidden className="size-3.5" />Back to profile</Link>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-title">Appearance</h1><p className="mt-2 text-body text-fg-secondary">Make your profile feel like you.</p></div><Button type="button" variant="outline" size="touch" onClick={() => setPreviewOpen(true)} className="gap-2 rounded-[10px] lg:hidden"><Eye aria-hidden className="size-4" />Preview changes</Button></div>
    </header>
    <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-10">
      <form onSubmit={submit} className="min-w-0 rounded-panel border bg-background">
        <input type="hidden" name="profileId" value={profileId} />
        <LayoutPicker view={preview} value={values.layout} disabled={saving || coverBusy} onChange={layout => setValues({ ...values, layout })} />
        <ModeToggle value={values.mode} disabled={saving || coverBusy} onChange={mode => setValues({ ...values, mode })} />
        <AccentPicker value={values.accent} disabled={saving || coverBusy} onChange={accent => setValues({ ...values, accent })} />
        {values.layout === "showcase" ? <CoverEditor profileId={profileId} cover={cover} actions={coverActions} disabled={saving || (reviewOnly && !coverActions)} onBusyChange={setCoverBusy} /> : null}
        {!validAccent ? <p className="px-4 pb-4 text-meta text-fg-secondary sm:px-6">Choose an accent to save your changes.</p> : null}
        {reviewOnly ? <p role="status" className="px-4 pb-4 text-meta text-fg-secondary sm:px-6">Development preview. Changes are not saved.</p> : null}
        {error ? <p ref={errorRef} role="alert" tabIndex={-1} className="px-4 pb-4 text-body text-destructive outline-none sm:px-6">{error}</p> : null}
        <EditorFooter dirty={dirty && validAccent} saving={saving} disabled={reviewOnly || coverBusy} sticky={false} showStatus={false} onCancel={() => { setValues(saved); router.push("/app/profiles/" + profileId); }} />
      </form>
      <aside data-appearance-preview aria-label="Live profile preview" className="sticky top-28 hidden min-w-0 lg:block">
        <div className="neffi-appearance-preview-scroll max-h-[calc(100dvh-10rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border border-border"><div inert><ProfileRenderer view={preview} /></div></div>
        <p className="mt-3 text-meta text-fg-secondary">Your changes appear here before you save.</p>
      </aside>
    </div>
    <Dialog.Root open={previewOpen} onOpenChange={setPreviewOpen}>
      <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" /><Dialog.Popup className="app-type fixed inset-0 z-50 flex flex-col bg-canvas text-foreground sm:inset-4 sm:mx-auto sm:max-w-[438px] sm:rounded-3xl sm:border">
        <div className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-3 sm:rounded-t-3xl"><Dialog.Title className="text-section">Profile preview</Dialog.Title><Dialog.Close render={<Button type="button" size="icon" variant="ghost" className="size-11" aria-label="Close preview" />}><X aria-hidden className="size-5" /></Dialog.Close></div>
        <Dialog.Description className="sr-only">Preview of your unsaved appearance choices. Close to continue editing.</Dialog.Description>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div inert><ProfileRenderer view={preview} /></div></div>
      </Dialog.Popup></Dialog.Portal>
    </Dialog.Root>
  </>;
}
