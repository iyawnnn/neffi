import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, expect, test, vi } from "vitest";
import { cards, formDefinitions, formSubmissions, sceneBlocks } from "@/db/schema";
import { insertAccount, insertReleasedDbc } from "@/db/test-fixtures";
import { createSetupTestProfile } from "@/db/setup-test-fixtures";
import { createTestDb, rollback, type TestDb, type TestTx } from "@/db/testing";
import { publishProfile, unpublishProfile } from "../profiles/profiles";
import { deleteBlock, setBlockVisible } from "../profiles/blocks";
import { submitForm } from "./submissions";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
async function setup(tx: TestTx) {
  const account = await insertAccount(tx);
  const { card } = await insertReleasedDbc(tx);
  await tx.update(cards).set({ ownerAccountId: account.id }).where(eq(cards.id, card.id));
  const { profileId } = await createSetupTestProfile(tx, { accountId: account.id, cardId: card.id, identity: { fullName: "Ana", headline: null, company: null, bio: null, phone: null, email: "ana@e.test", website: null, location: null }, content: [{ type: "form", content: {}, preset: "connect" }, { type: "contact", content: { saveContact: true } }] });
  await publishProfile(tx, { accountId: account.id, profileId });
  const [form] = await tx.select().from(formDefinitions).where(eq(formDefinitions.profileId, profileId));
  const [block] = await tx.select().from(sceneBlocks).where(eq(sceneBlocks.formId, form.id));
  return { accountId: account.id, profileId, formId: form.id, blockId: block.id };
}
const submission = (formId: string, clientKey = randomUUID()) => ({ formId, clientKey, answers: { name: "Vic", email: "VIC@e.test", message: "" } });
test("stores a validated snapshot", () => rollback(db, async tx => {
  const input = await setup(tx);
  const result = await submitForm(tx, submission(input.formId));
  expect(result).toEqual({ status: "created", submissionId: expect.any(String), replyTo: "vic@e.test" });
  const [row] = await tx.select().from(formSubmissions);
  expect(row).toMatchObject({ profileId: input.profileId, answers: [{ label: "Your name", value: "Vic" }, { label: "Email", value: "vic@e.test" }], readAt: null, notifiedAt: null });
}));
test("the same browser key stores once", () => rollback(db, async tx => {
  const input = await setup(tx); const data = submission(input.formId);
  const first = await submitForm(tx, data);
  expect(await submitForm(tx, data)).toEqual({ status: "duplicate", submissionId: "submissionId" in first ? first.submissionId : "missing" });
  expect(await tx.select().from(formSubmissions)).toHaveLength(1);
}));
test("invalid answers are refused", () => rollback(db, async tx => {
  const input = await setup(tx);
  expect(await submitForm(tx, { ...submission(input.formId), answers: { email: "vic@e.test" } })).toEqual({ status: "invalid", fields: ["name"] });
  expect(await tx.select().from(formSubmissions)).toHaveLength(0);
}));
test.each(["unpublish", "hide", "config"])("refuses a submission when %s changes after its validation read", change => rollback(db, async tx => {
  const input = await setup(tx);
  const [form] = await tx.select().from(formDefinitions).where(eq(formDefinitions.id, input.formId));
  // Return the pre-edit snapshot after the owner change, leaving the insert on the real database.
  const read = vi.spyOn(tx, "select").mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: async () => {
    if (change === "unpublish") await unpublishProfile(tx, input);
    else if (change === "hide") await setBlockVisible(tx, { ...input, visible: false });
    else await tx.update(formDefinitions).set({ config: { ...form.config as object, questions: [{ id: "budget", label: "Budget", required: true }] } }).where(eq(formDefinitions.id, form.id));
    return [form];
  } }) }) } as unknown as ReturnType<typeof tx.select>);
  try {
    expect(await submitForm(tx, submission(input.formId))).toEqual({ status: "unavailable" });
    expect(await tx.select().from(formSubmissions)).toHaveLength(0);
  } finally { read.mockRestore(); }
}));
test("only a Published profile's visible form accepts messages", () => rollback(db, async tx => {
  const input = await setup(tx);
  await submitForm(tx, submission(input.formId));
  await unpublishProfile(tx, input);
  expect(await submitForm(tx, submission(input.formId))).toEqual({ status: "unavailable" });
  await publishProfile(tx, input);
  await setBlockVisible(tx, { ...input, visible: false });
  expect(await submitForm(tx, submission(input.formId))).toEqual({ status: "unavailable" });
  await setBlockVisible(tx, { ...input, visible: true });
  await deleteBlock(tx, input);
  expect(await submitForm(tx, submission(input.formId))).toEqual({ status: "unavailable" });
  expect(await submitForm(tx, submission(randomUUID()))).toEqual({ status: "unavailable" });
  expect(await tx.select().from(formSubmissions)).toHaveLength(1);
}));
