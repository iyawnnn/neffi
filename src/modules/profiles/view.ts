import "server-only";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { env } from "@/config/env";
import { imageUrl } from "@/integrations/media/cloudinary";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { buildSceneView } from "./scene-view";
import type { ViewKey, ViewLoader } from "../cards/resolve";

const selectProfile = (db: Db, where: SQL | undefined) => db.select({
  fullName: schema.profiles.fullName, headline: schema.profiles.headline, company: schema.profiles.company,
  bio: schema.profiles.bio, phone: schema.profiles.phone, email: schema.profiles.email,
  website: schema.profiles.website, location: schema.profiles.location, accentColor: schema.profiles.accentColor,
  layout: schema.profiles.layout, colorMode: schema.profiles.colorMode,
  imageAssetId: schema.profiles.imageAssetId, imageIsLogo: schema.profiles.imageIsLogo, defaultSceneId: schema.profiles.defaultSceneId, activeSceneId: schema.profiles.activeSceneId,
}).from(schema.profiles).where(where);
type ViewProfile = Awaited<ReturnType<typeof selectProfile>>[number];

async function sceneView(db: Db, profileId: string, profile: ViewProfile, sceneId: string | undefined, fallbackSceneId: string | null) {
  const sceneRows = await db.select({ id: schema.scenes.id, name: schema.scenes.name }).from(schema.scenes).where(eq(schema.scenes.profileId, profileId));
  const scene = sceneRows.find(s => s.id === sceneId) ?? sceneRows.find(s => s.id === fallbackSceneId);
  if (!scene) return null;
  const [blocks, forms] = await Promise.all([
    db.select({ id: schema.sceneBlocks.id, type: schema.sceneBlocks.type, position: schema.sceneBlocks.position, visible: schema.sceneBlocks.visible, content: schema.sceneBlocks.content, formId: schema.sceneBlocks.formId }).from(schema.sceneBlocks).where(eq(schema.sceneBlocks.sceneId, scene.id)),
    db.select({ id: schema.formDefinitions.id, title: schema.formDefinitions.title, config: schema.formDefinitions.config }).from(schema.formDefinitions).where(eq(schema.formDefinitions.profileId, profileId)),
  ]);
  return buildSceneView({ profile, imageUrl: profile.imageAssetId ? imageUrl(env.cloudinaryCloudName, profile.imageAssetId, profile.imageIsLogo) : null, scene, blocks, forms });
}

export async function loadOwnerSceneView(db: Db, input: { accountId: string; profileId: string; sceneId?: string }) {
  const [profile] = await selectProfile(db, and(eq(schema.profiles.id, input.profileId), eq(schema.profiles.accountId, input.accountId)));
  return profile ? sceneView(db, input.profileId, profile, input.sceneId, profile.activeSceneId ?? profile.defaultSceneId) : null;
}

// Shared public data only. The caller has already checked, fresh, that a live card shows this Published profile and which
// Scene is shown; a Scene that has since disappeared falls back to the Default Scene.
export async function loadPublicSceneView(db: Db, input: { profileId: string; sceneId: string }) {
  const [profile] = await selectProfile(db, eq(schema.profiles.id, input.profileId));
  return profile ? sceneView(db, input.profileId, profile, input.sceneId, profile.defaultSceneId) : null;
}

async function publicRevisionIsCurrent(db: Db, key: ViewKey) {
  const [row] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(and(
    eq(schema.profiles.id, key.profileId), eq(schema.profiles.status, "published"),
    eq(schema.profiles.contentVersion, key.version),
    sql`coalesce(${schema.profiles.activeSceneId}, ${schema.profiles.defaultSceneId}) = ${key.sceneId}`,
  ));
  return row !== undefined;
}

// A cold entry must describe its own version, even when an edit commits between Proxy and cache resolution.
export async function loadVersionedPublicSceneView(db: Db, key: ViewKey) {
  return db.transaction(async tx => {
    const [profile] = await selectProfile(tx, and(eq(schema.profiles.id, key.profileId), eq(schema.profiles.contentVersion, key.version)));
    if (!profile || (profile.activeSceneId ?? profile.defaultSceneId) !== key.sceneId) return null;
    return sceneView(tx, key.profileId, profile, key.sceneId, profile.defaultSceneId);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

// Check around warm-cache resolution too: deleted/changed Scenes and newly private Profiles fail closed.
export async function loadCurrentPublicSceneView(db: Db, key: ViewKey, loadView: ViewLoader) {
  if (!await publicRevisionIsCurrent(db, key)) return null;
  const view = await loadView({ profileId: key.profileId, sceneId: key.sceneId, version: key.version });
  return view && await publicRevisionIsCurrent(db, key) ? view : null;
}
