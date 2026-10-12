import "server-only";
import { cacheLife } from "next/cache";
import { db } from "@/db";
import type { ViewKey } from "@/modules/cards/resolve";
import { loadVersionedPublicSceneView } from "@/modules/profiles/view";

// Shared public Scene content only; Card state is never cached. `key.version` is not read here: it is part of the cache key
// and moves on every change a visitor could see (bumpProfileContentVersion), so an edit never meets a stale entry on any
// instance. shortcut: per-instance in-memory store; add a remote cache handler only if measured traffic needs it.
export async function cachedSceneView(key: ViewKey) {
  "use cache";
  cacheLife("max");
  return loadVersionedPublicSceneView(db, key);
}
