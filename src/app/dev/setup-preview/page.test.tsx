// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/db", () => { throw new Error("Preview must not import the database"); });
vi.mock("@/auth/access", () => { throw new Error("Preview must not import authentication"); });
vi.mock("@/app/(customer)/app/setup/[cardId]/actions", () => { throw new Error("Preview must not import setup actions"); });
import PreviewPage from "./page";
const page = (query: Record<string, string | string[]> = {}) => PreviewPage({ searchParams: Promise.resolve(query) });
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", ""); });
afterEach(() => vi.unstubAllEnvs());
test.each(["production", "test", ""])("unavailable in NODE_ENV=%s", async environment => {
  vi.stubEnv("NODE_ENV", environment);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});
test.each(["production", "preview"])("unavailable in %s deployment", async environment => {
  vi.stubEnv("VERCEL_ENV", environment);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});
test.each([["new", "goal"], ["name", "you"], ["draft", "contact"], ["ready", "review"]])("synthetic %s resumes to %s", async (state, step) => {
  await expect(page({ state })).rejects.toThrow(`REDIRECT:?state=${state}&step=${step}`);
});
test("same resolver guards missing Profile, and permits optional-step shell", async () => {
  await expect(page({ state: "new", step: "style" })).rejects.toThrow("REDIRECT:?state=new&step=goal");
  expect(renderToStaticMarkup(await page({ step: "photo" }))).toContain("Skip for now");
});
test("real Goal shell has five choices, quiet progress, accessible Continue and no writes", async () => {
  const html = renderToStaticMarkup(await page({ state: "new", step: "goal" }));
  const host = document.createElement("div"); host.innerHTML = html;
  expect(host.querySelectorAll('[name="goal"]')).toHaveLength(5);
  expect(host.querySelector('[aria-label="Setup progress"]')?.textContent).toBe("1 of 7");
  expect(host.querySelector('[role="progressbar"]')).toBeNull();
  expect(host.querySelector('form')?.getAttribute("method")).toBe("get");
  expect(html).not.toContain("$ACTION");
  expect(html).toContain("synthetic data");
  expect(host.querySelector('nav[aria-label="Setup navigation"] a')?.getAttribute("href")).toBe("?state=new");
});
test("You preview retains existing essentials fallback with disabled submit", async () => {
  const html = renderToStaticMarkup(await page({ state: "new", step: "you", goal: "business" }));
  expect(html).toContain("Full name");
  expect(html).toMatch(/<button[^>]*disabled=""/);
  expect(html).not.toContain("$ACTION");
});
