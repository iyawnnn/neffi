import "server-only";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import type { SceneView } from "../profiles/scene-view";

const TOKEN = /^[0-9A-Za-z]{1,64}$/;
export type CardRoute =
  | { status: "unavailable"; cardId: string | null; ownerAccountId: string | null }
  | { status: "published"; cardId: string; ownerAccountId: string; profileId: string; sceneId: string; version: number };

// Fresh on every tap and never cached: one indexed lookup on the unique public token. Every reason a card cannot show a
// profile collapses into "unavailable", so nothing downstream can reveal why. The owner id is kept only for the owner's own
// Manage shortcut, which the page grants after a server-side ownership check.
export async function resolveCard(db: Db, token: string): Promise<CardRoute> {
  if (!TOKEN.test(token)) return { status: "unavailable", cardId: null, ownerAccountId: null };
  const [row] = await db.select({
    cardId: schema.cards.id, kind: schema.cards.kind, state: schema.cards.state, ownerAccountId: schema.cards.ownerAccountId,
    disabledAt: schema.cards.disabledAt, profileId: schema.profiles.id, status: schema.profiles.status,
    sceneId: sql<string | null>`coalesce(${schema.profiles.activeSceneId}, ${schema.profiles.defaultSceneId})`,
    version: schema.profiles.contentVersion,
  }).from(schema.cards).leftJoin(schema.profiles, eq(schema.profiles.id, schema.cards.profileId)).where(eq(schema.cards.publicToken, token));
  if (!row) return { status: "unavailable", cardId: null, ownerAccountId: null };
  const { cardId, ownerAccountId, profileId, sceneId, version } = row;
  if (row.kind !== "dbc" || row.state !== "released" || !ownerAccountId || row.disabledAt || !profileId || row.status !== "published" || !sceneId || version === null) {
    return { status: "unavailable", cardId, ownerAccountId };
  }
  return { status: "published", cardId, ownerAccountId, profileId, sceneId, version };
}

export type ViewKey = { profileId: string; sceneId: string; version: number };
export type ViewLoader = (key: ViewKey) => Promise<SceneView | null>;
export type PublicExperience =
  | { status: "unavailable"; cardId: string | null; ownerAccountId: string | null }
  | { status: "published"; cardId: string; ownerAccountId: string; profileId: string; view: SceneView };

// Card state is always fresh; only the Scene content comes from `loadView`, whose key carries the content version.
export async function resolvePublicExperience(db: Db, token: string, loadView: ViewLoader): Promise<PublicExperience> {
  const route = await resolveCard(db, token);
  if (route.status === "unavailable") return route;
  const view = await loadView({ profileId: route.profileId, sceneId: route.sceneId, version: route.version });
  if (!view) return { status: "unavailable", cardId: route.cardId, ownerAccountId: route.ownerAccountId };
  return { status: "published", cardId: route.cardId, ownerAccountId: route.ownerAccountId, profileId: route.profileId, view };
}
