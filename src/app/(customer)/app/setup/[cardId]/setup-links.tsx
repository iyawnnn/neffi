"use client";

import { BriefcaseBusiness, ChevronDown, Eye, Link2, MessageCircle, Pencil, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { ButtonLink } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { LinkKindIcon } from "@/components/social-icons";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { GOALS, NO_GOAL, type Goal } from "@/modules/profiles/goals";
import { PLATFORM_GROUPS, PLATFORMS } from "@/modules/profiles/platform-registry";
import type { BlockType } from "@/modules/profiles/block-content";
import { LINK_KINDS, type LinkKind } from "@/modules/profiles/block-options";
import type { SceneView } from "@/modules/profiles/scene-view";
import { ModeEditor, type ModeEditorActions, type ModeEditorControls, type ModeEditorItem } from "../../profiles/[profileId]/scenes/[sceneId]/mode-editor";
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
const professional = new Set<LinkKind>(["linkedin", "portfolio", ...PLATFORM_GROUPS.find(group => group.label === "Professional & creative")!.kinds]);
const messaging = new Set<LinkKind>(["discord", "reddit", ...PLATFORM_GROUPS.find(group => group.label === "Messaging")!.kinds]);
// Presentation groups only; labels, icons, fields and validation still come from the registry.
const cell = "h-auto min-h-14 w-full flex-col gap-1 rounded-lg border-transparent bg-transparent px-1 py-1.5 text-center text-[0.75rem] leading-tight font-normal whitespace-normal [overflow-wrap:anywhere] hover:bg-muted/60";
const categories = [
  { id: "social", label: "Social", icon: Share2, kinds: LINK_KINDS.filter(kind => PLATFORMS[kind].category === "social" && !professional.has(kind) && !messaging.has(kind)) },
  { id: "professional", label: "Professional", icon: BriefcaseBusiness, kinds: LINK_KINDS.filter(kind => professional.has(kind)) },
  { id: "messaging", label: "Messaging & community", icon: MessageCircle, kinds: LINK_KINDS.filter(kind => messaging.has(kind)) },
  { id: "other", label: "Other links & actions", icon: Link2, kinds: LINK_KINDS.filter(kind => PLATFORMS[kind].category !== "social" && !professional.has(kind)) },
];
function itemDetails(item: ModeEditorItem) {
  const kind = (item.content.kind || "custom") as LinkKind;
  return {
    label: item.type === "link" ? String(item.content.label || PLATFORMS[kind].label) : item.type === "form" ? item.summary === "Form" ? "Contact form" : item.summary : item.type === "booking" ? String(item.content.label || BLOCK_META.booking.label) : BLOCK_META[item.type].label,
    description: String(item.content.url || (item.type === "project" ? item.content.title : item.type === "about" ? item.content.text : BLOCK_META[item.type].description) || ""),
    icon: item.type === "link" ? <LinkKindIcon kind={kind} /> : <BlockTile icon={BLOCK_META[item.type].icon} />,
  };
}
export type SetupLinksProps = { suffix: string; goal: Goal | null; profileId: string; sceneId: string; blocks: ModeEditorItem[]; view: SceneView; actions?: ModeEditorActions };
export function SetupLinks({ suffix, goal, profileId, sceneId, blocks, view, actions }: SetupLinksProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const id = useId();
  const suggestions = setupSuggestions(goal);
  const rank = (kind: LinkKind) => { const index = suggestions.findIndex(suggestion => suggestion.kind === kind); return index < 0 ? suggestions.length : index; };
  function choose(controls: ModeEditorControls, type: BlockType, kind: LinkKind | undefined, label: string | undefined, trigger: HTMLElement) {
    controls.choose(type, kind, label, trigger.closest("section")?.querySelector<HTMLButtonElement>("h2 button") ?? trigger);
    setExpanded(null);
  }
  const preview = <Button type="button" size="touch" variant="outline" className="h-11 gap-2" onClick={() => setPreviewOpen(true)}><Eye aria-hidden className="size-4" />Preview</Button>;
  return <>
    <SetupView suffix={suffix} step="links" backHref="?step=contact" preview={preview} desktopPreview={<div inert aria-hidden="true"><ProfileRenderer view={view} /></div>}>
      <p className="text-body text-fg-secondary">Optional. Add links to your work, social profiles, or somewhere useful.</p>
      <ModeEditor inlineEditor profileId={profileId} sceneId={sceneId} blocks={blocks} actions={actions} renderItems={({ controls, editor }) => <div className="flex min-w-0 flex-col gap-6">
        <div className="divide-y rounded-xl border">
          {categories.map(category => <section key={category.id}>
            <h2><Button data-add-item type="button" variant="ghost" size="touch" aria-expanded={expanded === category.id} aria-controls={`${id}-${category.id}`} onClick={() => setExpanded(expanded === category.id ? null : category.id)} className="h-auto min-h-16 w-full justify-start gap-3 rounded-none px-4 py-3 text-left whitespace-normal first:rounded-t-xl last:rounded-b-xl">
              <category.icon aria-hidden className="size-4 shrink-0 text-fg-secondary" /><span className="min-w-0 flex-1 text-body font-medium">{category.label}</span>{expanded !== category.id && <span aria-hidden className="flex shrink-0 items-center gap-1">{category.kinds.slice(0, 3).map(kind => <LinkKindIcon key={kind} kind={kind} className="size-5 rounded-md [&_svg]:size-3" />)}</span>}<ChevronDown aria-hidden className={`size-4 shrink-0 text-fg-secondary transition-transform motion-reduce:transition-none ${expanded === category.id ? "rotate-180" : ""}`} />
            </Button></h2>
            <div id={`${id}-${category.id}`} hidden={expanded !== category.id}>
              {expanded === category.id && <ul className="grid grid-cols-3 gap-x-1 gap-y-2 px-2 pb-3 min-[360px]:grid-cols-4 sm:grid-cols-5">
                {[...category.kinds].sort((a,b) => rank(a) - rank(b)).map(kind => <li key={kind}><Button type="button" data-platform={kind} variant="ghost" size="touch" onClick={event => choose(controls, "link", kind, undefined, event.currentTarget)} className={cell}>
                  <LinkKindIcon kind={kind} className="size-7 rounded-lg [&_svg]:size-4" /><span>{kind === "booking" ? "Booking link" : PLATFORMS[kind].label}</span>
                </Button></li>)}
                {category.id === "professional" && suggestions.some(suggestion => suggestion.id === "resume") && <li><Button type="button" variant="ghost" size="touch" className={cell} onClick={event => choose(controls, "link", "custom", "Resume", event.currentTarget)}><LinkKindIcon kind="custom" className="size-7 rounded-lg [&_svg]:size-4" />Resume</Button></li>}
                {category.id === "other" && (["project", "about", "booking", "form"] as const).map(type => <li key={type}><Button type="button" variant="ghost" size="touch" onClick={event => choose(controls, type, undefined, undefined, event.currentTarget)} className={cell}><span aria-hidden className="inline-flex size-7 items-center justify-center">{(Icon => <Icon className="size-[1.125rem] text-foreground" strokeWidth={1.6} />)(BLOCK_META[type].icon)}</span><span>{BLOCK_META[type].label}</span></Button></li>)}
              </ul>}
            </div>
          </section>)}
        </div>
        {editor}
        <section aria-labelledby="setup-added-items" className="min-w-0 border-t pt-5">
          <h2 id="setup-added-items" className="text-body font-semibold">Added links</h2>
          {blocks.length ? <ul className="mt-3 divide-y">{blocks.map(item => {
            const detail = itemDetails(item);
            return <li key={item.id} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
              <div className="flex min-w-0 items-start gap-3">{detail.icon}<div className="min-w-0 flex-1"><p className="text-body font-medium">{detail.label}</p><p className="mt-0.5 text-meta text-fg-secondary [overflow-wrap:anywhere]">{detail.description}</p>{!item.visible && <span className="text-label text-fg-secondary">Hidden</span>}</div></div>
              <div role="group" aria-label={`Actions for ${detail.label}`} className="flex justify-self-end rounded-lg border border-border bg-background p-0.5">
                <Button type="button" size="touch" variant="ghost" aria-label={`Edit ${detail.label}`} onClick={event => controls.edit(item, event.currentTarget)} className="gap-1.5 px-2.5 text-meta"><Pencil aria-hidden className="size-3.5" />Edit</Button>
                <Button type="button" variant="ghost" size="touch" aria-label={`Remove ${detail.label}`} className="gap-1.5 px-2.5 text-meta text-destructive hover:text-destructive" onClick={event => controls.remove(item, event.currentTarget)}><Trash2 aria-hidden className="size-3.5" />Remove</Button>
              </div>
            </li>;
          })}</ul> : <p className="mt-2 text-meta text-fg-secondary">Nothing added yet. You can skip this step.</p>}
        </section>
      </div>} />
      <div className="mt-2 flex flex-col gap-3 border-t pt-6"><ButtonLink href="?step=look" variant="action" className="h-12 w-full sm:h-12">Continue</ButtonLink><Link href="?step=look" className="inline-flex min-h-11 items-center justify-center rounded-lg text-body text-fg-secondary focus-visible:outline-2 focus-visible:outline-brand">Skip for now</Link></div>
    </SetupView>
    <SetupPreviewDialog view={view} open={previewOpen} onOpenChange={setPreviewOpen} />
  </>;
}
