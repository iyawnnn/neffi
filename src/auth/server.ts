import "server-only";
import { betterAuth } from "better-auth/minimal";
import { env } from "@/config/env";
import { db } from "@/db";
import { sendEmail } from "@/integrations/email/sender";
import { authCodeEmail, changeEmailCodeEmail } from "@/integrations/email/resend";
import { authOptions } from "./options";

export const auth = betterAuth(
  authOptions({
    db,
    secret: env.betterAuthSecret,
    baseURL: env.authBaseUrl,
    google: { clientId: env.googleClientId, clientSecret: env.googleClientSecret },
    sendAuthCode: ({ email, code, type }) => sendEmail({ to: email, ...(type === "change-email" ? changeEmailCodeEmail(code, 5) : authCodeEmail(code, 5)) }),
  }),
);
