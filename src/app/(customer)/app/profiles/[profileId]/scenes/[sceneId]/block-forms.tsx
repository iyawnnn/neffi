"use client";

import { Ellipsis, Layers, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BlockType } from "@/modules/profiles/block-content";
import { DialogCancel, EditorDialog } from "../../editor-dialogs";
import { ItemFields } from "./item-fields";
import { addBlockAction, deleteSceneAction, renameSceneAction, updateBlockAction, type SceneActionState } from "./actions";

const motion = "interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none";
const fieldClass = "h-11 rounded-[10px]";

type Target = { profileId: string; sceneId: string };
function HiddenTarget({ profileId, sceneId, blockId }: Target & { blockId?: string }) {
  return <><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="sceneId" value={sceneId} />{blockId ? <input type="hidden" name="blockId" value={blockId} /> : null}</>;
}
function Feedback({ state }: { state: SceneActionState | undefined }) {
  return <>{state?.error ? <p role="alert" className="text-meta text-destructive">{state.error}</p> : null}{state?.gaps?.length ? <ul className="list-inside list-disc text-meta text-fg-secondary">{state.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul> : null}</>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">{label}{children}{hint ? <span className="text-meta font-normal text-fg-secondary">{hint}</span> : null}</label>;
}
function Submit({ pending, children, className }: { pending: boolean; children: ReactNode; className?: string }) {
  return <Button type="submit" size="touch" disabled={pending} className={cn("min-h-11 rounded-[10px] sm:h-[42px]", motion, className)}>{children}</Button>;
}

export function SceneMenu({ profileId, sceneId, name, canDelete }: Target & { name: string; canDelete: boolean }) {
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [renameState, renameAction, renamePending] = useActionState(renameSceneAction, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSceneAction, undefined);
  const close = (open: boolean) => { if (!open) setDialog(null); };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="touch" variant="outline" aria-label="More profile mode options" className={cn("size-12 min-h-0 rounded-[10px] px-0 hover:border-border-strong hover:bg-canvas sm:size-11", motion)} />}>
          <Ellipsis aria-hidden className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-[10px] p-1.5">
          <DropdownMenuItem onClick={() => setDialog("rename")} className="min-h-11 cursor-pointer gap-2.5 rounded-lg px-2.5 text-body"><Pencil aria-hidden />Rename mode</DropdownMenuItem>
          {canDelete ? <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")} className="min-h-11 cursor-pointer gap-2.5 rounded-lg px-2.5 text-body"><Trash2 aria-hidden />Delete mode</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <EditorDialog open={dialog === "rename"} onOpenChange={close} icon={Layers} title="Rename mode" description="Visitors don't see this name. It helps you tell your profile modes apart.">
        <form action={renameAction} className="flex flex-col gap-5">
          <HiddenTarget profileId={profileId} sceneId={sceneId} />
          <Field label="Mode name"><Input name="name" defaultValue={name} required maxLength={40} className={fieldClass} /></Field>
          <Feedback state={renameState} />
          <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end"><DialogCancel /><Submit pending={renamePending}>Save name</Submit></div>
        </form>
      </EditorDialog>
      {canDelete ? (
        <EditorDialog open={dialog === "delete"} onOpenChange={close} icon={Trash2} iconClassName="bg-destructive/10 text-destructive" title={`Delete ${name}?`} description="This deletes the profile mode and everything in it. It can't be undone.">
          <form action={deleteAction} className="flex flex-col gap-5">
            <HiddenTarget profileId={profileId} sceneId={sceneId} /><input type="hidden" name="confirm" value="on" />
            <Feedback state={deleteState} />
            <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end"><DialogCancel /><Submit pending={deletePending} className="bg-destructive text-white hover:bg-destructive/90">Delete mode</Submit></div>
          </form>
        </EditorDialog>
      ) : null}
    </>
  );
}

export function BlockForm({ profileId, sceneId, blockId, type, content = {}, cancelHref }: Target & { blockId?: string; type: BlockType; content?: Record<string, unknown>; cancelHref: string }) {
  const [state, action, pending] = useActionState(blockId ? updateBlockAction : addBlockAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-5">
      <HiddenTarget profileId={profileId} sceneId={sceneId} blockId={blockId} />
      <ItemFields type={type} content={content} editing={!!blockId} errors={state?.fields} />
      <Feedback state={state} />
      <div className="flex flex-col-reverse gap-2.5 border-t pt-5 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={cn("inline-flex min-h-11 items-center justify-center rounded-[10px] border px-4 text-body font-medium hover:border-border-strong hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:h-[42px]", motion)}>Cancel</Link>
        <Submit pending={pending}>{blockId ? "Save changes" : type === "link" ? "Add link" : type === "form" ? "Add contact form" : type === "about" || type === "project" ? "Add content" : "Add action"}</Submit>
      </div>
    </form>
  );
}
