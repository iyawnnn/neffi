import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { hmacHex } from "@/auth/otp-quota";
import * as s from "@/db/schema";
import type { EmailSender } from "@/integrations/email/resend";
import { recoveryCodeEmail } from "@/integrations/email/support-templates";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { withCase } from "../support/case";
import { containsActivationCode } from "../support/credentials";
import { recoveryInitiationSchema, RECOVERY_LIFETIME_MS } from "../support/domain";
import { SupportError } from "../support/errors";
import { sendSecurityNotice } from "./security-notice";

export const recoveryLookup = (secret: string, id: string, code: string) => hmacHex(secret, "account-recovery", `${id}:${code}`);
export async function lockCustomerAccount(tx: Db, accountId: string | null) {
  if (!accountId) throw new SupportError("customer_required");
  const [account] = await tx.select().from(s.accounts).where(eq(s.accounts.id, accountId)).for("update");
  if (!account || account.role !== "customer") throw new SupportError("customer_required");
  return account;
}
export async function emailOccupied(db: Db, email: string) {
  const [account] = await db.select({ id: s.accounts.id }).from(s.accounts).where(sql`lower(${s.accounts.email}) = ${email.toLowerCase()}`).limit(1);
  return Boolean(account);
}
export function pgCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

export async function initiateRecovery(db: Db, input: { caseId: string; actorId: string; secret: string; now?: Date } & Record<string, unknown>, send: EmailSender) {
  const parsed = recoveryInitiationSchema.safeParse(input);
  if (!parsed.success || containsActivationCode(parsed.data.verificationNote)) throw new SupportError("invalid_input");
  const data = parsed.data; const now = input.now ?? new Date();
  const recoveryId = randomUUID(); const code = String(randomInt(100000000)).padStart(8, "0");
  let account: typeof s.accounts.$inferSelect;
  try {
    account = await withCase(db, input, async (tx, row) => {
      if (row.type !== "account_recovery") throw new SupportError("invalid_input");
      const target = await lockCustomerAccount(tx, row.accountId);
      if (await emailOccupied(tx, data.newEmail)) throw new SupportError("email_taken");
      const pending = await tx.select().from(s.accountRecoveries).where(and(eq(s.accountRecoveries.status, "pending"), or(eq(s.accountRecoveries.accountId, target.id), eq(s.accountRecoveries.newEmail, data.newEmail)))).orderBy(s.accountRecoveries.id).for("update");
      if (pending.some(recovery => recovery.expiresAt > now)) throw new SupportError("recovery_live");
      for (const expired of pending) {
        await tx.update(s.accountRecoveries).set({ status: "cancelled", cancelledAt: now, updatedAt: now }).where(eq(s.accountRecoveries.id, expired.id));
        await recordActivity(tx, { type: "account_recovery_cancelled", actorAccountId: input.actorId, supportCaseId: expired.supportCaseId, note: `expired ${expired.id}` });
      }
      await tx.insert(s.accountRecoveries).values({ id: recoveryId, supportCaseId: row.id, accountId: target.id, oldEmail: target.email, newEmail: data.newEmail, codeHmac: recoveryLookup(input.secret, recoveryId, code), unlinkGoogle: data.unlinkGoogle, expiresAt: new Date(now.getTime() + RECOVERY_LIFETIME_MS), createdByAccountId: input.actorId, createdAt: now });
      await recordActivity(tx, { type: "account_recovery_started", actorAccountId: input.actorId, accountId: target.id, supportCaseId: row.id, note: data.verificationNote });
      return target;
    });
  } catch (error) {
    if (pgCode(error) === "23505") throw new SupportError("recovery_live");
    throw error;
  }
  let sent = true;
  try { await send({ to: data.newEmail, ...recoveryCodeEmail(code, now), idempotencyKey: `recovery-code-${recoveryId}` }); }
  catch { sent = false; }
  await recordActivity(db, { type: sent ? "support_email_sent" : "support_email_failed", actorAccountId: input.actorId, accountId: account.id, supportCaseId: input.caseId, note: `recovery_code ${recoveryId}` });
  await sendSecurityNotice(db, { accountId: account.id, caseId: input.caseId, actorId: input.actorId, kind: "recovery_started", attemptId: recoveryId, at: now, recipients: [{ to: account.email, slot: "old" }] }, send);
  return { recoveryId };
}

export async function cancelRecovery(db: Db, input: { caseId: string; actorId: string; recoveryId: string }) {
  return withCase(db, input, async tx => {
    const [row] = await tx.select().from(s.accountRecoveries).where(and(eq(s.accountRecoveries.id, input.recoveryId), eq(s.accountRecoveries.supportCaseId, input.caseId))).for("update");
    if (!row || row.status !== "pending") throw new SupportError("invalid_input");
    const now = new Date();
    await tx.update(s.accountRecoveries).set({ status: "cancelled", cancelledAt: now, updatedAt: now }).where(eq(s.accountRecoveries.id, row.id));
    await recordActivity(tx, { type: "account_recovery_cancelled", actorAccountId: input.actorId, supportCaseId: input.caseId, note: row.id });
  });
}
