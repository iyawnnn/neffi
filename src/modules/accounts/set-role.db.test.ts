import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { accounts, activityEvents } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/testing";
import { setAccountRole } from "./set-role";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});

const insertAccount = async (email: string, role: "customer" | "owner" = "customer") =>
  (await db.insert(accounts).values({ name: "Synthetic", email, emailVerified: true, role }).returning())[0];
const eventsFor = (accountId: string) => db.select().from(activityEvents).where(eq(activityEvents.accountId, accountId));

describe("setAccountRole", () => {
  test("promotes a customer to owner and records who/what in one activity event", async () => {
    const account = await insertAccount("promote@example.test");
    const result = await setAccountRole(db, "Promote@Example.test", "owner");
    expect(result).toEqual({ accountId: account.id, from: "customer", to: "owner", changed: true });

    const [after] = await db.select().from(accounts).where(eq(accounts.id, account.id));
    expect(after.role).toBe("owner");
    const events = await eventsFor(account.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "account_role_changed", note: "customer→owner" });
  });

  test("demotes an owner back to customer", async () => {
    const account = await insertAccount("demote@example.test", "owner");
    expect(await setAccountRole(db, "demote@example.test", "customer")).toMatchObject({ from: "owner", to: "customer", changed: true });
    expect((await db.select().from(accounts).where(eq(accounts.id, account.id)))[0].role).toBe("customer");
  });

  test("setting the role an Account already has changes and records nothing", async () => {
    const account = await insertAccount("same@example.test", "owner");
    expect(await setAccountRole(db, "same@example.test", "owner")).toMatchObject({ changed: false });
    expect(await eventsFor(account.id)).toHaveLength(0);
  });

  test("an unknown email is an error and writes nothing", async () => {
    const before = await db.select().from(activityEvents);
    await expect(setAccountRole(db, "nobody@example.test", "owner")).rejects.toThrow("No account with that email");
    expect(await db.select().from(accounts).where(eq(accounts.email, "nobody@example.test"))).toHaveLength(0);
    expect(await db.select().from(activityEvents)).toEqual(before);
  });

  test("only the two known roles are accepted", async () => {
    const account = await insertAccount("bad-role@example.test");
    await expect(setAccountRole(db, "bad-role@example.test", "admin" as never)).rejects.toThrow("Role must be");
    expect((await db.select().from(accounts).where(eq(accounts.id, account.id)))[0].role).toBe("customer");
    expect(await eventsFor(account.id)).toHaveLength(0);
  });

  test("case-variant accounts are ambiguous and neither is changed or audited", async () => {
    const first = await insertAccount("ambiguous@example.test");
    const second = await insertAccount("Ambiguous@example.test");
    await expect(setAccountRole(db, "AMBIGUOUS@example.test", "owner")).rejects.toThrow("Ambiguous account email");
    for (const account of [first, second]) {
      expect((await db.select().from(accounts).where(eq(accounts.id, account.id)))[0].role).toBe("customer");
      expect(await eventsFor(account.id)).toHaveLength(0);
    }
  });

  test("the role change and its event succeed or fail together", async () => {
    const account = await insertAccount("atomic@example.test");
    // Force audit failure to prove the preceding role update rolls back.
    await db.execute(`create function fail_event() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$` as never);
    await db.execute(`create trigger fail_event before insert on activity_events for each row execute function fail_event()` as never);
    try {
      await expect(setAccountRole(db, "atomic@example.test", "owner")).rejects.toThrow();
    } finally {
      await db.execute(`drop trigger fail_event on activity_events` as never);
      await db.execute(`drop function fail_event()` as never);
    }
    expect((await db.select().from(accounts).where(eq(accounts.id, account.id)))[0].role).toBe("customer");
    expect(await eventsFor(account.id)).toHaveLength(0);
  });
});
