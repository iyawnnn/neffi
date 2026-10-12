import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { cards, formDefinitions, formSubmissions, profiles, sceneBlocks, scenes } from "./schema";
import { insertAccount, insertClaimedCard, insertProfile } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb, type TestTx } from "./testing";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const CONFIG = { fields: { name: "required", email: "required", phone: "optional", company: "hidden", message: "required" }, questions: [] };
async function profileWithScene(tx: TestTx) {
  const profile = await insertProfile(tx, (await insertAccount(tx)).id);
  const [scene] = await tx.insert(scenes).values({ profileId: profile.id, name: "Main" }).returning();
  await tx.update(profiles).set({ defaultSceneId: scene.id }).where(eq(profiles.id, profile.id));
  return { profile, scene };
}

describe("scenes", () => {
  test("names are 1–40 characters", () =>
    rollback(db, async (tx) => {
      const profile = await insertProfile(tx, (await insertAccount(tx)).id);
      await expectPgError(tx, (s) => s.insert(scenes).values({ profileId: profile.id, name: "" }), "23514", "scenes_name_length");
      await expectPgError(tx, (s) => s.insert(scenes).values({ profileId: profile.id, name: "x".repeat(41) }), "23514", "scenes_name_length");
    }));

  test("a profile can only point at its own scenes", () =>
    rollback(db, async (tx) => {
      const a = await profileWithScene(tx);
      const b = await profileWithScene(tx);
      await expectPgError(tx, (s) => s.update(profiles).set({ defaultSceneId: b.scene.id }).where(eq(profiles.id, a.profile.id)), "23503", "profiles_default_scene_fk");
      await expectPgError(tx, (s) => s.update(profiles).set({ activeSceneId: b.scene.id }).where(eq(profiles.id, a.profile.id)), "23503", "profiles_active_scene_fk");
    }));

  test("a published profile needs a default scene", () =>
    rollback(db, async (tx) => {
      const profile = await insertProfile(tx, (await insertAccount(tx)).id);
      await expectPgError(
        tx,
        (s) => s.update(profiles).set({ status: "published", fullName: "Synthetic" }).where(eq(profiles.id, profile.id)),
        "23514",
        "profiles_published_needs_default_scene",
      );
    }));

  test("the default scene cannot be deleted", () =>
    rollback(db, async (tx) => {
      const { scene } = await profileWithScene(tx);
      await expectPgError(tx, (s) => s.delete(scenes).where(eq(scenes.id, scene.id)), "23503", "profiles_default_scene_fk");
    }));
});

describe("blocks, forms and submissions", () => {
  test("only form blocks carry a form; content is an object; positions are non-negative", () =>
    rollback(db, async (tx) => {
      const { profile, scene } = await profileWithScene(tx);
      const [form] = await tx.insert(formDefinitions).values({ profileId: profile.id, preset: "contact", title: "Contact", config: CONFIG }).returning();
      await expectPgError(tx, (s) => s.insert(sceneBlocks).values({ sceneId: scene.id, type: "form", position: 0 }), "23514", "scene_blocks_form_only_on_form");
      await expectPgError(tx, (s) => s.insert(sceneBlocks).values({ sceneId: scene.id, type: "about", position: 0, formId: form.id }), "23514", "scene_blocks_form_only_on_form");
      await expectPgError(tx, (s) => s.insert(sceneBlocks).values({ sceneId: scene.id, type: "about", position: -1 }), "23514", "scene_blocks_position_nonnegative");
      await expectPgError(tx, (s) => s.insert(sceneBlocks).values({ sceneId: scene.id, type: "about", position: 0, content: [] as never }), "23514", "scene_blocks_content_object");
      await tx.insert(sceneBlocks).values({ sceneId: scene.id, type: "form", position: 0, formId: form.id });
    }));

  test("a submission belongs to its form's profile and is stored once per client key", () =>
    rollback(db, async (tx) => {
      const { profile } = await profileWithScene(tx);
      const other = await profileWithScene(tx);
      const [form] = await tx.insert(formDefinitions).values({ profileId: profile.id, preset: "contact", title: "Contact", config: CONFIG }).returning();
      const key = crypto.randomUUID();
      await expectPgError(tx, (s) => s.insert(formSubmissions).values({ formId: form.id, profileId: other.profile.id, clientKey: key, answers: [] }), "23503", "form_submissions_form_fk");
      await expectPgError(tx, (s) => s.insert(formSubmissions).values({ formId: form.id, profileId: profile.id, clientKey: key, answers: {} as never }), "23514", "form_submissions_answers_array");
      await tx.insert(formSubmissions).values({ formId: form.id, profileId: profile.id, clientKey: key, answers: [] });
      await expectPgError(tx, (s) => s.insert(formSubmissions).values({ formId: form.id, profileId: profile.id, clientKey: key, answers: [] }), "23505", "form_submissions_form_client_key_unique");
    }));

  test("deleting a profile removes its scenes, blocks, forms and messages, but not while a card shows it", () =>
    rollback(db, async (tx) => {
      const { card, profile } = await insertClaimedCard(tx);
      const [scene] = await tx.insert(scenes).values({ profileId: profile.id, name: "Main" }).returning();
      await tx.update(profiles).set({ defaultSceneId: scene.id }).where(eq(profiles.id, profile.id));
      const [form] = await tx.insert(formDefinitions).values({ profileId: profile.id, preset: "contact", title: "Contact", config: CONFIG }).returning();
      await tx.insert(sceneBlocks).values({ sceneId: scene.id, type: "form", position: 0, formId: form.id });
      await tx.insert(formSubmissions).values({ formId: form.id, profileId: profile.id, clientKey: crypto.randomUUID(), answers: [] });
      await expectPgError(tx, (s) => s.delete(profiles).where(eq(profiles.id, profile.id)), "23503", "cards_profile_owner_fk");
      await tx.update(cards).set({ profileId: null }).where(eq(cards.id, card.id));
      await tx.delete(profiles).where(eq(profiles.id, profile.id));
      for (const table of [scenes, formDefinitions]) expect(await tx.select().from(table).where(eq(table.profileId, profile.id))).toHaveLength(0);
      expect(await tx.select().from(formSubmissions).where(eq(formSubmissions.profileId, profile.id))).toHaveLength(0);
    }));
});
