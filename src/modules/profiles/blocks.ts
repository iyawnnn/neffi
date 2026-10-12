import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { PRESETS } from "../forms/config";
import { parseBlockContent, type BlockType } from "./block-content";
import { ProfileError } from "./errors";
import { bumpProfileContentVersion, lockOwnedProfile, visibleBlockCount } from "./profiles";
import { LIMITS } from "./rules";
import { ownedScene } from "./scenes";

async function ownedBlock(tx: Db, profileId: string, blockId: string) {
  const [block] = await tx
    .select({ id: schema.sceneBlocks.id, sceneId: schema.sceneBlocks.sceneId, type: schema.sceneBlocks.type, visible: schema.sceneBlocks.visible })
    .from(schema.sceneBlocks)
    .innerJoin(schema.scenes, eq(schema.scenes.id, schema.sceneBlocks.sceneId))
    .where(and(eq(schema.sceneBlocks.id, blockId), eq(schema.scenes.profileId, profileId)));
  if (!block) throw new ProfileError("not_found");
  return block;
}

// Positions stay 0..n-1 in display order; written only while the profile row is locked.
async function writeOrder(tx: Db, ids: string[]) {
  for (const [position, id] of ids.entries()) await tx.update(schema.sceneBlocks).set({ position }).where(eq(schema.sceneBlocks.id, id));
}
const orderedIds = async (tx: Db, sceneId: string) =>
  (await tx.select({ id: schema.sceneBlocks.id }).from(schema.sceneBlocks).where(eq(schema.sceneBlocks.sceneId, sceneId)).orderBy(asc(schema.sceneBlocks.position), asc(schema.sceneBlocks.createdAt))).map(row => row.id);

// Removing the last visible item of a Published profile's Default Scene would leave it empty.
async function guardLastVisible(tx: Db, profile: { status: string; defaultSceneId: string | null }, block: { sceneId: string; visible: boolean }) {
  if (profile.status === "published" && block.visible && block.sceneId === profile.defaultSceneId && (await visibleBlockCount(tx, block.sceneId)) <= 1) {
    throw new ProfileError("not_ready", ["content"]);
  }
}

export async function addBlock(db: Db, input: { accountId: string; profileId: string; sceneId: string; type: BlockType; content: Record<string, unknown>; preset?: keyof typeof PRESETS }): Promise<{ blockId: string }> {
  return db.transaction(async tx => {
    const profile = await lockOwnedProfile(tx, input.accountId, input.profileId);
    await ownedScene(tx, profile.id, input.sceneId);
    const parsed = parseBlockContent(input.type, input.content);
    if (!parsed.ok) throw new ProfileError("invalid");
    const [{ n }] = await tx.select({ n: count() }).from(schema.sceneBlocks).where(eq(schema.sceneBlocks.sceneId, input.sceneId));
    if (n >= LIMITS.blocksPerScene) throw new ProfileError("limit_reached");
    let formId: string | null = null;
    if (input.type === "form") {
      if (!input.preset) throw new ProfileError("invalid");
      const [{ n: forms }] = await tx.select({ n: count() }).from(schema.formDefinitions).where(eq(schema.formDefinitions.profileId, profile.id));
      if (forms >= LIMITS.formsPerProfile) throw new ProfileError("limit_reached");
      const preset = PRESETS[input.preset];
      const [form] = await tx.insert(schema.formDefinitions).values({ profileId: profile.id, preset: input.preset, title: preset.title, config: preset.config }).returning({ id: schema.formDefinitions.id });
      formId = form.id;
    }
    const [block] = await tx.insert(schema.sceneBlocks).values({ sceneId: input.sceneId, type: input.type, position: n, content: parsed.content, formId }).returning({ id: schema.sceneBlocks.id });
    await bumpProfileContentVersion(tx, profile.id);
    return { blockId: block.id };
  });
}

export async function updateBlock(db: Db, input: { accountId: string; profileId: string; blockId: string; content: Record<string, unknown> }): Promise<void> {
  await db.transaction(async tx => {
    const profile = await lockOwnedProfile(tx, input.accountId, input.profileId);
    const block = await ownedBlock(tx, profile.id, input.blockId);
    if (block.type === "form") throw new ProfileError("invalid");
    const parsed = parseBlockContent(block.type, input.content);
    if (!parsed.ok) throw new ProfileError("invalid");
    await tx.update(schema.sceneBlocks).set({ content: parsed.content }).where(eq(schema.sceneBlocks.id, block.id));
    await bumpProfileContentVersion(tx, profile.id);
  });
}

export async function moveBlock(db: Db, input: { accountId: string; profileId: string; blockId: string; direction: "up" | "down" }): Promise<void> {
  await db.transaction(async tx => {
    const profile = await lockOwnedProfile(tx, input.accountId, input.profileId);
    const block = await ownedBlock(tx, profile.id, input.blockId);
    const ids = await orderedIds(tx, block.sceneId);
    const i = ids.indexOf(block.id);
    const j = i + (input.direction === "up" ? -1 : 1);
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await writeOrder(tx, ids);
    await bumpProfileContentVersion(tx, profile.id);
  });
}

export async function setBlockVisible(db: Db, input: { accountId: string; profileId: string; blockId: string; visible: boolean }): Promise<void> {
  await db.transaction(async tx => {
    const profile = await lockOwnedProfile(tx, input.accountId, input.profileId);
    const block = await ownedBlock(tx, profile.id, input.blockId);
    if (!input.visible) await guardLastVisible(tx, profile, block);
    await tx.update(schema.sceneBlocks).set({ visible: input.visible }).where(eq(schema.sceneBlocks.id, block.id));
    await bumpProfileContentVersion(tx, profile.id);
  });
}

export async function deleteBlock(db: Db, input: { accountId: string; profileId: string; blockId: string }): Promise<void> {
  await db.transaction(async tx => {
    const profile = await lockOwnedProfile(tx, input.accountId, input.profileId);
    const block = await ownedBlock(tx, profile.id, input.blockId);
    await guardLastVisible(tx, profile, block);
    await tx.delete(schema.sceneBlocks).where(eq(schema.sceneBlocks.id, block.id));
    await writeOrder(tx, await orderedIds(tx, block.sceneId));
    await bumpProfileContentVersion(tx, profile.id);
  });
}
