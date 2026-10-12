import { expect, test } from "vitest";
import { parseFormConfig, PRESETS, validateAnswers, visibleFields } from "./config";

test("presets are valid configurations", () => {
  for (const preset of Object.values(PRESETS)) expect(parseFormConfig(preset.config)).toEqual({ ok: true, config: preset.config });
  expect(PRESETS.connect.title).toBe("Let's connect");
  expect(PRESETS.project_inquiry.title).toBe("Tell me about your project");
  expect(PRESETS.contact.title).toBe("Send me a message");
});

test.each([
  ["name not required", { fields: { ...PRESETS.contact.config.fields, name: "optional" }, questions: [] }],
  ["no way to reply", { fields: { ...PRESETS.contact.config.fields, email: "optional", phone: "hidden" }, questions: [] }],
  ["four questions", { ...PRESETS.contact.config, questions: Array.from({ length: 4 }, (_, i) => ({ id: `q${i}aaaaa`, label: "Q", required: false })) }],
  ["empty question", { ...PRESETS.contact.config, questions: [{ id: "q1aaaaaa", label: " ", required: false }] }],
  ["unknown field", { fields: { ...PRESETS.contact.config.fields, budget: "required" }, questions: [] }],
  ["not an object", "x"],
])("rejects %s", (_name, input) => expect(parseFormConfig(input)).toEqual({ ok: false }));

test("answers: required fields enforced, hidden fields ignored, snapshot keeps labels", () => {
  const config = { ...PRESETS.project_inquiry.config, questions: [{ id: "budget01", label: "Budget", required: true }] };
  expect(validateAnswers(config, { name: "", email: "bad", message: "" })).toEqual({ ok: false, fields: ["name", "email", "message", "budget01"] });
  expect(validateAnswers(config, { name: " Vic ", email: "VIC@e.test", phone: "", company: "", message: "Hi", budget01: "10k", extra: "ignored" })).toEqual({
    ok: true,
    replyTo: "vic@e.test",
    answers: [
      { label: "Your name", value: "Vic" },
      { label: "Email", value: "vic@e.test" },
      { label: "Message", value: "Hi" },
      { label: "Budget", value: "10k" },
    ],
  });
});

test("visible fields in display order with input kinds", () => {
  expect(visibleFields(PRESETS.contact.config).map((f) => [f.key, f.kind, f.required])).toEqual([
    ["name", "text", true],
    ["email", "email", true],
    ["phone", "tel", false],
    ["message", "long", true],
  ]);
});
