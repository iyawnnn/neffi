import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { env } from "@/config/env";
import { db } from "@/db";
import { imageUrl } from "@/integrations/media/cloudinary";
import { getOwnedProfile } from "@/modules/profiles/profiles";
import { AppearanceForm, ImageUpload } from "../image-upload";

export const instant = false;

export default async function AppearancePage({ params }: PageProps<"/app/profiles/[profileId]/appearance">) {
  const viewer = await requireAccount("/app");
  const { profileId } = await params;
  const profile = await getOwnedProfile(db, viewer.accountId, profileId);
  if (!profile) notFound();
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
        <AppearanceForm profileId={profile.id} accentColor={profile.accentColor} imageIsLogo={profile.imageIsLogo} />
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Image</h2>
          {profile.imageAssetId ? <img src={imageUrl(env.cloudinaryCloudName, profile.imageAssetId, profile.imageIsLogo)} alt={profile.fullName ?? "Profile image"} width={128} height={128} className={profile.imageIsLogo ? "size-32 object-contain" : "size-32 rounded-full object-cover"} /> : null}
          <ImageUpload profileId={profile.id} hasImage={Boolean(profile.imageAssetId)} />
        </section>
      </div>
    </main>
  );
}
