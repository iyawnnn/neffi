import { afterEach, beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ authorize: vi.fn(), session: vi.fn(), request: vi.fn(), confirm: vi.fn(), unlink: vi.fn(), revoke: vi.fn(), revokeOthers: vi.fn(), quota: vi.fn(), list: vi.fn() }));
const notices = vi.hoisted(() => ({ after: vi.fn(), send: vi.fn() }));
vi.mock("next/server", () => ({ after: notices.after }));
vi.mock("@/modules/accounts/security-notice", () => ({ sendSecurityNotice: notices.send }));
vi.mock("@/integrations/email/sender", () => ({ sendEmail: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/auth/server", () => ({ auth: { api: { getSession: m.session, requestEmailChangeEmailOTP: m.request, changeEmailEmailOTP: m.confirm, listUserAccounts: m.list, unlinkAccount: m.unlink, revokeSessions: m.revoke, revokeOtherSessions: m.revokeOthers } } }));
vi.mock("@/auth/otp-quota", async original => ({ ...await original<typeof import("@/auth/otp-quota")>(), consumeEmailChangeQuota: m.quota }));
vi.mock("@/config/env", () => ({ env: { betterAuthSecret: "synthetic-test-secret" } }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { confirmEmailChangeAction, removeGoogleAction, requestEmailChangeAction, signOutEverywhereAction } from "./actions";
const data = (email = " NEW@EXAMPLE.TEST ") => { const form = new FormData(); form.set("email", email); return form; };
beforeEach(() => { vi.resetAllMocks(); m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1", email: "old@example.test" } }); m.session.mockResolvedValue({ user: { id: "a1" }, session: { createdAt: new Date() } }); m.quota.mockResolvedValue(true); m.list.mockResolvedValue([{ id: "linked-row", accountId: "google-sub", providerId: "google" }]); });
afterEach(() => vi.useRealTimers());
test("invalid email is refused before sending", async () => { expect(await requestEmailChangeAction(undefined, data("bad"))).toEqual({ error: "Enter a valid email address." }); expect(m.request).not.toHaveBeenCalled(); });
test("email-change quota is account-scoped", async () => {
  m.quota.mockResolvedValue(false); expect(await requestEmailChangeAction(undefined, data())).toEqual({ error: "Too many tries. Please wait a few minutes and try again." });
  expect(m.quota).toHaveBeenCalledWith({}, "synthetic-test-secret", "a1", "new@example.test"); expect(m.request).not.toHaveBeenCalled();
});
test.each([requestEmailChangeAction, confirmEmailChangeAction])("stale sessions refuse %s before quota or provider calls", async action => {
  m.session.mockResolvedValue({ user: { id: "a1" }, session: { createdAt: new Date(Date.now() - 15 * 60_000 - 1000) } });
  const form = data(); form.set("code", "123456");
  expect(await action(undefined, form)).toEqual({ stale: true, error: "For your security, sign out and sign in again, then change your email." });
  expect(m.request).not.toHaveBeenCalled(); expect(m.confirm).not.toHaveBeenCalled(); expect(m.quota).not.toHaveBeenCalled(); expect(m.revokeOthers).not.toHaveBeenCalled();
});

test.each([null, { user: { id: "other" }, session: { createdAt: new Date() } }])("missing or mismatched session fails closed", async session => {
  m.session.mockResolvedValue(session);
  expect(await requestEmailChangeAction(undefined, data())).toHaveProperty("stale", true);
  expect(m.request).not.toHaveBeenCalled();
});

test("the exact fifteen-minute boundary is fresh and the session read does not renew it", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
  m.session.mockResolvedValue({ user: { id: "a1" }, session: { createdAt: new Date(Date.now() - 15 * 60_000) } });
  expect(await requestEmailChangeAction(undefined, data())).toEqual({ step: "code", email: "new@example.test" });
  expect(m.session).toHaveBeenCalledWith({ headers: expect.any(Headers), query: { disableRefresh: true } });
});
test("successful request returns the normalized email step", async () => { expect(await requestEmailChangeAction(undefined, data())).toEqual({ step: "code", email: "new@example.test" }); expect(m.request).toHaveBeenCalledWith({ headers: expect.any(Headers), body: { newEmail: "new@example.test" } }); });

test("provider refusal remains generic rather than masquerading as an age check", async () => {
  m.request.mockRejectedValue({ statusCode: 403, message: "private-provider-detail" });
  expect(await requestEmailChangeAction(undefined, data())).toEqual({ error: "We couldn't send that code. Please try again." });
});
test("confirm success redirects; failure is opaque", async () => {
  const form = data("new@example.test"); form.set("code", "123456");
  await expect(confirmEmailChangeAction({ step: "code", email: "new@example.test" }, form)).rejects.toThrow("REDIRECT:/app/account?changed=1");
  expect(m.revokeOthers).toHaveBeenCalledWith({ headers: expect.any(Headers) });
  expect(m.confirm.mock.invocationCallOrder[0]).toBeLessThan(notices.after.mock.invocationCallOrder[0]);
  expect(notices.after.mock.invocationCallOrder[0]).toBeLessThan(m.revokeOthers.mock.invocationCallOrder[0]);
  expect(notices.send).not.toHaveBeenCalled();
  await notices.after.mock.calls[0][0]();
  expect(notices.send.mock.calls[0][1]).toMatchObject({ kind: "email_changed", recipients: [{ to: "old@example.test", slot: "old" }, { to: "new@example.test", slot: "new" }] });
  m.confirm.mockRejectedValue(new Error("private-detail"));
  m.revokeOthers.mockClear(); notices.after.mockClear();
  expect(await confirmEmailChangeAction({ step: "code", email: "new@example.test" }, form)).toEqual({ step: "code", email: "new@example.test", error: "That code is not valid. Check it, or request a new one." });
  expect(JSON.stringify(await confirmEmailChangeAction(undefined, form))).not.toContain("123456");
  expect(m.revokeOthers).not.toHaveBeenCalled(); expect(notices.after).not.toHaveBeenCalled();
});

test("revoke failure reports the completed email change without undoing it or exposing details", async () => {
  m.revokeOthers.mockRejectedValue(new Error("private revoke detail"));
  const form = data(); form.set("code", "123456");
  expect(await confirmEmailChangeAction(undefined, form)).toEqual({ changed: true, error: "Your email changed, but we couldn't sign out other devices. Use Sign out everywhere below." });
  expect(m.confirm).toHaveBeenCalledTimes(1); expect(notices.after).toHaveBeenCalledTimes(1); expect(m.revoke).not.toHaveBeenCalled();
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
