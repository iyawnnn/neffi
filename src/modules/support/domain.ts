import { z } from "zod";

export const categories = {
  activation: { label: "Lost activation code", type: "activation_issue" },
  ownership: { label: "Card in the wrong account or not found", type: "ownership_correction" },
  recovery: { label: "Cannot sign in or lost email or Google access", type: "account_recovery" },
  defective: { label: "Card damaged or not working", type: "defective_card" },
  shipping: { label: "Delivery problem", type: "shipping_issue" },
  other: { label: "Other", type: "other" },
} as const;

export const contactEmail = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const intakeSchema = z.object({
  email: contactEmail,
  name: z.string().trim().max(100).default(""),
  category: z.enum(["activation", "ownership", "recovery", "defective", "shipping", "other"]),
  message: z.string().trim().min(1).max(2000),
  clientKey: z.uuid(),
  website: z.string().max(2000).default(""),
  cardId: z.uuid().optional(),
});
export const verificationSchema = z.object({ confirmed: z.literal(true), verificationNote: z.string().trim().min(10).max(300), unlinkGoogle: z.boolean().default(true) });
export const recoveryInitiationSchema = verificationSchema.extend({ newEmail: contactEmail });
export const recoveryCompletionSchema = z.object({ email: contactEmail, code: z.string().trim().regex(/^\d{8}$/) });
export const replySchema = z.object({ body: z.string().trim().min(1).max(2000), attemptId: z.uuid() });
export const caseReference = (id: string) => id.slice(0, 8);
export const ACK_WINDOW_MS = 24 * 60 * 60_000;
export const RECOVERY_LIFETIME_MS = ACK_WINDOW_MS;
export const SUPPORT_LIMITS = { ip: 5, email: 3, global: 100, recoveryIp: 10 } as const;
export const SUPPORT_SUCCESS = "Your request has been received. Neffi support will contact you if more information is needed.";
export const RECOVERY_FAILURE = "We could not complete recovery. Check your details or contact Neffi support.";
export const RECOVERY_INSTRUCTION = "Do not sign in with the new address until recovery completes. Signing in early can create another Account and block recovery.";
export const ACTIVATION_EMAIL_BLOCKED = "Remove the activation code; give it to the customer directly";
