import { eq } from "drizzle-orm";
import { profiles } from "./schema";
import type { Db } from "@/modules/db";
import { addBlock } from "@/modules/profiles/blocks";
import { createProfileFromSetup } from "@/modules/profiles/profiles";
import type { Goal } from "@/modules/profiles/goals";
import type { Identity } from "@/modules/profiles/rules";
import type { BlockType } from "@/modules/profiles/block-content";
import type { PRESETS } from "@/modules/forms/config";

type Content = { type: BlockType; content: Record<string, unknown>; preset?: keyof typeof PRESETS };

export async function createSetupTestProfile(tx: Db, input: { accountId: string; cardId: string; goal?: Goal | null; identity: Identity; content?: Content[] }) {
  const created = await createProfileFromSetup(tx, { accountId: input.accountId, cardId: input.cardId, goal: input.goal ?? null, identity: input.identity });
  const [profile] = await tx.select({ defaultSceneId: profiles.defaultSceneId }).from(profiles).where(eq(profiles.id, created.profileId));
  for (const item of input.content ?? []) await addBlock(tx, { accountId: input.accountId, profileId: created.profileId, sceneId: profile.defaultSceneId!, ...item });
  return { ...created, sceneId: profile.defaultSceneId! };
}
