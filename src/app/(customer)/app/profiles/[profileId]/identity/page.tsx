import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { requireAccount } from "@/auth/access";
import { env } from "@/config/env";
import { db } from "@/db";
import { imageUrl } from "@/integrations/media/cloudinary";
import { getOwnedProfile } from "@/modules/profiles/profiles";
import { IdentityForm } from "./identity-form";

export const instant = false;

export default async function IdentityPage({ params }: PageProps<"/app/profiles/[profileId]/identity">) {
  const viewer = await requireAccount("/app");
  const { profileId } = await params;
  const profile = await getOwnedProfile(db, viewer.accountId, profileId);
  if (!profile) notFound();
  const { id, fullName, headline, company, bio, phone, email, website, location, imageAssetId, imageIsLogo } = profile;
  return (
    <main data-canvas className="mx-auto flex w-full max-w-[848px] flex-1 flex-col gap-6 px-4 pt-8 md:px-6 md:pt-10 md:pb-12">
      <header>
        <Link href={`/app/profiles/${id}`} className="mb-3 inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-lg text-body text-fg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand interact motion-reduce:transition-none"><ArrowLeft aria-hidden className="size-4 shrink-0" />Back to profile</Link>
        <h1 className="text-title">Your details</h1>
        <p className="mt-2 text-body text-fg-secondary">Shared information across all profile modes.</p>
      </header>
      <IdentityForm profile={{ id, fullName, headline, company, bio, phone, email, website, location }} image={{ hasImage: !!imageAssetId, photoUrl: imageAssetId ? imageUrl(env.cloudinaryCloudName, imageAssetId, false) : null, logoUrl: imageAssetId ? imageUrl(env.cloudinaryCloudName, imageAssetId, true) : null, imageIsLogo }} />
    </main>
  );
}
