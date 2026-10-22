"use client";

import { Eye, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { LinkKindIcon } from "@/components/social-icons";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { GOALS, NO_GOAL, type Goal } from "@/modules/profiles/goals";
import { PLATFORMS } from "@/modules/profiles/platform-registry";
import type { BlockType } from "@/modules/profiles/block-content";
import type { LinkKind } from "@/modules/profiles/block-options";
import type { SceneView } from "@/modules/profiles/scene-view";
import { ModeEditor, type ModeEditorActions, type ModeEditorItem } from "../../profiles/[profileId]/scenes/[sceneId]/mode-editor";
import { BLOCK_META, BlockTile } from "../../profiles/[profileId]/scenes/[sceneId]/block-meta";
import { SetupView } from "./setup-view";
import { SetupPreviewDialog } from "./setup-preview";

type Suggestion = { id: string; type: BlockType; kind?: LinkKind; label: string; description: string; initialLabel?: string };
export function setupSuggestions(goal: Goal | null): Suggestion[] {
  return (goal ? GOALS[goal] : NO_GOAL).suggestions.map(suggestion => {
    if (typeof suggestion !== "string") return { id: "resume", type: "link", kind: "custom", label: suggestion.label, description: PLATFORMS.custom.help, initialLabel: suggestion.label };
    if (suggestion === "project" || suggestion === "booking" || suggestion === "form") return { id: suggestion, type: suggestion, ...BLOCK_META[suggestion] };
    return { id: suggestion, type: "link", kind: suggestion, label: PLATFORMS[suggestion].label, description: PLATFORMS[suggestion].help };
  });
}
function itemDetails(item: ModeEditorItem) {
  const kind = item.content.kind as LinkKind;
  return {
    label: item.type === "link" ? String(item.content.label || PLATFORMS[kind].label) : item.type === "form" ? item.summary === "Form" ? "Contact form" : item.summary : item.type === "booking" ? String(item.content.label || BLOCK_META.booking.label) : BLOCK_META[item.type].label,
    description: String(item.content.url || (item.type === "project" ? item.content.title : item.type === "about" ? item.content.text : BLOCK_META[item.type].description) || ""),
    icon: item.type === "link" ? <LinkKindIcon kind={kind} /> : <BlockTile icon={BLOCK_META[item.type].icon} />,
  };
}
export type SetupLinksProps = { suffix: string; goal: Goal | null; profileId: string; sceneId: string; blocks: ModeEditorItem[]; view: SceneView; actions?: ModeEditorActions };
export function SetupLinks({ suffix, goal, profileId, sceneId, blocks, view, actions }: SetupLinksProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const items = blocks;
  const preview = <Button type="button" size="touch" variant="outline" className="h-11 gap-2" onClick={() => setPreviewOpen(true)}><Eye aria-hidden className="size-4" />Preview</Button>;
  return <>
    <SetupView suffix={suffix} step="links" backHref="?step=contact" preview={preview} desktopPreview={<div inert aria-hidden="true"><ProfileRenderer view={view} /></div>}>
      <p className="text-body text-fg-secondary">Optional. Add links to your work, social profiles, or somewhere useful.</p>
      <ModeEditor profileId={profileId} sceneId={sceneId} blocks={blocks} actions={actions} renderItems={({ controls }) => <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <ul aria-label="Suggested additions" className="flex flex-col gap-2">
            {setupSuggestions(goal).map(suggestion => <li key={suggestion.id}><Button type="button" variant="outline" size="touch" aria-label={`Add ${suggestion.label}`} data-suggestion={suggestion.id} onClick={event => controls.choose(suggestion.type, suggestion.kind, suggestion.initialLabel, event.currentTarget)} className="h-auto min-h-16 w-full justify-start gap-3 rounded-[10px] px-3 py-3 text-left whitespace-normal">
              {suggestion.kind ? <LinkKindIcon kind={suggestion.kind} /> : <BlockTile icon={BLOCK_META[suggestion.type].icon} />}
              <span className="min-w-0 flex-1"><span className="block text-body font-medium">{suggestion.label}</span><span className="mt-0.5 block text-meta font-normal text-fg-secondary">{suggestion.description}</span></span><Plus aria-hidden className="size-4 shrink-0 text-fg-secondary" />
            </Button></li>)}
          </ul>
          <Button data-add-item type="button" variant="outline" size="touch" className="min-h-11 w-full gap-2" onClick={event => controls.openAll(event.currentTarget)}><Plus aria-hidden className="size-4" />Add something else</Button>
        </div>
        <section aria-labelledby="setup-added-items" className="min-w-0 border-t pt-5">
          <h2 id="setup-added-items" className="text-body font-semibold">Added to your profile</h2>
          {items.length ? <ul className="mt-3 divide-y">{items.map(item => {
            const detail = itemDetails(item);
            return <li key={item.id} className="flex min-w-0 items-center gap-1 py-2">
              <Button type="button" size="touch" variant="ghost" aria-label={`Edit ${detail.label}`} onClick={event => controls.edit(item, event.currentTarget)} className="h-auto min-h-14 min-w-0 flex-1 justify-start gap-3 px-1 text-left">
                {detail.icon}<span className="min-w-0 flex-1"><span className="block truncate text-body font-medium">{detail.label}</span><span className="mt-0.5 block truncate text-meta font-normal text-fg-secondary">{detail.description}</span>{!item.visible && <span className="block text-label text-fg-secondary">Hidden</span>}</span>
              </Button>
              <Button type="button" variant="ghost" size="touch" aria-label={`Remove ${detail.label}`} className="size-11 shrink-0 px-0 text-destructive hover:text-destructive" onClick={event => controls.remove(item, event.currentTarget)}><Trash2 aria-hidden className="size-4" /></Button>
            </li>;
          })}</ul> : <p className="mt-2 text-meta text-fg-secondary">Nothing added yet. You can skip this step.</p>}
        </section>
      </div>} />
      <div className="mt-2 flex flex-col gap-3 border-t pt-6"><ButtonLink href="?step=look" variant="action" className="h-12 w-full sm:h-12">Continue</ButtonLink><Link href="?step=look" className="inline-flex min-h-11 items-center justify-center rounded-lg text-body text-fg-secondary focus-visible:outline-2 focus-visible:outline-brand">Skip for now</Link></div>
    </SetupView>
    <SetupPreviewDialog view={view} open={previewOpen} onOpenChange={setPreviewOpen} />
  </>;
}
