import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { headers } from "next/headers";
import { SceneViewPreview } from "@/components/scene-view";
import { db } from "@/db";
import { CARD_REQUEST_HEADER, readCardRequest } from "@/modules/cards/request";
import { loadCurrentPublicSceneView } from "@/modules/profiles/view";
import { cachedSceneView } from "./cached-view";
import { Unavailable } from "./unavailable";

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
  return (
    <main className="flex flex-1 flex-col bg-[#F2F0EA] text-[#0C0C0D]">
      <SceneViewPreview view={view} visitorActions={{ saveContactHref: `/c/${token}/contact` }} />
    </main>
  );
}
