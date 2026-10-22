import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { insertAccount, insertProfile } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb, type TestTx } from "./testing";

describe("profile appearance schema", () => {
  let db: TestDb;
  beforeAll(async () => { db = await createTestDb(); });
  afterAll(async () => { await db.$client.close(); });

  test("fresh profiles default to Classic, Light and no Goal, with theme removed", () =>
    rollback(db, async (tx) => {
      const profile = await insertProfile(tx, (await insertAccount(tx)).id);
      const { rows: [row] } = await tx.execute(sql`SELECT * FROM profiles WHERE id = ${profile.id}`);
      expect(row).toMatchObject({ layout: "classic", color_mode: "light", goal: null });
      expect(row).not.toHaveProperty("theme");
    }));

  test.each([
    { column: "layout", type: "profile_layout", values: ["classic", "editorial", "showcase"], nullable: false },
    { column: "color_mode", type: "profile_color_mode", values: ["light", "dark"], nullable: false },
    { column: "goal", type: "profile_goal", values: ["networking", "freelance", "business", "student"], nullable: true },
  ])("$column accepts exactly the approved enum values and nullability", ({ column, type, values, nullable }) =>
    rollback(db, async (tx) => {
      const { rows } = await tx.execute<{ value: string }>(sql`SELECT enumlabel AS value FROM pg_enum WHERE enumtypid = ${type}::regtype ORDER BY enumsortorder`);
      expect(rows.map((row) => row.value)).toEqual(values);
      const profile = await insertProfile(tx, (await insertAccount(tx)).id);
      for (const value of values) {
        const { rows: [row] } = await tx.execute(sql`UPDATE profiles SET ${sql.identifier(column)} = ${value} WHERE id = ${profile.id} RETURNING ${sql.identifier(column)}`);
        expect(row[column]).toBe(value);
      }
      await expectPgError(tx, (s) => s.execute(sql`UPDATE profiles SET ${sql.identifier(column)} = 'invalid' WHERE id = ${profile.id}`), "22P02");
      const clear = (s: TestTx) => s.execute(sql`UPDATE profiles SET ${sql.identifier(column)} = NULL WHERE id = ${profile.id} RETURNING ${sql.identifier(column)}`);
      if (nullable) expect((await clear(tx)).rows).toEqual([{ [column]: null }]);
      else await expectPgError(tx, clear, "23502");
    }));
});

async function createLegacyDb() {
  const before = mkdtempSync(join(tmpdir(), "neffi-0016-"));
  const client = new PGlite();
  const db = drizzle({ client });
  try {
    cpSync("drizzle", before, { recursive: true });
    const journal = JSON.parse(readFileSync(join(before, "meta/_journal.json"), "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 16);
    writeFileSync(join(before, "meta/_journal.json"), JSON.stringify(journal));
    await migrate(db, { migrationsFolder: before });
    await client.exec(`
      INSERT INTO accounts (id, name, email, role) VALUES
        ('00000000-0000-4000-8000-000000000001', 'Synthetic owner', 'owner@example.test', 'owner');
      INSERT INTO profiles (id, account_id, full_name, headline, company, location, bio, phone, email, website, image_asset_id, image_is_logo, accent_color, content_version) VALUES
        ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Synthetic person', 'Designer', 'Synthetic company', 'Quezon City', 'An existing intro', '+639000000001', 'public@example.test', 'https://example.test', 'synthetic/logo', true, '#2f6fed', 7),
        ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Unpublished person', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, 0),
        ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, '#0C0C0D', 0);
      INSERT INTO scenes (id, profile_id, name) VALUES
        ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000002', 'Main'),
        ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002', 'Events'),
        ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000003', 'Main');
      INSERT INTO form_definitions (id, profile_id, preset, title, config) VALUES
        ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000002', 'connect', 'Contact me', '{"fields":{"name":"required"},"questions":[]}');
      INSERT INTO scene_blocks (scene_id, type, position, visible, content, form_id) VALUES
        ('00000000-0000-4000-8000-000000000010', 'about', 0, true, '{"text":"Existing about text"}', NULL),
        ('00000000-0000-4000-8000-000000000010', 'contact', 1, true, '{"saveContact":true}', NULL),
        ('00000000-0000-4000-8000-000000000010', 'link', 2, false, '{"kind":"custom","url":"https://example.test/hidden"}', NULL),
        ('00000000-0000-4000-8000-000000000011', 'form', 0, true, '{}', '00000000-0000-4000-8000-000000000020');
      INSERT INTO form_submissions (form_id, profile_id, client_key, answers) VALUES
        ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000021', '[{"label":"Name","value":"Synthetic visitor"}]');
      INSERT INTO profile_links (profile_id, type, url) VALUES
        ('00000000-0000-4000-8000-000000000002', 'linkedin', 'https://example.test/in/person');
      UPDATE profiles SET status = 'published', default_scene_id = '00000000-0000-4000-8000-000000000010', active_scene_id = '00000000-0000-4000-8000-000000000011' WHERE id = '00000000-0000-4000-8000-000000000002';
      UPDATE profiles SET status = 'unpublished', default_scene_id = '00000000-0000-4000-8000-000000000012' WHERE id = '00000000-0000-4000-8000-000000000003';
      INSERT INTO products (id, kind, name, price) VALUES ('00000000-0000-4000-8000-000000000030', 'dbc', 'Synthetic DBC', 50000);
      INSERT INTO stock_purchases (id, received_on, created_by_account_id) VALUES ('00000000-0000-4000-8000-000000000031', '2026-10-01', '00000000-0000-4000-8000-000000000001');
      INSERT INTO purchasers (id, name) VALUES ('00000000-0000-4000-8000-000000000032', 'Synthetic buyer');
      INSERT INTO orders (id, purchaser_id, created_by_account_id, assigned_to_account_id) VALUES ('00000000-0000-4000-8000-000000000033', '00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
      INSERT INTO order_items (id, order_id, product_id, product_kind, quantity, unit_price) VALUES ('00000000-0000-4000-8000-000000000034', '00000000-0000-4000-8000-000000000033', '00000000-0000-4000-8000-000000000030', 'dbc', 1, 50000);
      INSERT INTO cards (stock_purchase_id, product_id, kind, state, order_item_id, public_token, owner_account_id, profile_id) VALUES ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000030', 'dbc', 'released', '00000000-0000-4000-8000-000000000034', 'SYNTH0017', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
    `);
    return db;
  } catch (error) {
    await client.close();
    throw error;
  } finally {
    rmSync(before, { recursive: true, force: true });
  }
}

test("0017 migrates default themes without changing existing profiles, accents, URLs or related content", async () => {
  const db = await createLegacyDb();
  try {
    const before = (await db.execute(sql`SELECT to_jsonb(p) - 'theme' AS data FROM profiles p ORDER BY id`)).rows;
    const tables = ["cards", "scenes", "scene_blocks", "profile_links", "form_definitions", "form_submissions"];
    const related = await Promise.all(tables.map(async (table) => (await db.execute(sql`SELECT * FROM ${sql.identifier(table)} ORDER BY id`)).rows));
    await migrate(db, { migrationsFolder: "drizzle" });
    expect((await db.execute(sql`SELECT layout, color_mode, goal FROM profiles ORDER BY id`)).rows).toEqual(
      before.map(() => ({ layout: "classic", color_mode: "light", goal: null })),
    );
    expect((await db.execute(sql`SELECT to_jsonb(p) - 'layout' - 'color_mode' - 'goal' - 'cover_asset_id' - 'cover_width' - 'cover_height' - 'cover_crop_x' - 'cover_crop_y' - 'cover_crop_width' AS data FROM profiles p ORDER BY id`)).rows).toEqual(before);
    for (const [index, table] of tables.entries()) {
      expect((await db.execute(sql`SELECT * FROM ${sql.identifier(table)} ORDER BY id`)).rows, table).toEqual(related[index]);
    }
    const journal = (await db.execute(sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`)).rows;
    await migrate(db, { migrationsFolder: "drizzle" });
    expect((await db.execute(sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`)).rows).toEqual(journal);
  } finally {
    await db.$client.close();
  }
});

test("0017 refuses an unexpected legacy theme and rolls back without discarding data", async () => {
  const db = await createLegacyDb();
  try {
    await db.execute(sql`UPDATE profiles SET theme = 'unknown-customer-theme' WHERE id = '00000000-0000-4000-8000-000000000003'`);
    const before = (await db.execute(sql`SELECT * FROM profiles ORDER BY id`)).rows;
    const journal = (await db.execute(sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`)).rows;
    await expect(migrate(db, { migrationsFolder: "drizzle" })).rejects.toMatchObject({ cause: { code: "P0001", message: expect.stringMatching(/theme/i) } });
    expect((await db.execute(sql`SELECT * FROM profiles ORDER BY id`)).rows).toEqual(before);
    expect((await db.execute(sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`)).rows).toEqual(journal);
    expect((await db.execute(sql`SELECT typname FROM pg_type WHERE typname IN ('profile_layout', 'profile_color_mode', 'profile_goal')`)).rows).toEqual([]);
  } finally {
    await db.$client.close();
  }
});
