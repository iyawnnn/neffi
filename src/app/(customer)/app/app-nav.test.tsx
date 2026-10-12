import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => m.pathname }));
import { AppNav } from "./app-nav";

test.each([["/app", "Home"], ["/app/profiles/x", "Profiles"], ["/app/cards/x", "Cards"], ["/app/account", "Account"]])("navigation marks only the current section at %s", (path, current) => {
  m.pathname = path;
  const html = renderToStaticMarkup(<AppNav />);
  const links = [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)];
  expect(links.map(([, , label]) => label)).toEqual(["Home", "Profiles", "Cards", "Account"]);
  expect(links.map(([, attrs]) => attrs.match(/href="([^"]+)"/)?.[1])).toEqual(["/app", "/app/profiles", "/app/cards", "/app/account"]);
  for (const [, attrs, label] of links) {
    expect(attrs).toContain("min-h-11");
    expect(attrs.includes('aria-current="page"')).toBe(label === current);
  }
});
