import { z } from "zod";

// Native Neffi forms stay small: a fixed field catalogue, three modes, up to three short custom questions.
export const FORM_FIELDS = ["name", "email", "phone", "company", "message"] as const;
export type FormField = (typeof FORM_FIELDS)[number];
export type FieldMode = "hidden" | "optional" | "required";
export const FIELD_LABELS: Record<FormField, string> = { name: "Your name", email: "Email", phone: "Phone", company: "Company", message: "Message" };
const FIELD_KIND = { name: "text", email: "email", phone: "tel", company: "text", message: "long" } as const;
const FIELD_MAX: Record<FormField, number> = { name: 80, email: 254, phone: 30, company: 80, message: 2000 };
export const MAX_QUESTIONS = 3;

const mode = z.enum(["hidden", "optional", "required"]);
const configSchema = z
  .object({
    fields: z.strictObject({ name: mode, email: mode, phone: mode, company: mode, message: mode }),
    questions: z
      .array(z.strictObject({ id: z.string().regex(/^[a-z0-9]{8}$/), label: z.string().trim().min(1).max(80), required: z.boolean() }))
      .max(MAX_QUESTIONS),
  })
  .strict()
  .refine((c) => c.fields.name === "required" && (c.fields.email === "required" || c.fields.phone === "required"));
export type FormConfig = z.infer<typeof configSchema>;

export const PRESETS = {
  connect: { title: "Let's connect", config: { fields: { name: "required", email: "required", phone: "optional", company: "optional", message: "optional" }, questions: [] } },
  project_inquiry: { title: "Tell me about your project", config: { fields: { name: "required", email: "required", phone: "optional", company: "optional", message: "required" }, questions: [] } },
  contact: { title: "Send me a message", config: { fields: { name: "required", email: "required", phone: "optional", company: "hidden", message: "required" }, questions: [] } },
} satisfies Record<string, { title: string; config: FormConfig }>;
export type Preset = keyof typeof PRESETS;

export function parseFormConfig(input: unknown): { ok: true; config: FormConfig } | { ok: false } {
  const result = configSchema.safeParse(input);
  return result.success ? { ok: true, config: result.data } : { ok: false };
}

export function visibleFields(config: FormConfig) {
  return [
    ...FORM_FIELDS.filter((key) => config.fields[key] !== "hidden").map((key) => ({ key, label: FIELD_LABELS[key], required: config.fields[key] === "required", kind: FIELD_KIND[key] })),
    ...config.questions.map((q) => ({ key: q.id, label: q.label, required: q.required, kind: "text" as const })),
  ];
}

export type Answer = { label: string; value: string };

export function validateAnswers(config: FormConfig, raw: Record<string, unknown>) {
  const answers: Answer[] = [];
  const fields: string[] = [];
  let replyTo: string | null = null;
  for (const field of visibleFields(config)) {
    const value = typeof raw[field.key] === "string" ? (raw[field.key] as string).trim() : "";
    const max = field.key in FIELD_MAX ? FIELD_MAX[field.key as FormField] : 500;
    const normalized = field.kind === "email" ? value.toLowerCase() : value;
    const valid =
      normalized.length <= max &&
      (!normalized || field.kind !== "email" || z.email().safeParse(normalized).success) &&
      (!normalized || field.kind !== "tel" || /^\+?[0-9 ()-]{7,20}$/.test(normalized));
    if (!valid || (field.required && !normalized)) {
      fields.push(field.key);
      continue;
    }
    if (!normalized) continue;
    if (field.kind === "email") replyTo = normalized;
    answers.push({ label: field.label, value: normalized });
  }
  return fields.length ? { ok: false as const, fields } : { ok: true as const, answers, replyTo };
}
