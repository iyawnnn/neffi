import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { formDefinitions, formSubmissions } from "@/db/schema";
import { insertAccount, insertProfileWithScene } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { PRESETS } from "./config";
import { deleteSubmission, listInbox, openSubmission, unreadCount } from "./submissions";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
async function form(tx: TestTx, accountId: string) {
  const { profile } = await insertProfileWithScene(tx, accountId);
  return (await tx.insert(formDefinitions).values({ profileId: profile.id, title: "Contact", preset: "contact", config: PRESETS.contact.config }).returning())[0];
}
async function message(tx: TestTx, form: { id: string; profileId: string }, createdAt = new Date("2026-10-11T04:05:00Z")) {
  return (await tx.insert(formSubmissions).values({ formId: form.id, profileId: form.profileId, clientKey: randomUUID(), answers: [{ label: "Your name", value: "x".repeat(100) }, { label: "Email", value: "vic@e.test" }], createdAt }).returning())[0];
}
test("lists the account's messages newest first, 20 per page, across its profiles", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const first = await form(tx, owner.id); const second = await form(tx, owner.id);
  const ids: string[] = [];
  for (let i = 0; i < 21; i++) ids.push((await message(tx, i % 2 ? first : second, new Date(Date.UTC(2026, 9, 11, 0, i)))).id);
  const other = await insertAccount(tx); await message(tx, await form(tx, other.id));
  const page = await listInbox(tx, { accountId: owner.id });
  expect(page.items.map(item => item.id)).toEqual(ids.slice(1).reverse());
  expect(page.next).not.toBeNull();
  const older = await listInbox(tx, { accountId: owner.id, before: page.next! });
  expect(older.items.map(item => item.id)).toEqual([ids[0]]); expect(older.next).toBeNull();
}));
test("preview is the first answer at most 80 characters; unread until opened", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const row = await message(tx, await form(tx, owner.id));
  const page = await listInbox(tx, { accountId: owner.id });
  expect(page.items[0]).toMatchObject({ id: row.id, preview: "x".repeat(80), unread: true, formTitle: "Contact" });
  await openSubmission(tx, { accountId: owner.id, submissionId: row.id });
  expect((await listInbox(tx, { accountId: owner.id })).items[0].unread).toBe(false);
}));
test("opening marks read once and returns the snapshot only to its owner", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const row = await message(tx, await form(tx, owner.id)); const other = await insertAccount(tx);
  expect(await openSubmission(tx, { accountId: other.id, submissionId: row.id })).toBeNull();
  expect((await tx.select().from(formSubmissions).where(eq(formSubmissions.id, row.id)))[0].readAt).toBeNull();
  expect(await openSubmission(tx, { accountId: owner.id, submissionId: row.id })).toMatchObject({ id: row.id, answers: row.answers, replyEmail: "vic@e.test" });
  const readAt = (await tx.select().from(formSubmissions).where(eq(formSubmissions.id, row.id)))[0].readAt;
  await openSubmission(tx, { accountId: owner.id, submissionId: row.id });
  expect((await tx.select().from(formSubmissions).where(eq(formSubmissions.id, row.id)))[0].readAt).toEqual(readAt);
}));
test("unreadCount counts only the account's unread", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const owned = await form(tx, owner.id);
  const read = await message(tx, owned); await message(tx, owned);
  const other = await insertAccount(tx); await message(tx, await form(tx, other.id));
  expect(await unreadCount(tx, owner.id)).toBe(2);
  await openSubmission(tx, { accountId: owner.id, submissionId: read.id });
  expect(await unreadCount(tx, owner.id)).toBe(1);
}));
test("delete removes only the account's own message", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const row = await message(tx, await form(tx, owner.id)); const other = await insertAccount(tx);
  await expect(deleteSubmission(tx, { accountId: other.id, submissionId: row.id })).rejects.toMatchObject({ code: "not_found" });
  expect(await tx.select().from(formSubmissions)).toHaveLength(1);
  await deleteSubmission(tx, { accountId: owner.id, submissionId: row.id });
  expect(await tx.select().from(formSubmissions)).toHaveLength(0);
}));
