import "server-only";
import { and, asc, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import type { FormConfig } from "../forms/config";
import { LINK_KIND_LABELS, type LinkKind } from "./block-content";

function summary(type: string, content: Record<string, unknown>, formTitle: string | null) {
  if (type === "about") return String(content.text).slice(0, 60);
  if (type === "project") return String(content.title);
  if (type === "link") return (content.label as string | null) ?? LINK_KIND_LABELS[content.kind as LinkKind];
  if (type === "contact") return `Save Contact ${content.saveContact ? "on" : "off"}`;
  if (type === "booking") return (content.label as string | null) ?? "Book a time";
  return formTitle ?? "Form";
}

const blockColumns = {
  id: schema.sceneBlocks.id, sceneId: schema.sceneBlocks.sceneId, type: schema.sceneBlocks.type,
  visible: schema.sceneBlocks.visible, content: schema.sceneBlocks.content, formId: schema.sceneBlocks.formId,
  formTitle: schema.formDefinitions.title,
};

export async function sceneForEditing(db: Db, accountId: string, profileId: string, sceneId: string) {
  const [scene] = await db.select({ id: schema.scenes.id, name: schema.scenes.name, defaultSceneId: schema.profiles.defaultSceneId })
    .from(schema.scenes).innerJoin(schema.profiles, eq(schema.profiles.id, schema.scenes.profileId))
    .where(and(eq(schema.scenes.id, sceneId), eq(schema.profiles.id, profileId), eq(schema.profiles.accountId, accountId)));
  if (!scene) return null;
  const rows = await db.select(blockColumns).from(schema.sceneBlocks)
    .leftJoin(schema.formDefinitions, eq(schema.formDefinitions.id, schema.sceneBlocks.formId))
    .where(eq(schema.sceneBlocks.sceneId, scene.id)).orderBy(asc(schema.sceneBlocks.position), asc(schema.sceneBlocks.createdAt));
  return {
    scene: { id: scene.id, name: scene.name, isDefault: scene.id === scene.defaultSceneId },
    blocks: rows.map(row => ({ id: row.id, type: row.type, visible: row.visible, content: row.content as Record<string, unknown>, summary: summary(row.type, row.content as Record<string, unknown>, row.formTitle) })),
  };
}

export async function blockForEditing(db: Db, accountId: string, profileId: string, blockId: string) {
  const [row] = await db.select({ ...blockColumns, formConfig: schema.formDefinitions.config }).from(schema.sceneBlocks)
    .innerJoin(schema.scenes, eq(schema.scenes.id, schema.sceneBlocks.sceneId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.scenes.profileId))
    .leftJoin(schema.formDefinitions, eq(schema.formDefinitions.id, schema.sceneBlocks.formId))
    .where(and(eq(schema.sceneBlocks.id, blockId), eq(schema.profiles.id, profileId), eq(schema.profiles.accountId, accountId)));
  if (!row) return null;
  return { id: row.id, sceneId: row.sceneId, type: row.type, visible: row.visible, content: row.content as Record<string, unknown>, formId: row.formId,
    form: row.formId && row.formTitle && row.formConfig ? { id: row.formId, title: row.formTitle, config: row.formConfig as FormConfig } : null };
}
