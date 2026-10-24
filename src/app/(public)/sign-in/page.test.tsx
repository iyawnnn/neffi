import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ getViewer: vi.fn(), redirect: vi.fn() }));
vi.mock("@/auth/access", () => ({ getViewer: m.getViewer }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("./sign-in-form", () => ({ SignInForm: () => <form data-sign-in="" /> }));

import Page, { metadata } from "./page";

test("metadata title is Continue to Neffi", () => {
  expect(metadata.title).toBe("Continue to Neffi");
});

test("sign-in help reaches public support without an auth next parameter", async () => {
  m.getViewer.mockResolvedValue(null);
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }));
  expect(html).toContain('href="/support#account-recovery"');
  expect(html).not.toContain("/support?next");
  expect(html).toContain("Lost access to your email?");
});

test("renders responsive hero artwork with desktop and mobile assets", async () => {
  m.getViewer.mockResolvedValue(null);
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }));
  expect(html).toContain("neffi-signin-hero-desktop.png");
  expect(html).toContain("neffi-signin-hero-mobile.png");
  expect(html).toContain("<picture");
  expect(html).toContain("data-sign-in");
});

test("redirects already authenticated viewer to safe next destination", async () => {
  m.getViewer.mockResolvedValue({ accountId: "acc-1", role: "customer" });
  await Page({ params: Promise.resolve({}), searchParams: Promise.resolve({ next: "/app/cards" }) });
  expect(m.redirect).toHaveBeenCalledWith("/app/cards");
});

test("an authenticated viewer can sign in again for Account email changes", async () => {
  m.redirect.mockClear();
  m.getViewer.mockResolvedValue({ accountId: "acc-1", role: "customer" });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({}), searchParams: Promise.resolve({ next: "/app/account" }) }));
  expect(m.redirect).not.toHaveBeenCalled();
  expect(html).toContain("data-sign-in");
});
