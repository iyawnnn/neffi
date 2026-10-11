import Link from "next/link";
import { requireAccount } from "@/auth/access";
import { db } from "@/db";
import { ownedProfiles } from "@/modules/profiles/profiles";

export const instant = false;

export default async function ProfilesPage() {
  const viewer = await requireAccount("/app");
  const profiles = await ownedProfiles(db, viewer.accountId);
  const statuses = { draft: "Draft", published: "Published", unpublished: "Unpublished" };
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your profiles</h1>
        <ul className="flex flex-col gap-3">
          {profiles.map(profile => <li key={profile.id}><Link href={`/app/profiles/${profile.id}`} className="flex min-h-11 flex-col rounded-lg border p-4"><span className="font-medium">{profile.fullName ?? "Untitled profile"}</span><span className="text-sm text-muted-foreground">{statuses[profile.status]}</span></Link></li>)}
        </ul>
      </div>
    </main>
  );
}
