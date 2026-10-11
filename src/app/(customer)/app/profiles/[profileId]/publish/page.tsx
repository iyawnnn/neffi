import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { SceneViewPreview } from "@/components/scene-view";
import { db } from "@/db";
import { getOwnedProfile } from "@/modules/profiles/profiles";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
import { loadOwnerSceneView } from "@/modules/profiles/view";
import { PublishButton } from "../profile-forms";

export const instant = false;

export default async function PublishPage({ params }: PageProps<"/app/profiles/[profileId]/publish">) {
  const viewer = await requireAccount("/app");
  const { profileId } = await params;
  const profile = await getOwnedProfile(db, viewer.accountId, profileId);
  if (!profile) notFound();
  if (profile.status !== "draft") redirect(`/app/profiles/${profileId}`);
  const view = await loadOwnerSceneView(db, { accountId: viewer.accountId, profileId, sceneId: profile.defaultSceneId });
  if (!view) notFound();
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{profile.gaps.length ? "Finish your Neffi" : "Your Neffi is ready"}</h1>
        <SceneViewPreview view={view} />
        {profile.gaps.length ? (
          <>
            <ul className="list-inside list-disc text-sm">{profile.gaps.map(gap => <li key={gap}>{PUBLISH_GAP_COPY[gap]}</li>)}</ul>
            <Link href={`/app/profiles/${profileId}/identity`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">Edit details</Link>
          </>
        ) : null}
        <PublishButton profileId={profileId} />
        <Link href={`/app/profiles/${profileId}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">Edit before publishing</Link>
      </div>
    </main>
  );
}
