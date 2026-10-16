export const FORM_FIELDS = ["name", "email", "phone", "company", "message"] as const;
export type FormField = (typeof FORM_FIELDS)[number];
export const FIELD_LABELS: Record<FormField, string> = { name: "Your name", email: "Email", phone: "Phone", company: "Company", message: "Message" };
export const MAX_QUESTIONS = 3;
