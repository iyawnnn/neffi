import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/db", () => { throw new Error("Preview must not import the database"); });
vi.mock("@/config/env", () => { throw new Error("Preview must not import the environment"); });
vi.mock("@/integrations/email/sender", () => { throw new Error("Preview must not import the sender"); });
vi.mock("@/integrations/email/support-templates", async importOriginal => {
  const actual = await importOriginal<typeof import("@/integrations/email/support-templates")>();
  return { ...actual, recoveryCodeEmail: vi.fn(actual.recoveryCodeEmail) };
});
import { recoveryCodeEmail } from "@/integrations/email/support-templates";
import PreviewPage from "./page";

const page = (query: Record<string, string | string[]> = {}) => PreviewPage({ searchParams: Promise.resolve(query) });
const fetchSpy = vi.fn();
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", ""); vi.stubGlobal("fetch", fetchSpy); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

test.each(["production", "test", ""])("preview is unavailable in NODE_ENV=%s", async environment => {
  vi.stubEnv("NODE_ENV", environment);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});

test.each(["production", "preview"])("preview is unavailable in a %s deployment", async environment => {
  vi.stubEnv("VERCEL_ENV", environment);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});

test("outside development no template is even built, so a template error cannot surface", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const original = vi.mocked(recoveryCodeEmail).getMockImplementation()!;
  vi.mocked(recoveryCodeEmail).mockImplementation(() => { throw new Error("template failure"); });
  try {
    await expect(page()).rejects.toThrow("NOT_FOUND");
    expect(recoveryCodeEmail).not.toHaveBeenCalled();
  } finally { vi.mocked(recoveryCodeEmail).mockImplementation(original); }
});

test("every discovered email type renders at both widths without throwing, with no network access", async () => {
  const index = renderToStaticMarkup(await page());
  const emailNav = index.slice(index.indexOf('aria-label="Emails"'), index.indexOf('aria-label="Width"'));
  const kinds = [...emailNav.matchAll(/href="\?email=([^&"]+)&amp;w=600"/g)].map(match => match[1]);
  expect(kinds).toEqual(["sign-in", "sign-in-zero", "email-change", "recovery", "notice-email_changed", "notice-google_connected", "notice-google_removed", "notice-sessions_revoked", "notice-recovery_started", "notice-recovery_completed", "notice-account_secured", "ack", "reply", "resolution", "form"]);
  for (const kind of kinds) for (const w of ["375", "600"]) {
    const html = renderToStaticMarkup(await page({ email: kind, w }));
    expect(html).toContain("<iframe");
    expect(html).toContain(`width:${w}px`);
    expect(html).toContain("Subject:");
  }
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("security notices use the fixed preview timestamp, so output is stable", async () => {
  const first = renderToStaticMarkup(await page({ email: "notice-email_changed" }));
  const second = renderToStaticMarkup(await page({ email: "notice-email_changed" }));
  expect(first).toBe(second);
  expect(first).toContain("Oct 19, 2026, 3:42 PM (Philippine time)");
});

test("shows the code as fake data and falls back to the sign-in email for an unknown selection", async () => {
  expect(renderToStaticMarkup(await page({ email: "recovery", w: "375" }))).toContain("123456");
  expect(renderToStaticMarkup(await page({ email: "nonsense" }))).toContain("Your Neffi sign-in code");
});
