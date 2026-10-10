// Test-only: a real Postgres (PGlite, in-process) migrated from zero with the committed migrations,
// so database invariants are tested exactly as they ship, without credentials or a shared database.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect } from "vitest";
import * as schema from "./schema";

export async function createTestDb() {
  const db = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
export type TestTx = Parameters<Parameters<TestDb["transaction"]>[0]>[0];

class Rollback extends Error {}

// Runs `fn` in a transaction that is always rolled back, so tests sharing one database stay independent.
export async function rollback(db: TestDb, fn: (tx: TestTx) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

type PgError = { code?: string; constraint?: string; message?: string };

// The failing statement runs in a savepoint: an error would otherwise abort the surrounding test transaction.
export async function expectPgError(
  tx: TestTx,
  fn: (savepoint: TestTx) => Promise<unknown>,
  code: string,
  constraint?: string,
): Promise<void> {
  const error = await tx.transaction(async (savepoint) => {
    await fn(savepoint);
  }).then(
    () => undefined,
    (thrown: { cause?: PgError } & PgError) => thrown.cause ?? thrown,
  );
  expect(error, "expected the database to reject this").toBeDefined();
  expect(error?.code, error?.message).toBe(code);
  if (constraint) expect(error?.constraint).toBe(constraint);
}
