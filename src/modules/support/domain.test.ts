import { expect, test } from "vitest";
import { categories, intakeSchema, recoveryCompletionSchema, recoveryInitiationSchema, replySchema, caseReference } from "./domain";
import { containsActivationCode } from "./credentials";
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

test("recovery requires verified initiation and eight digits for completion", () => {
  const data = { newEmail: " New@Example.test ", confirmed: true, verificationNote: "Verified purchase evidence" };
  expect(recoveryInitiationSchema.parse(data)).toMatchObject({ newEmail: "new@example.test", unlinkGoogle: true });
  expect(recoveryInitiationSchema.safeParse({ ...data, confirmed: false }).success).toBe(false);
  expect(recoveryInitiationSchema.safeParse({ ...data, verificationNote: "short" }).success).toBe(false);
  expect(recoveryCompletionSchema.parse({ email: "NEW@example.test", code: "12345678" }).email).toBe("new@example.test");
  for (const code of ["1234567", "123456789", "abcdefgh"]) expect(recoveryCompletionSchema.safeParse({ email: "new@example.test", code }).success).toBe(false);
});

test("reply is bounded and references expose only eight hex characters", () => {
  expect(replySchema.safeParse({ body: "a".repeat(2001), attemptId: input.clientKey }).success).toBe(false);
  expect(replySchema.safeParse({ body: " ", attemptId: input.clientKey }).success).toBe(false);
  expect(caseReference("abcdef12-1234-4000-8000-000000000001")).toBe("abcdef12");
});

test.each(["0123456789ABCDEF", "0123-4567-89ab-cdef", "o123 4567 89ab cdef", "0123\n4567\n89AB\nCDEF"])("blocks activation-shaped credentials: %s", (code) => {
  expect(containsActivationCode(`Here is ${code}.`)).toBe(true);
});

test("ordinary messages and invalid alphabet do not look like activation credentials", () => {
  expect(containsActivationCode("Please contact support about your card.")).toBe(false);
  expect(containsActivationCode("0123456789ABCDEU")).toBe(false);
});

test("embedding a code in a longer token does not bypass the email credential guard", () => {
  expect(containsActivationCode("code0123456789ABCDEF")).toBe(true);
  expect(containsActivationCode("0123456789ABCDEF0")).toBe(true);
});

test("acknowledgement and security notices accept no personal content and use fixed headers", () => {
  const at = new Date("2026-10-14T12:00:00Z");
  const ack = acknowledgementEmail("abcdef12-1234-4000-8000-000000000001", at);
  expect(ack.subject).toBe("Neffi support received your request");
  expect(ack.text).toContain("abcdef12");
  const notice = securityNoticeEmail("recovery_started", at, "abcdef12-1234-4000-8000-000000000001");
  expect(notice.text).toMatch(/recovery/i);
  for (const email of [ack, notice]) {
    expect(email.text).not.toMatch(/@|\b\d{8}\b/);
    expect(email.text).toContain("/support");
  }
  expect(recoveryCodeEmail("12345678", at).text).toContain("Do not sign in");
  expect(recoveryCodeEmail("12345678", at).text).toContain("12345678");
  expect(caseMessageEmail("reply", "Hello\ncustomer").subject).toBe("A message from Neffi support");
});
