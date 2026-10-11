import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { db } from "@/db";
import { getOwnedProfile } from "@/modules/profiles/profiles";
import { IdentityForm } from "../profile-forms";

export const instant = false;

export default async function IdentityPage({ params }: PageProps<"/app/profiles/[profileId]/identity">) {
  const viewer = await requireAccount("/app");
  const { profileId } = await params;
  const profile = await getOwnedProfile(db, viewer.accountId, profileId);
  if (!profile) notFound();
  const { id, fullName, headline, company, bio, phone, email, website, location } = profile;
  return <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10"><div className="flex w-full max-w-sm flex-col gap-4"><h1 className="text-2xl font-semibold tracking-tight">Your details</h1><IdentityForm profile={{ id, fullName, headline, company, bio, phone, email, website, location }} /></div></main>;
}
