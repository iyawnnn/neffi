import { eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { accounts, accountRecoveries, activationCredentials, cards } from "./schema";
import { countRows, SEED_IDS, seed } from "./seed";
import { createTestDb, type TestDb } from "./testing";
import { ACCENTS } from "../modules/profiles/appearance-options";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "development");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DATABASE_URL_UNPOOLED", "postgresql://seed:synthetic@seed.example.invalid/neffi");
});
afterEach(() => vi.unstubAllEnvs());

test.each([
  { VERCEL_ENV: undefined, NODE_ENV: undefined },
  { VERCEL_ENV: "", NODE_ENV: "development" },
  { VERCEL_ENV: undefined, NODE_ENV: "production" },
  { VERCEL_ENV: "preview", NODE_ENV: "development" },
  { VERCEL_ENV: "production", NODE_ENV: "development" },
  { VERCEL_ENV: "staging", NODE_ENV: "development" },
  { VERCEL_ENV: "development", NODE_ENV: "production" },
  { VERCEL_ENV: "development", NODE_ENV: "test" },
  { VERCEL_ENV: "development", NODE_ENV: "staging" },
  { VERCEL_ENV: "development", NODE_ENV: "" },
])("seed refuses a non-development context before resetting data: %j", async (env) => {
  await seed(db);
  const [sentinel] = await db.insert(accounts).values({ name: "Keep me", email: "keep@example.test" }).returning();
  vi.stubEnv("VERCEL_ENV", env.VERCEL_ENV);
  vi.stubEnv("NODE_ENV", env.NODE_ENV);

  await expect(seed(db)).rejects.toThrow(/development/);
  expect(await db.select().from(accounts).where(eq(accounts.id, sentinel.id))).toHaveLength(1);
});

test.each([undefined, "", "not-a-url", "postgresql://seed:synthetic@seed.example.invalid/neffi?host=other.invalid"])(
  "seed enforces migration URL validation/isolation at the sink: %s",
  async (url) => {
    await seed(db);
    const before = await countRows(db);
    vi.stubEnv("DATABASE_URL_UNPOOLED", url);
    await expect(seed(db)).rejects.toThrow(/DATABASE_URL/);
    expect(await countRows(db)).toEqual(before);
  },
);

test("the development seed is deterministic and re-runnable", async () => {
  await seed(db);
  const first = await countRows(db);
  await seed(db);
  const second = await countRows(db);

  expect(second).toEqual(first);
  // Every domain table is exercised; no sign-in exists yet, so identities, sessions and verifications stay empty.
  const authOnly = ["auth_identities", "auth_sessions", "auth_verifications", "auth_rate_limits", "auth_otp_quotas"];
  expect(Object.entries(first).filter(([table, n]) => !authOnly.includes(table) && table !== "account_recoveries" && n === 0)).toEqual([]);
  expect(first.account_recoveries).toBe(0);
  expect(authOnly.map((table) => first[table])).toEqual([0, 0, 0, 0, 0]);
  const [owner] = await db.select().from(accounts).where(eq(accounts.id, SEED_IDS.ownerOne));
  expect(owner.email).toMatch(/@example\.test$/);
});

test("seeded credentials are lookup values only; no activation code exists for them", async () => {
  await seed(db);
  const credentials = await db.select({ lookupHmac: activationCredentials.lookupHmac }).from(activationCredentials);
  expect(credentials.length).toBeGreaterThan(0);
  for (const { lookupHmac } of credentials) expect(lookupHmac).toMatch(/^5eed0{56}[0-9a-f]{4}$/);
});

test("seed profiles cover all layouts and colour modes with curated accents and an optional Goal", async () => {
  await seed(db);
  const rows = (await db.execute(sql`SELECT layout, color_mode, goal, accent_color FROM profiles`)).rows;
  expect(new Set(rows.map((row) => row.layout))).toEqual(new Set(["classic", "editorial", "showcase"]));
  expect(new Set(rows.map((row) => row.color_mode))).toEqual(new Set(["light", "dark"]));
  expect(rows.some((row) => row.goal === "freelance")).toBe(true);
  expect(rows.some((row) => row.goal === null)).toBe(true);
  for (const row of rows) expect(ACCENTS.map((accent) => accent.hex)).toContain(row.accent_color);
});

test("seed cleanup includes recovery history without relying on cascade", async () => {
  await seed(db);
  await db.insert(accountRecoveries).values({ supportCaseId: SEED_IDS.supportCaseDefective, accountId: SEED_IDS.customerAna, oldEmail: "synthetic@example.test", newEmail: "recovery@example.test", codeHmac: "a".repeat(64), expiresAt: new Date(0), createdByAccountId: SEED_IDS.ownerOne });
  await seed(db);
  expect((await countRows(db)).account_recoveries).toBe(0);
});

test("seed refuses to reset an unlisted table linked by a foreign key", async () => {
  await seed(db);
  await db.execute(sql`CREATE TABLE seed_external_reference (account_id uuid REFERENCES public.accounts(id))`);
  try {
    await db.execute(sql`INSERT INTO seed_external_reference VALUES (${SEED_IDS.ownerOne})`);
    const before = await countRows(db);
    await expect(seed(db)).rejects.toMatchObject({ cause: { code: "0A000" } });
    expect((await db.execute(sql`SELECT * FROM seed_external_reference`)).rows).toHaveLength(1);
    expect(await countRows(db)).toEqual(before);
  } finally {
    await db.execute(sql`DROP TABLE seed_external_reference`);
  }
});

test("seed preserves unrelated tables and migration history", async () => {
  await db.execute(sql`CREATE TABLE seed_unrelated (value text)`);
  try {
    await db.execute(sql`INSERT INTO seed_unrelated VALUES ('keep')`);
    const migrations = (await db.execute(sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`)).rows;
    await seed(db);
    expect((await db.execute(sql`SELECT * FROM seed_unrelated`)).rows).toEqual([{ value: "keep" }]);
    expect((await db.execute(sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`)).rows).toEqual(migrations);
  } finally {
    await db.execute(sql`DROP TABLE seed_unrelated`);
  }
});

test("the seed claims no physical provisioning evidence and holds no Ready DBC", async () => {
  await seed(db);
  const all = await db.select().from(cards);
  expect(all.filter((card) => card.nfcVerifiedAt !== null || card.packageMatchedAt !== null)).toEqual([]);
  expect(all.filter((card) => card.kind === "dbc" && card.state === "ready")).toEqual([]);
  expect(all.find((card) => card.id === SEED_IDS.cardProvisioningDbc)?.state).toBe("blank");
});
