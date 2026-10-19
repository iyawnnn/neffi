import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { env } from "@/config/env";
import { db } from "@/db";
import { imageUrl } from "@/integrations/media/cloudinary";
import { getOwnedProfile } from "@/modules/profiles/profiles";
import { AppearanceForm } from "../image-upload";

export const instant = false;

export default async function AppearancePage({ params }: PageProps<"/app/profiles/[profileId]/appearance">) {
  const viewer = await requireAccount("/app");
  const { profileId } = await params;
  const profile = await getOwnedProfile(db, viewer.accountId, profileId);
  if (!profile) notFound();
  return (
    <main data-canvas className="mx-auto flex w-full max-w-[944px] flex-1 flex-col px-4 pt-6 pb-10 md:px-6 md:pt-8 md:pb-12">
      <AppearanceForm profileId={profile.id} fullName={profile.fullName} accentColor={profile.accentColor} imageIsLogo={profile.imageIsLogo}
        photoUrl={profile.imageAssetId ? imageUrl(env.cloudinaryCloudName, profile.imageAssetId, false) : null}
        logoUrl={profile.imageAssetId ? imageUrl(env.cloudinaryCloudName, profile.imageAssetId, true) : null} />
    </main>
  );
}
