import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ pathname: "/activate", viewer: null as { email: string } | null }));
vi.mock("next/navigation", () => ({ usePathname: () => m.pathname, redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/auth/access", () => ({ getViewer: () => Promise.resolve(m.viewer) }));
vi.mock("@/app/(public)/activate/challenge-cookie", () => ({ readChallenge: () => Promise.resolve(null) }));
vi.mock("@/app/(public)/activate/activate-forms", () => ({ CodeForm: () => <form data-activation="" />, ClaimForm: () => null, StartOverButton: () => null, SwitchAccountButton: () => null }));
vi.mock("@/app/(public)/sign-in/sign-in-form", () => ({ SignInForm: () => <form data-sign-in="" /> }));
vi.mock("@/app/(public)/support/support-form", () => ({ SupportForm: () => <form data-support="" /> }));
vi.mock("@/app/(public)/support/recover/recovery-form", () => ({ RecoveryForm: () => <form data-recovery="" /> }));

import { PublicSiteShell } from "./public-site-shell";
import ActivateLayout from "@/app/(public)/activate/layout";
import SignInLayout from "@/app/(public)/sign-in/layout";
import SupportLayout from "@/app/(public)/support/layout";
import Activate from "@/app/(public)/activate/page";
import SignIn from "@/app/(public)/sign-in/page";
import Support from "@/app/(public)/support/page";
import Recover from "@/app/(public)/support/recover/page";
import { Unavailable } from "@/app/(public)/c/[token]/unavailable";
import { readFileSync, existsSync } from "node:fs";

const props = { params: Promise.resolve({}), searchParams: Promise.resolve({}) };

test.each([
  ["/activate", ActivateLayout, () => Activate(props)],
  ["/sign-in", SignInLayout, () => SignIn(props)],
  ["/support", SupportLayout, () => Support(props)],
  ["/support/recover", SupportLayout, () => Recover()],
] as const)("%s shares public navigation and footer without a legacy header", async (path, Layout, page) => {
  m.pathname = path;
  const html = renderToStaticMarkup(<Layout>{await page()}</Layout>);
  expect(html.match(/aria-label="Main"/g)).toHaveLength(2); // desktop and mobile
  expect(html.match(/<footer/g)).toHaveLength(1);
  expect(html.match(/aria-label="Neffi home"/g)).toHaveLength(1);
  expect(html).toContain("data-marketing-content");
  expect(html.match(/<header/g)).toHaveLength(1);
  expect(html).toContain('href="/privacy"');
  expect(html).toContain('href="/terms"');
  expect(html).toMatch(/aria-current="page"[^>]*data-active="true"/);
});

test("marketing layout delegates to the same shell and retains the active Product link", () => {
  m.pathname = "/product";
  const html = renderToStaticMarkup(<PublicSiteShell><main>Product</main></PublicSiteShell>);
  expect([...html.matchAll(/<a\b[^>]*>/g)].some(([tag]) => tag.includes('href="/product"') && tag.includes('aria-current="page"'))).toBe(true);
  expect(html.match(/<footer/g)).toHaveLength(1);
  expect(readFileSync("src/app/(marketing)/layout.tsx", "utf8")).toContain("PublicSiteShell");
});

test("public card and unavailable routes cannot inherit the public site shell", () => {
  const html = renderToStaticMarkup(<Unavailable />);
  expect(html).not.toMatch(/<nav|<footer|Neffi home/);
  for (const path of ["src/app/layout.tsx", "src/app/(public)/c/[token]/page.tsx", "src/app/(public)/c-unavailable/page.tsx"]) {
    expect(readFileSync(path, "utf8")).not.toMatch(/PublicSiteShell|PublicUtilityLayout|MarketingNav|AppNav/);
  }
  expect(existsSync("src/app/(public)/layout.tsx")).toBe(false);
});
