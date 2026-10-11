import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PRESETS, validateAnswers } from "../src/modules/forms/config";

const m = vi.hoisted(() => ({ query: vi.fn(), end: vi.fn(), pool: vi.fn() }));
vi.mock("pg", () => ({ default: { Pool: class {
  constructor() { m.pool(); }
  query = m.query;
  end = m.end;
} } }));

const config = { fields: { ...PRESETS.project_inquiry.config.fields, phone: "required" as const, company: "hidden" as const }, questions: [{ id: "budget01", label: "Budget", required: true }] };
const formId = "22222222-2222-4222-8222-222222222222";
const run = () => import("./dev-form-submission.mjs");

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("DATABASE_URL", "postgres://postgres@127.0.0.1:55432/neffi_m2_test");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.stubEnv("VISITOR_EMAIL", "visitor@example.test");
  vi.spyOn(process, "argv", "get").mockReturnValue(["node", "dev-form-submission"]);
  m.query.mockResolvedValueOnce({ rows: [{ neon: "" }] }).mockResolvedValueOnce({ rows: [{ id: formId, config }] });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test("local helper answers satisfy Required Phone and Budget and print only HTTP status", async () => {
  const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    expect(validateAnswers(config, body.answers).ok).toBe(true);
    expect(body.answers.phone).toBe("+639000000000");
    expect(body.answers.budget01).toBe("Synthetic answer");
    expect(body.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(init.headers).toEqual({ Origin: "http://localhost:3000", "Content-Type": "application/json" });
    return new Response("{}", { status: 201 });
  });
  vi.stubGlobal("fetch", fetch);
  await run();
  expect(fetch.mock.calls[0][0]).toBe(`http://localhost:3000/api/forms/${formId}/submissions`);
  expect(output).toHaveBeenCalledExactlyOnceWith("201");
  expect(m.end).toHaveBeenCalledOnce();
});

test("repeat-key posts the same submission twice", async () => {
  vi.spyOn(process, "argv", "get").mockReturnValue(["node", "dev-form-submission", "--repeat-key"]);
  const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetch);
  await run();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
  expect(output).toHaveBeenCalledExactlyOnceWith("201 201");
});

test.each([
  ["DATABASE_URL", "postgres://postgres@example.invalid/neffi_m2_test"],
  ["APP_ORIGIN", "https://example.invalid"],
])("%s must be loopback before opening the database", async (name, value) => {
  vi.stubEnv(name, value);
  await expect(run()).rejects.toThrow(/loopback/);
  expect(m.pool).not.toHaveBeenCalled();
});

test("a Neon-marked database refuses before selecting a form", async () => {
  m.query.mockReset().mockResolvedValueOnce({ rows: [{ neon: "synthetic-project" }] });
  await expect(run()).rejects.toThrow(/never target Neon/);
  expect(m.query).toHaveBeenCalledOnce();
  expect(m.end).toHaveBeenCalledOnce();
});
