import { beforeEach, expect, test, vi } from "vitest";
import { RECOVERY_FAILURE } from "@/modules/support/domain";
const m = vi.hoisted(() => ({ complete: vi.fn(), quota: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/env", () => ({ env: { betterAuthSecret: "synthetic-secret" } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/auth/otp-quota", async original => ({ ...await original<object>(), consumeQuota: m.quota }));
vi.mock("@/modules/accounts/recovery", () => ({ completeRecovery: m.complete }));
vi.mock("@/integrations/email/sender", () => ({ sendEmail: vi.fn() }));
import { completeRecoveryAction } from "./actions";
function form(code = "123456") { const data = new FormData(); data.set("email", "new@example.test"); data.set("code", code); return data; }
beforeEach(() => { vi.clearAllMocks(); m.quota.mockResolvedValue(true); m.complete.mockResolvedValue({ ok: false }); });
test("all expected failure paths have identical customer copy", async () => {
  expect(await completeRecoveryAction(undefined, form())).toEqual({ error: RECOVERY_FAILURE });
  expect(JSON.stringify(await completeRecoveryAction(undefined, form()))).not.toContain("123456");
  expect(await completeRecoveryAction(undefined, form("bad"))).toEqual({ error: RECOVERY_FAILURE });
  m.quota.mockResolvedValue(false);
  expect(await completeRecoveryAction(undefined, form())).toEqual({ error: RECOVERY_FAILURE });
});
test("success offers sign-in and unexpected errors still propagate", async () => {
  m.complete.mockResolvedValue({ ok: true });
  expect(await completeRecoveryAction(undefined, form())).toHaveProperty("ok");
  expect(JSON.stringify(await completeRecoveryAction(undefined, form()))).not.toContain("123456");
  m.complete.mockRejectedValue(new Error("database offline"));
  await expect(completeRecoveryAction(undefined, form())).rejects.toThrow("database offline");
});
test("legacy eight-digit input returns generic failure before completion and quota keys are HMAC-only", async () => {
  expect(await completeRecoveryAction(undefined, form("12345678"))).toEqual({ error: RECOVERY_FAILURE });
  expect(m.complete).not.toHaveBeenCalled();
  expect(m.quota.mock.calls[0][1]).toMatch(/^[0-9a-f]{64}$/);
  expect(m.quota.mock.calls[0][2]).toBe(10);
});
