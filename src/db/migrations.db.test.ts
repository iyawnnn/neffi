import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { expect, test } from "vitest";
import { createTestDb } from "./testing";

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };

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
