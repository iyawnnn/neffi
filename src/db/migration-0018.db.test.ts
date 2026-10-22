import { sql } from "drizzle-orm";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, expect, test } from "vitest";
import { insertAccount, insertProfile } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
afterAll(async () => { await db.$client.close(); });

test("0018 preserves existing profiles and needs no backfill", async () => {
  const folder = mkdtempSync(join(tmpdir(), "neffi-0017-cover-"));
  const client = new PGlite();
  try {
    cpSync("drizzle", folder, { recursive: true });
    const journal = JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 17);
    writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(journal));
    const legacy = drizzle({ client });
    await migrate(legacy, { migrationsFolder: folder });
    await client.exec("INSERT INTO accounts (id, name, email) VALUES ('00000000-0000-4000-8000-000000000001', 'Synthetic', 'cover@example.invalid'); INSERT INTO profiles (account_id, full_name, image_asset_id, content_version) VALUES ('00000000-0000-4000-8000-000000000001', 'Existing person', 'existing/photo', 42)");
    const before = await client.query("SELECT * FROM profiles");
    await migrate(legacy, { migrationsFolder: "drizzle" });
    const after = await client.query<Record<string, unknown>>("SELECT * FROM profiles");
    const fields = ["cover_asset_id", "cover_width", "cover_height", "cover_crop_x", "cover_crop_y", "cover_crop_width"];
    for (const key of fields) { expect(after.rows[0][key]).toBeNull(); delete after.rows[0][key]; }
    expect(after.rows).toEqual(before.rows);
  } finally {
    await client.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("profiles default to a wholly null cover without backfill", () => rollback(db, async tx => {
  const profile = await insertProfile(tx, (await insertAccount(tx)).id);
  const { rows: [row] } = await tx.execute(sql`SELECT cover_asset_id, cover_width, cover_height, cover_crop_x, cover_crop_y, cover_crop_width FROM profiles WHERE id = ${profile.id}`);
  expect(Object.values(row)).toEqual([null, null, null, null, null, null]);
}));

test("coherent cover, inclusive edges and round(width/3) are accepted", () => rollback(db, async tx => {
  const profile = await insertProfile(tx, (await insertAccount(tx)).id);
  await tx.execute(sql`UPDATE profiles SET cover_asset_id = 'synthetic-cover', cover_width = 601, cover_height = 200, cover_crop_x = 0, cover_crop_y = 0, cover_crop_width = 601 WHERE id = ${profile.id}`);
  await tx.execute(sql`UPDATE profiles SET cover_asset_id = NULL, cover_width = NULL, cover_height = NULL, cover_crop_x = NULL, cover_crop_y = NULL, cover_crop_width = NULL WHERE id = ${profile.id}`);
}));

test("every partial tuple and invalid bound is rejected by database CHECKs", () => rollback(db, async tx => {
  const profile = await insertProfile(tx, (await insertAccount(tx)).id);
  const valid = { cover_asset_id: "synthetic-cover", cover_width: 1200, cover_height: 400, cover_crop_x: 0, cover_crop_y: 0, cover_crop_width: 1200 };
  const invalid = [
    ...Object.keys(valid).map(key => ({ ...valid, [key]: null })),
    ...Object.keys(valid).map(key => ({ ...Object.fromEntries(Object.keys(valid).map(key => [key, null])), [key]: valid[key as keyof typeof valid] })),
    { ...valid, cover_width: 0 }, { ...valid, cover_height: -1 },
    { ...valid, cover_crop_x: -1 }, { ...valid, cover_crop_y: -1 },
    { ...valid, cover_crop_width: 599 }, { ...valid, cover_crop_x: 1 }, { ...valid, cover_crop_y: 1 },
    { ...valid, cover_crop_width: 602, cover_height: 200 },
  ];
  for (const values of invalid) {
    const sets = sql.join(Object.entries(values).map(([key, value]) => sql`${sql.identifier(key)} = ${value}`), sql`, `);
    await expectPgError(tx, s => s.execute(sql`UPDATE profiles SET ${sets} WHERE id = ${profile.id}`), "23514");
  }
}));
