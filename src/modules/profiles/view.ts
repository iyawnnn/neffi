import "server-only";
import { and, eq } from "drizzle-orm";
import { env } from "@/config/env";
import { imageUrl } from "@/integrations/media/cloudinary";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { buildSceneView } from "./scene-view";

export async function loadOwnerSceneView(db: Db, input: { accountId: string; profileId: string; sceneId?: string }) {
  const [profile] = await db.select({
    fullName: schema.profiles.fullName, headline: schema.profiles.headline, company: schema.profiles.company,
    bio: schema.profiles.bio, phone: schema.profiles.phone, email: schema.profiles.email,
    website: schema.profiles.website, location: schema.profiles.location, accentColor: schema.profiles.accentColor,
    imageAssetId: schema.profiles.imageAssetId, imageIsLogo: schema.profiles.imageIsLogo, defaultSceneId: schema.profiles.defaultSceneId, activeSceneId: schema.profiles.activeSceneId,
  }).from(schema.profiles).where(and(eq(schema.profiles.id, input.profileId), eq(schema.profiles.accountId, input.accountId)));
  if (!profile) return null;
  const sceneRows = await db.select({ id: schema.scenes.id, name: schema.scenes.name }).from(schema.scenes).where(eq(schema.scenes.profileId, input.profileId));
  const scene = sceneRows.find(s => s.id === input.sceneId) ?? sceneRows.find(s => s.id === (profile.activeSceneId ?? profile.defaultSceneId));
  if (!scene) return null;
  const [blocks, forms] = await Promise.all([
    db.select({ id: schema.sceneBlocks.id, type: schema.sceneBlocks.type, position: schema.sceneBlocks.position, visible: schema.sceneBlocks.visible, content: schema.sceneBlocks.content, formId: schema.sceneBlocks.formId }).from(schema.sceneBlocks).where(eq(schema.sceneBlocks.sceneId, scene.id)),
    db.select({ id: schema.formDefinitions.id, title: schema.formDefinitions.title, config: schema.formDefinitions.config }).from(schema.formDefinitions).where(eq(schema.formDefinitions.profileId, input.profileId)),
  ]);
  return buildSceneView({ profile, imageUrl: profile.imageAssetId ? imageUrl(env.cloudinaryCloudName, profile.imageAssetId, profile.imageIsLogo) : null, scene, blocks, forms });
}
