import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { db } from "@/db";
import { getOwnedProfile } from "@/modules/profiles/profiles";
import { loadOwnerSceneView } from "@/modules/profiles/view";

export const instant = false;

export default async function PreviewPage({ params, searchParams }: PageProps<"/app/profiles/[profileId]/preview">) {
  const viewer = await requireAccount("/app");
  const [{ profileId }, query] = await Promise.all([params, searchParams]);
  const profile = await getOwnedProfile(db, viewer.accountId, profileId);
  if (!profile) notFound();
  const sceneId = Array.isArray(query.scene) ? query.scene[0] : query.scene;
  const view = await loadOwnerSceneView(db, { accountId: viewer.accountId, profileId, sceneId });
  if (!view) notFound();
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-[480px] flex-col gap-4">
        <p className="text-sm text-muted-foreground">This is a preview. Visitors see this when your Neffi is published.</p>
        <nav aria-label="Preview scenes" className="flex flex-wrap gap-2">
          {profile.scenes.map(scene => <Link key={scene.id} href={`?scene=${scene.id}`} aria-current={scene.id === view.scene.id ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium">{scene.name}</Link>)}
        </nav>
        <div className="overflow-hidden rounded-3xl border border-border"><ProfileRenderer view={view} /></div>
      </div>
    </main>
  );
}
