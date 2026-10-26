import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./server";
import { isOwner, safeAdminNext, toViewer, type Viewer } from "./policy";

// The Data Access Layer for identity. Pages, layouts, route handlers and server actions all ask here who is
// calling; nothing else reads the session. Layouts are not a security boundary for mutations or soft navigations,
// so every protected page and action calls these functions itself (they are memoized per request).

// Reads the session without ever mutating it: a Server Component cannot set the refreshed cookie, so a
// refresh here would roll the database expiry while the browser cookie quietly ran out (see refreshSession).
export async function getViewerFromHeaders(requestHeaders: Headers): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers: requestHeaders, query: { disableRefresh: true } });
  return toViewer(session);
}
export const getViewer = cache(async (): Promise<Viewer | null> => getViewerFromHeaders(await headers()));

export async function requireAccount(area: "/app" | "/admin"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${area}`);
  return viewer;
}

// Signed-in non-owners get a plain 404 so the admin surface does not announce itself. A signed-out visitor returns to
// the exact Admin page they asked for; the optional path is validated here, never trusted.
export async function requireOwner(nextPath?: string): Promise<Viewer> {
  const next = safeAdminNext(nextPath);
  const viewer = next === "/admin" ? await requireAccount("/admin") : await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (!isOwner(viewer)) notFound();
  return viewer;
}

export type Denial = { status: 401 | 403; error: "unauthenticated" | "forbidden" };
export type Authorization = { ok: true; viewer: Viewer } | { ok: false; denial: Denial };

// For route handlers and server actions, which answer with a status instead of redirecting.
export async function authorize(required: "account" | "owner"): Promise<Authorization> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, denial: { status: 401, error: "unauthenticated" } };
  if (required === "owner" && !isOwner(viewer)) return { ok: false, denial: { status: 403, error: "forbidden" } };
  return { ok: true, viewer };
}

export const denialResponse = ({ status, error }: Denial) => Response.json({ error }, { status });
