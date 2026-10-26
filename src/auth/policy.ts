// Pure authorization policy: no Next.js, no database, no server-only. Every role or ownership comparison in the
// app goes through here, so there is one place to read and one place to test.

export type Role = "customer" | "owner";
export type Viewer = { accountId: string; email: string; role: Role };

const ROLES: readonly string[] = ["customer", "owner"];

type SessionLike = { user?: { id?: unknown; email?: unknown; emailVerified?: unknown; role?: unknown } } | null | undefined;

// Narrows a Better Auth session to the few fields the app may see. Anything unexpected (missing id, an unverified
// email, an unknown role) means "not signed in": a malformed session never gets a default role.
export function toViewer(session: SessionLike): Viewer | null {
  const user = session?.user;
  if (!user) return null;
  const { id, email, emailVerified, role } = user;
  if (typeof id !== "string" || typeof email !== "string" || emailVerified !== true) return null;
  if (typeof role !== "string" || !ROLES.includes(role)) return null;
  return { accountId: id, email, role: role as Role };
}

export const isOwner = (viewer: Viewer) => viewer.role === "owner";

// An owner is still an Account: owning the business does not grant access to a customer's private data. Owner
// access to customer records is an explicit, separate decision made where it is needed (Milestone 8).
export const ownsAccountResource = (viewer: Viewer, ownerAccountId: string) => viewer.accountId === ownerAccountId;

const NEXT_ORIGIN = "http://neffi.invalid";
const FALLBACK = "/app";

// Post-sign-in destination. Only paths inside /app, /admin or /activate on this site are honored; everything else (other
// origins, protocol-relative or backslash tricks, encoded variants, dot segments) falls back to /app.
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || raw === "") return FALLBACK;
  let url: URL;
  try {
    url = new URL(raw, NEXT_ORIGIN);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== NEXT_ORIGIN) return FALLBACK;
  const path = url.pathname;
  const inside = ["/app", "/admin", "/activate"].some((root) => path === root || path.startsWith(`${root}/`));
  return inside ? path : FALLBACK;
}

// Owner-gate return destination: the exact internal Admin path, or /admin when the value is unsafe or elsewhere.
export function safeAdminNext(raw: unknown): string {
  const next = safeNext(raw);
  return next === "/admin" || next.startsWith("/admin/") ? next : "/admin";
}
