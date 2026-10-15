"use server";
import { headers } from "next/headers";
import { consumeQuota, hmacHex } from "@/auth/otp-quota";
import { env } from "@/config/env";
import { db } from "@/db";
import { sendEmail } from "@/integrations/email/sender";
import { clientIp } from "@/lib/client-ip";
import { completeRecovery } from "@/modules/accounts/recovery";
import { recoveryCompletionSchema, RECOVERY_FAILURE, SUPPORT_LIMITS } from "@/modules/support/domain";

export type RecoveryState = { ok?: string; error?: string };
export async function completeRecoveryAction(_previous: RecoveryState | undefined, data: FormData): Promise<RecoveryState> {
  if (!await consumeQuota(db, hmacHex(env.betterAuthSecret, "recovery-ip", clientIp(await headers())), SUPPORT_LIMITS.recoveryIp)) return { error: RECOVERY_FAILURE };
  const parsed = recoveryCompletionSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: RECOVERY_FAILURE };
  const result = await completeRecovery(db, { ...parsed.data, secret: env.betterAuthSecret }, sendEmail);
  return result.ok ? { ok: "Recovery completed. Sign in with an email code at your new address." } : { error: RECOVERY_FAILURE };
}
