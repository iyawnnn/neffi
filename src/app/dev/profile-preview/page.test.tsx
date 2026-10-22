import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/db", () => { throw new Error("Profile fixture must not import the database"); });
vi.mock("@/auth/access", () => { throw new Error("Profile fixture must not import authentication"); });
import PreviewPage from "./page";
const page = (query: Record<string, string> = {}) => PreviewPage({ searchParams: Promise.resolve(query) });
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", ""); });
afterEach(() => vi.unstubAllEnvs());
test.each(["production", "test", ""])("fixture returns 404 in NODE_ENV=%s", async mode => {
  vi.stubEnv("NODE_ENV", mode);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});
test.each(["production", "preview"])("fixture returns 404 on %s deployments", async mode => {
  vi.stubEnv("VERCEL_ENV", mode);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});
test.each(["light", "dark"])("%s fixture uses the real renderer without live submission controls", async mode => {
  const html = renderToStaticMarkup(await page({ mode, accent: "Vermilion" }));
  expect(html).toContain('data-layout="classic"');
  expect(html).toContain(`color-scheme:${mode}`);
  expect(html).toContain(mode === "dark" ? "--pf-accent:#EF9D8B" : "--pf-accent:#E64A35");
  expect(html).toContain("Synthetic profile");
  expect(html).toContain("Visitors can send you a message here.");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("/c/");
});
