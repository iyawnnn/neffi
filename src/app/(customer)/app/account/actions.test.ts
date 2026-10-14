import { beforeEach, expect, test, vi } from "vitest";
import { hmacHex } from "@/auth/otp-quota";
const m = vi.hoisted(() => ({ authorize: vi.fn(), request: vi.fn(), confirm: vi.fn(), unlink: vi.fn(), revoke: vi.fn(), quota: vi.fn(), list: vi.fn() }));
const notices = vi.hoisted(() => ({ after: vi.fn(), send: vi.fn() }));
vi.mock("next/server", () => ({ after: notices.after }));
vi.mock("@/modules/accounts/security-notice", () => ({ sendSecurityNotice: notices.send }));
vi.mock("@/integrations/email/sender", () => ({ sendEmail: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/auth/server", () => ({ auth: { api: { requestEmailChangeEmailOTP: m.request, changeEmailEmailOTP: m.confirm, listUserAccounts: m.list, unlinkAccount: m.unlink, revokeSessions: m.revoke } } }));
vi.mock("@/auth/otp-quota", async original => ({ ...await original<typeof import("@/auth/otp-quota")>(), consumeQuota: m.quota }));
vi.mock("@/config/env", () => ({ env: { betterAuthSecret: "synthetic-test-secret" } }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { confirmEmailChangeAction, removeGoogleAction, requestEmailChangeAction, signOutEverywhereAction } from "./actions";
const data = (email = " NEW@EXAMPLE.TEST ") => { const form = new FormData(); form.set("email", email); return form; };
beforeEach(() => { vi.resetAllMocks(); m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1", email: "old@example.test" } }); m.quota.mockResolvedValue(true); m.list.mockResolvedValue([{ id: "linked-row", accountId: "google-sub", providerId: "google" }]); });
test("invalid email is refused before sending", async () => { expect(await requestEmailChangeAction(undefined, data("bad"))).toEqual({ error: "Enter a valid email address." }); expect(m.request).not.toHaveBeenCalled(); });
test("email-change quota is account-scoped", async () => {
  m.quota.mockResolvedValue(false); expect(await requestEmailChangeAction(undefined, data())).toEqual({ error: "Too many tries. Please wait a few minutes and try again." });
  expect(m.quota).toHaveBeenCalledWith({}, hmacHex("synthetic-test-secret", "email-change", "a1"), 3); expect(m.request).not.toHaveBeenCalled();
});
test("stale session maps to sign-in guidance without provider detail", async () => { m.request.mockRejectedValue({ statusCode: 403, message: "private-provider-detail" }); expect(await requestEmailChangeAction(undefined, data())).toEqual({ error: "For your security, sign out and sign in again, then change your email." }); });
test("successful request returns the normalized email step", async () => { expect(await requestEmailChangeAction(undefined, data())).toEqual({ step: "code", email: "new@example.test" }); expect(m.request).toHaveBeenCalledWith({ headers: expect.any(Headers), body: { newEmail: "new@example.test" } }); });
test("confirm success redirects; failure is opaque", async () => {
  const form = data("new@example.test"); form.set("code", "123456");
  await expect(confirmEmailChangeAction({ step: "code", email: "new@example.test" }, form)).rejects.toThrow("REDIRECT:/app/account?changed=1");
  expect(notices.send).not.toHaveBeenCalled();
  await notices.after.mock.calls[0][0]();
  expect(notices.send.mock.calls[0][1]).toMatchObject({ kind: "email_changed", recipients: [{ to: "old@example.test", slot: "old" }, { to: "new@example.test", slot: "new" }] });
  m.confirm.mockRejectedValue(new Error("private-detail"));
  expect(await confirmEmailChangeAction({ step: "code", email: "new@example.test" }, form)).toEqual({ step: "code", email: "new@example.test", error: "That code is not valid. Check it, or request a new one." });
});
test("removing Google redirects and revoking sessions signs out", async () => {
  await expect(removeGoogleAction(undefined, new FormData())).rejects.toThrow("REDIRECT:/app/account"); expect(m.unlink).toHaveBeenCalledWith({ headers: expect.any(Headers), body: { accountId: "linked-row" } });
  await expect(signOutEverywhereAction()).rejects.toThrow("REDIRECT:/sign-in"); expect(m.revoke).toHaveBeenCalled();
  for (const [callback] of notices.after.mock.calls) await callback();
  expect(notices.send.mock.calls.map(call => call[1].kind)).toEqual(["google_removed", "sessions_revoked"]);
});
test("signed-out actions require authentication", async () => { m.authorize.mockResolvedValue({ ok: false }); await expect(requestEmailChangeAction(undefined, data())).rejects.toThrow("REDIRECT:/sign-in?next=/app"); expect(m.request).not.toHaveBeenCalled(); });

test("browser identity ids are ignored and absent Google is an idempotent redirect", async () => {
 const form = new FormData(); form.set("accountId", "foreign-row");
 await expect(removeGoogleAction(undefined, form)).rejects.toThrow("REDIRECT:/app/account");
 expect(m.unlink).toHaveBeenCalledWith({headers: expect.any(Headers),body:{accountId:"linked-row"}});
 m.unlink.mockClear(); m.list.mockResolvedValue([]);
 await expect(removeGoogleAction(undefined, form)).rejects.toThrow("REDIRECT:/app/account"); expect(m.unlink).not.toHaveBeenCalled();
});
