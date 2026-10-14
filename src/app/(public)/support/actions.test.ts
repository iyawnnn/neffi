import { beforeEach, expect, test, vi } from "vitest";
import { SUPPORT_SUCCESS } from "@/modules/support/domain";
const m = vi.hoisted(() => ({ getViewer: vi.fn(), submit: vi.fn(), dispatch: vi.fn(), after: vi.fn() }));
vi.mock("@/auth/access", () => ({ getViewer: m.getViewer }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/env", () => ({ env: { betterAuthSecret: "synthetic-secret" } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("@/integrations/email/sender", () => ({ sendEmail: vi.fn() }));
vi.mock("@/modules/support/intake", () => ({ submitSupportRequest: m.submit }));
vi.mock("@/modules/support/email", () => ({ dispatchCaseEmail: m.dispatch }));
import { submitSupportAction } from "./actions";
function input() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ email: "contact@example.test", name: "Contact", category: "activation", message: "Please help", clientKey: "00000000-0000-4000-8000-000000000001", website: "" })) data.set(key, value);
  return data;
}
beforeEach(() => { vi.clearAllMocks(); m.getViewer.mockResolvedValue(null); m.submit.mockResolvedValue({ caseId: "00000000-0000-4000-8000-000000000002", acknowledge: true }); });
test("normal, dropped and duplicate submissions return the same public success", async () => {
  expect(await submitSupportAction(undefined, input())).toEqual({ ok: SUPPORT_SUCCESS });
  m.submit.mockResolvedValue({ acknowledge: false });
  expect(await submitSupportAction(undefined, input())).toEqual({ ok: SUPPORT_SUCCESS });
  const bot = input(); bot.set("website", "bot");
  expect(await submitSupportAction(undefined, bot)).toEqual({ ok: SUPPORT_SUCCESS });
});
test("signed-in contact comes from the session and acknowledgement runs after persistence", async () => {
  m.getViewer.mockResolvedValue({ accountId: "account", email: "verified@example.test", role: "customer" });
  await submitSupportAction(undefined, input());
  expect(m.submit.mock.calls[0][1].email).toBe("verified@example.test");
  expect(m.dispatch).not.toHaveBeenCalled();
  await m.after.mock.calls[0][0]();
  expect(m.dispatch.mock.calls[0][1]).toMatchObject({ kind: "acknowledgement", actorId: "account" });
});
test("validation is inline and unexpected database errors are rethrown", async () => {
  const bad = input(); bad.set("message", "");
  expect(await submitSupportAction(undefined, bad)).toMatchObject({ error: expect.any(String) });
  expect(m.submit).not.toHaveBeenCalled();
  m.submit.mockRejectedValue(new Error("database offline"));
  await expect(submitSupportAction(undefined, input())).rejects.toThrow("database offline");
});
