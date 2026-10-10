import { betterAuth } from "better-auth/minimal";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { authOptions } from "@/auth/options";
import { accounts, authIdentities, authSessions } from "./schema";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const account = (email: string) => ({ name: "Synthetic Person", email });

describe("Account / Authentication Identity integrity", () => {
  test("an email can belong to only one Account", () =>
    rollback(db, async (tx) => {
      await tx.insert(accounts).values(account("one@example.test"));
      await expectPgError(tx, (s) => s.insert(accounts).values(account("one@example.test")), "23505", "accounts_email_unique");
    }));

  test("a provider identity can attach to only one Account", () =>
    rollback(db, async (tx) => {
      const [a, b] = await tx.insert(accounts).values([account("a@example.test"), account("b@example.test")]).returning();
      const identity = { providerId: "google", accountId: "google-subject-1" };
      await tx.insert(authIdentities).values({ ...identity, userId: a.id });
      await expectPgError(
        tx,
        (s) => s.insert(authIdentities).values({ ...identity, userId: b.id }),
        "23505",
        "auth_identities_provider_identity_unique",
      );
    }));

  test("session tokens are unique", () =>
    rollback(db, async (tx) => {
      const [a] = await tx.insert(accounts).values(account("s@example.test")).returning();
      const session = { token: "synthetic-token", userId: a.id, expiresAt: new Date(Date.now() + 60_000) };
      await tx.insert(authSessions).values(session);
      await expectPgError(tx, (s) => s.insert(authSessions).values(session), "23505", "auth_sessions_token_unique");
    }));

  test("sessions and identities go with their Account; they carry no business history", () =>
    rollback(db, async (tx) => {
      const [a] = await tx.insert(accounts).values(account("c@example.test")).returning();
      await tx.insert(authIdentities).values({ providerId: "google", accountId: "google-subject-2", userId: a.id });
      await tx.insert(authSessions).values({ token: "t-2", userId: a.id, expiresAt: new Date(Date.now() + 60_000) });
      await tx.delete(accounts).where(eq(accounts.id, a.id));
      const { rows } = await tx.execute<{ n: number }>(
        sql`select (select count(*) from auth_identities) + (select count(*) from auth_sessions) as n`,
      );
      expect(Number(rows[0].n)).toBe(0);
    }));
});

describe("Better Auth persists through the Neffi schema", () => {
  test("users, identities, sessions and verifications round-trip with database-generated ids", async () => {
    const auth = betterAuth(
      authOptions({ db, secret: "test-only-secret-not-used-anywhere-0123456789", baseURL: "http://localhost:3000" }),
    );
    const { internalAdapter } = await auth.$context;

    const user = await internalAdapter.createUser(
      { name: "Round Trip", email: "Round.Trip@Example.test" },
      { method: "admin" },
    );
    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(user.email).toBe("round.trip@example.test");
    expect((user as typeof user & { role: string }).role).toBe("customer");

    await internalAdapter.linkAccount({ userId: user.id, providerId: "google", accountId: "google-subject-rt" });
    const [identity] = await db.select().from(authIdentities).where(eq(authIdentities.accountId, "google-subject-rt"));
    expect(identity.userId).toBe(user.id);

    const session = await internalAdapter.createSession(user.id);
    expect((await internalAdapter.findSession(session.token))?.user.id).toBe(user.id);

    await internalAdapter.createVerificationValue({
      identifier: "round-trip",
      value: "synthetic",
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect((await internalAdapter.findVerificationValue("round-trip"))?.value).toBe("synthetic");
  });
});
