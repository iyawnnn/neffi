"use server";

import { randomBytes } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { blockType, formPreset } from "@/db/schema/enums";
import { FORM_FIELDS, MAX_QUESTIONS } from "@/modules/forms/config";
import { updateForm } from "@/modules/forms/forms";
import { addBlock, deleteBlock, moveBlock, setBlockVisible, updateBlock } from "@/modules/profiles/blocks";
import type { BlockType } from "@/modules/profiles/block-content";
import { ProfileError } from "@/modules/profiles/errors";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
import { deleteScene, renameScene } from "@/modules/profiles/scenes";

export type SceneActionState = { error?: string; gaps?: string[] };
const MESSAGES = {
  invalid: "Check the highlighted fields and try again.",
  limit_reached: "You've reached the limit for this. Remove one first.",
  default_scene: "Your main scene can't be deleted.",
  has_cards: "Move the cards showing this profile to another profile before deleting it.",
  not_ready: "Your Neffi isn't ready to publish yet.",
};
const id = (value: FormDataEntryValue | null) => typeof value === "string" && z.uuid().safeParse(value).success ? value : notFound();
const text = (data: FormData, key: string) => typeof data.get(key) === "string" ? data.get(key) as string : "";
async function context(data: FormData) {
  const auth = await authorize("account");
  if (!auth.ok) redirect("/sign-in?next=/app");
  return { accountId: auth.viewer.accountId, profileId: id(data.get("profileId")), sceneId: id(data.get("sceneId")) };
}
function failure(error: unknown): SceneActionState {
  if (!(error instanceof ProfileError)) throw error;
  if (error.code === "not_found") notFound();
  if (error.code === "not_ready") return { error: MESSAGES.not_ready, gaps: error.gaps.map(gap => PUBLISH_GAP_COPY[gap]) };
  return { error: MESSAGES[error.code] };
}
const KEYS: Record<BlockType, string[]> = { about: ["text"], project: ["title", "description", "url"], link: ["kind", "label", "url"], contact: ["saveContact"], booking: ["label", "url"], form: [] };
function blockContent(data: FormData) {
  const parsed = z.enum(blockType.enumValues).safeParse(text(data, "type"));
  if (!parsed.success) notFound();
  const type = parsed.data;
  const content = Object.fromEntries(KEYS[type].map(key => [key, key === "saveContact" ? data.get(key) : text(data, key)]));
  return { type, content };
}

export async function renameSceneAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  try { await renameScene(db, { ...input, name: text(data, "name") }); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${input.profileId}/scenes/${input.sceneId}`);
}
export async function deleteSceneAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  if (data.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  try { await deleteScene(db, input); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${input.profileId}`);
}
export async function addBlockAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  const { type, content } = blockContent(data);
  const preset = type === "form" ? z.enum(formPreset.enumValues).safeParse(text(data, "preset")) : null;
  if (preset && !preset.success) return { error: MESSAGES.invalid };
  try { await addBlock(db, { ...input, type, content, ...(preset?.success ? { preset: preset.data } : {}) }); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${input.profileId}/scenes/${input.sceneId}`);
}
export async function updateBlockAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  const blockId = id(data.get("blockId"));
  const { content } = blockContent(data);
  try { await updateBlock(db, { accountId: input.accountId, profileId: input.profileId, blockId, content }); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${input.profileId}/scenes/${input.sceneId}`);
}
export async function moveBlockAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  const blockId = id(data.get("blockId"));
  const direction = z.enum(["up", "down"]).safeParse(text(data, "direction"));
  if (!direction.success) return { error: MESSAGES.invalid };
  try { await moveBlock(db, { accountId: input.accountId, profileId: input.profileId, blockId, direction: direction.data }); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${input.profileId}/scenes/${input.sceneId}`);
}
export async function toggleBlockAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  const blockId = id(data.get("blockId"));
  const visible = text(data, "visible");
  if (visible !== "true" && visible !== "false") return { error: MESSAGES.invalid };
  try { await setBlockVisible(db, { accountId: input.accountId, profileId: input.profileId, blockId, visible: visible === "true" }); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${input.profileId}/scenes/${input.sceneId}`);
}
export async function removeBlockAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  const blockId = id(data.get("blockId"));
  if (data.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  try { await deleteBlock(db, { accountId: input.accountId, profileId: input.profileId, blockId }); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${input.profileId}/scenes/${input.sceneId}`);
}

export async function updateFormAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  const formId = id(data.get("formId"));
  const fields = Object.fromEntries(FORM_FIELDS.map(field => [field, text(data, `field.${field}`)]));
  const indices = [...new Set([...data.keys()].flatMap(key => key.match(/^question\.(\d+)\.label$/)?.[1] ?? []))].sort((a, b) => Number(a) - Number(b));
  const questions = indices.filter(index => text(data, `question.${index}.label`).trim()).map(index => ({
    id: text(data, `question.${index}.id`) || randomBytes(4).toString("hex"),
    label: text(data, `question.${index}.label`).trim(), required: data.get(`question.${index}.required`) === "on",
  }));
  if (questions.length > MAX_QUESTIONS) return { error: "You can add up to 3 questions." };
  try { await updateForm(db, { accountId: input.accountId, profileId: input.profileId, formId, title: text(data, "title"), config: { fields, questions } }); } catch (error) { return failure(error); }
  redirect(`/app/profiles/${input.profileId}/scenes/${input.sceneId}`);
}
