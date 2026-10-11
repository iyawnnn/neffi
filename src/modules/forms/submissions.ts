import "server-only";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { parseFormConfig, validateAnswers } from "./config";

export type SubmitResult = { status: "created"; submissionId: string; replyTo: string | null } | { status: "duplicate"; submissionId: string } | { status: "unavailable" } | { status: "invalid"; fields: string[] };

export async function submitForm(db: Db, input: { formId: string; clientKey: string; answers: Record<string, unknown> }): Promise<SubmitResult> {
  const [form] = await db
    .select({ id: schema.formDefinitions.id, profileId: schema.formDefinitions.profileId, config: schema.formDefinitions.config })
    .from(schema.formDefinitions)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.formDefinitions.profileId))
    .where(
      and(
        eq(schema.formDefinitions.id, input.formId),
        eq(schema.profiles.status, "published"),
        // Only a form the owner currently shows somewhere accepts messages (D11).
        sql`exists (select 1 from ${schema.sceneBlocks} where ${schema.sceneBlocks.formId} = ${schema.formDefinitions.id} and ${schema.sceneBlocks.visible})`,
      ),
    );
  const config = form ? parseFormConfig(form.config) : null;
  if (!form || !config?.ok) return { status: "unavailable" };
  const result = validateAnswers(config.config, input.answers);
  if (!result.ok) return { status: "invalid", fields: result.fields };
  const [row] = await db
    .insert(schema.formSubmissions)
    .values({ formId: form.id, profileId: form.profileId, clientKey: input.clientKey, answers: result.answers })
    .onConflictDoNothing({ target: [schema.formSubmissions.formId, schema.formSubmissions.clientKey] })
    .returning({ id: schema.formSubmissions.id });
  if (row) return { status: "created", submissionId: row.id, replyTo: result.replyTo };
  const [existing] = await db
    .select({ id: schema.formSubmissions.id })
    .from(schema.formSubmissions)
    .where(and(eq(schema.formSubmissions.formId, form.id), eq(schema.formSubmissions.clientKey, input.clientKey)));
  return { status: "duplicate", submissionId: existing.id };
}
