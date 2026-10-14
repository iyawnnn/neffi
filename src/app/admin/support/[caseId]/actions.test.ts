import { beforeEach, expect, test, vi } from "vitest";
const { authorize, openCase, addCaseNote, setCaseStatus, revalidatePath } = vi.hoisted(() => ({ authorize: vi.fn(), openCase: vi.fn(), addCaseNote: vi.fn(), setCaseStatus: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/modules/support/case", async (original) => ({ ...await original<object>(), openCase, addCaseNote, setCaseStatus }));
import { openCaseAction, addCaseNoteAction, setCaseStatusAction } from "./actions";
import { SupportError } from "@/modules/support/errors";
const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return data; };
beforeEach(() => { vi.clearAllMocks(); authorize.mockResolvedValue({ ok: true, viewer: { accountId: id } }); openCase.mockResolvedValue({ caseId: id }); });

test("customer is denied before input or service access", async () => {
  authorize.mockResolvedValue({ ok: false });
  expect(await addCaseNoteAction(undefined, form({ caseId: id, note: "Test" }))).toHaveProperty("error");
  expect(addCaseNote).not.toHaveBeenCalled();
});

test("case schemas reject bad ids and oversized summaries and notes", async () => {
  expect(await openCaseAction(undefined, form({ type: "other", summary: "x".repeat(501) }))).toHaveProperty("error");
  expect(await addCaseNoteAction(undefined, form({ caseId: "bad", note: "Test" }))).toHaveProperty("error");
  expect(await addCaseNoteAction(undefined, form({ caseId: id, note: "x".repeat(501) }))).toHaveProperty("error");
  expect(openCase).not.toHaveBeenCalled();
  expect(addCaseNote).not.toHaveBeenCalled();
});

test("resolved stale submissions map to recovery copy, unknown errors rethrow", async () => {
  setCaseStatus.mockRejectedValueOnce(new SupportError("case_resolved"));
  const data = form({ caseId: id, status: "waiting_on_customer" });
  expect(await setCaseStatusAction(undefined, data)).toEqual({ error: "This case is resolved. Reopen it before making a correction." });
  setCaseStatus.mockRejectedValueOnce(new Error("unexpected"));
  await expect(setCaseStatusAction(undefined, data)).rejects.toThrow("unexpected");
});
