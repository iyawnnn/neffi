import "server-only";
import { asc, count, eq, ilike, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { escapeLike } from "../orders/purchasers";
import { accountAvatarUrl } from "@/lib/account-avatar";

// Display-only chrome from the stored Better Auth user; provider credentials never enter this DTO.
export async function accountHeaderDetails(db: Db, id: string) {
  const [row] = await db.select({ name: schema.accounts.name, image: schema.accounts.image }).from(schema.accounts).where(eq(schema.accounts.id, id));
  return { name: row?.name.trim() || null, image: accountAvatarUrl(row?.image) };
}

const accountMatch = (query: string) => (query ? ilike(schema.accounts.email, `%${escapeLike(query)}%`) : undefined);

export async function countAccounts(db: Db, query = "") {
  const [row] = await db.select({ total: count() }).from(schema.accounts).where(accountMatch(query));
  return row.total;
}

export function listAccounts(db: Db, query = "", { offset = 0, limit = 50 }: { offset?: number; limit?: number } = {}) {
  return db.select({ id: schema.accounts.id, email: schema.accounts.email, role: schema.accounts.role, createdAt: schema.accounts.createdAt }).from(schema.accounts).where(accountMatch(query)).orderBy(asc(schema.accounts.email), asc(schema.accounts.id)).limit(limit).offset(offset);
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
