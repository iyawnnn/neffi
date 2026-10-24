// @vitest-environment happy-dom
import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import GuidePage from "./guide/page";
import PricingPage from "./pricing/page";
import HelpPage from "./help/page";
import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page";
import TermsPage, { metadata as termsMetadata } from "./terms/page";
import { MarketingFooter } from "./marketing-footer";

const appRoot = join(process.cwd(), "src/app");
const publicRoot = join(process.cwd(), "public");
const routes = new Set(readdirSync(appRoot, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name === "page.tsx")
  .map(entry => "/" + relative(appRoot, entry.parentPath).split(sep).filter(part => part && !part.startsWith("(")).join("/")));
const pages = { "/guide": GuidePage, "/pricing": PricingPage, "/help": HelpPage, "/privacy": PrivacyPage, "/terms": TermsPage };
const rendered = Object.fromEntries(Object.entries(pages).map(([path, Page]) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<><Page /><MarketingFooter /></>);
  return [path, host];
}));

test.each(Object.keys(pages))("%s has a clear landmark, valid destinations and existing artwork", path => {
  const host = rendered[path];
  expect(host.querySelectorAll("main")).toHaveLength(1);
  expect([...host.querySelectorAll("h1")].filter(heading => !heading.closest("[inert]"))).toHaveLength(1);
  expect(host.querySelectorAll("footer")).toHaveLength(1);
  const ids = [...host.querySelectorAll("[id]")].map(element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const link of host.querySelectorAll("a")) {
    const href = link.getAttribute("href")!;
    expect(href).not.toBe("");
    expect(href).not.toBe("#");
    expect(href).not.toMatch(/^javascript:/i);
    const target = new URL(href, `https://neffi.example${path}`);
    if (target.origin !== "https://neffi.example") continue;
    expect(routes.has(target.pathname), href).toBe(true);
    if (target.hash && rendered[target.pathname]) {
      const targetIds = [...rendered[target.pathname].querySelectorAll("[id]")].map(element => element.id);
      expect(targetIds, href).toContain(decodeURIComponent(target.hash.slice(1)));
    }
  }
  for (const asset of host.querySelectorAll("img[src], image[href]")) {
    const source = asset.getAttribute("src") ?? asset.getAttribute("href")!;
    if (source.startsWith("/")) expect(existsSync(join(publicRoot, source.slice(1))), source).toBe(true);
  }
});

test.each([
  ["/privacy", privacyMetadata], ["/terms", termsMetadata],
] as const)("%s makes its unapproved legal status explicit and stays out of search indexes", (path, metadata) => {
  expect(rendered[path].textContent).toContain("Not yet published");
  expect(rendered[path].textContent).toContain("Approved copy required");
  expect(rendered[path].textContent).toContain("not a statement of legal terms or data practices");
  expect(metadata.robots).toEqual({ index: false, follow: true });
});

test("pricing offers an enquiry without inventing a price or checkout", () => {
  const host = rendered["/pricing"];
  expect(host.textContent).toContain("A public price and online checkout aren’t available here yet.");
  expect(host.textContent).not.toMatch(/(?:₱|PHP|\$)\s*\d/);
  expect(host.querySelector('a[href*="checkout"], form')).toBeNull();
  expect(host.querySelector('a.mp-button-primary')?.getAttribute("href")).toBe("/support");
});

test("footer links to real marketing pages while subscriptions and unconfigured socials stay inert", () => {
  const footer = rendered["/guide"].querySelector("footer")!;
  for (const path of ["/product", "/guide", "/pricing", "/help", "/privacy", "/terms"]) {
    expect(footer.querySelector(`a[href="${path}"]`), path).not.toBeNull();
  }
  expect(footer.querySelector("form, .marketing-footer-socials a")).toBeNull();
  expect(footer.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
});
