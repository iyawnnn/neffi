import "server-only";
import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";

type AccountsDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function setAccountRole(db: AccountsDb, email: string, role: "owner" | "customer") {
  if (role !== "owner" && role !== "customer") throw new Error("Role must be owner or customer");

  return db.transaction(async (tx) => {
    // Lock before reading the old role so concurrent grants produce accurate audit transitions.
    const matches = await tx.select({ id: schema.accounts.id, role: schema.accounts.role })
      .from(schema.accounts)
      .where(sql`lower(${schema.accounts.email}) = ${email.toLowerCase()}`)
      .orderBy(schema.accounts.id)
      .for("update");
    if (matches.length === 0) throw new Error("No account with that email");
    if (matches.length !== 1) throw new Error("Ambiguous account email");
    const account = matches[0];
    const changed = account.role !== role;
    if (changed) {
      await tx.update(schema.accounts).set({ role }).where(eq(schema.accounts.id, account.id));
      await tx.insert(schema.activityEvents).values({
        type: "account_role_changed", accountId: account.id, note: `${account.role}→${role}`,
      });
    }
    return { accountId: account.id, from: account.role, to: role, changed };
  });
}
