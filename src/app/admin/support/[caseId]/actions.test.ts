import { beforeEach, expect, test, vi } from "vitest";
const { authorize, openCase, addCaseNote, setCaseStatus, revalidatePath, reissueActivationCode } = vi.hoisted(() => ({ authorize: vi.fn(), openCase: vi.fn(), addCaseNote: vi.fn(), setCaseStatus: vi.fn(), revalidatePath: vi.fn(), reissueActivationCode: vi.fn() }));
const email = vi.hoisted(() => ({ prepare: vi.fn(), dispatch: vi.fn(), after: vi.fn() }));
const recovery = vi.hoisted(() => ({ initiate: vi.fn(), cancel: vi.fn(), secure: vi.fn() }));
vi.mock("@/modules/accounts/recovery", () => ({ initiateRecovery: recovery.initiate, cancelRecovery: recovery.cancel }));
vi.mock("@/modules/accounts/secure", () => ({ secureAccount: recovery.secure }));
vi.mock("@/modules/support/email", () => ({ prepareCaseMessage: email.prepare, dispatchCaseEmail: email.dispatch }));
vi.mock("@/integrations/email/sender", () => ({ sendEmail: vi.fn() }));
vi.mock("next/server", () => ({ after: email.after }));
vi.mock("@/auth/access", () => ({ authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/env", () => ({ env: { activationCodeSecret: "synthetic" } }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/modules/support/case", async (original) => ({ ...await original<object>(), openCase, addCaseNote, setCaseStatus }));
vi.mock("@/modules/support/cards", async (original) => ({ ...await original<object>(), reissueActivationCode }));
import { openCaseAction, addCaseNoteAction, setCaseStatusAction } from "./actions";
import { SupportError } from "@/modules/support/errors";
import * as actions from "./actions";
const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return data; };
beforeEach(() => { vi.clearAllMocks(); authorize.mockResolvedValue({ ok: true, viewer: { accountId: id } }); openCase.mockResolvedValue({ caseId: id }); });

test("customer is denied before input or service access", async () => {
  authorize.mockResolvedValue({ ok: false });
  expect(await addCaseNoteAction(undefined, form({ caseId: id, note: "Test" }))).toHaveProperty("error");
  expect(addCaseNote).not.toHaveBeenCalled();
});

test("reply saves first, schedules delivery and maps unsafe-code refusals", async () => {
  const data = form({ caseId: id, kind: "reply", body: "Please provide evidence.", attemptId: id });
  expect(await actions.sendCaseMessageAction(undefined, data)).toHaveProperty("ok");
  expect(email.dispatch).not.toHaveBeenCalled();
  await email.after.mock.calls[0][0]();
  expect(email.dispatch).toHaveBeenCalled();
  email.prepare.mockRejectedValueOnce(new SupportError("activation_code_in_email"));
  expect(await actions.sendCaseMessageAction(undefined, data)).toEqual({ error: "Remove the activation code; give it to the customer directly" });
});

test("recovery owner actions require verification and never return a recovery code", async () => {
  const fields = { caseId: id, newEmail: "new@example.test", verificationNote: "Verified purchase evidence", unlinkGoogle: "on" };
  expect(await actions.initiateRecoveryAction(undefined, form(fields))).toHaveProperty("error");
  expect(recovery.initiate).not.toHaveBeenCalled();
  recovery.initiate.mockResolvedValue({ recoveryId: id });
  const result = await actions.initiateRecoveryAction(undefined, form({ ...fields, confirmed: "on" }));
  expect(result).toHaveProperty("ok");
  expect(result).not.toHaveProperty("reveal");
  expect(recovery.initiate.mock.calls[0][1]).toMatchObject({ actorId: id, unlinkGoogle: true, confirmed: true });
});

test("case schemas reject bad ids and oversized summaries and notes", async () => {
  expect(await openCaseAction(undefined, form({ type: "other", summary: "x".repeat(501) }))).toHaveProperty("error");
  expect(await addCaseNoteAction(undefined, form({ caseId: "bad", note: "Test" }))).toHaveProperty("error");
  expect(await addCaseNoteAction(undefined, form({ caseId: id, note: "x".repeat(501) }))).toHaveProperty("error");
  expect(openCase).not.toHaveBeenCalled();
  expect(addCaseNote).not.toHaveBeenCalled();
});

test("resolved stale submissions map to recovery copy, unknown errors rethrow", async () => {
  setCaseStatus.mockRejectedValueOnce(new SupportError("case_resolved"));
  const data = form({ caseId: id, status: "waiting_on_customer" });
  expect(await setCaseStatusAction(undefined, data)).toEqual({ error: "This case is resolved. Reopen it before making a correction." });
  setCaseStatus.mockRejectedValueOnce(new Error("unexpected"));
  await expect(setCaseStatusAction(undefined, data)).rejects.toThrow("unexpected");
});

test("every controlled action requires confirmation and a reason or verification note", async () => {
  const controlled = [actions.afterSaleRefundAction, actions.voidAfterSaleRefundAction, actions.voidCompletedPaymentAction, actions.recordCompletedPaymentAction, actions.retireAffectedCardAction, actions.releaseReplacementCardAction, actions.reissueActivationCodeAction, actions.resetCardOwnershipAction, actions.recordSupportShipmentAction, actions.updateSupportShipmentAction];
  for (const action of controlled) {
    const data = form({ caseId: id, orderId: id, cardId: id, orderItemId: id, paymentId: id, refundId: id, shipmentId: id, method: "cash", amount: "1", status: "delivered", reason: "Checked", verificationNote: "Checked" });
    expect(await action(undefined, data)).toHaveProperty("error");
    data.set("confirm", "on");
    data.set("reason", "");
    data.set("verificationNote", "");
    expect(await action(undefined, data)).toHaveProperty("error");
  }
});

test("every support action refuses a customer direct call", async () => {
  authorize.mockResolvedValue({ ok: false });
  for (const action of Object.values(actions)) {
    expect(await action(undefined, new FormData())).toEqual({ error: "You aren't allowed to do that." });
  }
});

test("a verified reissue returns a one-time reveal and only record paths are revalidated", async () => {
  reissueActivationCode.mockResolvedValue({ activationCode: "A".repeat(16), credentialId: id });
  const result = await actions.reissueActivationCodeAction(undefined, form({ caseId: id, cardId: id, verificationNote: "Invoice and claimant checked", confirm: "on" }));
  expect(result.reveal?.code.length).toBe(19);
  expect(result.reveal?.instructions).toContain("Copy it now");
  expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/admin", "/admin/support", "/admin/orders", "/admin/inventory", "/admin/expenses", `/admin/support/${id}`, "/admin/orders/[orderId]", `/admin/inventory/cards/${id}`]);
  expect(result.href).toBeUndefined();
});
