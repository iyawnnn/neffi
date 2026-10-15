import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import * as s from "@/db/schema";
import type { EmailSender } from "@/integrations/email/resend";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { withCase } from "../support/case";
import { containsStoredCredential } from "../support/credentials";
import { verificationSchema } from "../support/domain";
import { SupportError } from "../support/errors";
import { lockCustomerAccount } from "./recovery";
import { sendSecurityNotice } from "./security-notice";

export async function secureAccount(db: Db, input: { caseId: string; actorId: string } & Record<string, unknown>, send: EmailSender) {
  const parsed = verificationSchema.safeParse(input);
  if (!parsed.success || containsStoredCredential(parsed.data.verificationNote)) throw new SupportError("invalid_input");
  const account = await withCase(db, input, async (tx, row) => {
    const target = await lockCustomerAccount(tx, row.accountId);
    if (parsed.data.unlinkGoogle && !target.emailVerified) throw new SupportError("checks_incomplete");
    await tx.delete(s.authSessions).where(eq(s.authSessions.userId, target.id));
    await recordActivity(tx, { type: "account_sessions_revoked", actorAccountId: input.actorId, accountId: target.id, supportCaseId: row.id, note: parsed.data.verificationNote });
    if (parsed.data.unlinkGoogle) {
      const removed = await tx.delete(s.authIdentities).where(and(eq(s.authIdentities.userId, target.id), eq(s.authIdentities.providerId, "google"))).returning({ id: s.authIdentities.id });
      if (removed.length) await recordActivity(tx, { type: "account_google_removed", actorAccountId: input.actorId, accountId: target.id, supportCaseId: row.id });
    }
    return target;
  });
  await sendSecurityNotice(db, { accountId: account.id, caseId: input.caseId, actorId: input.actorId, kind: "account_secured", attemptId: randomUUID(), at: new Date(), recipients: [{ to: account.email, slot: "current" }] }, send);
}
