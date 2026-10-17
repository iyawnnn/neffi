import "server-only";
import { asc, eq, ilike, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { escapeLike } from "../orders/purchasers";

// Display-only: the Google profile name, when there is one (email-code sign-ups have an empty name).
export async function accountDisplayName(db: Db, id: string): Promise<string | null> {
  const [row] = await db.select({ name: schema.accounts.name }).from(schema.accounts).where(eq(schema.accounts.id, id));
  return row?.name.trim() || null;
}

export function listAccounts(db: Db, query = "") {
  return db.select({ id: schema.accounts.id, email: schema.accounts.email, role: schema.accounts.role, createdAt: schema.accounts.createdAt }).from(schema.accounts).where(query ? ilike(schema.accounts.email, `%${escapeLike(query)}%`) : undefined).orderBy(asc(schema.accounts.email)).limit(50);
}

export async function accountDirectoryDetail(db: Db, id: string) {
  const [account] = await db.select({ email: schema.accounts.email, role: schema.accounts.role, createdAt: schema.accounts.createdAt }).from(schema.accounts).where(eq(schema.accounts.id, id));
  if (!account) return null;
  const [google, cards, profiles] = await Promise.all([
    db.select({ provider: schema.authIdentities.providerId }).from(schema.authIdentities).where(sql`${schema.authIdentities.userId} = ${id} AND ${schema.authIdentities.providerId} = 'google'`).limit(1),
    db.select({ state: schema.cards.state, disabled: sql<boolean>`${schema.cards.disabledAt} IS NOT NULL`, tokenSuffix: sql<string>`right(${schema.cards.publicToken}, 4)`, profileName: schema.profiles.fullName, profileStatus: schema.profiles.status }).from(schema.cards).leftJoin(schema.profiles, eq(schema.profiles.id, schema.cards.profileId)).where(eq(schema.cards.ownerAccountId, id)).orderBy(asc(schema.cards.createdAt), asc(schema.cards.id)),
    db.select({ name: schema.profiles.fullName, status: schema.profiles.status }).from(schema.profiles).where(eq(schema.profiles.accountId, id)).orderBy(asc(schema.profiles.createdAt), asc(schema.profiles.id)),
  ]);
  return { ...account, methods: google.length ? ["email", "google"] : ["email"], cards, profiles };
}
