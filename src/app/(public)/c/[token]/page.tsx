import type { CSSProperties } from "react";
import { profileTheme } from "@/modules/profiles/profile-theme";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { headers } from "next/headers";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { db } from "@/db";
import { CARD_REQUEST_HEADER, readCardRequest } from "@/modules/cards/request";
import { loadCurrentPublicSceneView } from "@/modules/profiles/view";
import { cachedSceneView } from "./cached-view";
import { Unavailable } from "./unavailable";
import { ProfileIntro } from "./profile-intro";

// Public but kept out of search: customer-controlled indexing is a later, separately planned feature.
export const metadata: Metadata = { title: "Neffi", robots: { index: false, follow: false } };
// Card state is read fresh on every request.
export const instant = false;
export const prefetch = "force-disabled";

// Proxy decides availability before streaming. Only a concurrent content change reaches this fallback.
export default async function CardPage({ params }: PageProps<"/c/[token]">) {
  await connection();
  const { token } = await params;
  const snapshot = readCardRequest(token, (await headers()).get(CARD_REQUEST_HEADER));
  if (!snapshot) notFound();
  if (snapshot.status === "unavailable") return <Unavailable manageHref={`/app/cards/${snapshot.ownerCardId}`} />;
  const view = await loadCurrentPublicSceneView(db, snapshot, cachedSceneView);
  if (!view) notFound();
  return <>
    <ProfileIntro />
    <main className="flex flex-1 flex-col bg-[var(--pf-bg)] text-[var(--pf-fg)]" style={{ ...profileTheme(view.appearance.accent, view.appearance.mode), colorScheme: view.appearance.mode } as CSSProperties}>
      {snapshot.owner ? (
        <nav aria-label="Manage your Neffi" className="pf-owner-bar flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-sm">
          <span>Only you see this</span>
          <Link href={`/app/profiles/${snapshot.profileId}/scenes/${view.scene.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--pf-border)] px-3 font-medium">Edit</Link>
          <Link href={`/app/profiles/${snapshot.profileId}`} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--pf-border)] px-3 font-medium">Switch mode</Link>
        </nav>
      ) : null}
      <ProfileRenderer view={view} visitorActions={{ saveContactHref: `/c/${token}/contact` }} />
    </main>
  </>;
}
