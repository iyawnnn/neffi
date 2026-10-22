import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { ownedCards } from "@/modules/cards/owned";
import { getOwnedProfile, ownedProfiles } from "@/modules/profiles/profiles";
import { isGoal } from "@/modules/profiles/goals";
import { PURPOSES, type Purpose } from "@/modules/profiles/purpose-options";
import { chooseProfileAction, continueGoalAction } from "./actions";
import { SETUP_STEPS } from "./setup-steps";
import { SetupForm } from "./setup-form";
import { EssentialsForm } from "./setup-forms";
import { GoalFields, SetupPlaceholder, SetupView } from "./setup-view";
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
        {profiles.map(profile => (
          <form key={profile.id} action={chooseProfileAction}>
            <input type="hidden" name="cardId" value={card.id} />
            <input type="hidden" name="profileId" value={profile.id} />
            <Button type="submit" variant="action" size="touch" className="h-12 w-full">Use {profile.fullName ?? "Untitled profile"}</Button>
          </form>
        ))}
        <Link href="?step=goal" className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">Create a new profile</Link>
      </SetupView>
    );
  }
  const step = resolveStep(requested, profile);
  if (requested !== step && (requested !== undefined || profile)) redirect(`?step=${step}`);
  const rawGoal = first(query.goal);
  const goal = isGoal(rawGoal) ? rawGoal : profile?.goal ?? null;
  const previous = previousStep(step);
  const backHref = previous ? `?step=${previous}${!profile && previous === "goal" && rawGoal !== undefined ? `&goal=${goal ?? ""}` : ""}` : "/app";
  // Keep the existing essentials presentation until the dedicated You step lands in T10.
  const purpose: Purpose = goal === "business" ? "get_clients" : goal === "freelance" ? "show_my_work" : "network";
  return (
    <SetupView suffix={card.publicToken.slice(-4)} step={step} backHref={backHref}>
      {step === "goal" ? (
        <SetupForm key={goal ?? "none"} action={continueGoalAction} className="flex flex-col gap-5">
          <input type="hidden" name="cardId" value={card.id} />
          <GoalFields goal={rawGoal !== undefined ? goal : profile ? profile.goal : undefined} />
        </SetupForm>
      ) : step === "you" && !profile ? (
        <EssentialsForm cardId={card.id} goal={goal} purpose={purpose} linkLabel={PURPOSES[purpose].linkLabel} defaultEmail={viewer.email} />
      ) : profile ? <SetupPlaceholder step={step} profileId={profile.id} sceneId={profile.defaultSceneId} /> : null}
    </SetupView>
  );
}
