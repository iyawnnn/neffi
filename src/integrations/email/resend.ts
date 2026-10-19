import "server-only";
import { renderEmail, type EmailMessage } from "./layout";

export type Email = EmailMessage & { to: string; replyTo?: string; idempotencyKey?: string };
export type EmailSender = (email: Email) => Promise<void>;

type ResendConfig = { apiKey: string; from: string; origin: string };

// EmailService boundary for Resend. HTML with a generated plain-text alternative, no tracking. Failures are
// deliberately opaque: the provider's response, the recipient and the message body (which holds a sign-in code)
// must never reach logs or Sentry.
export function createResendSender({ apiKey, from, origin }: ResendConfig): EmailSender {
  return async ({ to, replyTo, idempotencyKey, ...message }) => {
    const { subject, text, html } = renderEmail(message, origin);
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // Caller-supplied for notifications; random for sign-in codes, never derived from the code.
          "Idempotency-Key": idempotencyKey ?? crypto.randomUUID(),
        },
        body: JSON.stringify({ from, to: [to], subject, text, html, ...(replyTo ? { reply_to: [replyTo] } : {}) }),
      });
    } catch {
      throw new Error("Email delivery failed");
    }
    if (!response.ok) throw new Error("Email delivery failed");
  };
}

export function authCodeEmail(code: string, lifetimeMinutes: number): EmailMessage {
  return {
    subject: "Your Neffi sign-in code",
    preheader: `Use it within ${lifetimeMinutes} minutes to continue.`,
    heading: "Your sign-in code",
    paragraphs: ["Use this code to continue to Neffi."],
    code,
    notes: [`This code expires in ${lifetimeMinutes} minutes and works once.`, "If you didn't request it, you can ignore this email."],
  };
}

export function changeEmailCodeEmail(code: string, lifetimeMinutes: number): EmailMessage {
  return {
    subject: "Confirm your new Neffi email",
    preheader: `Use this code within ${lifetimeMinutes} minutes to finish the change.`,
    heading: "Confirm your new email",
    paragraphs: ["Enter this code in Neffi to start signing in with this address."],
    code,
    notes: [`This code expires in ${lifetimeMinutes} minutes and works once.`, "If you didn't request this, ignore this email. Your account won't change."],
  };
}
