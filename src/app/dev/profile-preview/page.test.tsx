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

test("Editorial fixture uses the real layout and keeps fixture links on that layout", async () => {
  const html = renderToStaticMarkup(await page({ layout: "editorial", sample: "long" }));
  expect(html).toContain('data-layout="editorial"');
  expect(html).toContain("?layout=editorial&amp;mode=dark");
  expect(html).toContain("averylongpublicemailaddress");
  expect(html).not.toContain("<form");
});

test.each(["full", "link-featured", "minimal"])("Showcase %s fixture uses its real layout without live controls", async sample => {
  const html = renderToStaticMarkup(await page({ layout: "showcase", sample }));
  expect(html).toContain('data-layout="showcase"');
  expect(html).toContain("?layout=showcase&amp;mode=dark");
  expect(html).not.toContain("<form");
  if (sample === "full") expect(html).toContain("A home for independent ideas");
  if (sample === "link-featured") {
    expect(html).not.toContain("A home for independent ideas");
    expect(html).toContain('aria-label="Featured"');
  }
  if (sample === "minimal") expect(html).not.toContain('aria-label="Featured"');
});

test.each(["light", "dark"])("%s local cover fixture works for full and minimal Showcase without Cloudinary", async mode => {
  for (const sample of ["full", "minimal"]) {
    const html = renderToStaticMarkup(await page({ layout: "showcase", cover: "sample", image: "photo", mode, sample }));
    expect(html).toContain('class="pf-showcase-cover"');
    expect(html).toContain("/dev/profile-cover.svg");
    expect(html).toContain("/avatar-example.jpg");
    expect(html).not.toContain('class="pf-showcase-band"');
    expect(html).not.toContain("res.cloudinary.com");
    expect(html).not.toContain("<form");
  }
});
