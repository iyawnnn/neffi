import { beforeEach, expect, test, vi } from "vitest";
import { hmacHex } from "@/auth/otp-quota";
const m = vi.hoisted(() => ({ quota: vi.fn(), submit: vi.fn(), after: vi.fn(), notify: vi.fn(), send: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("@/modules/forms/notify", () => ({ notifySubmission: m.notify }));
vi.mock("@/integrations/email/sender", () => ({ sendEmail: m.send }));
vi.mock("@/config/env", () => ({ env: { authBaseUrl: "http://localhost:3000", betterAuthSecret: "synthetic-form-secret" } }));
vi.mock("@/auth/otp-quota", async original => ({ ...await original<typeof import("@/auth/otp-quota")>(), consumeQuota: m.quota }));
vi.mock("@/modules/forms/submissions", () => ({ submitForm: m.submit }));
import { POST } from "./route";
const FORM = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";
const valid = { key: KEY, answers: { name: "Vic", email: "vic@e.test" } };
const call = (body: string = JSON.stringify(valid), origin: string | null = "http://localhost:3000", formId = FORM) => POST(new Request(`http://localhost:3000/api/forms/${formId}/submissions`, { method: "POST", headers: { ...(origin ? { origin } : {}), "x-vercel-forwarded-for": "203.0.113.9" }, body }), { params: Promise.resolve({ formId }) });
beforeEach(() => { vi.resetAllMocks(); m.quota.mockResolvedValue(true); m.submit.mockResolvedValue({ status: "created", submissionId: "s1", replyTo: "vic@e.test" }); });
test.each([null, "https://foreign.example.test"])("rejects missing or foreign origin %s before any work", async origin => {
  expect((await call(undefined, origin)).status).toBe(403); expect(m.quota).not.toHaveBeenCalled(); expect(m.submit).not.toHaveBeenCalled();
});
test("quota exhaustion uses the HMAC IP key and limit 10", async () => {
  m.quota.mockResolvedValue(false); expect((await call()).status).toBe(429);
  expect(m.quota).toHaveBeenCalledWith({}, hmacHex("synthetic-form-secret", "form-ip", "203.0.113.9"), 10); expect(m.submit).not.toHaveBeenCalled();
});
test("oversize bodies are refused", async () => { expect((await call("x".repeat(16_001))).status).toBe(413); expect(m.submit).not.toHaveBeenCalled(); });

test("the body cap counts UTF-8 bytes rather than characters", async () => {
  const payload = JSON.stringify({ ...valid, answers: { ...valid.answers, a: "界".repeat(1900), b: "界".repeat(1900), c: "界".repeat(1900) } });
  expect(payload.length).toBeLessThan(16_000);
  expect(new TextEncoder().encode(payload).byteLength).toBeGreaterThan(16_000);
  expect((await call(payload)).status).toBe(413);
  expect(m.submit).not.toHaveBeenCalled();
});

test("stops reading a chunked body once the byte cap is exceeded", async () => {
  let cancelled = false;
  let reads = 0;
  const stream = new ReadableStream({
    pull(controller) { reads++; if (reads <= 4) controller.enqueue(new Uint8Array(8001)); else controller.close(); },
    cancel() { cancelled = true; },
  });
  const request = new Request(`http://localhost:3000/api/forms/${FORM}/submissions`, {
    method: "POST", headers: { origin: "http://localhost:3000" }, body: stream, duplex: "half",
  } as RequestInit);
  expect((await POST(request, { params: Promise.resolve({ formId: FORM }) })).status).toBe(413);
  expect(cancelled).toBe(true);
  expect(reads).toBeLessThanOrEqual(3);
  expect(m.submit).not.toHaveBeenCalled();
});
test.each(["not json", JSON.stringify({ ...valid, key: "bad" }), JSON.stringify({ ...valid, answers: { name: "x".repeat(2001) } })])("invalid body returns only the generic error", async body => {
  const response = await call(body); expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "invalid" }); expect(m.submit).not.toHaveBeenCalled();
});
test("malformed form id is not available", async () => { expect((await call(undefined, undefined, "bad")).status).toBe(404); expect(m.submit).not.toHaveBeenCalled(); });
test("honeypot silently drops the message", async () => { const response = await call(JSON.stringify({ ...valid, website: "x" })); expect(response.status).toBe(201); expect(await response.json()).toEqual({ ok: true }); expect(m.submit).not.toHaveBeenCalled(); });
test.each([
  [{ status: "unavailable" }, 404, { error: "unavailable" }],
  [{ status: "invalid", fields: ["name"] }, 400, { error: "invalid", fields: ["name"] }],
  [{ status: "created", submissionId: "s1", replyTo: null }, 201, { ok: true }],
  [{ status: "duplicate", submissionId: "s1" }, 201, { ok: true }],
])("maps result %j without echoing answers", async (result, status, body) => {
  m.submit.mockResolvedValue(result); const response = await call(); expect(response.status).toBe(status); expect(await response.json()).toEqual(body);
  expect(m.submit).toHaveBeenCalledWith({}, { formId: FORM, clientKey: KEY, answers: valid.answers });
});

test("created schedules notification after the response; duplicate never schedules", async () => {
  await call();
  expect(m.after).toHaveBeenCalledOnce();
  await m.after.mock.calls[0][0]();
  expect(m.notify).toHaveBeenCalledWith({}, m.send, { submissionId: "s1", appOrigin: "http://localhost:3000", replyTo: "vic@e.test" });
  m.after.mockClear(); m.submit.mockResolvedValue({ status: "duplicate", submissionId: "s1" });
  await call(); expect(m.after).not.toHaveBeenCalled();
});
