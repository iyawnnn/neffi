import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { accounts, activationCredentials } from "./schema";
import { countRows, SEED_IDS, seed } from "./seed";
import { createTestDb, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

test("the development seed is deterministic and re-runnable", async () => {
  await seed(db);
  const first = await countRows(db);
  await seed(db);
  const second = await countRows(db);

  expect(second).toEqual(first);
  // Every domain table is exercised; no sign-in exists yet, so identities, sessions and verifications stay empty.
  const authOnly = ["auth_identities", "auth_sessions", "auth_verifications"];
  expect(Object.entries(first).filter(([table, n]) => !authOnly.includes(table) && n === 0)).toEqual([]);
  expect(authOnly.map((table) => first[table])).toEqual([0, 0, 0]);
  const [owner] = await db.select().from(accounts).where(eq(accounts.id, SEED_IDS.ownerOne));
  expect(owner.email).toMatch(/@example\.test$/);
});

test("seeded credentials are lookup values only; no activation code exists for them", async () => {
  await seed(db);
  const credentials = await db.select({ lookupHmac: activationCredentials.lookupHmac }).from(activationCredentials);
  expect(credentials.length).toBeGreaterThan(0);
  for (const { lookupHmac } of credentials) expect(lookupHmac).toMatch(/^5eed0{56}[0-9a-f]{4}$/);
});
