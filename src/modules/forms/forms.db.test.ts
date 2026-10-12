import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { formDefinitions, formSubmissions } from "@/db/schema";
import { insertAccount, insertProfileWithScene } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { PRESETS } from "./config";
import { updateForm } from "./forms";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
async function setup(tx: TestTx) {
  const account = await insertAccount(tx);
  const { profile } = await insertProfileWithScene(tx, account.id);
  const [form] = await tx.insert(formDefinitions).values({ profileId: profile.id, title: "Contact", preset: "contact", config: PRESETS.contact.config }).returning();
  return { accountId: account.id, profileId: profile.id, formId: form.id };
}
test("saves a trimmed title and valid configuration with a custom question", () => rollback(db, async tx => {
  const input = await setup(tx);
  const config = { ...PRESETS.contact.config, questions: [{ id: "abcdefgh", label: "How can I help?", required: true }] };
  await updateForm(tx, { ...input, title: " Enquiries ", config });
  expect((await tx.select().from(formDefinitions).where(eq(formDefinitions.id, input.formId)))[0]).toMatchObject({ title: "Enquiries", config });
}));
test("invalid configuration and blank or long titles are refused", () => rollback(db, async tx => {
  const input = await setup(tx);
  for (const title of [" ", "x".repeat(61)]) await expect(updateForm(tx, { ...input, title, config: PRESETS.contact.config })).rejects.toMatchObject({ code: "invalid" });
  await expect(updateForm(tx, { ...input, title: "Contact", config: { ...PRESETS.contact.config, fields: { ...PRESETS.contact.config.fields, email: "hidden", phone: "hidden" } } })).rejects.toMatchObject({ code: "invalid" });
}));
test("another profile's form or another account is not found", () => rollback(db, async tx => {
  const input = await setup(tx); const other = await setup(tx);
  await expect(updateForm(tx, { ...input, formId: other.formId, title: "Contact", config: PRESETS.contact.config })).rejects.toMatchObject({ code: "not_found" });
  await expect(updateForm(tx, { ...input, accountId: other.accountId, title: "Contact", config: PRESETS.contact.config })).rejects.toMatchObject({ code: "not_found" });
}));
test("editing leaves existing submission snapshots untouched", () => rollback(db, async tx => {
  const input = await setup(tx);
  const [submission] = await tx.insert(formSubmissions).values({ profileId: input.profileId, formId: input.formId, clientKey: randomUUID(), answers: [{ label: "Your name", value: "Vic" }] }).returning();
  await updateForm(tx, { ...input, title: "Enquiries", config: PRESETS.project_inquiry.config });
  expect((await tx.select().from(formSubmissions).where(eq(formSubmissions.id, submission.id)))[0]).toEqual(submission);
}));
