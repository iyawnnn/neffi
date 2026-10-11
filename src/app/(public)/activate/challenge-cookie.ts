import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/config/env";
import { CHALLENGE_TTL_MS, signChallenge, verifyChallenge } from "@/modules/activation/challenge";

const NAME = "neffi_activation";

// The credential id of a code this browser entered within the last 15 minutes, or null.
export async function readChallenge(): Promise<string | null> {
  // Cookie access can resolve during runtime prerendering; expiry must use the request-time clock.
  await connection();
  return verifyChallenge(env.activationCodeSecret, (await cookies()).get(NAME)?.value);
}

// Lax so it survives the top-level return from Google; scoped to /activate so no other route ever receives it.
export async function setChallenge(credentialId: string): Promise<void> {
  (await cookies()).set(NAME, signChallenge(env.activationCodeSecret, credentialId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/activate",
    secure: env.authBaseUrl.startsWith("https:"),
    maxAge: CHALLENGE_TTL_MS / 1000,
  });
}

export async function clearChallenge(): Promise<void> {
  (await cookies()).delete({ name: NAME, path: "/activate" });
}
