import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { PRESETS, visibleFields } from "@/modules/forms/config";
import { INQUIRY_MESSAGES, PublicForm, sendInquiry } from "./public-form";

const FORM = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";
const data = (entries: Record<string, string>) => { const d = new FormData(); for (const [k, v] of Object.entries(entries)) d.set(k, v); return d; };
const reply = (status: number, body: object) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

test("posts answers and the browser key as JSON to the form's endpoint", async () => {
  const send = reply(201, { ok: true });
  expect(await sendInquiry(FORM, KEY, data({ name: "Vic", email: "vic@e.test", website: "" }), send)).toEqual({ result: "sent", fields: [] });
  const [url, init] = send.mock.calls[0];
  expect(url).toBe(`/api/forms/${FORM}/submissions`);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({ key: KEY, answers: { name: "Vic", email: "vic@e.test" } });
});
test("a filled honeypot travels as `website`, never as an answer", async () => {
  const send = reply(201, { ok: true });
  await sendInquiry(FORM, KEY, data({ name: "Vic", website: "spam.example" }), send);
  expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toEqual({ key: KEY, answers: { name: "Vic" }, website: "spam.example" });
});
test.each([
  [400, { error: "invalid", fields: ["email"] }, { result: "invalid", fields: ["email"] }],
  [413, { error: "too_large" }, { result: "invalid", fields: [] }],
  [404, { error: "unavailable" }, { result: "unavailable", fields: [] }],
  [429, { error: "rate_limited" }, { result: "busy", fields: [] }],
  [500, {}, { result: "failed", fields: [] }],
])("status %i maps to a calm visitor outcome", async (status, body, expected) => {
  expect(await sendInquiry(FORM, KEY, data({ name: "Vic" }), reply(status, body))).toEqual(expected);
});
test("a network failure keeps the visitor on the form with a retry message", async () => {
  const send = vi.fn<typeof fetch>(async () => { throw new TypeError("offline"); });
  expect(await sendInquiry(FORM, KEY, data({ name: "Vic" }), send)).toEqual({ result: "failed", fields: [] });
  expect(INQUIRY_MESSAGES.failed).toContain("try again");
});
test("renders persistent labels, required fields, autocomplete and a hidden honeypot", () => {
  const html = renderToStaticMarkup(<PublicForm formId={FORM} title="Send me a message" fields={visibleFields(PRESETS.contact.config)} />);
  expect(html).toContain("Send me a message");
  for (const label of ["Your name", "Email", "Phone", "Message"]) expect(html).toContain(label);
  const tag = (name: string) => html.match(new RegExp(`<(?:input|textarea)\\b[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
  expect(tag("name").toLowerCase()).toContain('autocomplete="name"');
  expect(tag("email")).toContain('type="email"');
  expect(tag("email")).toContain("required");
  expect(tag("name")).toContain('placeholder="Full name"');
  expect(tag("email")).toContain('placeholder="you@example.com"');
  expect(tag("message")).toContain('placeholder="Tell me what you&#x27;d like to discuss..."');
  expect(tag("phone")).not.toContain("placeholder");
  for (const name of ["name", "email", "message"]) expect(tag(name)).not.toContain("value=");
  expect(tag("phone")).toContain('type="tel"');
  expect(tag("website").toLowerCase()).toContain('tabindex="-1"');
  expect(html).toMatch(/aria-hidden="true"[^>]*>\s*<label[^>]*>[^<]*<input[^>]*name="website"/);
  for (const [t] of html.matchAll(/<(?:input|textarea|button)\b[^>]*>/g)) expect(t).not.toMatch(/\sdisabled(?:[=\s>])/i);
});
