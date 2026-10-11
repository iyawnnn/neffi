import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, test } from "vitest";
import * as schema from "./schema";

test("0010 gives every existing profile a default scene and turns its links into ordered link blocks", async () => {
  // Migrations 0000–0009 only, so the profile and links exist before 0010 runs.
  const before = mkdtempSync(join(tmpdir(), "neffi-0009-"));
  cpSync("drizzle", before, { recursive: true });
  const journal = JSON.parse(readFileSync(join(before, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 9);
  writeFileSync(join(before, "meta/_journal.json"), JSON.stringify(journal));

  const db = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: before });
  await db.execute(sql`INSERT INTO accounts (id, name, email) VALUES ('00000000-0000-4000-8000-000000000001', 'Synthetic', 'synthetic@example.test')`);
  await db.execute(sql`INSERT INTO profiles (id, account_id, status, full_name) VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'published', 'Synthetic')`);
  await db.execute(sql`INSERT INTO profile_links (profile_id, type, label, url, position, visible) VALUES
    ('00000000-0000-4000-8000-000000000002', 'custom', 'Portfolio', 'https://example.test/b', 5, false),
    ('00000000-0000-4000-8000-000000000002', 'linkedin', NULL, 'https://example.test/a', 1, true)`);

  await migrate(db, { migrationsFolder: "drizzle" });

  const { rows: [profile] } = await db.execute(sql`SELECT default_scene_id, active_scene_id FROM profiles`);
  expect(profile.default_scene_id).toBeTruthy();
  expect(profile.active_scene_id).toBeNull();
  const { rows: blocks } = await db.execute(sql`SELECT type, position, visible, content FROM scene_blocks WHERE scene_id = ${profile.default_scene_id} ORDER BY position`);
  expect(blocks).toEqual([
    { type: "link", position: 0, visible: true, content: { kind: "linkedin", url: "https://example.test/a" } },
    { type: "link", position: 1, visible: false, content: { kind: "custom", label: "Portfolio", url: "https://example.test/b" } },
  ]);
  const { rows: legacy } = await db.execute(sql`SELECT count(*)::int AS n FROM profile_links`);
  expect(legacy[0].n).toBe(2);
});
