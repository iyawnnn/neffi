"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { getViewer } from "@/auth/access";
import { env } from "@/config/env";
import { db } from "@/db";
import { sendEmail } from "@/integrations/email/sender";
import { clientIp } from "@/lib/client-ip";
import { intakeSchema, SUPPORT_SUCCESS } from "@/modules/support/domain";
import { dispatchCaseEmail } from "@/modules/support/email";
import { SupportError } from "@/modules/support/errors";
import { submitSupportRequest } from "@/modules/support/intake";

export type SupportState = { ok?: string; error?: string };
export async function submitSupportAction(_previous: SupportState | undefined, data: FormData): Promise<SupportState> {
  if (data.get("website")) return { ok: SUPPORT_SUCCESS };
  const viewer = await getViewer();
  const parsed = intakeSchema.safeParse({ ...Object.fromEntries(data), ...(viewer ? { email: viewer.email } : {}) });
  if (!parsed.success) return { error: "Check your email and message. Messages can be up to 2,000 characters." };
  try {
    const result = await submitSupportRequest(db, parsed.data, { ip: clientIp(await headers()), secret: env.betterAuthSecret, viewer });
    if (result.caseId && result.acknowledge) after(async () => {
      try {
        await dispatchCaseEmail(db, { caseId: result.caseId!, actorId: viewer?.accountId ?? null, kind: "acknowledgement", attemptId: parsed.data.clientKey }, sendEmail, env.supportReplyTo);
      } catch { /* The case is persisted; email cannot change the public result. */ }
    });
    return { ok: SUPPORT_SUCCESS };
  } catch (error) {
    if (error instanceof SupportError && error.code === "invalid_input") return { error: "Check the fields and try again." };
    throw error;
  }
}
