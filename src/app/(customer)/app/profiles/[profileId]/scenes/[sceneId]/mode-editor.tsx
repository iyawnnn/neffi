"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Ellipsis, Eye, EyeOff, FileText, Link2, LoaderCircle, Pencil, Plus, Trash2, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { LinkKindIcon } from "@/components/social-icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BLOCK_SECTIONS, type BlockSection, type LinkKind } from "@/modules/profiles/block-options";
import type { BlockType } from "@/modules/profiles/block-content";
import { PLATFORM_GROUPS, PLATFORMS } from "@/modules/profiles/platform-registry";
import type { blockForEditing, sceneForEditing } from "@/modules/profiles/editor";
import { loadItemAction, mutateItemAction, type SceneActionState } from "./actions";
import { BLOCK_META, BlockTile } from "./block-meta";
import { ItemFields } from "./item-fields";
import { FormFields } from "./form-editor";

type Item = NonNullable<Awaited<ReturnType<typeof sceneForEditing>>>["blocks"][number];
type LoadedItem = NonNullable<Awaited<ReturnType<typeof blockForEditing>>>;
type Intent = { section: BlockSection; type?: BlockType; kind?: LinkKind; item?: LoadedItem; loading?: boolean; remove?: Item };
const SECTIONS = [
  { key: "links", title: "Socials & links", description: "Add your social media and important links.", icon: Link2, empty: "Add Facebook, LinkedIn, Instagram or another link." },
  { key: "content", title: "Content", description: "Showcase your work and tell your story.", icon: FileText, empty: "Add an introduction or highlight a project." },
  { key: "actions", title: "Actions", description: "Let visitors take action.", icon: Zap, empty: "Add a way for visitors to connect or take action." },
] as const;
const OPTIONS = { content: ["about", "project"], actions: ["contact", "booking", "form"] } as const;
const help = { about: "Tell visitors a little more about you.", project: "Highlight something you've worked on.", contact: "Let visitors save your details.", booking: "Add your booking link.", form: "Let visitors send you a message." };
const chooserTitle = { links: "Add a social or link", content: "Add content", actions: "Add an action" };
const focusClass = "rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const subscribeViewport = (listener: () => void) => {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", listener); viewport?.addEventListener("scroll", listener);
  return () => { viewport?.removeEventListener("resize", listener); viewport?.removeEventListener("scroll", listener); };
};
const getViewport = () => window.visualViewport ? `${window.visualViewport.offsetTop}:${window.visualViewport.height}` : "";
const serverViewport = () => "";

function describe(item: Item) {
  const c = item.content;
  const kind = (c.kind || "custom") as LinkKind;
  const title = item.type === "link" ? String(c.label || PLATFORMS[kind].label) : item.type === "form" ? item.summary === "Form" ? "Contact form" : item.summary : item.type === "booking" ? String(c.label || BLOCK_META.booking.label) : BLOCK_META[item.type].label;
  const url = typeof c.url === "string" ? c.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "";
  const secondary = item.type === "link" || item.type === "booking" ? url : item.type === "about" ? String(c.text || "") : item.type === "project" ? String(c.title || "") : item.type === "contact" && !c.saveContact ? "Save contact button is off" : BLOCK_META[item.type].description;
  return { title, secondary, icon: item.type === "link" ? <LinkKindIcon kind={kind} /> : <BlockTile icon={BLOCK_META[item.type].icon} /> };
}

export function ModeEditor(props: { profileId: string; sceneId: string; blocks: Item[] }) {
  return <Toast.Provider limit={1}><Editor {...props} /><Notifications /></Toast.Provider>;
}
function Notifications() {
  const { toasts } = Toast.useToastManager();
  return <Toast.Portal><Toast.Viewport className="app-type fixed top-[calc(env(safe-area-inset-top)_+_5.5rem)] right-4 z-[70] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-2">
    {toasts.map(toast => <Toast.Root key={toast.id} toast={toast} className="flex items-center justify-between gap-3 rounded-panel border bg-background p-4 text-foreground shadow-sm"><div><Toast.Title className="text-body font-medium" /><Toast.Description className="mt-1 text-meta text-fg-secondary" /></div><Toast.Close aria-label="Dismiss notification" className={`flex size-11 shrink-0 cursor-pointer items-center justify-center ${focusClass}`}><X aria-hidden className="size-4" /></Toast.Close></Toast.Root>)}
  </Toast.Viewport></Toast.Portal>;
}

function Editor({ profileId, sceneId, blocks }: { profileId: string; sceneId: string; blocks: Item[] }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [result, setResult] = useState<SceneActionState>();
  const [discard, setDiscard] = useState<"close" | "back" | null>(null);
  const [dirty, setDirty] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const activeField = useRef<HTMLElement | null>(null);
  const baseline = useRef("");
  const returnFocus = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const requestId = useRef(0);
  const viewport = useSyncExternalStore(subscribeViewport, getViewport, serverViewport);
  const [top, height] = viewport.split(":");
  const signature = () => form.current ? JSON.stringify([...new FormData(form.current).entries()]) : "";
  useEffect(() => {
    baseline.current = signature();
    if (intent && !intent.loading) heading.current?.focus();
  }, [intent]);

  function close() { requestId.current++; setIntent(null); setResult(undefined); setDirty(false); }
  function requestLeave(action: "back" | "close") {
    if (busyRef.current) return;
    if (dirty) { setDiscard(action); return; }
    if (action === "close") close();
    else { setResult(undefined); setIntent(intent ? { section: intent.section } : null); }
  }
  function open(section: BlockSection, trigger: HTMLElement) {
    returnFocus.current = trigger; setResult(undefined); setDirty(false); setIntent({ section });
  }
  async function edit(section: BlockSection, item: Item, trigger: HTMLElement) {
    open(section, trigger);
    const current = ++requestId.current;
    setIntent({ section, loading: true });
    try {
      const loaded = await loadItemAction(profileId, sceneId, item.id);
      if (current !== requestId.current) return;
      if (!loaded) throw new Error("unavailable");
      setIntent({ section, type: loaded.type, kind: loaded.type === "link" ? loaded.content.kind as LinkKind : undefined, item: loaded });
    } catch {
      if (current !== requestId.current) return;
      close(); router.refresh(); toast.add({ title: "This item is no longer available", priority: "high" });
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!intent || busyRef.current) return;
    const data = new FormData(event.currentTarget);
    data.set("profileId", profileId); data.set("sceneId", sceneId);
    data.set("operation", intent.remove ? "remove" : intent.item ? intent.type === "form" ? "form" : "update" : "add");
    if (intent.item || intent.remove) data.set("blockId", (intent.item || intent.remove)!.id);
    if (intent.item?.form) data.set("formId", intent.item.form.id);
    if (intent.remove) data.set("confirm", "on");
    busyRef.current = true; setBusy(true); setResult(undefined);
    try {
      const response = await mutateItemAction(data);
      if (response.ok) {
        const title = intent.remove ? "Item removed" : intent.item ? "Changes saved" : intent.type === "link" ? "Link added" : intent.type === "form" ? "Contact form added" : intent.section === "content" ? "Content added" : "Action added";
        if (intent.remove) returnFocus.current = document.getElementById(`add-${intent.section}`);
        close(); router.refresh(); toast.add({ title });
      } else { setResult(response); }
    } catch {
      setResult({ error: "Couldn’t save changes. Your changes are still here. Try again." });
      toast.add({ title: "Couldn’t save changes", description: "Your changes are still here. Try again.", priority: "high" });
    }
    finally { busyRef.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!result?.fields || busy) return;
    const first = Object.keys(result.fields)[0];
    form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [result, busy]);
  const title = intent?.remove ? `Remove ${describe(intent.remove).title}?` : intent?.loading ? "Edit item" : intent?.type ? intent.type === "link" ? `${intent.item ? "Edit " : ""}${PLATFORMS[intent.kind || "custom"].label}` : `${intent.item ? "Edit " : ""}${BLOCK_META[intent.type].label}` : intent ? chooserTitle[intent.section] : "";
  return <>
    <div className="flex min-w-0 flex-col gap-5">
      {SECTIONS.map(section => <Section key={section.key} section={section} blocks={blocks.filter(block => (BLOCK_SECTIONS[section.key] as readonly string[]).includes(block.type))} profileId={profileId} sceneId={sceneId} onAdd={trigger => open(section.key, trigger)} onEdit={(item, trigger) => void edit(section.key, item, trigger)} onRemove={(item, trigger) => { returnFocus.current = trigger; setIntent({ section: section.key, remove: item }); }} />)}
    </div>
    <Dialog.Root open={!!intent} onOpenChange={next => { if (!next) requestLeave("close"); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Viewport className="fixed inset-x-0 top-0 z-50 flex h-dvh items-center justify-center p-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]" style={viewport ? { top: `${top}px`, height: `${height}px` } : undefined}>
          <Dialog.Popup aria-modal="true" initialFocus={heading} finalFocus={returnFocus} className="app-type flex max-h-full w-full max-w-[600px] flex-col overflow-hidden rounded-panel border bg-background text-foreground shadow-sm">
            <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3 sm:px-5">
              {intent?.type && !intent.item ? <Button type="button" size="touch" variant="ghost" aria-label="Back to choices" disabled={busy} onClick={() => requestLeave("back")} className="size-11 rounded-[10px] px-0"><ArrowLeft aria-hidden className="size-4" /></Button> : null}
              <Dialog.Title ref={heading} tabIndex={-1} className="min-w-0 flex-1 text-section outline-none">{title}</Dialog.Title>
              <Button type="button" size="touch" variant="ghost" aria-label="Close dialog" disabled={busy} onClick={() => requestLeave("close")} className="size-11 rounded-[10px] px-0"><X aria-hidden className="size-4" /></Button>
            </header>
            <Dialog.Description className="sr-only">{intent?.remove ? "Visitors will no longer see this item." : "Choose and edit what visitors see in this profile mode."}</Dialog.Description>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-4 [scrollbar-width:thin] sm:p-5">
              {intent?.loading ? <p role="status" className="flex items-center gap-2 py-6 text-body text-fg-secondary"><LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />Loading item…</p> : intent && !intent.type && !intent.remove ? <Chooser section={intent.section} onChoose={(type, kind) => setIntent({ section: intent.section, type, kind })} /> : intent ? <form ref={form} onSubmit={submit} onFocusCapture={event => { if (event.target.matches("input,textarea,select")) activeField.current = event.target; }} onChange={() => setDirty(signature() !== baseline.current)} className="flex flex-col gap-5">
                <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
                  {intent.remove ? <p className="text-body text-fg-secondary">Visitors will no longer see it. You can add it again later.</p> : intent.item?.type === "form" && intent.item.form ? <>
                    {(intent.item.form.useCount || 0) > 1 ? <p className="text-meta text-fg-secondary">Changes apply wherever this contact form is used.</p> : null}
                    <FormFields form={intent.item.form} errors={result?.fields} onStructureChange={() => requestAnimationFrame(() => { if (form.current) setDirty(signature() !== baseline.current); })} />
                  </> : intent.type ? <>
                    <div className="flex items-center gap-3">{intent.type === "link" ? <LinkKindIcon kind={intent.kind || "custom"} /> : <BlockTile icon={BLOCK_META[intent.type].icon} />}<p className="text-body text-fg-secondary">{intent.type === "link" ? PLATFORMS[intent.kind || "custom"].help : BLOCK_META[intent.type].description}</p></div>
                    <ItemFields type={intent.type} content={intent.item?.content || (intent.kind ? { kind: intent.kind } : {})} editing={!!intent.item} errors={result?.fields} />
                  </> : null}
                </fieldset>
                {result?.error ? <p role="alert" className="text-body text-destructive">{result.error}</p> : null}
                {result?.gaps?.map(gap => <p key={gap} className="text-meta text-fg-secondary">{gap}</p>)}
                <footer className="flex flex-wrap justify-end gap-2.5 border-t pt-4">
                  <Button type="button" size="touch" variant="outline" disabled={busy} onClick={() => requestLeave("close")} className="rounded-[10px]">Cancel</Button>
                  <Button type="submit" size="touch" variant={intent.remove ? "destructive" : "action"} disabled={busy} className="gap-2 rounded-[10px]">{busy ? <><LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />{intent.remove ? "Removing…" : intent.item ? "Saving…" : "Adding…"}</> : intent.remove ? "Remove" : intent.item ? "Save changes" : intent.type === "link" ? "Add link" : intent.type === "form" ? "Add contact form" : intent.section === "content" ? "Add content" : "Add action"}</Button>
                </footer>
              </form> : null}
            </div>
            <Dialog.Root open={discard !== null} onOpenChange={next => { if (!next) setDiscard(null); }}>
              <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[60] bg-foreground/30" /><Dialog.Popup finalFocus={() => activeField.current?.isConnected ? activeField.current : heading.current || returnFocus.current} className="app-type fixed top-1/2 left-1/2 z-[60] w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-panel border bg-background p-5 text-foreground shadow-sm">
                <Dialog.Title className="text-section">Discard changes?</Dialog.Title><Dialog.Description className="mt-2 text-body text-fg-secondary">Your changes haven’t been saved.</Dialog.Description>
                <div className="mt-5 flex flex-wrap justify-end gap-2"><Dialog.Close render={<Button size="touch" variant="outline" className="rounded-[10px]" />}>Keep editing</Dialog.Close><Button size="touch" variant="destructive" className="rounded-[10px]" onClick={() => { const action = discard; setDiscard(null); setDirty(false); if (action === "back" && intent) setIntent({ section: intent.section }); else close(); }}>Discard changes</Button></div>
              </Dialog.Popup></Dialog.Portal>
            </Dialog.Root>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}

export function Chooser({ section, onChoose }: { section: BlockSection; onChoose: (type: BlockType, kind?: LinkKind) => void }) {
  if (section === "links") return <div className="flex flex-col gap-5">{PLATFORM_GROUPS.map(group => <div key={group.label}><h3 className="mb-2 text-label text-fg-secondary">{group.label}</h3><ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{group.kinds.map(kind => <li key={kind}><Button type="button" size="touch" variant="ghost" onClick={() => onChoose("link", kind)} className="h-14 min-h-11 w-full justify-start gap-2.5 rounded-[10px] border border-border px-2.5 text-left text-meta whitespace-normal hover:bg-canvas"><LinkKindIcon kind={kind} className="size-8 rounded-lg [&_svg]:size-4" /><span className="min-w-0">{PLATFORMS[kind].label}</span></Button></li>)}</ul></div>)}</div>;
  return <ul className="flex flex-col gap-2">{OPTIONS[section].map(type => <li key={type}><Button type="button" size="touch" variant="ghost" onClick={() => onChoose(type)} className="h-auto min-h-[72px] w-full justify-start gap-3 rounded-[10px] border border-border px-3 py-3 text-left whitespace-normal hover:bg-canvas"><BlockTile icon={BLOCK_META[type].icon} /><span className="min-w-0 flex-1"><span className="block text-body font-medium">{BLOCK_META[type].label}</span><span className="mt-0.5 block text-meta font-normal text-fg-secondary">{help[type]}</span></span><ChevronRight aria-hidden className="size-4 text-fg-secondary" /></Button></li>)}</ul>;
}

function Section({ section, blocks, profileId, sceneId, onAdd, onEdit, onRemove }: { section: typeof SECTIONS[number]; blocks: Item[]; profileId: string; sceneId: string; onAdd: (trigger: HTMLElement) => void; onEdit: (item: Item, trigger: HTMLElement) => void; onRemove: (item: Item, trigger: HTMLElement) => void }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const [reordering, setReordering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const lock = useRef(false);
  const [status, setStatus] = useState("");
  const focusAfter = useRef<{ id: string; direction: string } | null>(null);
  const ref = useRef<HTMLElement>(null);
  const pending = busy || refreshing;
  const Icon = section.icon;
  const wasReordering = useRef(false);
  if (reordering && blocks.length < 2) setReordering(false);
  useEffect(() => {
    if (pending) return;
    if (wasReordering.current && !reordering) document.getElementById(`add-${section.key}`)?.focus();
    wasReordering.current = reordering;
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    const row = ref.current?.querySelector<HTMLElement>(`[data-item-id="${target.id}"]`);
    const preferred = row?.querySelector<HTMLButtonElement>(`[data-direction="${target.direction}"]`);
    (preferred && !preferred.disabled ? preferred : row?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
  }, [pending, blocks, reordering, section.key]);
  async function mutate(item: Item, operation: "visibility" | "move", direction?: "up" | "down") {
    if (lock.current || pending) return;
    lock.current = true; setBusy(true); setStatus("");
    const data = new FormData();
    for (const [key, value] of Object.entries({ profileId, sceneId, blockId: item.id, section: section.key, operation, visible: String(!item.visible), ...(direction ? { direction } : {}) })) data.set(key, value);
    try {
      const result = await mutateItemAction(data);
      if (result.ok) {
        if (direction) { focusAfter.current = { id: item.id, direction }; setStatus(`Moved ${describe(item).title} ${direction}.`); }
        else toast.add({ title: item.visible ? "Item hidden" : "Item shown" });
        startRefresh(() => router.refresh());
      } else { setStatus(result.error || "Couldn’t save changes. Try again."); }
    } catch { setStatus("Couldn’t save changes. Try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section ref={ref} aria-labelledby={`section-${section.key}`} className="overflow-hidden rounded-panel border bg-background">
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 p-4 sm:px-5">
      <h2 id={`section-${section.key}`} className="flex min-w-0 items-center gap-2 text-section"><Icon aria-hidden className="size-[18px] shrink-0 text-fg-secondary" />{section.title}</h2>
      <div className="flex items-center gap-1">
        {reordering ? <Button type="button" size="touch" variant="outline" disabled={pending} onClick={() => setReordering(false)} className="rounded-[10px] px-3">Done</Button> : <>{blocks.length > 1 ? <Button type="button" size="touch" variant="ghost" aria-label={`Reorder ${section.title}`} onClick={() => setReordering(true)} className="rounded-[10px] px-2 text-meta text-fg-secondary">Reorder</Button> : null}<Button id={`add-${section.key}`} type="button" size="touch" variant="outline" aria-label={`Add to ${section.title}`} onClick={event => onAdd(event.currentTarget)} className="gap-1 rounded-[10px] px-3"><Plus aria-hidden className="size-3.5" />Add</Button></>}
      </div>
      <p className="col-span-full text-meta text-fg-secondary">{section.description}</p>
    </header>
    {blocks.length ? <ul className="divide-y border-t">{blocks.map((item, index) => {
      const detail = describe(item);
      const identity = <><span className="shrink-0">{detail.icon}</span><span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="flex min-w-0 items-center gap-2"><span className="truncate text-body font-medium">{detail.title}</span>{!item.visible ? <span className="rounded-md bg-subtle px-1.5 py-0.5 text-label text-fg-secondary">Hidden</span> : null}</span><span className="truncate text-meta text-fg-secondary">{detail.secondary}</span></span></>;
      return <li key={item.id} data-item-id={item.id} className="flex min-h-16 items-center gap-1 px-3 py-2 sm:px-4">
        {reordering ? <><div className="flex min-w-0 flex-1 items-center gap-3 px-1">{identity}</div>{(["up", "down"] as const).map(direction => <Button key={direction} type="button" size="touch" variant="outline" aria-label={`Move ${detail.title} ${direction}`} data-direction={direction} disabled={pending || (direction === "up" ? index === 0 : index === blocks.length - 1)} onClick={() => void mutate(item, "move", direction)} className="size-11 shrink-0 rounded-[10px] px-0">{direction === "up" ? <ArrowUp aria-hidden className="size-4" /> : <ArrowDown aria-hidden className="size-4" />}</Button>)}</> : <>
          <button type="button" aria-label={`Edit ${detail.title}`} onClick={event => onEdit(item, event.currentTarget)} className={`flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 px-1 text-left hover:bg-canvas ${focusClass}`}>{identity}</button>
          <button type="button" role="switch" aria-checked={item.visible} aria-label={`Show ${detail.title} to visitors`} disabled={pending} onClick={() => void mutate(item, "visibility")} className={`flex size-11 shrink-0 cursor-pointer items-center justify-center disabled:opacity-50 ${focusClass}`}><span className={`relative h-5 w-8 rounded-full ${item.visible ? "bg-foreground" : "bg-border-strong"}`}><span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-background transition-transform interact duration-[220ms] motion-reduce:transition-none ${item.visible ? "translate-x-3" : ""}`} /></span></button>
          <DropdownMenu><DropdownMenuTrigger render={<Button size="touch" variant="ghost" aria-label={`Options for ${detail.title}`} className="size-11 shrink-0 rounded-[10px] px-0 text-fg-secondary" />}><Ellipsis aria-hidden className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44 rounded-[10px] p-1.5">
            <DropdownMenuItem className="min-h-11 cursor-pointer rounded-lg text-body" onClick={() => onEdit(item, ref.current?.querySelector<HTMLElement>(`[data-item-id="${item.id}"] button`) || document.getElementById(`add-${section.key}`)!)}><Pencil aria-hidden />Edit</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 cursor-pointer rounded-lg text-body" disabled={pending} onClick={() => void mutate(item, "visibility")}>{item.visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}{item.visible ? "Hide" : "Show"}</DropdownMenuItem>
            <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" className="min-h-11 cursor-pointer rounded-lg text-body" onClick={() => onRemove(item, ref.current?.querySelector<HTMLElement>(`[data-item-id="${item.id}"] button`) || document.getElementById(`add-${section.key}`)!)}><Trash2 aria-hidden />Remove</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>
        </>}
      </li>;
    })}</ul> : <p className="border-t px-4 py-4 text-meta text-fg-secondary sm:px-5">{section.empty}</p>}
    <p role="status" className={status ? "border-t px-4 py-2 text-meta text-fg-secondary" : "sr-only"}>{status}</p>
  </section>;
}
