"use client";

import { SetupEditor } from "@/app/(customer)/app/setup/[cardId]/setup-forms";
import { setupDraft } from "@/app/(customer)/app/setup/[cardId]/setup-draft";
import type { SetupState } from "@/app/(customer)/app/setup/[cardId]/actions";
import type { ImageUploadActions } from "@/app/(customer)/app/profiles/[profileId]/image-upload";
import type { Goal } from "@/modules/profiles/goals";
import type { DetailValues } from "@/app/(customer)/app/profiles/[profileId]/identity/identity-values";
import { useState } from "react";
import { useRouter } from "next/navigation";

type PreviewProfile = DetailValues & { id: string; imageIsLogo: boolean; imageAssetId: string | null };

const imageUrls = { photo: "/avatar-example.jpg", logo: "/neffi-logo-ink.svg" };
const ticket = { url: "/dev/setup-preview/upload", fields: {} };

export function PreviewForm({ step, goal, profile, contact, error }: {
  step: "you" | "photo" | "contact"; goal: Goal | null; profile: PreviewProfile | null;
  contact: { saveContact: boolean } | null; error: boolean;
}) {
  const router = useRouter();
  const [asset, setAsset] = useState(profile?.imageAssetId ?? null);
  const previewProfile = profile && { ...profile, imageAssetId: asset };
  const uploads: ImageUploadActions = {
    start: async () => ({ ticket }),
    confirm: async () => { setAsset("synthetic-image"); return { ok: true as const }; },
    remove: async () => { setAsset(null); },
  };
  const action = async (_previous: SetupState | undefined, data: FormData): Promise<SetupState> => {
    if (error) return { error: "Check the highlighted fields and try again.", fields: ["email"], messages: { email: "Enter a valid email, such as name@example.com." } };
    if (step === "you" && !String(data.get("fullName") ?? "").trim()) return { error: "Check the highlighted fields and try again.", fields: ["fullName"], messages: { fullName: "Enter your full name (up to 80 characters)." } };
    if (step === "contact" && !["phone", "email", "website"].some(key => String(data.get(key) ?? "").trim())) return { error: "Add a phone number, email or website so people can reach you.", fields: ["phone"] };
    router.push(`?state=draft&step=${step === "you" ? "photo" : step === "photo" ? "contact" : "links"}`);
    return {};
  };
  const view = setupDraft(null, previewProfile ?? {}, goal, asset ? imageUrls : null);
  return <SetupEditor
    step={step} suffix="TEST" cardId="00000000-0000-4000-8000-000000000001" goal={goal} profile={previewProfile} view={view}
    imageUrls={asset ? imageUrls : null} signInEmail="customer@example.invalid"
    contact={contact} imageActions={uploads} action={action}
  />;
}
