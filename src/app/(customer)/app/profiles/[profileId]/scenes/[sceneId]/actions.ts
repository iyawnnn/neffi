"use server";

import { randomBytes } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { blockType, formPreset } from "@/db/schema/enums";
import { FORM_FIELDS, MAX_QUESTIONS, parseFormConfig } from "@/modules/forms/config";
import { parseFormTitle, updateForm } from "@/modules/forms/forms";
import { addBlock, deleteBlock, moveBlock, setBlockVisible, updateBlock } from "@/modules/profiles/blocks";
import { BLOCK_CONTENT_SCHEMAS, type BlockType } from "@/modules/profiles/block-content";
import { BLOCK_SECTIONS, type BlockSection } from "@/modules/profiles/block-options";
import { blockForEditing } from "@/modules/profiles/editor";
import { ProfileError } from "@/modules/profiles/errors";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
import { deleteScene, renameScene } from "@/modules/profiles/scenes";

export type SceneActionState = { error?: string; gaps?: string[]; fields?: Record<string, string>; ok?: boolean; blockId?: string };
const MESSAGES = {
  invalid: "Check the highlighted fields and try again.",
  limit_reached: "You've reached the limit for this. Remove one first.",
  default_scene: "Your main profile mode can't be deleted.",
  has_cards: "Move the cards showing this profile to another profile before deleting it.",
  not_ready: "Your Neffi isn't ready to publish yet.",
};
const uuid = (value: string) => z.uuid().safeParse(value).success ? value : notFound();
const id = (value: FormDataEntryValue | null) => typeof value === "string" ? uuid(value) : notFound();
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
function blockContent(data: FormData, knownType?: BlockType) {
  const parsed = knownType ? { success: true as const, data: knownType } : z.enum(blockType.enumValues).safeParse(text(data, "type"));
  if (!parsed.success) notFound();
  const type = parsed.data;
  const content = Object.fromEntries(KEYS[type].map(key => [key, key === "saveContact" ? data.get(key) : text(data, key)]));
  return { type, content };
}

type ItemOperation = "add" | "update" | "move" | "visibility" | "remove" | "form";
const OPERATION = z.enum(["add", "update", "move", "visibility", "remove", "form"]);
function contentErrors(type: BlockType, content: Record<string, unknown>): SceneActionState | null {
  const parsed = BLOCK_CONTENT_SCHEMAS[type].safeParse(content);
  if (parsed.success) return null;
  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = typeof issue.path[0] === "string" ? issue.path[0] : "form";
    if (!fields[key]) fields[key] = key === "url" ? "Enter a valid link." : issue.code === "too_small" ? "This field is required." : "Check this field.";
  }
  return { error: MESSAGES.invalid, fields };
}

async function routeBlock(input: { accountId: string; profileId: string; sceneId: string }, blockId: string) {
  const block = await blockForEditing(db, input.accountId, input.profileId, blockId, input.sceneId);
  if (!block) notFound();
  return block;
}

async function mutate(input: { accountId: string; profileId: string; sceneId: string }, data: FormData, operation: ItemOperation): Promise<SceneActionState> {
  if (operation === "add") {
    const { type, content } = blockContent(data);
    const preset = type === "form" ? z.enum(formPreset.enumValues).safeParse(text(data, "preset")) : null;
    const invalid = contentErrors(type, content);
    if (invalid || (preset && !preset.success)) return invalid ?? { error: MESSAGES.invalid, fields: { preset: "Choose a starting point." } };
    try {
      const { blockId } = await addBlock(db, { ...input, type, content, ...(preset?.success ? { preset: preset.data } : {}) });
      return { ok: true, blockId };
    } catch (error) {
      const state = failure(error);
      return state.error === MESSAGES.invalid ? { error: MESSAGES.invalid } : state;
    }
  }

  const blockId = id(data.get("blockId"));
  const block = await routeBlock(input, blockId);

  if (operation === "update") {
    if (block.type === "form") return { error: MESSAGES.invalid };
    const { content } = blockContent(data, block.type);
    const invalid = contentErrors(block.type, content);
    if (invalid) return invalid;
    try {
      await updateBlock(db, { accountId: input.accountId, profileId: input.profileId, blockId, content });
      return { ok: true, blockId };
    } catch (error) {
      const state = failure(error);
      return state.error === MESSAGES.invalid ? { error: MESSAGES.invalid } : state;
    }
  }

  if (operation === "move") {
    const direction = z.enum(["up", "down"]).safeParse(text(data, "direction"));
    const section = z.enum(Object.keys(BLOCK_SECTIONS) as [BlockSection, ...BlockSection[]]).safeParse(text(data, "section"));
    const among: readonly BlockType[] = section.success ? BLOCK_SECTIONS[section.data] : [];
    if (!direction.success || !section.success || !among.includes(block.type)) return { error: MESSAGES.invalid };
    try {
      await moveBlock(db, { accountId: input.accountId, profileId: input.profileId, blockId, direction: direction.data, among });
      return { ok: true, blockId };
    } catch (error) { return failure(error); }
  }

  if (operation === "visibility") {
    const visible = text(data, "visible");
    if (visible !== "true" && visible !== "false") return { error: MESSAGES.invalid };
    try {
      await setBlockVisible(db, { accountId: input.accountId, profileId: input.profileId, blockId, visible: visible === "true" });
      return { ok: true, blockId };
    } catch (error) { return failure(error); }
  }

  if (operation === "remove") {
    if (data.get("confirm") !== "on") return { error: "Tick the box to confirm." };
    try {
      await deleteBlock(db, { accountId: input.accountId, profileId: input.profileId, blockId });
      return { ok: true, blockId };
    } catch (error) { return failure(error); }
  }

  if (block.type !== "form" || !block.form) return { error: MESSAGES.invalid };
  const fields = Object.fromEntries(FORM_FIELDS.map(field => [field, text(data, `field.${field}`)]));
  const indices = [...new Set([...data.keys()].flatMap(key => key.match(/^question\.(\d+)\.label$/)?.[1] ?? []))].sort((a, b) => Number(a) - Number(b));
  const questions = indices.filter(index => text(data, `question.${index}.label`).trim()).map(index => ({
    id: text(data, `question.${index}.id`) || randomBytes(4).toString("hex"),
    label: text(data, `question.${index}.label`).trim(), required: data.get(`question.${index}.required`) === "on",
  }));
  if (questions.length > MAX_QUESTIONS) return { error: "You can add up to 3 questions.", fields: { questions: "You can add up to 3 questions." } };
  if (!parseFormTitle(text(data, "title"))) return { error: MESSAGES.invalid, fields: { title: "Enter a title up to 60 characters." } };
  if (!parseFormConfig({ fields, questions }).ok) return { error: MESSAGES.invalid, fields: { config: "Check your contact form settings." } };
  try {
    await updateForm(db, { accountId: input.accountId, profileId: input.profileId, formId: block.form.id, title: text(data, "title"), config: { fields, questions } });
    return { ok: true, blockId };
  } catch (error) { return failure(error); }
}

export async function loadItemAction(profileId: string, sceneId: string, blockId: string) {
  const auth = await authorize("account");
  if (!auth.ok) redirect("/sign-in?next=/app");
  const item = await blockForEditing(db, auth.viewer.accountId, uuid(profileId), uuid(blockId), uuid(sceneId));
  if (!item) notFound();
  return item;
}

export async function mutateItemAction(data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  const operation = OPERATION.safeParse(text(data, "operation"));
  if (!operation.success) return { error: MESSAGES.invalid };
  return mutate(input, data, operation.data);
}

async function redirectMutation(input: { accountId: string; profileId: string; sceneId: string }, data: FormData, operation: ItemOperation): Promise<SceneActionState> {
  const state = await mutate(input, data, operation);
  if (state.ok) redirect(`/app/profiles/${input.profileId}/scenes/${input.sceneId}`);
  return state;
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
  return redirectMutation(input, data, "add");
}
export async function updateBlockAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  return redirectMutation(input, data, "update");
}
export async function moveBlockAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  return redirectMutation(input, data, "move");
}
export async function toggleBlockAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  return redirectMutation(input, data, "visibility");
}
export async function removeBlockAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  return redirectMutation(input, data, "remove");
}

export async function updateFormAction(_previous: SceneActionState | undefined, data: FormData): Promise<SceneActionState> {
  const input = await context(data);
  return redirectMutation(input, data, "form");
}
