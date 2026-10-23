import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => m.pathname }));
vi.mock("@/auth/actions", () => ({ signOutAction: vi.fn() }));
import { AppHeader, AppNav } from "./app-nav";

const ACCOUNT = { name: "Ian Macabulos", email: "ian@example.test" };

test("setup has a compact exit header and no app navigation", () => {
  m.pathname = "/app/setup/test-card";
  try {
    const html = renderToStaticMarkup(<AppHeader account={ACCOUNT} unread={0} />);
    expect(html).toContain("Finish later");
    expect(html).toContain('href="/app"');
    expect(html).not.toContain("Account menu");
    expect(html).not.toContain('aria-label="Main"');
    expect(renderToStaticMarkup(<AppNav />)).toBe("");
  } finally {
    m.pathname = "/app";
  }
});

const sectionLinks = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)]
    .map(([, attrs, inner]) => ({ attrs, label: inner.replace(/<[^>]+>/g, ""), href: attrs.match(/href="([^"]+)"/)?.[1] }))
    .filter(({ attrs }) => !attrs.includes('aria-label="Neffi home"') && !attrs.includes('href="/app/inbox"'));

// Account lives in the avatar menu, so on /app/account no section is current.
test.each([["/app", "Home"], ["/app/profiles/x", "Profiles"], ["/app/cards/x", "Cards"], ["/app/account", null], ["/app/inbox", null]])("the shared desktop/mobile dock marks only the current section at %s", (path, current) => {
  m.pathname = path;
  const links = sectionLinks(renderToStaticMarkup(<AppNav />));
  expect(links.map(({ label }) => label)).toEqual(["Home", "Profiles", "Cards"]);
  expect(links.map(({ href }) => href)).toEqual(["/app", "/app/profiles", "/app/cards"]);
  for (const { attrs, label } of links) {
    expect(attrs).toMatch(/\bmin-h-1[12]\b/);
    expect(attrs.includes('aria-current="page"')).toBe(label === current);
  }
});

test("the header carries the logo home link and the account menu", () => {
  const html = renderToStaticMarkup(<AppHeader account={ACCOUNT} unread={0} />);
  expect(html).toMatch(/<a [^>]*aria-label="Neffi home"[^>]*href="\/app"|<a [^>]*href="\/app"[^>]*aria-label="Neffi home"/);
  expect(html).toContain("var(--brand)");
  expect(html).toContain('aria-label="Account menu for Ian Macabulos"');
  expect(html).toContain(">Ian<");
  expect(html).not.toContain("Macabulos<");
});

test("without a display name the account menu falls back to the email name", () => {
  expect(renderToStaticMarkup(<AppHeader account={{ name: null, email: "pat.lee@example.test" }} unread={0} />)).toContain('aria-label="Account menu for pat.lee"');
});

test.each([0, 1, 3])("the Inbox bell links to the real Inbox and shows an unread dot only when nonzero (%s)", (unread) => {
  m.pathname = "/app";
  const html = renderToStaticMarkup(<AppHeader account={ACCOUNT} unread={unread} />);
  const bell = html.match(/<a [^>]*href="\/app\/inbox"[^>]*>(.*?)<\/a>/);
  expect(bell).not.toBeNull();
  expect(bell![0]).toContain(unread ? `aria-label="Inbox, ${unread} unread"` : 'aria-label="Inbox"');
  expect(bell![0]).toMatch(/\bsize-11\b/);
  expect(bell![1].includes("bg-brand")).toBe(unread > 0);
});


test("primary navigation is a separate Ink dock that grows without a three-column grid", () => {
  m.pathname = "/app";
  const header = renderToStaticMarkup(<AppHeader account={ACCOUNT} unread={1} />);
  const dock = renderToStaticMarkup(<AppNav />);
  expect(header).not.toContain('aria-label="Main"');
  expect(dock).toContain("nav-ink-surface");
  expect(dock).toContain("auto-cols-fr");
  expect(dock).not.toContain("grid-cols-3");
  expect(dock.match(/<nav[^>]*>/)?.[0]).not.toContain("md:hidden");
  expect(dock).not.toContain("Get Neffi");
});
