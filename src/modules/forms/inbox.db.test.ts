import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { formDefinitions, formSubmissions } from "@/db/schema";
import { insertAccount, insertProfileWithScene } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { PRESETS } from "./config";
import { deleteSubmission, listInbox, openSubmission, setSubmissionRead, unreadCount } from "./submissions";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
async function form(tx: TestTx, accountId: string) {
  const { profile } = await insertProfileWithScene(tx, accountId);
  return (await tx.insert(formDefinitions).values({ profileId: profile.id, title: "Contact", preset: "contact", config: PRESETS.contact.config }).returning())[0];
}
async function message(tx: TestTx, form: { id: string; profileId: string }, createdAt = new Date("2026-10-11T04:05:00Z")) {
  return (await tx.insert(formSubmissions).values({ formId: form.id, profileId: form.profileId, clientKey: randomUUID(), answers: [{ label: "Your name", value: "x".repeat(100) }, { label: "Email", value: "vic@e.test" }], createdAt }).returning())[0];
}

test("pagination keeps all 22 messages exactly once across a microsecond boundary", () => rollback(db, async tx => {
  const owner = await insertAccount(tx);
  const owned = await form(tx, owner.id);
  const ids: string[] = [];
  for (let i = 0; i < 22; i++) {
    const row = await message(tx, owned, new Date(Date.UTC(2026, 9, 11, 0, 22 - i)));
    ids.push(row.id);
    if (i >= 19) await tx.update(formSubmissions).set({ createdAt: sql`('2026-10-11 00:00:00.000' || ${String(999 - i)} || '+00')::timestamptz` }).where(eq(formSubmissions.id, row.id));
  }
  const first = await listInbox(tx, { accountId: owner.id });
  expect(first.items).toHaveLength(20);
  const second = await listInbox(tx, { accountId: owner.id, before: first.next! });
  expect([...first.items, ...second.items].map(item => item.id)).toEqual(ids);
  expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(22);
  expect(second.next).toBeNull();
}));
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
test("legacy preview fallback preserves full text for visual clamping; unread until opened", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const row = await message(tx, await form(tx, owner.id));
  const page = await listInbox(tx, { accountId: owner.id });
  expect(page.items[0]).toMatchObject({ id: row.id, senderName: "x".repeat(100), senderEmail: "vic@e.test", messagePreview: "x".repeat(100), unread: true, formTitle: "Contact" });
  await openSubmission(tx, { accountId: owner.id, submissionId: row.id });
  expect((await listInbox(tx, { accountId: owner.id })).items[0].unread).toBe(false);
}));

test.each([
  { scenario: "message longer than the old 80-character cap", answers: [{ label: "Message", value: "A website project inquiry. ".repeat(10) }], expected: { senderName: null, senderEmail: null, messagePreview: "A website project inquiry. ".repeat(10).trim() } },
  { scenario: "named fields in arbitrary order", answers: [{ label: "Email", value: "sender@example.test" }, { label: "Message", value: "A project inquiry" }, { label: "Name", value: "Test Sender" }], expected: { senderName: "Test Sender", senderEmail: "sender@example.test", messagePreview: "A project inquiry" } },
  { scenario: "canonical Your name label", answers: [{ label: "Message", value: "Hello" }, { label: "Your name", value: "Test Sender" }], expected: { senderName: "Test Sender", senderEmail: null, messagePreview: "Hello" } },
  { scenario: "missing name", answers: [{ label: "Email", value: "sender@example.test" }, { label: "Message", value: "Hello" }], expected: { senderName: null, senderEmail: "sender@example.test", messagePreview: "Hello" } },
  { scenario: "missing message uses meaningful non-identity answer", answers: [{ label: "Name", value: "Test Sender" }, { label: "Email", value: "sender@example.test" }, { label: "Company", value: "  Test studio  " }], expected: { senderName: "Test Sender", senderEmail: "sender@example.test", messagePreview: "Test studio" } },
  { scenario: "blank message and other answers are skipped", answers: [{ label: "Name", value: "  " }, { label: "Message", value: " " }, { label: "Company", value: "" }, { label: "Phone", value: "0917 555 0123" }], expected: { senderName: null, senderEmail: null, messagePreview: "0917 555 0123" } },
  { scenario: "identity-only legacy fallback", answers: [{ label: "Email", value: "sender@example.test" }], expected: { senderName: null, senderEmail: "sender@example.test", messagePreview: "sender@example.test" } },
  { scenario: "empty answers", answers: [], expected: { senderName: null, senderEmail: null, messagePreview: "" } },
])("derives Inbox data from $scenario without changing stored answers", ({ answers, expected }) => rollback(db, async tx => {
  const owner = await insertAccount(tx); const owned = await form(tx, owner.id);
  const [row] = await tx.insert(formSubmissions).values({ formId: owned.id, profileId: owned.profileId, clientKey: randomUUID(), answers }).returning();
  expect((await listInbox(tx, { accountId: owner.id })).items[0]).toMatchObject(expected);
  expect((await tx.select().from(formSubmissions).where(eq(formSubmissions.id, row.id)))[0].answers).toEqual(answers);
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

test("detail reply email uses normalized answer labels, independent of answer order", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const row = await message(tx, await form(tx, owner.id));
  await tx.update(formSubmissions).set({ answers: [{ label: "Message", value: "Hello" }, { label: " EMAIL ", value: "sender@example.test" }] }).where(eq(formSubmissions.id, row.id));
  expect(await openSubmission(tx, { accountId: owner.id, submissionId: row.id })).toMatchObject({ replyEmail: "sender@example.test" });
  expect(await unreadCount(tx, owner.id)).toBe(0);
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

test("explicit read state changes enforce ownership, preserve first read time and update unread counts", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const row = await message(tx, await form(tx, owner.id)); const other = await insertAccount(tx);
  for (const read of [true, false]) {
    await expect(setSubmissionRead(tx, { accountId: other.id, submissionId: row.id, read })).rejects.toMatchObject({ code: "not_found" });
    await expect(setSubmissionRead(tx, { accountId: owner.id, submissionId: randomUUID(), read })).rejects.toMatchObject({ code: "not_found" });
  }
  expect(await unreadCount(tx, owner.id)).toBe(1);
  await setSubmissionRead(tx, { accountId: owner.id, submissionId: row.id, read: true });
  expect(await unreadCount(tx, owner.id)).toBe(0);
  const firstRead = (await tx.select().from(formSubmissions).where(eq(formSubmissions.id, row.id)))[0].readAt;
  expect(firstRead).not.toBeNull();
  await setSubmissionRead(tx, { accountId: owner.id, submissionId: row.id, read: true });
  expect((await tx.select().from(formSubmissions).where(eq(formSubmissions.id, row.id)))[0].readAt).toEqual(firstRead);
  await setSubmissionRead(tx, { accountId: owner.id, submissionId: row.id, read: false });
  expect(await unreadCount(tx, owner.id)).toBe(1);
  expect((await listInbox(tx, { accountId: owner.id, unreadOnly: true })).items[0].unread).toBe(true);
  await openSubmission(tx, { accountId: owner.id, submissionId: row.id });
  expect((await listInbox(tx, { accountId: owner.id, unreadOnly: true })).items).toEqual([]);
}));

test("unread filtering precedes pagination and never includes foreign or read submissions", () => rollback(db, async tx => {
  const owner = await insertAccount(tx); const owned = await form(tx, owner.id); const second = await form(tx, owner.id);
  const expected: string[] = [];
  for (let i = 0; i < 44; i++) {
    const row = await message(tx, i % 3 ? owned : second, new Date(Date.UTC(2026, 9, 11, 0, i)));
    if (i % 2) await setSubmissionRead(tx, { accountId: owner.id, submissionId: row.id, read: true });
    else expected.unshift(row.id);
  }
  const other = await insertAccount(tx); await message(tx, await form(tx, other.id));
  const first = await listInbox(tx, { accountId: owner.id, unreadOnly: true });
  expect(first.items).toHaveLength(20); expect(first.next).not.toBeNull();
  const older = await listInbox(tx, { accountId: owner.id, unreadOnly: true, before: first.next! });
  expect([...first.items, ...older.items].map(item => item.id)).toEqual(expected);
  expect([...first.items, ...older.items].every(item => item.unread)).toBe(true);
  expect(older.next).toBeNull(); expect(await unreadCount(tx, owner.id)).toBe(22);
}));
