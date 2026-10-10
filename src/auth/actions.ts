"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./server";

// Server Actions can set cookies, so this is the one place a session is refreshed: it renews the database expiry
// and the browser cookie together. Rendering never refreshes (see getViewer).
export async function refreshSession(): Promise<void> {
  await auth.api.getSession({ headers: await headers() });
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
