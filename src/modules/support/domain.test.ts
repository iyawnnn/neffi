import { expect, test } from "vitest";
import { categories, intakeSchema, recoveryCompletionSchema, recoveryInitiationSchema, replySchema, caseReference } from "./domain";
import { containsActivationCode, containsStoredCredential } from "./credentials";
import { renderEmail, type EmailMessage } from "@/integrations/email/layout";
import { acknowledgementEmail, recoveryCodeEmail, securityNoticeEmail, caseMessageEmail } from "@/integrations/email/support-templates";

const input = { email: " Person@Example.test ", name: " Person ", category: "activation", message: " Lost package ", clientKey: "00000000-0000-4000-8000-000000000001", website: "" };

test("intake normalizes contact fields and bounds untrusted input", () => {
  expect(intakeSchema.parse(input)).toMatchObject({ email: "person@example.test", name: "Person", message: "Lost package" });
  for (const change of [{ email: "bad" }, { name: "a".repeat(101) }, { message: "a".repeat(2001) }, { message: " " }, { category: "unknown" }, { clientKey: "bad" }]) expect(intakeSchema.safeParse({ ...input, ...change }).success).toBe(false);
  expect(intakeSchema.parse({ ...input, website: "bot" }).website).toBe("bot");
  expect(categories.activation.type).toBe("activation_issue");
  expect(categories.ownership.type).toBe("ownership_correction");
  expect(categories.recovery.type).toBe("account_recovery");
  expect(categories.defective.type).toBe("defective_card");
  expect(categories.shipping.type).toBe("shipping_issue");
  expect(categories.other.type).toBe("other");
});

test("recovery requires verified initiation and six digits for completion", () => {
  const data = { newEmail: " New@Example.test ", confirmed: true, verificationNote: "Verified purchase evidence" };
  expect(recoveryInitiationSchema.parse(data)).toMatchObject({ newEmail: "new@example.test", unlinkGoogle: true });
  expect(recoveryInitiationSchema.safeParse({ ...data, confirmed: false }).success).toBe(false);
  expect(recoveryInitiationSchema.safeParse({ ...data, verificationNote: "short" }).success).toBe(false);
  expect(recoveryCompletionSchema.parse({ email: "NEW@example.test", code: "123456" }).email).toBe("new@example.test");
  for (const code of ["12345", "1234567", "12345678", "abcdef", "12 3456"]) expect(recoveryCompletionSchema.safeParse({ email: "new@example.test", code }).success).toBe(false);
});

test.each(["Recovery code 123456", "my recovery code is 123456", "OTP 123456", "PIN: 123456", "passcode 000000", "code" + " ".repeat(20) + "123456"])("blocks contextual six-digit credentials: %s", body => {
  expect(containsStoredCredential(body)).toBe(true);
});

test.each(["paid 150000", "20261019", "Case: 12345678", "year 2026", "call 0917 123 4567", "0917-123456", "123456", "123456 is my code", "code 12 3456", "code\n123456", "code" + " ".repeat(21) + "123456", "code 12345678", "zipcode 123456"])("allows ordinary text and documented filter gaps: %s", body => {
  expect(containsStoredCredential(body)).toBe(false);
});

test("reply is bounded and references expose only eight hex characters", () => {
  expect(replySchema.safeParse({ body: "a".repeat(2001), attemptId: input.clientKey }).success).toBe(false);
  expect(replySchema.safeParse({ body: " ", attemptId: input.clientKey }).success).toBe(false);
  expect(caseReference("abcdef12-1234-4000-8000-000000000001")).toBe("abcdef12");
});

test.each(["N8KF42PQ", "N8KF-42pq", "o8kf42pq"])("blocks activation-shaped credentials: %s", (code) => {
  expect(containsActivationCode(`Here is ${code}.`)).toBe(true);
});

test("ordinary messages and invalid alphabet do not look like activation credentials", () => {
  expect(containsActivationCode("Please contact support about your card.")).toBe(false);
  expect(containsActivationCode("0123456789ABCDEU")).toBe(false);
  for (const body of ["Jennifer", "Margaret", "activation", "Verified purchase evidence", "abcdef12", "year 2026", "card 1234"]) expect(containsActivationCode(body)).toBe(false);
});

test("embedded codes are deliberately not treated as standalone credentials", () => {
  expect(containsActivationCode("codeN8KF42PQ")).toBe(false);
  expect(containsActivationCode("N8KF42PQ0")).toBe(false);
});

const render = (message: EmailMessage) => renderEmail(message, "https://app.example.test");
test("acknowledgement and security notices accept no personal content and use fixed headers", () => {
  const at = new Date("2026-10-14T12:00:00Z");
  const caseId = "abcdef12-1234-4000-8000-000000000001";
  const ack = render(acknowledgementEmail(caseId));
  expect(ack.subject).toBe("We received your Neffi support request");
  expect(ack.text).toContain("abcdef12");
  const notice = render(securityNoticeEmail("recovery_started", at, caseId));
  expect(notice.text).toMatch(/recovery/i);
  for (const email of [ack, notice]) {
    expect(email.text).not.toMatch(/@|\b\d{6}\b/);
    expect(email.text).toContain("https://app.example.test/support");
  }
  const recovery = render(recoveryCodeEmail("123456"));
  expect(recovery.subject).toBe("Your Neffi recovery code");
  expect(recovery.text).toContain("Don't sign in with this address");
  expect(recovery.text).toContain("https://app.example.test/support/recover");
  expect(recovery.html).toContain(">123456<");
  expect(caseMessageEmail("reply", "Hello\ncustomer", caseId, true).subject).toBe("A message from Neffi support");
});
