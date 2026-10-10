import "server-only";
import { betterAuth } from "better-auth/minimal";
import { env } from "@/config/env";
import { db } from "@/db";
import { authCodeEmail, createResendSender } from "@/integrations/email/resend";
import { authOptions } from "./options";

const sendEmail = createResendSender({ apiKey: env.resendApiKey, from: env.authEmailFrom });

export const auth = betterAuth(
  authOptions({
    db,
    secret: env.betterAuthSecret,
    baseURL: env.authBaseUrl,
    google: { clientId: env.googleClientId, clientSecret: env.googleClientSecret },
    sendAuthCode: ({ email, code }) => sendEmail({ to: email, ...authCodeEmail(code, 5) }),
  }),
);
