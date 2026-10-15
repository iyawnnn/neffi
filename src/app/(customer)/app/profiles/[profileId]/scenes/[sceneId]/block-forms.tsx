"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, inputClass, Textarea } from "@/components/ui/input";
import { LINK_KINDS, LINK_KIND_LABELS } from "@/modules/profiles/block-options";
import type { BlockType } from "@/modules/profiles/block-content";
import { addBlockAction, deleteSceneAction, moveBlockAction, removeBlockAction, renameSceneAction, toggleBlockAction, updateBlockAction, type SceneActionState } from "./actions";

type Target = { profileId: string; sceneId: string };
function HiddenTarget({ profileId, sceneId, blockId }: Target & { blockId?: string }) {
  return <><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="sceneId" value={sceneId} />{blockId ? <input type="hidden" name="blockId" value={blockId} /> : null}</>;
}
function Feedback({ state }: { state: SceneActionState | undefined }) {
  return <>{state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}{state?.gaps?.length ? <ul className="list-inside list-disc text-sm">{state.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul> : null}</>;
}

export function RenameSceneForm({ profileId, sceneId, name }: Target & { name: string }) {
  const [state, action, pending] = useActionState(renameSceneAction, undefined);
  return <form action={action} className="flex flex-col gap-3"><HiddenTarget profileId={profileId} sceneId={sceneId} /><label className="flex flex-col gap-1 text-sm">Name<Input name="name" defaultValue={name} required maxLength={40} /></label><Feedback state={state} /><Button type="submit" size="touch" disabled={pending}>Rename</Button></form>;
}
export function DeleteSceneForm({ profileId, sceneId }: Target) {
  const [state, action, pending] = useActionState(deleteSceneAction, undefined);
  return <form action={action} className="flex flex-col gap-3"><HiddenTarget profileId={profileId} sceneId={sceneId} /><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" required />I understand this deletes this scene and its items</label><Feedback state={state} /><Button type="submit" size="touch" variant="destructive" disabled={pending}>Delete scene</Button></form>;
}

export function BlockControls({ profileId, sceneId, blockId, visible, first, last }: Target & { blockId: string; visible: boolean; first: boolean; last: boolean }) {
  const [upState, upAction, upPending] = useActionState(moveBlockAction, undefined);
  const [downState, downAction, downPending] = useActionState(moveBlockAction, undefined);
  const [visibilityState, visibilityAction, visibilityPending] = useActionState(toggleBlockAction, undefined);
  const [removeState, removeAction, removePending] = useActionState(removeBlockAction, undefined);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={upAction}><HiddenTarget profileId={profileId} sceneId={sceneId} blockId={blockId} /><input type="hidden" name="direction" value="up" /><Button type="submit" size="touch" variant="outline" disabled={first || upPending}>Move up</Button></form>
        <form action={downAction}><HiddenTarget profileId={profileId} sceneId={sceneId} blockId={blockId} /><input type="hidden" name="direction" value="down" /><Button type="submit" size="touch" variant="outline" disabled={last || downPending}>Move down</Button></form>
        <form action={visibilityAction}><HiddenTarget profileId={profileId} sceneId={sceneId} blockId={blockId} /><input type="hidden" name="visible" value={String(!visible)} /><Button type="submit" size="touch" variant="outline" disabled={visibilityPending}>{visible ? "Hide" : "Show"}</Button></form>
      </div>
      <Feedback state={upState} /><Feedback state={downState} /><Feedback state={visibilityState} />
      <form action={removeAction} className="flex flex-col gap-2">
        <HiddenTarget profileId={profileId} sceneId={sceneId} blockId={blockId} />
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" required />Remove this item</label>
        <Feedback state={removeState} /><Button type="submit" size="touch" variant="outline" disabled={removePending}>Remove</Button>
      </form>
    </div>
  );
}

export function BlockForm({ profileId, sceneId, blockId, type, content = {} }: Target & { blockId?: string; type: BlockType; content?: Record<string, unknown> }) {
  const [state, action, pending] = useActionState(blockId ? updateBlockAction : addBlockAction, undefined);
  const value = (key: string) => typeof content[key] === "string" ? content[key] as string : "";
  return (
    <form action={action} className="flex flex-col gap-4">
      <HiddenTarget profileId={profileId} sceneId={sceneId} blockId={blockId} /><input type="hidden" name="type" value={type} />
      {type === "about" ? <label className="flex flex-col gap-1 text-sm">About you<Textarea name="text" defaultValue={value("text")} required maxLength={1000} /></label> : null}
      {type === "project" ? <><label className="flex flex-col gap-1 text-sm">Project name<Input name="title" defaultValue={value("title")} required maxLength={80} /></label><label className="flex flex-col gap-1 text-sm">Short description<Textarea name="description" defaultValue={value("description")} maxLength={500} /></label><label className="flex flex-col gap-1 text-sm">Link<Input name="url" defaultValue={value("url")} inputMode="url" /></label></> : null}
      {type === "link" ? <><label className="flex flex-col gap-1 text-sm">Type<select name="kind" className={inputClass} defaultValue={value("kind") || "custom"}>{LINK_KINDS.map(kind => <option key={kind} value={kind}>{LINK_KIND_LABELS[kind]}</option>)}</select></label><label className="flex flex-col gap-1 text-sm">Label<Input name="label" defaultValue={value("label")} maxLength={40} /></label><label className="flex flex-col gap-1 text-sm">Link<Input name="url" defaultValue={value("url")} required inputMode="url" /></label></> : null}
      {type === "contact" ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="saveContact" defaultChecked={content.saveContact === undefined ? true : Boolean(content.saveContact)} />Show a Save Contact button</label> : null}
      {type === "booking" ? <><label className="flex flex-col gap-1 text-sm">Button text<Input name="label" defaultValue={value("label")} placeholder="Book a time" maxLength={40} /></label><label className="flex flex-col gap-1 text-sm">Booking link<Input name="url" defaultValue={value("url")} required inputMode="url" /></label></> : null}
      {type === "form" ? <label className="flex flex-col gap-1 text-sm">Form<select name="preset" className={inputClass} defaultValue="connect"><option value="connect">Connect</option><option value="project_inquiry">Project inquiry</option><option value="contact">Contact</option></select></label> : null}
      <Feedback state={state} /><Button type="submit" size="touch" disabled={pending}>{blockId ? "Save" : "Add"}</Button>
    </form>
  );
}
