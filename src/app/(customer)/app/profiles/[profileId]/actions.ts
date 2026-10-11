"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { ProfileError } from "@/modules/profiles/errors";
import { deleteProfile, publishProfile, unpublishProfile, updateIdentity } from "@/modules/profiles/profiles";
import { identitySchema, PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
import { createScene, showScene } from "@/modules/profiles/scenes";

export type ProfileActionState = { error?: string; gaps?: string[]; fields?: string[]; ok?: string };
const PROFILE_MESSAGES = {
  invalid: "Check the highlighted fields and try again.",
  limit_reached: "You've reached the limit for this. Remove one first.",
  has_cards: "Move the cards showing this profile to another profile before deleting it.",
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

const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

export async function updateIdentityAction(_previous: ProfileActionState | undefined, data: FormData): Promise<ProfileActionState> {
  const accountId = await ownerId();
  const profileId = id(data.get("profileId"));
  const parsed = identitySchema.safeParse(Object.fromEntries(["fullName", "headline", "company", "bio", "phone", "email", "website", "location"].map(key => [key, text(data, key)])));
  if (!parsed.success) return { error: PROFILE_MESSAGES.invalid, fields: [...new Set(parsed.error.issues.map(issue => String(issue.path[0])))] };
  try { await updateIdentity(db, { accountId, profileId, identity: parsed.data }); } catch (error) { return failure(error); }
  return { ok: "Saved." };
}

export async function showSceneAction(data: FormData): Promise<void> {
  const accountId = await ownerId();
  const profileId = id(data.get("profileId"));
  const sceneId = id(data.get("sceneId"));
  try { await showScene(db, { accountId, profileId, sceneId }); } catch (error) { failure(error); }
  redirect(`/app/profiles/${profileId}`);
}

export async function createSceneAction(_previous: ProfileActionState | undefined, data: FormData): Promise<ProfileActionState> {
  const accountId = await ownerId();
  const profileId = id(data.get("profileId"));
  const copyFrom = text(data, "copyFrom");
  const copyFromSceneId = copyFrom === "empty" ? null : id(copyFrom);
  let sceneId: string;
  try { ({ sceneId } = await createScene(db, { accountId, profileId, name: text(data, "name"), copyFromSceneId })); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${profileId}/scenes/${sceneId}`);
}

export async function deleteProfileAction(_previous: ProfileActionState | undefined, data: FormData): Promise<ProfileActionState> {
  const accountId = await ownerId();
  const profileId = id(data.get("profileId"));
  if (data.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  try { await deleteProfile(db, { accountId, profileId }); } catch (error) { return failure(error); }
  redirect("/app/profiles");
}
