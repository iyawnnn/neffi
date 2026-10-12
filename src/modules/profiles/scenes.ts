import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { ProfileError } from "./errors";
import { lockOwnedProfile } from "./profiles";
import { LIMITS } from "./rules";

const sceneName = (raw: string) => {
  const name = raw.trim();
  if (name.length < 1 || name.length > 40) throw new ProfileError("invalid");
  return name;
};
export async function ownedScene(tx: Db, profileId: string, sceneId: string) {
  const [scene] = await tx.select({ id: schema.scenes.id }).from(schema.scenes).where(and(eq(schema.scenes.id, sceneId), eq(schema.scenes.profileId, profileId)));
  if (!scene) throw new ProfileError("not_found");
  return scene;
}

export async function createScene(db: Db, input: { accountId: string; profileId: string; name: string; copyFromSceneId: string | null }): Promise<{ sceneId: string }> {
  return db.transaction(async tx => {
    const profile = await lockOwnedProfile(tx, input.accountId, input.profileId);
    const name = sceneName(input.name);
    const [{ n }] = await tx.select({ n: count() }).from(schema.scenes).where(eq(schema.scenes.profileId, profile.id));
    if (n >= LIMITS.scenesPerProfile) throw new ProfileError("limit_reached");
    if (input.copyFromSceneId) await ownedScene(tx, profile.id, input.copyFromSceneId);
    const [scene] = await tx.insert(schema.scenes).values({ profileId: profile.id, name }).returning({ id: schema.scenes.id });
    if (input.copyFromSceneId) {
      const blocks = await tx.select({ type: schema.sceneBlocks.type, position: schema.sceneBlocks.position, visible: schema.sceneBlocks.visible, content: schema.sceneBlocks.content, formId: schema.sceneBlocks.formId }).from(schema.sceneBlocks).where(eq(schema.sceneBlocks.sceneId, input.copyFromSceneId)).orderBy(asc(schema.sceneBlocks.position));
      if (blocks.length) await tx.insert(schema.sceneBlocks).values(blocks.map(block => ({ ...block, sceneId: scene.id })));
    }
    return { sceneId: scene.id };
  });
}

export async function renameScene(db: Db, input: { accountId: string; profileId: string; sceneId: string; name: string }): Promise<void> {
  await db.transaction(async tx => {
    const profile = await lockOwnedProfile(tx, input.accountId, input.profileId);
    await ownedScene(tx, profile.id, input.sceneId);
    await tx.update(schema.scenes).set({ name: sceneName(input.name) }).where(eq(schema.scenes.id, input.sceneId));
  });
}

export async function deleteScene(db: Db, input: { accountId: string; profileId: string; sceneId: string }): Promise<void> {
  await db.transaction(async tx => {
    const profile = await lockOwnedProfile(tx, input.accountId, input.profileId);
    if (input.sceneId === profile.defaultSceneId) throw new ProfileError("default_scene");
    await ownedScene(tx, profile.id, input.sceneId);
    if (profile.activeSceneId === input.sceneId) await tx.update(schema.profiles).set({ activeSceneId: null }).where(eq(schema.profiles.id, profile.id));
    await tx.delete(schema.scenes).where(eq(schema.scenes.id, input.sceneId));
  });
}

export async function showScene(db: Db, input: { accountId: string; profileId: string; sceneId: string }): Promise<void> {
  await db.transaction(async tx => {
    const profile = await lockOwnedProfile(tx, input.accountId, input.profileId);
    await ownedScene(tx, profile.id, input.sceneId);
    await tx.update(schema.profiles).set({ activeSceneId: input.sceneId === profile.defaultSceneId ? null : input.sceneId }).where(eq(schema.profiles.id, profile.id));
  });
}
