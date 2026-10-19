import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { expect, test } from "vitest";
import { createTestDb } from "./testing";

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };

test("social platform migration is additive only and matches the PostgreSQL enum", async () => {
  const additions = ["threads", "discord", "reddit", "pinterest", "behance", "dribbble"];
  const prior = JSON.parse(readFileSync("drizzle/meta/0015_snapshot.json", "utf8")).enums["public.profile_link_type"].values as string[];
  const migration = readFileSync("drizzle/0016_extend_social_platforms.sql", "utf8");
  expect(migration.split("--> statement-breakpoint").map(statement => statement.trim())).toEqual(
    additions.map(kind => `ALTER TYPE "public"."profile_link_type" ADD VALUE '${kind}';`),
  );
  const db = await createTestDb();
  const { rows } = await db.execute<{ value: string }>(sql`select enumlabel as value from pg_enum where enumtypid = 'profile_link_type'::regtype order by enumsortorder`);
  expect(rows.map(row => row.value)).toEqual([...prior, ...additions]);
});

test("every committed migration applies to an empty database", async () => {
  const db = await createTestDb();
  const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
  expect(rows[0].n).toBe(journal.entries.length);
});

test("the DBC ready-checks constraint is validated after migration from zero", async () => {
  const db = await createTestDb();
  const { rows } = await db.execute<{ convalidated: boolean }>(sql`select convalidated from pg_constraint where conrelid = 'cards'::regclass and conname = 'cards_dbc_ready_checks_recorded'`);
  expect(rows).toEqual([{ convalidated: true }]);
});
