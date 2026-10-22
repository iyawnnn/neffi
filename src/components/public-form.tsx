"use client";

import { useState, type FormEvent } from "react";
import { Input, Textarea } from "@/components/ui/input";
import type { visibleFields } from "@/modules/forms/config";

type Field = ReturnType<typeof visibleFields>[number];
export type InquiryResult = "sent" | "invalid" | "unavailable" | "busy" | "failed";
export const INQUIRY_MESSAGES: Record<Exclude<InquiryResult, "sent">, string> = {
  invalid: "Check the highlighted fields and try again.",
  unavailable: "This form isn't taking messages right now.",
  busy: "Too many messages were sent from this network. Please try again in a few minutes.",
  failed: "Your message wasn't sent. Check your connection and try again.",
};
const AUTOCOMPLETE: Record<string, string> = { name: "name", email: "email", phone: "tel", company: "organization" };

// The browser key is made once per form view, so a retry or double tap stores one message (M6 D11).
export async function sendInquiry(formId: string, key: string, data: FormData, send: typeof fetch = fetch): Promise<{ result: InquiryResult; fields: string[] }> {
  const answers = Object.fromEntries([...data].filter(([name, value]) => name !== "website" && typeof value === "string"));
  const website = data.get("website");
  let response: Response;
  try {
    response = await send(`/api/forms/${formId}/submissions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, answers, ...(typeof website === "string" && website ? { website } : {}) }) });
  } catch {
    return { result: "failed", fields: [] };
  }
  if (response.ok) return { result: "sent", fields: [] };
  if (response.status === 404) return { result: "unavailable", fields: [] };
  if (response.status === 429) return { result: "busy", fields: [] };
  if (response.status !== 400 && response.status !== 413) return { result: "failed", fields: [] };
  const body = (await response.json().catch(() => ({}))) as { fields?: unknown };
  return { result: "invalid", fields: Array.isArray(body.fields) ? body.fields.filter((f): f is string => typeof f === "string") : [] };
}

export function PublicForm({ formId, title, fields }: { formId: string; title: string; fields: Field[] }) {
  const [key] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<{ result?: InquiryResult; fields: string[]; pending: boolean }>({ fields: [], pending: false });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(current => ({ ...current, pending: true }));
    setState({ ...(await sendInquiry(formId, key, new FormData(event.currentTarget))), pending: false });
  }
  if (state.result === "sent") return (
    <section className="pf-form">
      <h2 className="pf-section-title">{title}</h2>
      <p role="status">Thanks, your message was sent.</p>
    </section>
  );
  return (
    <form onSubmit={submit} className="pf-form">
      <h2 className="pf-section-title">{title}</h2>
      {fields.map(field => {
        const invalid = state.fields.includes(field.key) || undefined;
        const props = { name: field.key, required: field.required, "aria-invalid": invalid, autoComplete: AUTOCOMPLETE[field.key] };
        return (
          <label key={field.key} className="pf-field-label">
            {field.label}{field.required ? " (required)" : ""}
            {field.kind === "long" ? <Textarea {...props} className="pf-field" maxLength={2000} /> : <Input {...props} className="pf-field" type={field.kind} maxLength={field.kind === "email" ? 254 : 500} />}
          </label>
        );
      })}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state.result ? <p role="alert" className="text-sm">{INQUIRY_MESSAGES[state.result]}</p> : null}
      <button type="submit" disabled={state.pending} className="pf-action min-h-12">
        {state.pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
