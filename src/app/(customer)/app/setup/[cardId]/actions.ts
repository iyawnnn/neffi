"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { connectCardToProfile } from "@/modules/cards/manage";
import { ProfileError } from "@/modules/profiles/errors";
import { createProfileFromSetup, getOwnedProfile, setProfileGoal } from "@/modules/profiles/profiles";
import { essentialsSchema } from "@/modules/profiles/starters";
import { isGoal } from "@/modules/profiles/goals";
import { ownedCards } from "@/modules/cards/owned";

export type SetupState = { error?: string; fields?: string[] };
const MESSAGES = {
  invalid: "Check the highlighted fields and try again.",
  limit_reached: "You've reached the limit for this. Remove one first.",
};
const text = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
};
const uuid = (value: string) => (z.uuid().safeParse(value).success ? value : notFound());

async function viewerId() {
  const authorization = await authorize("account");
  if (!authorization.ok) redirect("/sign-in?next=/app");
  return authorization.viewer.accountId;
}

export async function createProfileAction(_previous: SetupState | undefined, data: FormData): Promise<SetupState> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const goal = data.get("goal");
  if (typeof goal !== "string" || (goal !== "" && !isGoal(goal))) notFound();
  const parsed = essentialsSchema.safeParse({
    fullName: text(data, "fullName"), headline: text(data, "headline"), bio: text(data, "bio"),
    email: text(data, "email"), phone: text(data, "phone"), link: text(data, "link"),
  });
  if (!parsed.success) return { error: MESSAGES.invalid, fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  try {
    const { link, ...identity } = parsed.data;
    await createProfileFromSetup(db, { accountId, cardId, goal: isGoal(goal) ? goal : null, identity: { ...identity, website: link, company: null, location: null } });
  } catch (error) {
    if (error instanceof ProfileError && error.code === "limit_reached") return { error: MESSAGES.limit_reached };
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  redirect(`/app/setup/${cardId}?step=photo`);
}

export async function chooseProfileAction(data: FormData): Promise<void> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const profileId = uuid(text(data, "profileId"));
  try {
    await connectCardToProfile(db, { accountId, cardId, profileId });
  } catch (error) {
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  redirect(`/app/profiles/${profileId}`);
}

export async function continueGoalAction(data: FormData): Promise<void> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const goal = data.get("goal");
  if (typeof goal !== "string" || (goal !== "" && !isGoal(goal))) notFound();
  const card = (await ownedCards(db, accountId)).find(card => card.id === cardId);
  if (!card) notFound();
  if (card.profileId) {
    const profile = await getOwnedProfile(db, accountId, card.profileId);
    if (profile?.status !== "draft") notFound();
    try {
      await setProfileGoal(db, { accountId, profileId: card.profileId, goal: isGoal(goal) ? goal : null });
    } catch (error) {
      if (error instanceof ProfileError) notFound();
      throw error;
    }
  }
  redirect(`/app/setup/${cardId}?step=you&goal=${goal}`);
}
