import Link from "next/link";
import { ButtonLink } from "@/components/app-ui";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { PUBLISH_GAP_COPY, type PublishGap } from "@/modules/profiles/rules";
import type { SceneView } from "@/modules/profiles/scene-view";
import { PublishButton } from "../../profiles/[profileId]/publish-button";
import type { publishAction } from "../../profiles/[profileId]/actions";
import { SetupView } from "./setup-view";

const changes = [["you", "You"], ["photo", "Photo or logo"], ["contact", "Contact"], ["links", "Links"], ["look", "Look"], ["style", "Colours"]] as const;
export function SetupReview({ suffix, cardId, profileId, view, gaps, action }: { suffix: string; cardId: string; profileId: string; view: SceneView; gaps: PublishGap[]; action: typeof publishAction }) {
 return <SetupView suffix={suffix} step="review" backHref="?step=style">
   <div className="overflow-hidden rounded-3xl border"><ProfileRenderer view={view} /></div>
   {gaps.length > 0 && <section aria-labelledby="publish-gaps"><h2 id="publish-gaps" className="text-section">Before you publish</h2><ul className="mt-2 divide-y">{gaps.map(gap => <li key={gap} className="flex items-center justify-between gap-4 py-2 text-body"><span>{PUBLISH_GAP_COPY[gap]}</span><Link href={`?step=${gap === "name" ? "you" : "contact"}`} aria-label={`Fix: ${PUBLISH_GAP_COPY[gap]}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 font-medium text-action-text underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-brand">Fix</Link></li>)}</ul></section>}
   <section aria-labelledby="setup-changes" className="border-t pt-5"><h2 id="setup-changes" className="text-section">Change</h2><ul className="mt-2 divide-y">{changes.map(([step,label]) => <li key={step}><Link href={`?step=${step}`} className="flex min-h-11 items-center justify-between gap-4 rounded-lg text-body focus-visible:outline-2 focus-visible:outline-brand"><span>{label}</span><span className="text-meta text-fg-secondary">Change</span></Link></li>)}</ul></section>
   <PublishButton profileId={profileId} cardId={cardId} action={action} disabled={gaps.length > 0} />
 </SetupView>;
}
export function SetupDone({ suffix, profileId, token }: { suffix: string; profileId: string; token: string }) {
 return <SetupView suffix={suffix} step="done">
   <p className="text-body text-fg-secondary">Tap your card on your phone to try it.</p>
   <div className="flex flex-col gap-3"><ButtonLink href={`/c/${token}`} target="_blank" rel="noopener noreferrer" variant="action" className="h-12 w-full">View your page</ButtonLink><ButtonLink href={`/app/profiles/${profileId}`} variant="outline" className="w-full">Customize more</ButtonLink><Link href="/app" className="inline-flex min-h-11 items-center justify-center rounded-lg text-body text-fg-secondary focus-visible:outline-2 focus-visible:outline-brand">Go to Home</Link></div>
 </SetupView>;
}
