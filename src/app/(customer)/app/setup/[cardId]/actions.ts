"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { connectCardToProfile } from "@/modules/cards/manage";
import { ProfileError } from "@/modules/profiles/errors";
import { createProfileFromStarter } from "@/modules/profiles/profiles";
import { essentialsSchema, isPurpose } from "@/modules/profiles/starters";

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
  const purpose = text(data, "purpose");
  if (!isPurpose(purpose)) notFound();
  const parsed = essentialsSchema.safeParse({
    fullName: text(data, "fullName"), headline: text(data, "headline"), bio: text(data, "bio"),
    email: text(data, "email"), phone: text(data, "phone"), link: text(data, "link"),
  });
  if (!parsed.success) return { error: MESSAGES.invalid, fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  let profileId: string;
  try {
    ({ profileId } = await createProfileFromStarter(db, { accountId, cardId, purpose, essentials: parsed.data }));
  } catch (error) {
    if (error instanceof ProfileError && error.code === "limit_reached") return { error: MESSAGES.limit_reached };
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  redirect(`/app/profiles/${profileId}/publish`);
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
