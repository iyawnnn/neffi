import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, House, Image as ImageIcon, Link2, Palette, PanelsTopLeft, SlidersHorizontal, UserRound, Waypoints } from "lucide-react";
import { ButtonLink } from "@/components/app-ui";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { PUBLISH_GAP_COPY, type PublishGap } from "@/modules/profiles/rules";
import type { SceneView } from "@/modules/profiles/scene-view";
import { PublishButton } from "../../profiles/[profileId]/publish-button";
import type { publishAction } from "../../profiles/[profileId]/actions";
import { STEP_TITLES } from "./setup-steps";
import { SetupView } from "./setup-view";

const layoutNames = { classic: "Classic", editorial: "Editorial", showcase: "Showcase" } as const;

function NeffiCard({ suffix }: { suffix: string }) {
  return <div data-neffi-card className="flex items-center gap-4 border-b border-border pb-5">
    <Image src="/neffi-card-front-preview.svg" alt="" width={324} height={205} unoptimized className="h-auto w-32 shrink-0 rounded-[3.7%/5.85%] border border-border sm:w-40" />
    <div className="min-w-0"><p className="text-body font-medium text-foreground">Card ending in {suffix}</p><p className="mt-1 text-meta text-fg-secondary">This card will open this profile once published.</p></div>
  </div>;
}

function ReviewRows({ view }: { view: SceneView }) {
  const contactMethods = [view.identity.phone, view.identity.email, view.identity.website].filter(Boolean).length;
  const links = view.blocks.filter(block => block.type === "link").length;
  const accent = ACCENTS.find(option => option.hex === view.appearance.accent)?.name ?? "Ink";
  const rows = [
    { step: "you", label: "You", summary: view.identity.fullName || undefined, Icon: UserRound },
    { step: "photo", label: "Photo or logo", summary: view.identity.image ? view.identity.image.isLogo ? "Logo added" : "Photo added" : "Not added", Icon: ImageIcon },
    { step: "contact", label: "Contact", summary: contactMethods ? `${contactMethods} ${contactMethods === 1 ? "method" : "methods"}` : "Not added", Icon: Waypoints },
    { step: "links", label: "Links", summary: links ? `${links} ${links === 1 ? "link" : "links"}` : "Not added", Icon: Link2 },
    { step: "look", label: "Look", summary: layoutNames[view.appearance.layout], Icon: PanelsTopLeft },
    { step: "style", label: "Colours", summary: `${view.appearance.mode === "dark" ? "Dark" : "Light"} · ${accent}`, Icon: Palette },
  ] as const;
  return <section aria-labelledby="setup-changes" className="border-t pt-5"><h2 id="setup-changes" className="text-section">Your setup</h2><ul className="mt-2 divide-y divide-border">
    {rows.map(({ step, label, summary, Icon }) => <li key={step} data-setup-review-row={step}><Link href={`?step=${step}`} className="flex min-h-12 items-center gap-3 rounded-lg py-2 pr-1 focus-visible:outline-2 focus-visible:outline-brand">
      <Icon aria-hidden className="size-4 shrink-0 text-fg-secondary" /><span className="min-w-0 flex-1"><span className="block text-body font-medium">{label}</span>{summary && <span className="block truncate text-meta text-fg-secondary">{summary}</span>}</span><span className="inline-flex min-h-11 items-center text-meta font-medium text-action-text underline underline-offset-4">Change</span>
    </Link></li>)}
  </ul></section>;
}

export function SetupReview({ suffix, cardId, profileId, view, gaps, action }: { suffix: string; cardId: string; profileId: string; view: SceneView; gaps: PublishGap[]; action: typeof publishAction }) {
 const preview = <ProfileRenderer view={view} />;
 return <SetupView suffix={suffix} step="review" backHref="?step=style" desktopPreview={preview} showCardSuffix={false}>
   <NeffiCard suffix={suffix} />
   <div tabIndex={0} aria-label="Scrollable profile preview" className="neffi-appearance-preview-scroll max-h-[22rem] overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden">{preview}</div>
   {gaps.length > 0 && <section aria-labelledby="publish-gaps"><h2 id="publish-gaps" className="text-section">Before you publish</h2><ul className="mt-2 divide-y divide-border">{gaps.map(gap => <li key={gap} className="flex items-center justify-between gap-4 py-2 text-body"><span>{PUBLISH_GAP_COPY[gap]}</span><Link href={`?step=${gap === "name" ? "you" : "contact"}`} aria-label={`Fix: ${PUBLISH_GAP_COPY[gap]}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 font-medium text-action-text underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-brand">Fix</Link></li>)}</ul></section>}
   <ReviewRows view={view} />
   <PublishButton profileId={profileId} cardId={cardId} action={action} disabled={gaps.length > 0} />
 </SetupView>;
}
export function SetupDone({ suffix, profileId, token }: { suffix: string; profileId: string; token: string }) {
 return <SetupView suffix={suffix} showCardSuffix={false}>
   <div className="flex flex-col items-center pt-4 text-center sm:pt-8">
     <span aria-hidden className="flex size-14 items-center justify-center rounded-full border border-border bg-background shadow-xs"><Check strokeWidth={2.25} className="size-6 text-foreground" /></span>
     <p className="mt-5 text-meta text-fg-secondary">Card ending in {suffix}</p>
     <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">{STEP_TITLES.done}</h1>
     <p className="mt-2 max-w-xs text-body text-fg-secondary">Tap your card on your phone to try it.</p>
     <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
       <ButtonLink href={`/c/${token}`} target="_blank" rel="noopener noreferrer" variant="action" className="w-full gap-2 sm:flex-1">View your page<ArrowUpRight aria-hidden /></ButtonLink>
       <ButtonLink href={`/app/profiles/${profileId}`} variant="outline" className="w-full gap-2 sm:flex-1"><SlidersHorizontal aria-hidden />Customize more</ButtonLink>
     </div>
     <Link href="/app" className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-body text-fg-secondary transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"><House aria-hidden className="size-4" />Go to Home</Link>
   </div>
 </SetupView>;
}
