// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("geist/font/sans", () => ({ GeistSans: { variable: "" } }));
vi.mock("next/font/google", () => ({ Geist_Mono: () => ({ variable: "" }) }));

import { robotsFor } from "./robots";
import { sitemapFor } from "./sitemap";
import Home, { metadata as home } from "./(marketing)/page";
import { metadata as product } from "./(marketing)/product/page";
import { metadata as pricing } from "./(marketing)/pricing/page";
import { metadata as guide } from "./(marketing)/guide/page";
import { metadata as help } from "./(marketing)/help/page";
import { metadata as privacy } from "./(marketing)/privacy/page";
import { metadata as terms } from "./(marketing)/terms/page";
import { metadata as root } from "./layout";

const indexable = [
  ["/", "Neffi", home],
  ["/product", "Product | Neffi", product],
  ["/pricing", "Pricing | Neffi", pricing],
  ["/guide", "Guide | Neffi", guide],
  ["/help", "Help | Neffi", help],
] as const;

test("root sets the canonical origin and the minimal brand-first title system", () => {
  expect(String(root.metadataBase)).toBe("https://getneffi.com/");
  expect(root.title).toEqual({ default: "Neffi", template: "%s | Neffi" });
});

test.each(indexable)("%s declares its own canonical, title and Open Graph", (path, renderedTitle, metadata) => {
  expect(metadata.alternates?.canonical).toBe(path);
  expect(metadata.openGraph).toMatchObject({ title: renderedTitle, description: metadata.description, url: path, siteName: "Neffi" });
  expect(metadata.twitter).toMatchObject({ title: renderedTitle, description: metadata.description });
  const images = [{ url: "/opengraph-image.png", width: 1200, height: 630 }];
  expect(metadata.openGraph).toMatchObject({ images });
  expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images });
  const pageTitle = typeof metadata.title === "string" ? metadata.title : undefined;
  expect(pageTitle ? `${pageTitle} | Neffi` : "Neffi").toBe(renderedTitle);
  expect(metadata.robots).toBeUndefined();
});

test("privacy and terms stay noindex without a canonical", () => {
  for (const metadata of [privacy, terms]) {
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toBeUndefined();
  }
});

test.each(["development", "preview"] as const)("%s blocks all crawling and publishes no sitemap", env => {
  expect(robotsFor(env)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  expect(sitemapFor(env)).toEqual([]);
});

test("production allows crawling except private areas and lists only the five canonical pages", () => {
  expect(robotsFor("production")).toEqual({
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/app/", "/api/", "/dev/"] },
    sitemap: "https://getneffi.com/sitemap.xml",
  });
  expect(sitemapFor("production").map(entry => entry.url)).toEqual([
    "https://getneffi.com", "https://getneffi.com/product", "https://getneffi.com/pricing", "https://getneffi.com/guide", "https://getneffi.com/help",
  ]);
});

test("Home emits Organization and WebSite JSON-LD without invented fields", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<Home />);
  const script = host.querySelector('script[type="application/ld+json"]')!;
  expect(script.textContent).not.toContain("<");
  const graph = JSON.parse(script.textContent!)["@graph"];
  expect(graph.map((node: { "@type": string }) => node["@type"])).toEqual(["Organization", "WebSite"]);
  expect(graph[0]).toMatchObject({ name: "Neffi", url: "https://getneffi.com", logo: "https://getneffi.com/apple-icon.png" });
  expect(graph[0].sameAs).toHaveLength(3);
  expect(script.textContent).not.toMatch(/legalName|address|telephone|contactPoint|SearchAction|aggregateRating/);
});
