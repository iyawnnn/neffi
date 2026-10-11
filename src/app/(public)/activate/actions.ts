"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authorize, getViewer } from "@/auth/access";
import { consumeQuota, hmacHex } from "@/auth/otp-quota";
import { auth } from "@/auth/server";
import { env } from "@/config/env";
import { db } from "@/db";
import { checkActivationCode, claimCard } from "@/modules/activation/claim";
import { clearChallenge, readChallenge, setChallenge } from "./challenge-cookie";

export type ActivateState = { error?: string };

const CHECKS_PER_IP = 20;
const CLAIMS_PER_ACCOUNT = 10;
const MESSAGES = {
  invalid: "We couldn't find that code. Check the label inside your package and try again. If it still doesn't work, please contact Neffi support.",
  unavailableSignedOut: "This code can't be used. If you already added this Neffi, sign in to find it. Otherwise, please contact Neffi support for help.",
  unavailable: "This code can't be used. Please contact Neffi support for help.",
  tooMany: "Too many tries. Please wait a few minutes and try again.",
};

// Same trusted headers as Better Auth's limiter (src/auth/options.ts); Vercel overwrites both.
const clientIp = (h: Headers) => (h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
const quotaKey = (domain: string, value: string) => hmacHex(env.activationCodeSecret, domain, value);

// The code arrives only in this POST body. It is never echoed back, logged, stored or put in a URL.
export async function checkCodeAction(_previous: ActivateState | undefined, data: FormData): Promise<ActivateState> {
  if (!(await consumeQuota(db, quotaKey("activation-ip", clientIp(await headers())), CHECKS_PER_IP))) return { error: MESSAGES.tooMany };
  const viewer = await getViewer();
  const raw = data.get("code");
  const result = await checkActivationCode(db, {
    secret: env.activationCodeSecret,
    code: typeof raw === "string" ? raw.slice(0, 64) : "",
    accountId: viewer?.accountId,
  });
  if (result.status === "claimable") {
    await setChallenge(result.credentialId);
    redirect("/activate");
  }
  if (result.status === "yours") {
    // A used code whose Card the signed-in Account already owns: take them to their Neffi, never a second claim.
    redirect("/app");
  }
  if (result.status === "invalid") return { error: MESSAGES.invalid };
  // Remaining status: "unavailable" (used elsewhere, revoked, not yet sold, retired).
  return { error: viewer ? MESSAGES.unavailable : MESSAGES.unavailableSignedOut };
}

export async function claimAction(_previous: ActivateState | undefined, _data: FormData): Promise<ActivateState> {
  const authorization = await authorize("account");
  if (!authorization.ok) redirect("/activate");
  const credentialId = await readChallenge();
  if (!credentialId) redirect("/activate?notice=expired");
  const { accountId } = authorization.viewer;
  if (!(await consumeQuota(db, quotaKey("activation-claim", accountId), CLAIMS_PER_ACCOUNT))) return { error: MESSAGES.tooMany };
  const result = await claimCard(db, { credentialId, accountId });
  await clearChallenge();
  redirect(result.status === "unavailable" ? "/activate?notice=unavailable" : "/app?added=1");
}

// Keeps the accepted code so the customer can sign in with the right account and finish.
export async function switchAccountAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/activate");
}

export async function startOverAction(): Promise<void> {
  await clearChallenge();
  redirect("/activate");
}
