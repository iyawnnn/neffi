import "server-only";
import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { ProfileError } from "../profiles/errors";
import { bumpProfileContentVersion, lockOwnedProfile } from "../profiles/profiles";
import { parseFormConfig } from "./config";

export async function updateForm(db: Db, input: { accountId: string; profileId: string; formId: string; title: string; config: unknown }): Promise<void> {
  const title = input.title.trim();
  const config = parseFormConfig(input.config);
  if (!title || title.length > 60 || !config.ok) throw new ProfileError("invalid");
  await db.transaction(async tx => {
    await lockOwnedProfile(tx, input.accountId, input.profileId);
    const [row] = await tx.update(schema.formDefinitions).set({ title, config: config.config })
      .where(and(eq(schema.formDefinitions.id, input.formId), eq(schema.formDefinitions.profileId, input.profileId)))
      .returning({ id: schema.formDefinitions.id });
    if (!row) throw new ProfileError("not_found");
    await bumpProfileContentVersion(tx, input.profileId);
  });
}
