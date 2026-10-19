"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { consumeEmailChangeQuota } from "@/auth/otp-quota";
import { auth } from "@/auth/server";
import { env } from "@/config/env";
import { db } from "@/db";
import { sendEmail } from "@/integrations/email/sender";
import type { NoticeKind } from "@/integrations/email/support-templates";
import { sendSecurityNotice, type SecurityNotice } from "@/modules/accounts/security-notice";
import type { Viewer } from "@/auth/policy";

export type EmailChangeState = { step?: "code"; email?: string; error?: string; stale?: true; changed?: true };
const STALE = "For your security, sign out and sign in again, then change your email.";
async function accountViewer() {
  const result = await authorize("account");
  if (!result.ok) redirect("/sign-in?next=/app");
  return result.viewer;
}
function notice(viewer: Viewer, kind: NoticeKind, recipients: SecurityNotice["recipients"] = [{ to: viewer.email, slot: "current" }]) {
  const attemptId = crypto.randomUUID(); const at = new Date();
  after(() => sendSecurityNotice(db, { accountId: viewer.accountId, actorId: viewer.accountId, kind, attemptId, at, recipients }, sendEmail));
}
const stale = (error: unknown) => typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 403;

async function recentSession(requestHeaders: Headers, accountId: string): Promise<boolean> {
  const session = await auth.api.getSession({ headers: requestHeaders, query: { disableRefresh: true } });
  return session?.user.id === accountId && Date.now() - new Date(session.session.createdAt).getTime() <= 15 * 60_000;
}

export async function requestEmailChangeAction(_previous: EmailChangeState | undefined, data: FormData): Promise<EmailChangeState> {
  const owner = (await accountViewer()).accountId;
  const requestHeaders = await headers();
  if (!await recentSession(requestHeaders, owner)) return { stale: true, error: STALE };
  const parsed = z.email().safeParse(typeof data.get("email") === "string" ? String(data.get("email")).trim().toLowerCase() : "");
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (!await consumeEmailChangeQuota(db, env.betterAuthSecret, owner, parsed.data)) return { error: "Too many tries. Please wait a few minutes and try again." };
  try { await auth.api.requestEmailChangeEmailOTP({ headers: requestHeaders, body: { newEmail: parsed.data } }); }
  catch { return { error: "We couldn't send that code. Please try again." }; }
  return { step: "code", email: parsed.data };
}
export async function confirmEmailChangeAction(_previous: EmailChangeState | undefined, data: FormData): Promise<EmailChangeState> {
  const viewer = await accountViewer();
  const requestHeaders = await headers();
  if (!await recentSession(requestHeaders, viewer.accountId)) return { stale: true, error: STALE };
  const email = typeof data.get("email") === "string" ? String(data.get("email")).trim().toLowerCase() : "";
  const code = data.get("code");
  const failed: EmailChangeState = { step: "code", email, error: "That code is not valid. Check it, or request a new one." };
  if (!z.email().safeParse(email).success || typeof code !== "string" || !/^\d{6}$/.test(code)) return failed;
  try { await auth.api.changeEmailEmailOTP({ headers: requestHeaders, body: { newEmail: email, otp: code } }); }
  catch { return failed; }
  notice(viewer, "email_changed", [{ to: viewer.email, slot: "old" }, { to: email, slot: "new" }]);
  try { await auth.api.revokeOtherSessions({ headers: requestHeaders }); }
  catch { return { changed: true, error: "Your email changed, but we couldn't sign out other devices. Use Sign out everywhere below." }; }
  redirect("/app/account?changed=1");
}
export async function removeGoogleAction(_previous: { error?: string } | undefined, _data: FormData): Promise<{ error?: string }> {
  const viewer = await accountViewer();
  let removed = false;
  try {
    const requestHeaders = await headers();
    const google = (await auth.api.listUserAccounts({ headers: requestHeaders })).find(identity => identity.providerId === "google");
    if (google) { await auth.api.unlinkAccount({ headers: requestHeaders, body: { accountId: google.id } }); removed = true; }
  } catch (error) { return { error: stale(error) ? STALE : "We couldn't remove Google. Please try again." }; }
  if (removed) notice(viewer, "google_removed");
  redirect("/app/account");
}
export async function signOutEverywhereAction(): Promise<void> {
  const viewer = await accountViewer();
  await auth.api.revokeSessions({ headers: await headers() });
  notice(viewer, "sessions_revoked");
  redirect("/sign-in");
}
