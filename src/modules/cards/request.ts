import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/config/env";
import { ownsAccountResource, type Viewer } from "@/auth/policy";
import type { CardRoute } from "./resolve";

export const CARD_REQUEST_HEADER = "x-neffi-card-request";
const snapshotSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("published"), profileId: z.string(), sceneId: z.string(), version: z.number().int().nonnegative(), owner: z.literal(true).optional() }).strict(),
  z.object({ status: z.literal("unavailable"), ownerCardId: z.string() }).strict(),
]);
export type CardRequest = z.infer<typeof snapshotSchema>;

export function createCardRequest(route: CardRoute, viewer: Viewer | null): CardRequest | null {
  const owner = viewer !== null && route.ownerAccountId !== null && ownsAccountResource(viewer, route.ownerAccountId);
  if (route.status === "unavailable") return owner && route.cardId ? { status: "unavailable", ownerCardId: route.cardId } : null;
  return { status: "published", profileId: route.profileId, sceneId: route.sceneId, version: route.version, ...(owner ? { owner: true as const } : {}) };
}

const signature = (token: string, payload: string) => createHmac("sha256", env.betterAuthSecret).update(`card-request\0${token}\0${payload}`).digest("hex");
export function signCardRequest(token: string, snapshot: CardRequest): string {
  const payload = Buffer.from(JSON.stringify(snapshot)).toString("base64url");
  return `${payload}.${signature(token, payload)}`;
}

// Proxy overwrites this request-only header. Authentication also fails closed if a request ever bypasses Proxy.
export function readCardRequest(token: string, value: string | null): CardRequest | null {
  if (!value || value.length > 2048) return null;
  const [payload, supplied, extra] = value.split(".");
  if (extra !== undefined || !payload || !supplied || !/^[0-9a-f]{64}$/.test(supplied)) return null;
  if (!timingSafeEqual(Buffer.from(signature(token, payload), "hex"), Buffer.from(supplied, "hex"))) return null;
  try {
    const result = snapshotSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return result.success ? result.data : null;
  } catch { return null; }
}
