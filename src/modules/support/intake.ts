import "server-only";
import { and, eq, gt } from "drizzle-orm";
import type { Viewer } from "@/auth/policy";
import { consumeQuota, hmacHex } from "@/auth/otp-quota";
import * as s from "@/db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { ACK_WINDOW_MS, categories, intakeSchema, SUPPORT_LIMITS } from "./domain";
import { SupportError } from "./errors";

export async function submitSupportRequest(db: Db, input: unknown, { ip, secret, viewer, now = new Date() }: { ip: string; secret: string; viewer?: Viewer | null; now?: Date }): Promise<{ caseId?: string; acknowledge: boolean }> {
  if (input && typeof input === "object" && "website" in input && input.website) return { acknowledge: false };
  const parsed = intakeSchema.safeParse(input);
  if (!parsed.success) throw new SupportError("invalid_input");
  const data = parsed.data;
  const email = (viewer?.email ?? data.email).toLowerCase();
  return db.transaction(async tx => {
    const [existing] = await tx.select({ id: s.supportCases.id }).from(s.supportCases).where(eq(s.supportCases.clientKey, data.clientKey));
    if (existing) return { caseId: existing.id, acknowledge: false };
    for (const [domain, value, limit] of [["support-global", "all", SUPPORT_LIMITS.global], ["support-ip", ip, SUPPORT_LIMITS.ip], ["support-email", email, SUPPORT_LIMITS.email]] as const) {
      if (!await consumeQuota(tx, hmacHex(secret, domain, value), limit, now)) return { acknowledge: false };
    }
    const [prior] = await tx.select({ id: s.supportCases.id }).from(s.supportCases).where(and(
      eq(s.supportCases.source, viewer ? "account" : "public"),
      viewer ? eq(s.supportCases.accountId, viewer.accountId) : eq(s.supportCases.requesterEmail, email),
      gt(s.supportCases.createdAt, new Date(now.getTime() - ACK_WINDOW_MS)),
    )).limit(1);
    const category = categories[data.category];
    const [row] = await tx.insert(s.supportCases).values({ type: category.type, summary: category.label, source: viewer ? "account" : "public", requesterEmail: viewer ? null : email, requesterName: data.name || null, requesterMessage: data.message, clientKey: data.clientKey, accountId: viewer?.accountId, openedByAccountId: viewer?.accountId, createdAt: now }).onConflictDoNothing().returning({ id: s.supportCases.id });
    if (!row) return { acknowledge: false };
    await recordActivity(tx, { type: "support_case_opened", actorAccountId: viewer?.accountId ?? null, supportCaseId: row.id, accountId: viewer?.accountId, note: viewer ? "account request" : "public request" });
    if (viewer && data.cardId) {
      const [card] = await tx.select({ id: s.cards.id }).from(s.cards).where(and(eq(s.cards.id, data.cardId), eq(s.cards.ownerAccountId, viewer.accountId)));
      if (card) {
        await tx.insert(s.supportCaseCards).values({ supportCaseId: row.id, cardId: card.id, role: "affected" });
        await recordActivity(tx, { type: "support_case_linked", actorAccountId: viewer.accountId, supportCaseId: row.id, cardId: card.id });
      }
    }
    return { caseId: row.id, acknowledge: !prior };
  });
}
