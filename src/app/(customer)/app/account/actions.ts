"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { consumeQuota, hmacHex } from "@/auth/otp-quota";
import { auth } from "@/auth/server";
import { env } from "@/config/env";
import { db } from "@/db";

export type EmailChangeState = { step?: "code"; email?: string; error?: string };
const STALE = "For your security, sign out and sign in again, then change your email.";
async function accountId() {
  const result = await authorize("account");
  if (!result.ok) redirect("/sign-in?next=/app");
  return result.viewer.accountId;
}
const stale = (error: unknown) => typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 403;

export async function requestEmailChangeAction(_previous: EmailChangeState | undefined, data: FormData): Promise<EmailChangeState> {
  const owner = await accountId();
  const parsed = z.email().safeParse(typeof data.get("email") === "string" ? String(data.get("email")).trim().toLowerCase() : "");
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (!await consumeQuota(db, hmacHex(env.betterAuthSecret, "email-change", owner), 3)) return { error: "Too many tries. Please wait a few minutes and try again." };
  try { await auth.api.requestEmailChangeEmailOTP({ headers: await headers(), body: { newEmail: parsed.data } }); }
  catch (error) { return { error: stale(error) ? STALE : "We couldn't send that code. Please try again." }; }
  return { step: "code", email: parsed.data };
}
export async function confirmEmailChangeAction(_previous: EmailChangeState | undefined, data: FormData): Promise<EmailChangeState> {
  await accountId();
  const email = typeof data.get("email") === "string" ? String(data.get("email")).trim().toLowerCase() : "";
  const code = data.get("code");
  const failed: EmailChangeState = { step: "code", email, error: "That code is not valid. Check it, or request a new one." };
  if (!z.email().safeParse(email).success || typeof code !== "string" || !/^\d{6}$/.test(code)) return failed;
  try { await auth.api.changeEmailEmailOTP({ headers: await headers(), body: { newEmail: email, otp: code } }); }
  catch { return failed; }
  redirect("/app/account?changed=1");
}
export async function removeGoogleAction(_previous: { error?: string } | undefined, _data: FormData): Promise<{ error?: string }> {
  await accountId();
  try {
    const requestHeaders = await headers();
    const google = (await auth.api.listUserAccounts({ headers: requestHeaders })).find(identity => identity.providerId === "google");
    if (google) await auth.api.unlinkAccount({ headers: requestHeaders, body: { accountId: google.id } });
  } catch (error) { return { error: stale(error) ? STALE : "We couldn't remove Google. Please try again." }; }
  redirect("/app/account");
}
export async function signOutEverywhereAction(): Promise<void> {
  await accountId();
  await auth.api.revokeSessions({ headers: await headers() });
  redirect("/sign-in");
}
