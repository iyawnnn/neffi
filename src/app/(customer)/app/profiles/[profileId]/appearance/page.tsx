import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { db } from "@/db";
import { getOwnedProfile } from "@/modules/profiles/profiles";
import { loadOwnerSceneView } from "@/modules/profiles/view";
import { AppearanceForm } from "./appearance-form";

export const instant = false;

export default async function AppearancePage({ params }: PageProps<"/app/profiles/[profileId]/appearance">) {
  const viewer = await requireAccount("/app");
  const { profileId } = await params;
  const profile = await getOwnedProfile(db, viewer.accountId, profileId);
  if (!profile) notFound();
  const view = await loadOwnerSceneView(db, { accountId: viewer.accountId, profileId });
  if (!view) notFound();
  return <main data-canvas className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10 md:px-6 md:pt-8 md:pb-12">
    <AppearanceForm profileId={profile.id} view={view} accentColor={profile.accentColor} />
  </main>;
}
