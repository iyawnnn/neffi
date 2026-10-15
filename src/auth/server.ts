import "server-only";
import { after } from "next/server";
import { betterAuth } from "better-auth/minimal";
import { env } from "@/config/env";
import { db } from "@/db";
import { sendEmail } from "@/integrations/email/sender";
import { authCodeEmail, changeEmailCodeEmail } from "@/integrations/email/resend";
import { authOptions } from "./options";
import { sendSecurityNotice } from "@/modules/accounts/security-notice";

export const auth = betterAuth(
  authOptions({
    db,
    secret: env.betterAuthSecret,
    baseURL: env.authBaseUrl,
    google: { clientId: env.googleClientId, clientSecret: env.googleClientSecret },
    sendAuthCode: ({ email, code, type }) => sendEmail({ to: email, ...(type === "change-email" ? changeEmailCodeEmail(code, 5) : authCodeEmail(code, 5)) }),
    onGoogleConnected: async ({ accountId, email }) => {
      const attemptId = crypto.randomUUID(); const at = new Date();
      after(() => sendSecurityNotice(db, { accountId, actorId: accountId, kind: "google_connected", attemptId, at, recipients: [{ to: email, slot: "current" }] }, sendEmail));
    },
  }),
);
