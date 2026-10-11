import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { getOwnedProfile } from "@/modules/profiles/profiles";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
import { showSceneAction, unpublishAction } from "./actions";
import { AddSceneForm, DeleteProfileForm, PublishButton } from "./profile-forms";

export const instant = false;

export default async function ProfilePage({ params, searchParams }: PageProps<"/app/profiles/[profileId]">) {
  const viewer = await requireAccount("/app");
  const [{ profileId }, query] = await Promise.all([params, searchParams]);
  const profile = await getOwnedProfile(db, viewer.accountId, profileId);
  if (!profile) notFound();
  const published = (Array.isArray(query.published) ? query.published[0] : query.published) === "1";
  const statuses = { draft: "Draft", published: "Published", unpublished: "Unpublished" };
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header><h1 className="break-words text-2xl font-semibold tracking-tight">{profile.fullName ?? "Untitled profile"}</h1><p className="text-sm text-muted-foreground">{statuses[profile.status]}</p></header>
        {published ? <p role="status">Your Neffi is live.</p> : null}
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Now showing</h2>
          <p>{profile.scenes.find(scene => scene.isShown)?.name}</p>
          {profile.scenes.filter(scene => !scene.isShown).map(scene => (
            <form key={scene.id} action={showSceneAction} className="flex items-center justify-between gap-2">
              <input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="sceneId" value={scene.id} />
              <span>{scene.name}</span><Button type="submit" size="touch">Show this</Button>
            </form>
          ))}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Scenes</h2>
          {profile.scenes.map(scene => <Link key={scene.id} href={`/app/profiles/${profile.id}/scenes/${scene.id}`} className="inline-flex min-h-11 items-center rounded-lg border px-3">{scene.name}{scene.isDefault ? " (Default)" : ""}</Link>)}
          <h3 className="font-medium">Add a scene</h3>
          <AddSceneForm profileId={profile.id} scenes={profile.scenes} />
        </section>
        <nav aria-label="Profile settings" className="flex flex-col gap-2">
          <Link href={`/app/profiles/${profile.id}/identity`} className="inline-flex min-h-11 items-center underline underline-offset-4">Your details</Link>
          <Link href={`/app/profiles/${profile.id}/appearance`} className="inline-flex min-h-11 items-center underline underline-offset-4">Appearance</Link>
          <Link href={`/app/profiles/${profile.id}/preview`} className="inline-flex min-h-11 items-center underline underline-offset-4">Preview</Link>
          <Link href="/app/inbox" className="inline-flex min-h-11 items-center underline underline-offset-4">Messages ({profile.unread})</Link>
        </nav>
        <section className="flex flex-col gap-2"><h2 className="font-medium">Cards showing this profile</h2>{profile.cards.map(card => <p key={card.id}>Neffi ending in {card.suffix}</p>)}</section>
        {profile.gaps.length ? <ul className="list-inside list-disc text-sm">{profile.gaps.map(gap => <li key={gap}>{PUBLISH_GAP_COPY[gap]}</li>)}</ul> : null}
        {profile.status === "published" ? <form action={unpublishAction}><input type="hidden" name="profileId" value={profile.id} /><Button type="submit" size="touch">Unpublish</Button></form> : <PublishButton profileId={profile.id} />}
        <section className="flex flex-col gap-3 border-t pt-6"><h2 className="font-medium">Delete profile</h2>
          {profile.cards.length ? <p className="text-sm text-muted-foreground">Move the cards showing this profile to another profile before deleting it.</p> : <DeleteProfileForm profileId={profile.id} />}
        </section>
      </div>
    </main>
  );
}
