import "server-only";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { ProfileError } from "../profiles/errors";
import { type Answer, parseFormConfig, validateAnswers } from "./config";

export type SubmitResult = { status: "created"; submissionId: string; replyTo: string | null } | { status: "duplicate"; submissionId: string } | { status: "unavailable" } | { status: "invalid"; fields: string[] };

const acceptsSubmissions = (formId: string) => and(
  eq(schema.formDefinitions.id, formId), eq(schema.profiles.status, "published"),
  sql`exists (select 1 from ${schema.sceneBlocks} where ${schema.sceneBlocks.formId} = ${schema.formDefinitions.id} and ${schema.sceneBlocks.visible})`,
);

export async function submitForm(db: Db, input: { formId: string; clientKey: string; answers: Record<string, unknown> }): Promise<SubmitResult> {
  const [form] = await db
    .select({ id: schema.formDefinitions.id, profileId: schema.formDefinitions.profileId, config: schema.formDefinitions.config })
    .from(schema.formDefinitions)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.formDefinitions.profileId))
    .where(acceptsSubmissions(input.formId));
  const config = form ? parseFormConfig(form.config) : null;
  if (!form || !config?.ok) return { status: "unavailable" };
  const result = validateAnswers(config.config, input.answers);
  if (!result.ok) return { status: "invalid", fields: result.fields };
  const [row] = await db
    .insert(schema.formSubmissions)
    // Recheck eligibility and the validated config at the insertion boundary, without adding locks (D20).
    .select(db.select({
      id: sql<string>`gen_random_uuid()`.as("id"), formId: schema.formDefinitions.id, profileId: schema.formDefinitions.profileId,
      clientKey: sql<string>`${input.clientKey}::uuid`.as("client_key"), answers: sql<Answer[]>`${JSON.stringify(result.answers)}::jsonb`.as("answers"),
      createdAt: sql<Date>`now()`.as("created_at"), readAt: sql<Date | null>`null::timestamptz`.as("read_at"), notifiedAt: sql<Date | null>`null::timestamptz`.as("notified_at"),
    }).from(schema.formDefinitions).innerJoin(schema.profiles, eq(schema.profiles.id, schema.formDefinitions.profileId))
      .where(and(acceptsSubmissions(form.id), eq(schema.formDefinitions.profileId, form.profileId), eq(schema.formDefinitions.config, form.config))))
    .onConflictDoNothing({ target: [schema.formSubmissions.formId, schema.formSubmissions.clientKey] })
    .returning({ id: schema.formSubmissions.id });
  if (row) return { status: "created", submissionId: row.id, replyTo: result.replyTo };
  const [existing] = await db
    .select({ id: schema.formSubmissions.id })
    .from(schema.formSubmissions)
    .where(and(eq(schema.formSubmissions.formId, form.id), eq(schema.formSubmissions.clientKey, input.clientKey)));
  return existing ? { status: "duplicate", submissionId: existing.id } : { status: "unavailable" };
}

export type InboxItem = { id: string; profileName: string | null; formTitle: string; preview: string; createdAt: Date; unread: boolean };
export type SubmissionDetail = { id: string; profileName: string | null; formTitle: string; answers: Answer[]; createdAt: Date; replyEmail: string | null };
const inboxColumns = {
  id: schema.formSubmissions.id, answers: schema.formSubmissions.answers, createdAt: schema.formSubmissions.createdAt,
  readAt: schema.formSubmissions.readAt, formTitle: schema.formDefinitions.title, profileName: schema.profiles.fullName,
};

export async function listInbox(db: Db, input: { accountId: string; before?: { createdAt: string; id: string } }): Promise<{ items: InboxItem[]; next: { createdAt: string; id: string } | null }> {
  const rows = await db.select({ ...inboxColumns, cursorAt: sql<string>`${schema.formSubmissions.createdAt}::text` }).from(schema.formSubmissions)
    .innerJoin(schema.formDefinitions, eq(schema.formDefinitions.id, schema.formSubmissions.formId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.formSubmissions.profileId))
    .where(and(eq(schema.profiles.accountId, input.accountId), input.before ? sql`(${schema.formSubmissions.createdAt}, ${schema.formSubmissions.id}) < (${input.before.createdAt}::timestamptz, ${input.before.id}::uuid)` : undefined))
    .orderBy(desc(schema.formSubmissions.createdAt), desc(schema.formSubmissions.id)).limit(21);
  const items = rows.slice(0, 20).map(row => ({ id: row.id, profileName: row.profileName, formTitle: row.formTitle, createdAt: row.createdAt, unread: row.readAt === null, preview: (row.answers as Answer[])[0]?.value.slice(0, 80) ?? "" }));
  const last = rows[19];
  return { items, next: rows.length > 20 ? { createdAt: last.cursorAt, id: last.id } : null };
}

export async function openSubmission(db: Db, input: { accountId: string; submissionId: string }): Promise<SubmissionDetail | null> {
  const [row] = await db.select(inboxColumns).from(schema.formSubmissions)
    .innerJoin(schema.formDefinitions, eq(schema.formDefinitions.id, schema.formSubmissions.formId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.formSubmissions.profileId))
    .where(and(eq(schema.formSubmissions.id, input.submissionId), eq(schema.profiles.accountId, input.accountId)));
  if (!row) return null;
  await db.update(schema.formSubmissions).set({ readAt: sql`now()` }).where(and(eq(schema.formSubmissions.id, row.id), isNull(schema.formSubmissions.readAt)));
  const answers = row.answers as Answer[];
  return { id: row.id, profileName: row.profileName, formTitle: row.formTitle, createdAt: row.createdAt, answers, replyEmail: answers.find(answer => answer.label === "Email")?.value ?? null };
}

export async function deleteSubmission(db: Db, input: { accountId: string; submissionId: string }): Promise<void> {
  const [row] = await db.delete(schema.formSubmissions).where(and(eq(schema.formSubmissions.id, input.submissionId), inArray(schema.formSubmissions.profileId, db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.accountId, input.accountId)))))
    .returning({ id: schema.formSubmissions.id });
  if (!row) throw new ProfileError("not_found");
}

export async function unreadCount(db: Db, accountId: string): Promise<number> {
  const [row] = await db.select({ total: count() }).from(schema.formSubmissions)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.formSubmissions.profileId))
    .where(and(eq(schema.profiles.accountId, accountId), isNull(schema.formSubmissions.readAt)));
  return row.total;
}
