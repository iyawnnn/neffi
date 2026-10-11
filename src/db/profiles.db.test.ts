import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { profileLinks, profiles } from "./schema";
import { insertAccount, insertProfile, insertProfileWithScene } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

describe("Profiles", () => {
  test("a Published profile must have a full name", () =>
    rollback(db, async (tx) => {
      const { profile } = await insertProfileWithScene(tx, (await insertAccount(tx)).id);
      await expectPgError(
        tx,
        (s) => s.update(profiles).set({ status: "published" }).where(eq(profiles.id, profile.id)),
        "23514",
        "profiles_published_needs_name",
      );
      await tx.update(profiles).set({ status: "published", fullName: "Synthetic Person" }).where(eq(profiles.id, profile.id));
    }));

  test("accent color is a hex color", () =>
    rollback(db, async (tx) => {
      const profile = await insertProfile(tx, (await insertAccount(tx)).id);
      await expectPgError(
        tx,
        (s) => s.update(profiles).set({ accentColor: "red; background:url(x)" }).where(eq(profiles.id, profile.id)),
        "23514",
        "profiles_accent_color_hex",
      );
    }));

  test("links belong to their profile and go with it", () =>
    rollback(db, async (tx) => {
      const profile = await insertProfile(tx, (await insertAccount(tx)).id);
      await expectPgError(
        tx,
        (s) => s.insert(profileLinks).values({ profileId: profile.id, type: "custom", url: "https://example.test", position: -1 }),
        "23514",
        "profile_links_position_nonnegative",
      );
      await tx.insert(profileLinks).values({ profileId: profile.id, type: "instagram", url: "https://example.test/me", position: 0 });
      await tx.delete(profiles).where(eq(profiles.id, profile.id));
      expect(await tx.select().from(profileLinks).where(eq(profileLinks.profileId, profile.id))).toHaveLength(0);
    }));
});
