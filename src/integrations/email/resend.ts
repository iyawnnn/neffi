import "server-only";

export type Email = { to: string; subject: string; text: string; replyTo?: string; idempotencyKey?: string };
export type EmailSender = (email: Email) => Promise<void>;

type ResendConfig = { apiKey: string; from: string };

// EmailService boundary for Resend. Plain text, no tracking. Failures are deliberately opaque: the provider's
// response, the recipient and the message body (which holds a sign-in code) must never reach logs or Sentry.
export function createResendSender({ apiKey, from }: ResendConfig): EmailSender {
  return async ({ to, subject, text, replyTo, idempotencyKey }) => {
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
        body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: [replyTo] } : {}) }),
      });
    } catch {
      throw new Error("Email delivery failed");
    }
    if (!response.ok) throw new Error("Email delivery failed");
  };
}

export function authCodeEmail(code: string, lifetimeMinutes: number): Pick<Email, "subject" | "text"> {
  return {
    subject: "Your Neffi sign-in code",
    text: `Your Neffi sign-in code is ${code}.\n\nIt expires in ${lifetimeMinutes} minutes and works once. If you did not ask for it, ignore this message.`,
  };
}
