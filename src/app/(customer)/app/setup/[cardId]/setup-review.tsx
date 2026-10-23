import Image from "next/image";
import Link from "next/link";
import { Image as ImageIcon, Link2, Palette, PanelsTopLeft, UserRound, Waypoints } from "lucide-react";
import { ButtonLink } from "@/components/app-ui";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { PUBLISH_GAP_COPY, type PublishGap } from "@/modules/profiles/rules";
import type { SceneView } from "@/modules/profiles/scene-view";
import { PublishButton } from "../../profiles/[profileId]/publish-button";
import type { publishAction } from "../../profiles/[profileId]/actions";
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
    {rows.map(({ step, label, summary, Icon }) => <li key={step} data-setup-review-row={step}><Link href={`?step=${step}`} className="flex min-h-14 items-center gap-3 rounded-lg py-2 pr-1 focus-visible:outline-2 focus-visible:outline-brand">
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
 return <SetupView suffix={suffix} step="done">
   <p className="text-body text-fg-secondary">Tap your card on your phone to try it.</p>
   <div className="flex flex-col gap-3"><ButtonLink href={`/c/${token}`} target="_blank" rel="noopener noreferrer" variant="action" className="h-12 w-full">View your page</ButtonLink><ButtonLink href={`/app/profiles/${profileId}`} variant="outline" className="w-full">Customize more</ButtonLink><Link href="/app" className="inline-flex min-h-11 items-center justify-center rounded-lg text-body text-fg-secondary focus-visible:outline-2 focus-visible:outline-brand">Go to Home</Link></div>
 </SetupView>;
}
