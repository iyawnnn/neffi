"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { ProfileError } from "@/modules/profiles/errors";
import { publishProfile, unpublishProfile } from "@/modules/profiles/profiles";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";

export type ProfileActionState = { error?: string; gaps?: string[]; fields?: string[]; ok?: string };
const PROFILE_MESSAGES = {
  invalid: "Check the highlighted fields and try again.",
  limit_reached: "You've reached the limit for this. Remove one first.",
  has_cards: "Move or disable the cards showing this profile before deleting it.",
  default_scene: "Your main scene can't be deleted.",
  not_ready: "Your Neffi isn't ready to publish yet.",
};

async function ownerId() {
  const authorization = await authorize("account");
  if (!authorization.ok) redirect("/sign-in?next=/app");
  return authorization.viewer.accountId;
}
const id = (value: FormDataEntryValue | null) => (typeof value === "string" && z.uuid().safeParse(value).success ? value : notFound());

function failure(error: unknown): ProfileActionState {
  if (!(error instanceof ProfileError)) throw error;
  if (error.code === "not_found") notFound();
  if (error.code === "not_ready") return { error: PROFILE_MESSAGES.not_ready, gaps: error.gaps.map(g => PUBLISH_GAP_COPY[g]) };
  return { error: PROFILE_MESSAGES[error.code] };
}

export async function publishAction(_previous: ProfileActionState | undefined, data: FormData): Promise<ProfileActionState> {
  const accountId = await ownerId();
  const profileId = id(data.get("profileId"));
  try { await publishProfile(db, { accountId, profileId }); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${profileId}?published=1`);
}

export async function unpublishAction(data: FormData): Promise<void> {
  const accountId = await ownerId();
  const profileId = id(data.get("profileId"));
  try { await unpublishProfile(db, { accountId, profileId }); } catch (error) { failure(error); }
  redirect(`/app/profiles/${profileId}`);
}
