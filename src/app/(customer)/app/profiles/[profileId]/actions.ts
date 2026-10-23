"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { consumeQuota, hmacHex } from "@/auth/otp-quota";
import { env } from "@/config/env";
import { db } from "@/db";
import { checkImage, destroyImage, getImage, isProfileCoverId, isProfileImageId, signImageUpload } from "@/integrations/media/cloudinary";
import { ProfileError } from "@/modules/profiles/errors";
import { deleteProfile, getOwnedProfile, lockOwnedProfile, publishProfile, setProfileCover, setProfileCoverCrop, setProfileImage, unpublishProfile, updateAppearance, updateIdentity } from "@/modules/profiles/profiles";
import { coverCropSchema, profileCoverSchema } from "@/modules/profiles/cover";
import { COLOR_MODES, LAYOUTS } from "@/modules/profiles/appearance-options";
import { ACCENTS, identitySchema, PUBLISH_GAP_COPY, type Identity } from "@/modules/profiles/rules";
import { createScene, showScene } from "@/modules/profiles/scenes";

export type ProfileActionState = { error?: string; gaps?: string[]; fields?: string[]; ok?: string; identity?: Identity };
const PROFILE_MESSAGES = {
  invalid: "Check the highlighted fields and try again.",
  limit_reached: "You've reached the limit for this. Remove one first.",
  has_cards: "Move the cards showing this profile to another profile before deleting it.",
  default_scene: "Your default mode can't be deleted.",
  not_ready: "Your Neffi isn't ready to publish yet.",
};
const mediaConfig = { cloudName: env.cloudinaryCloudName, apiKey: env.cloudinaryApiKey, apiSecret: env.cloudinaryApiSecret };
const IMAGE_ERROR = "Use a JPG, PNG, WebP or HEIC image up to 5 MB.";
const COVER_ERROR = "Use a JPG, PNG, WebP or HEIC image up to 5 MB and at least 600 pixels wide.";
const CROP_ERROR = "Adjust the crop to fit the image.";

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
  const imageIsLogo = data.get("imageIsLogo");
  if (imageIsLogo !== null && imageIsLogo !== "true" && imageIsLogo !== "false") return { error: PROFILE_MESSAGES.invalid };
  try { await updateIdentity(db, { accountId, profileId, identity: parsed.data, ...(imageIsLogo === null ? {} : { imageIsLogo: imageIsLogo === "true" }) }); } catch (error) { return failure(error); }
  return { ok: "Saved.", identity: parsed.data };
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
  try {
    const { imageAssetId, coverAssetId } = await deleteProfile(db, { accountId, profileId });
    if (imageAssetId) await destroyImage(mediaConfig, imageAssetId).catch(() => undefined);
    if (coverAssetId && isProfileCoverId(profileId, coverAssetId)) await destroyImage(mediaConfig, coverAssetId).catch(() => undefined);
  } catch (error) { return failure(error); }
  redirect("/app/profiles");
}

export async function updateAppearanceAction(_previous: ProfileActionState | undefined, data: FormData): Promise<ProfileActionState> {
  const accountId = await ownerId();
  const profileId = id(data.get("profileId"));
  const parsed = z.object({ layout: z.enum(LAYOUTS), colorMode: z.enum(COLOR_MODES), accentColor: z.string().refine(value => ACCENTS.some(accent => accent.hex === value)) }).safeParse({ layout: text(data, "layout"), colorMode: text(data, "colorMode"), accentColor: text(data, "accentColor") });
  if (!parsed.success) return { error: PROFILE_MESSAGES.invalid };
  try { await updateAppearance(db, { accountId, profileId, ...parsed.data }); } catch (error) { return failure(error); }
  return { ok: "Saved." };
}

// ponytail: orphaned Cloudinary assets from abandoned uploads are not swept; add a periodic sweep in M10 if storage matters.
export async function startImageUploadAction(profileId: string, kind: unknown = "image") {
  const accountId = await ownerId();
  id(profileId);
  if (kind !== "image" && kind !== "cover") return { error: IMAGE_ERROR };
  if (!await getOwnedProfile(db, accountId, profileId)) notFound();
  if (!await consumeQuota(db, hmacHex(env.betterAuthSecret, "media-sign", accountId), 20)) return { error: "Too many uploads. Please wait a few minutes and try again." };
  return { ticket: signImageUpload(mediaConfig, kind === "image" ? { profileId } : { profileId, kind }) };
}

export async function confirmImageAction(profileId: string, publicId: string): Promise<{ ok?: true; error?: string }> {
  const accountId = await ownerId();
  id(profileId);
  if (!await getOwnedProfile(db, accountId, profileId)) notFound();
  if (typeof publicId !== "string" || !isProfileImageId(profileId, publicId)) return { error: IMAGE_ERROR };
  const image = await getImage(mediaConfig, publicId);
  if (!image) return { error: IMAGE_ERROR };
  if (!checkImage(image)) {
    await destroyImage(mediaConfig, publicId).catch(() => undefined);
    return { error: IMAGE_ERROR };
  }
  const { previousAssetId } = await setProfileImage(db, { accountId, profileId, assetId: publicId });
  if (previousAssetId) await destroyImage(mediaConfig, previousAssetId).catch(() => undefined);
  return { ok: true };
}

export async function removeImageAction(profileId: string): Promise<void> {
  const accountId = await ownerId();
  id(profileId);
  const { previousAssetId } = await setProfileImage(db, { accountId, profileId, assetId: null });
  if (previousAssetId) await destroyImage(mediaConfig, previousAssetId).catch(() => undefined);
}

export async function confirmCoverAction(profileId: string, publicId: string, crop: unknown): Promise<{ ok?: true; error?: string }> {
  const accountId = await ownerId();
  id(profileId);
  if (typeof publicId !== "string" || !isProfileCoverId(profileId, publicId)) return { error: COVER_ERROR };
  let result: { error: string } | { previousAssetId: string | null };
  try { result = await db.transaction(async tx => {
    // The shared row lock keeps verification and rejection cleanup from racing another cover confirmation.
    const profile = await lockOwnedProfile(tx, accountId, profileId);
    if (publicId === profile.coverAssetId) return { error: COVER_ERROR };
    const image = await getImage(mediaConfig, publicId);
    if (!image) return { error: COVER_ERROR };
    if (!checkImage(image) || image.width < 600) {
      await destroyImage(mediaConfig, publicId).catch(() => undefined);
      return { error: COVER_ERROR };
    }
    const parsed = profileCoverSchema.safeParse({ assetId: publicId, width: image.width, height: image.height, crop });
    if (!parsed.success) {
      await destroyImage(mediaConfig, publicId).catch(() => undefined);
      return { error: CROP_ERROR };
    }
    return { previousAssetId: (await setProfileCover(tx, { accountId, profileId, cover: parsed.data })).previousAssetId };
  }); } catch (error) {
    if (error instanceof ProfileError && error.code === "not_found") notFound();
    throw error;
  }
  if ("error" in result) return { error: result.error };
  if (result.previousAssetId) await discardInactiveCover(accountId, profileId, result.previousAssetId).catch(() => undefined);
  return { ok: true };
}

export async function updateCoverCropAction(profileId: string, crop: unknown): Promise<{ error?: string }> {
  const accountId = await ownerId();
  id(profileId);
  const parsed = coverCropSchema.safeParse(crop);
  if (!parsed.success) return { error: CROP_ERROR };
  try { await setProfileCoverCrop(db, { accountId, profileId, crop: parsed.data }); } catch (error) { return failure(error); }
  return {};
}

export async function removeCoverAction(profileId: string): Promise<void> {
  const accountId = await ownerId();
  id(profileId);
  const { previousAssetId } = await setProfileCover(db, { accountId, profileId, cover: null });
  if (previousAssetId) await discardInactiveCover(accountId, profileId, previousAssetId).catch(() => undefined);
}

export async function discardCoverUploadAction(profileId: string, publicId: string): Promise<void> {
  const accountId = await ownerId();
  id(profileId);
  try { await discardInactiveCover(accountId, profileId, publicId); } catch (error) {
    if (error instanceof ProfileError && error.code === "not_found") notFound();
    throw error;
  }
}

async function discardInactiveCover(accountId: string, profileId: string, publicId: unknown): Promise<void> {
  if (typeof publicId !== "string" || !isProfileCoverId(profileId, publicId)) return;
  await db.transaction(async tx => {
    // Recheck while locked so a stale cleanup cannot delete a cover another request has made current.
    const profile = await lockOwnedProfile(tx, accountId, profileId);
    if (profile.coverAssetId !== publicId) await destroyImage(mediaConfig, publicId).catch(() => undefined);
  });
}
