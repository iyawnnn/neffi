import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { accounts, cards, formDefinitions, formSubmissions, sceneBlocks } from "@/db/schema";
import { insertAccount, insertReleasedDbc } from "@/db/test-fixtures";
import { createSetupTestProfile } from "@/db/setup-test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { renderEmail } from "@/integrations/email/layout";
import { publishProfile } from "../profiles/profiles";
import { notifySubmission } from "./notify";
import { openSubmission, submitForm } from "./submissions";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
async function setup(tx: TestTx, accountId?: string) {
  const account = accountId ? { id: accountId } : await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: account.id }).where(eq(cards.id, card.id));
  const { profileId } = await createSetupTestProfile(tx, { accountId: account.id, cardId: card.id, identity: { fullName: "Ana", headline: null, company: null, bio: null, phone: null, email: "ana@e.test", website: null, location: null }, content: [{ type: "form", content: {}, preset: "connect" }, { type: "contact", content: { saveContact: true } }] });
  await publishProfile(tx, { accountId: account.id, profileId });
  const [form] = await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, profileId));
  const [block] = await tx.select().from(sceneBlocks).where(eq(sceneBlocks.formId, form.id));
  return { accountId: account.id, profileId, formId: form.id, blockId: block.id };
}
const submission = (formId: string, clientKey = randomUUID()) => ({ formId, clientKey, answers: { name: "Vic", email: "VIC@e.test", message: "" } });

afterEach(() => vi.restoreAllMocks());
async function saved(tx: TestTx) {
  const input = await setup(tx);
  const result = await submitForm(tx, submission(input.formId));
  if (result.status !== "created") throw new Error("fixture failed");
  return { ...input, submissionId: result.submissionId };
}
test("emails the profile owner's sign-in address once", () => rollback(db, async tx => {
  const input = await saved(tx);
  const send = vi.fn().mockResolvedValue(undefined);
  await notifySubmission(tx, send, { submissionId: input.submissionId, secret: "synthetic-notification-secret", replyTo: "vic@e.test" });
  expect(send).toHaveBeenCalledOnce();
  const [account] = await tx.select().from(accounts).where(eq(accounts.id, input.accountId));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: account.email, subject: "New message from your Neffi", details: expect.arrayContaining([{ label: "Your name", value: "Vic" }]), action: { label: "Open inbox", path: `/app/inbox/${input.submissionId}` }, replyTo: "vic@e.test", idempotencyKey: `form-submission-${input.submissionId}` }));
  expect(renderEmail(send.mock.calls[0][0], "https://app.example.test").text).toContain(`https://app.example.test/app/inbox/${input.submissionId}`);
  const [row] = await tx.select().from(formSubmissions).where(eq(formSubmissions.id, input.submissionId));
  expect(row.notifiedAt).toBeInstanceOf(Date);
  await notifySubmission(tx, send, { submissionId: input.submissionId, secret: "synthetic-notification-secret", replyTo: null });
  expect(send).toHaveBeenCalledOnce();
}));
test("a failed send keeps the message and never throws or logs private data", () => rollback(db, async tx => {
  const input = await saved(tx);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const send = vi.fn().mockRejectedValue(new Error("private-provider-data"));
  await expect(notifySubmission(tx, send, { submissionId: input.submissionId, secret: "synthetic-notification-secret", replyTo: null })).resolves.toBeUndefined();
  expect((await tx.select().from(formSubmissions).where(eq(formSubmissions.id, input.submissionId)))[0].notifiedAt).toBeNull();
  expect(log).toHaveBeenCalledWith("Form notification failed");
}));
test("an unknown submission is ignored", () => rollback(db, async tx => {
  const send = vi.fn();
  await notifySubmission(tx, send, { submissionId: randomUUID(), secret: "synthetic-notification-secret", replyTo: null });
  expect(send).not.toHaveBeenCalled();
}));

test("the fifty-first Profile notification stays in the Inbox while another Profile of the same owner is unaffected", () => rollback(db, async tx => {
  const first = await setup(tx);
  const send = vi.fn().mockResolvedValue(undefined);
  let capped = "";
  for (let n = 0; n < 51; n++) {
    const result = await submitForm(tx, submission(first.formId));
    if (result.status !== "created") throw new Error("fixture failed");
    await notifySubmission(tx, send, { submissionId: result.submissionId, secret: "synthetic-notification-secret", replyTo: null });
    if (n === 50) capped = result.submissionId;
  }
  expect(send).toHaveBeenCalledTimes(50);
  expect((await tx.select().from(formSubmissions).where(eq(formSubmissions.profileId, first.profileId)))).toHaveLength(51);
  expect((await tx.select().from(formSubmissions).where(eq(formSubmissions.id, capped)))[0].notifiedAt).toBeNull();
  expect(await openSubmission(tx, { accountId: first.accountId, submissionId: capped })).not.toBeNull();
  const second = await setup(tx, first.accountId);
  const result = await submitForm(tx, submission(second.formId));
  if (result.status !== "created") throw new Error("fixture failed");
  await notifySubmission(tx, send, { submissionId: result.submissionId, secret: "synthetic-notification-secret", replyTo: null });
  expect(send).toHaveBeenCalledTimes(51);
}));
