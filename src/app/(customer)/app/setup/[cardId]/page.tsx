import { notFound, redirect } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { db } from "@/db";
import { ownedCards } from "@/modules/cards/owned";
import { getOwnedProfile, ownedProfiles } from "@/modules/profiles/profiles";
import { isGoal } from "@/modules/profiles/goals";
import { and, eq } from "drizzle-orm";
import { sceneBlocks } from "@/db/schema";
import { env } from "@/config/env";
import { imageUrl } from "@/integrations/media/cloudinary";
import { sceneForEditing } from "@/modules/profiles/editor";
import { ChooseProfile } from "./choose-profile";
import { SetupReview, SetupDone } from "./setup-review";
import { SetupAppearance } from "./setup-appearance";
import { SetupLinks } from "./setup-links";
import { loadOwnerSceneView } from "@/modules/profiles/view";
import { chooseProfileAction, continueGoalAction, saveYouAction, savePhotoAction, saveContactAction, saveLookAction, saveStyleAction, publishSetupAction } from "./actions";
import { SETUP_STEPS } from "./setup-steps";
import { SetupForm } from "./setup-form";
import { SetupEditor } from "./setup-forms";
import { GoalFields, SetupView } from "./setup-view";
import { previousStep, resolveStep } from "./setup-steps";

export const instant = false;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function SetupPage({ params, searchParams }: PageProps<"/app/setup/[cardId]">) {
  const viewer = await requireAccount("/app");
  const [{ cardId }, query] = await Promise.all([params, searchParams]);
  const card = (await ownedCards(db, viewer.accountId)).find(owned => owned.id === cardId);
  if (!card) notFound();
  const profile = card.profileId ? await getOwnedProfile(db, viewer.accountId, card.profileId) : null;
  if (card.profileId && !profile) notFound();
  const requested = first(query.step);
  if (profile && profile.status !== "draft" && !(profile.status === "published" && requested === "done")) redirect(`/app/profiles/${profile.id}`);
  const profiles = !profile ? await ownedProfiles(db, viewer.accountId) : [];
  if (!profile && profiles.length && !SETUP_STEPS.includes(requested as typeof SETUP_STEPS[number])) {
    return (
      <SetupView suffix={card.publicToken.slice(-4)}>
        <h1 className="text-2xl font-semibold tracking-tight">Show one of your profiles on this card</h1>
        <ChooseProfile cardId={card.id} profiles={profiles} action={chooseProfileAction} />
      </SetupView>
    );
  }
  const step = resolveStep(requested, profile);
  if (requested !== step && (requested !== undefined || profile)) redirect(`?step=${step}`);
  const rawGoal = first(query.goal);
  const goal = isGoal(rawGoal) ? rawGoal : profile?.goal ?? null;
  const previous = previousStep(step);
  const backHref = previous ? `?step=${previous}${!profile && previous === "goal" && rawGoal !== undefined ? `&goal=${goal ?? ""}` : ""}` : "/app";
  if (step === "done" && profile) return <SetupDone suffix={card.publicToken.slice(-4)} profileId={profile.id} token={card.publicToken} />;
  if (step === "review" && profile) {
    const view = await loadOwnerSceneView(db, { accountId: viewer.accountId, profileId: profile.id, sceneId: profile.defaultSceneId });
    if (!view) notFound();
    return <SetupReview suffix={card.publicToken.slice(-4)} cardId={card.id} profileId={profile.id} view={view} gaps={profile.gaps} action={publishSetupAction} />;
  }
  if ((step === "look" || step === "style") && profile) {
    const view = await loadOwnerSceneView(db, { accountId: viewer.accountId, profileId: profile.id, sceneId: profile.defaultSceneId });
    if (!view) notFound();
    return <SetupAppearance key={step} step={step} cardId={card.id} suffix={card.publicToken.slice(-4)} goal={profile.goal} view={view} action={step === "look" ? saveLookAction : saveStyleAction} />;
  }
  if (step === "links" && profile) {
    const [view, scene] = await Promise.all([
      loadOwnerSceneView(db, { accountId: viewer.accountId, profileId: profile.id, sceneId: profile.defaultSceneId }),
      sceneForEditing(db, viewer.accountId, profile.id, profile.defaultSceneId),
    ]);
    if (!view || !scene) notFound();
    return <SetupLinks suffix={card.publicToken.slice(-4)} goal={goal} profileId={profile.id} sceneId={profile.defaultSceneId} blocks={scene.blocks} view={view} />;
  }
  if (step === "you" || step === "photo" || step === "contact") {
    const view = profile ? await loadOwnerSceneView(db, { accountId: viewer.accountId, profileId: profile.id, sceneId: profile.defaultSceneId }) : null;
    const [contactBlock] = profile ? await db.select({ content: sceneBlocks.content }).from(sceneBlocks).where(and(eq(sceneBlocks.sceneId, profile.defaultSceneId), eq(sceneBlocks.type, "contact"))).limit(1) : [];
    const contact = contactBlock ? { saveContact: !(contactBlock.content && typeof contactBlock.content === "object" && "saveContact" in contactBlock.content && contactBlock.content.saveContact === false) } : null;
    const imageUrls = profile?.imageAssetId ? { photo: imageUrl(env.cloudinaryCloudName, profile.imageAssetId, false), logo: imageUrl(env.cloudinaryCloudName, profile.imageAssetId, true) } : null;
    return <SetupEditor key={`${step}-${profile?.id ?? "new"}`} step={step} cardId={card.id} suffix={card.publicToken.slice(-4)} goal={goal} profile={profile} view={view} imageUrls={imageUrls} signInEmail={viewer.email} contact={contact} action={step === "you" ? saveYouAction : step === "photo" ? savePhotoAction : saveContactAction} />;
  }
  return (
    <SetupView suffix={card.publicToken.slice(-4)} step={step} backHref={backHref}>
      {step === "goal" ? (
        <SetupForm key={goal ?? "none"} action={continueGoalAction} className="flex flex-col gap-5">
          <input type="hidden" name="cardId" value={card.id} />
          <GoalFields goal={rawGoal !== undefined ? goal : profile ? profile.goal : undefined} />
        </SetupForm>
      ) : null}
    </SetupView>
  );
}
