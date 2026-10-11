import "server-only";
import { env } from "@/config/env";
import { createResendSender } from "./resend";

// One EmailService instance for the app: sign-in codes and inquiry notifications share the sender address.
export const sendEmail = createResendSender({ apiKey: env.resendApiKey, from: env.authEmailFrom });
