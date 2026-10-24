import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3001" }) }));
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
  const emailNav = index.slice(index.indexOf('aria-label="Scenario"'), index.indexOf('aria-label="Theme"'));
  const kinds = [...emailNav.matchAll(/href="\?email=([^&"]+)&amp;w=600&amp;theme=light"/g)].map(match => match[1]);
  expect(kinds).toEqual(["sign-in", "sign-in-zero", "email-change", "recovery", "notice-email_changed", "notice-google_connected", "notice-google_removed", "notice-sessions_revoked", "notice-recovery_started", "notice-recovery_completed", "notice-account_secured", "ack", "reply", "resolution", "form"]);
  for (const kind of kinds) for (const w of ["375", "600"]) for (const theme of ["light", "dark"]) {
    const html = renderToStaticMarkup(await page({ email: kind, w, theme }));
    expect(html).toContain("<iframe");
    expect(html).toContain(`width:${w}px`);
    expect(html).toContain(`data-email-preview-theme=&quot;${theme}&quot;`);
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

const frameDoc = (html: string) => (html.match(/srcDoc="([^"]*)"/)![1]).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

test("Light and Dark are explicit choices that keep the selected scenario and width", async () => {
  const html = renderToStaticMarkup(await page({ email: "recovery", w: "375", theme: "dark" }));
  const themeNav = html.slice(html.indexOf('aria-label="Theme"'), html.indexOf('aria-label="Width"'));
  expect(themeNav).toContain('href="?email=recovery&amp;w=375&amp;theme=light"');
  expect(themeNav).toMatch(/aria-current="page"[^>]*href="\?email=recovery&amp;w=375&amp;theme=dark"|href="\?email=recovery&amp;w=375&amp;theme=dark"[^>]*aria-current="page"/);
  expect(themeNav).toContain(">Light<");
  expect(themeNav).toContain(">Dark<");
  expect(html).toContain('href="?email=recovery&amp;w=600&amp;theme=dark"');
  expect(html).toContain('href="?email=form&amp;w=375&amp;theme=dark"');
  expect(renderToStaticMarkup(await page({ theme: "nonsense" }))).toContain('href="?email=sign-in&amp;w=600&amp;theme=dark"');
});

test("both themes show the same real email; only the preview attribute differs", async () => {
  const light = frameDoc(renderToStaticMarkup(await page({ email: "recovery", theme: "light" })));
  const dark = frameDoc(renderToStaticMarkup(await page({ email: "recovery", theme: "dark" })));
  expect(dark).toContain('<html lang="en" data-email-preview-theme="dark">');
  expect(light).toContain('<html lang="en" data-email-preview-theme="light">');
  expect(dark.replace('data-email-preview-theme="dark"', 'data-email-preview-theme="light"')).toBe(light);
  expect(dark).not.toContain("prefers-color-scheme");
  expect(dark).toContain('src="http://localhost:3001/email/neffi-wordmark-dark.png"');
  expect(dark).toContain('html[data-email-preview-theme="dark"] .email-surface{background:#17181B !important');
});

test.each(["sign-in", "sign-in-zero", "email-change", "recovery"])("the %s notification preview shows subject and preheader but never the code", async email => {
  const html = renderToStaticMarkup(await page({ email }));
  const notification = html.slice(html.indexOf("data-notification"), html.indexOf("</section>", html.indexOf("data-notification")));
  expect(html).toContain("Notification preview — approximate");
  expect(notification).toContain(">Neffi<");
  const subject = html.match(/<dt[^>]*>Subject<\/dt><dd>([^<]*)<\/dd>/)![1];
  const preheader = html.match(/<dt[^>]*>Preheader<\/dt><dd>([^<]*)<\/dd>/)![1];
  expect(notification).toContain(subject);
  expect(notification).toContain(preheader);
  expect(notification).not.toMatch(/123456|012345/);
  expect(html).toMatch(/123456|012345/);
});

test("the sign-in preheader stands alone without the code", async () => {
  const html = renderToStaticMarkup(await page({ email: "sign-in-zero" }));
  expect(html).toContain("Expires in 5 minutes. If you didn&#x27;t request this sign-in, you can ignore this email.");
  expect(frameDoc(html)).toContain(">012345<");
});
