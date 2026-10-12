import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import { CardError, lockCard } from "../cards/card";
import type { Db } from "../db";
import { PRESETS } from "../forms/config";
import { ProfileError } from "./errors";
import { ACCENTS, LIMITS, publishGaps, type Identity, type PublishGap } from "./rules";
import { PURPOSES, starterBlocks, type Essentials, type Purpose } from "./starters";

// Every profile mutation starts here: the WHERE on account_id is the ownership check, FOR UPDATE serializes edits.
export async function lockOwnedProfile(tx: Db, accountId: string, profileId: string) {
  const [profile] = await tx
    .select()
    .from(schema.profiles)
    .where(and(eq(schema.profiles.id, profileId), eq(schema.profiles.accountId, accountId)))
    .for("update");
  if (!profile) throw new ProfileError("not_found");
  return profile;
}

// Call inside the transaction of every successful change a visitor could see: identity, appearance, image, a Scene's name,
// its Blocks, a Form, or which Scene is shown. The public Scene cache is keyed by this version, so a missed call serves stale
// content. Card state, Card→Profile routing and publish status are read fresh on every tap and need no bump.
export async function bumpProfileContentVersion(tx: Db, profileId: string): Promise<void> {
  await tx.update(schema.profiles).set({ contentVersion: sql`${schema.profiles.contentVersion} + 1` }).where(eq(schema.profiles.id, profileId));
}

export async function visibleBlockCount(tx: Db, sceneId: string | null): Promise<number> {
  if (!sceneId) return 0;
  const [row] = await tx
    .select({ n: count() })
    .from(schema.sceneBlocks)
    .where(and(eq(schema.sceneBlocks.sceneId, sceneId), eq(schema.sceneBlocks.visible, true)));
  return row.n;
}

export async function createProfileFromStarter(
  db: Db,
  input: { accountId: string; cardId: string; purpose: Purpose; essentials: Essentials },
): Promise<{ profileId: string; created: boolean }> {
  return db.transaction(async (tx) => {
    // Account row first, then the card: serializes the profile limit and a double submit for the same card.
    await tx.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.id, input.accountId)).for("update");
    const card = await lockCard(tx, input.cardId).catch((error) => {
      if (error instanceof CardError) return null;
      throw error;
    });
    if (!card || card.ownerAccountId !== input.accountId || card.kind !== "dbc" || card.state !== "released") throw new ProfileError("not_found");
    if (card.profileId) return { profileId: card.profileId, created: false };

    const [{ n }] = await tx.select({ n: count() }).from(schema.profiles).where(eq(schema.profiles.accountId, input.accountId));
    if (n >= LIMITS.profilesPerAccount) throw new ProfileError("limit_reached");

    const e = input.essentials;
    const [profile] = await tx
      .insert(schema.profiles)
      .values({ accountId: input.accountId, fullName: e.fullName, headline: e.headline, bio: e.bio, email: e.email, phone: e.phone })
      .returning({ id: schema.profiles.id });
    const [scene] = await tx
      .insert(schema.scenes)
      .values({ profileId: profile.id, name: PURPOSES[input.purpose].sceneName })
      .returning({ id: schema.scenes.id });
    let position = 0;
    for (const seed of starterBlocks(input.purpose, e)) {
      let formId: string | null = null;
      if (seed.preset) {
        const preset = PRESETS[seed.preset];
        const [form] = await tx
          .insert(schema.formDefinitions)
          .values({ profileId: profile.id, preset: seed.preset, title: preset.title, config: preset.config })
          .returning({ id: schema.formDefinitions.id });
        formId = form.id;
      }
      await tx.insert(schema.sceneBlocks).values({ sceneId: scene.id, type: seed.type, position: position++, content: seed.content, formId });
    }
    await tx.update(schema.profiles).set({ defaultSceneId: scene.id }).where(eq(schema.profiles.id, profile.id));
    await tx.update(schema.cards).set({ profileId: profile.id }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, { type: "card_profile_changed", actorAccountId: input.accountId, accountId: input.accountId, cardId: card.id });
    return { profileId: profile.id, created: true };
  });
}

const unread = sql<number>`count(${schema.formSubmissions.id}) filter (where ${schema.formSubmissions.readAt} is null)`.mapWith(Number);

export async function ownedProfiles(db: Db, accountId: string) {
  return db
    .select({ id: schema.profiles.id, fullName: schema.profiles.fullName, status: schema.profiles.status, unread })
    .from(schema.profiles)
    .leftJoin(schema.formSubmissions, eq(schema.formSubmissions.profileId, schema.profiles.id))
    .where(eq(schema.profiles.accountId, accountId))
    .groupBy(schema.profiles.id)
    .orderBy(asc(schema.profiles.createdAt));
}

export type OwnedProfile = {
  id: string;
  status: "draft" | "published" | "unpublished";
  fullName: string | null;
  headline: string | null;
  company: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  location: string | null;
  accentColor: string | null;
  imageAssetId: string | null;
  imageIsLogo: boolean;
  defaultSceneId: string;
  scenes: { id: string; name: string; isDefault: boolean; isShown: boolean }[];
  cards: { id: string; suffix: string }[];
  gaps: PublishGap[];
  unread: number;
};

export async function getOwnedProfile(db: Db, accountId: string, profileId: string): Promise<OwnedProfile | null> {
  const [p] = await db
    .select({
      id: schema.profiles.id, status: schema.profiles.status, fullName: schema.profiles.fullName, headline: schema.profiles.headline,
      company: schema.profiles.company, bio: schema.profiles.bio, phone: schema.profiles.phone, email: schema.profiles.email,
      website: schema.profiles.website, location: schema.profiles.location, accentColor: schema.profiles.accentColor,
      imageAssetId: schema.profiles.imageAssetId, imageIsLogo: schema.profiles.imageIsLogo,
      defaultSceneId: schema.profiles.defaultSceneId, activeSceneId: schema.profiles.activeSceneId,
    })
    .from(schema.profiles)
    .where(and(eq(schema.profiles.id, profileId), eq(schema.profiles.accountId, accountId)));
  if (!p?.defaultSceneId) return null; // every profile has a Default Scene since 0010
  const [sceneRows, cardRows, visible, [{ n: unreadCount }]] = await Promise.all([
    db.select({ id: schema.scenes.id, name: schema.scenes.name }).from(schema.scenes).where(eq(schema.scenes.profileId, p.id)).orderBy(asc(schema.scenes.createdAt)),
    db.select({ id: schema.cards.id, token: schema.cards.publicToken }).from(schema.cards).where(eq(schema.cards.profileId, p.id)),
    visibleBlockCount(db, p.defaultSceneId),
    db.select({ n: count() }).from(schema.formSubmissions).where(and(eq(schema.formSubmissions.profileId, p.id), sql`${schema.formSubmissions.readAt} is null`)),
  ]);
  const shown = p.activeSceneId ?? p.defaultSceneId;
  const scenes = sceneRows
    .map((s) => ({ ...s, isDefault: s.id === p.defaultSceneId, isShown: s.id === shown }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const { activeSceneId: _active, ...rest } = p;
  return {
    ...rest,
    defaultSceneId: p.defaultSceneId,
    scenes,
    cards: cardRows.map((c) => ({ id: c.id, suffix: (c.token ?? "").slice(-4) })),
    gaps: publishGaps({ ...p, visibleDefaultBlocks: visible }),
    unread: unreadCount,
  };
}

export async function publishProfile(db: Db, input: { accountId: string; profileId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    const gaps = publishGaps({ ...p, visibleDefaultBlocks: await visibleBlockCount(tx, p.defaultSceneId) });
    if (gaps.length) throw new ProfileError("not_ready", gaps);
    await tx.update(schema.profiles).set({ status: "published" }).where(eq(schema.profiles.id, p.id));
  });
}

export async function unpublishProfile(db: Db, input: { accountId: string; profileId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    if (p.status === "published") await tx.update(schema.profiles).set({ status: "unpublished" }).where(eq(schema.profiles.id, p.id));
  });
}

// A Published profile must stay publishable (D6): edits that would empty it are refused, not silently applied.
export async function updateIdentity(db: Db, input: { accountId: string; profileId: string; identity: Identity }): Promise<void> {
  await db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    if (p.status === "published") {
      const gaps = publishGaps({ ...input.identity, visibleDefaultBlocks: await visibleBlockCount(tx, p.defaultSceneId) });
      if (gaps.length) throw new ProfileError("not_ready", gaps);
    }
    await tx.update(schema.profiles).set(input.identity).where(eq(schema.profiles.id, p.id));
    await bumpProfileContentVersion(tx, p.id);
  });
}

export async function updateAppearance(db: Db, input: { accountId: string; profileId: string; accentColor: string; imageIsLogo: boolean }): Promise<void> {
  if (!ACCENTS.some((accent) => accent.hex === input.accentColor)) throw new ProfileError("invalid");
  await db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    await tx.update(schema.profiles).set({ accentColor: input.accentColor, imageIsLogo: input.imageIsLogo }).where(eq(schema.profiles.id, p.id));
    await bumpProfileContentVersion(tx, p.id);
  });
}

export async function setProfileImage(db: Db, input: { accountId: string; profileId: string; assetId: string | null }) {
  return db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    if (p.imageAssetId !== input.assetId) {
      await tx.update(schema.profiles).set({ imageAssetId: input.assetId }).where(eq(schema.profiles.id, p.id));
      await bumpProfileContentVersion(tx, p.id);
    }
    return { previousAssetId: p.imageAssetId === input.assetId ? null : p.imageAssetId };
  });
}

export async function deleteProfile(db: Db, input: { accountId: string; profileId: string }) {
  return db.transaction(async (tx) => {
    const p = await lockOwnedProfile(tx, input.accountId, input.profileId);
    const [{ n }] = await tx.select({ n: count() }).from(schema.cards).where(eq(schema.cards.profileId, p.id));
    if (n > 0) throw new ProfileError("has_cards");
    await tx.delete(schema.profiles).where(eq(schema.profiles.id, p.id));
    return { imageAssetId: p.imageAssetId };
  });
}
