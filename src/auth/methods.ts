import "server-only";
import { headers } from "next/headers";
import { auth } from "./server";

// Which Authentication Identities the signed-in Account has linked. Read on the server so the session-bound
// /list-accounts HTTP route can stay disabled. The email-code method is always available (it is the Account email).
export async function getLinkedMethods(): Promise<{ google: boolean }> {
  const identities = await auth.api.listUserAccounts({ headers: await headers() });
  return { google: identities.some((identity) => identity.providerId === "google") };
}
