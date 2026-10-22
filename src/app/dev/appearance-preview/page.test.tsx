import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/(customer)/app/profiles/[profileId]/actions", () => ({ updateAppearanceAction: vi.fn() }));
vi.mock("@/db", () => { throw new Error("Fixture must not import the database"); });
import PreviewPage from "./page";
const page = (query: Record<string, string> = {}) => PreviewPage({ searchParams: Promise.resolve(query) });
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", ""); });
afterEach(() => vi.unstubAllEnvs());
test.each(["production", "test"])("not available in %s", async mode => {
  vi.stubEnv("NODE_ENV", mode); await expect(page()).rejects.toThrow("NOT_FOUND");
});
test.each(["production", "preview"])("not available on %s Vercel deployment", async mode => {
  vi.stubEnv("VERCEL_ENV", mode); await expect(page()).rejects.toThrow("NOT_FOUND");
});
test("synthetic editor renders actual choices and cover without persistence", async () => {
  const html = renderToStaticMarkup(await page({ layout: "showcase", cover: "sample", mode: "dark", accent: "Ocean" }));
  expect(html).toContain('data-layout="showcase"'); expect(html).toContain("pf-showcase-cover");
  expect(html).toContain("Changes are not saved"); expect(html).toContain("colour-scheme:dark".replace("colour", "color"));
  expect(html).toMatch(/checked=""[^>]*value="#1F5FAE"/);
});
