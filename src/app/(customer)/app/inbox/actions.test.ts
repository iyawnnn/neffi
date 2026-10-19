import { beforeEach, expect, test, vi } from "vitest";
import { ProfileError } from "@/modules/profiles/errors";
const m = vi.hoisted(() => ({ authorize: vi.fn(), remove: vi.fn(), read: vi.fn(), revalidate: vi.fn(), unread: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/forms/submissions", () => ({ deleteSubmission: m.remove, setSubmissionRead: m.read, unreadCount: m.unread }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import { deleteSubmissionAction, updateInboxAction } from "./actions";
const ID = "11111111-1111-4111-8111-111111111111";
const data = (confirm = false) => { const form = new FormData(); form.set("submissionId", ID); if (confirm) form.set("confirm", "on"); return form; };
beforeEach(() => { vi.resetAllMocks(); m.unread.mockResolvedValue(2); m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } }); });
test("deletion needs explicit confirmation", async () => { expect(await deleteSubmissionAction(undefined, data())).toEqual({ error: "Tick the box to confirm." }); expect(m.remove).not.toHaveBeenCalled(); });
test("owned delete redirects to inbox", async () => { await expect(deleteSubmissionAction(undefined, data(true))).rejects.toThrow("REDIRECT:/app/inbox"); expect(m.remove).toHaveBeenCalledWith({}, { accountId: "a1", submissionId: ID }); });
test("unowned message is not found", async () => { m.remove.mockRejectedValue(new ProfileError("not_found")); await expect(deleteSubmissionAction(undefined, data(true))).rejects.toThrow("NOT_FOUND"); });
test("signed-out deletion requires authentication", async () => { m.authorize.mockResolvedValue({ ok: false }); await expect(deleteSubmissionAction(undefined, data(true))).rejects.toThrow("REDIRECT:/sign-in?next=/app"); expect(m.remove).not.toHaveBeenCalled(); });

test.each(["read", "unread"])("%s action scopes mutations to the account and returns the real bell count without reopening detail", async operation => {
  const form = data(); form.set("operation", operation);
  expect(await updateInboxAction(form)).toEqual({ ok: true, unread: 2 });
  expect(m.read).toHaveBeenCalledWith({}, { accountId: "a1", submissionId: ID, read: operation === "read" });
  expect(m.revalidate).not.toHaveBeenCalled();
  expect(m.unread).toHaveBeenCalledWith({}, "a1");
});

test("confirmed detail deletion refreshes Inbox and redirects before deleted detail can render", async () => {
  const form = data(); form.set("operation", "delete");
  await expect(updateInboxAction(form)).rejects.toThrow("REDIRECT:/app/inbox");
  expect(m.remove).toHaveBeenCalledWith({}, { accountId: "a1", submissionId: ID });
  expect(m.revalidate).toHaveBeenCalledWith("/app", "layout");
});

test("list actions authenticate before validation and reject invalid operations", async () => {
  m.authorize.mockResolvedValue({ ok: false });
  await expect(updateInboxAction(new FormData())).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } });
  expect(await updateInboxAction(data())).toHaveProperty("error");
  const invalidId = data(); invalidId.set("operation", "read"); invalidId.set("submissionId", "invalid");
  expect(await updateInboxAction(invalidId)).toHaveProperty("error");
  expect(m.read).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled();
});

test("list failures do not revalidate or expose private error details", async () => {
  const form = data(); form.set("operation", "read");
  m.read.mockRejectedValueOnce(new ProfileError("not_found"));
  expect(await updateInboxAction(form)).toEqual({ error: "This message is no longer available." });
  m.read.mockRejectedValueOnce(new Error("private database information"));
  expect(await updateInboxAction(form)).toEqual({ error: "Couldn’t update message. Try again." });
  expect(m.revalidate).not.toHaveBeenCalled();
});
