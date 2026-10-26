// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));
vi.mock("@/auth/actions", () => ({ signOutAction: vi.fn() }));
import { AppHeader } from "./app-nav";

test.each([null, "http://lh3.googleusercontent.com/photo", "https://example.test/photo", "https://lh3.googleusercontent.com/a/photo"])("avatar falls back safely when absent, rejected or unable to load (%s)", async image => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<AppHeader account={{ name: "Maya Santos", email: "maya@example.test", image }} unread={0} />));
    const trigger = host.querySelector('[aria-label="Account menu for Maya Santos"]')!;
    const img = trigger.querySelector("img");
    if (image?.startsWith("https://lh3.googleusercontent.com/")) {
      expect(img).not.toBeNull();
      await act(async () => img!.dispatchEvent(new Event("error")));
    }
    expect(trigger.querySelector("img")).toBeNull();
    expect(trigger.querySelector('[aria-hidden="true"]')?.textContent).toBe("M");
    expect(trigger.getAttribute("aria-label")).toBe("Account menu for Maya Santos");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

test.each([[true, true], [false, false]])("the Account menu lists Admin dashboard only for an OWNER (owner=%s)", async (owner, expected) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<AppHeader account={{ name: "Maya Santos", email: "maya@example.test" }} unread={0} owner={owner} />));
    await act(async () => (host.querySelector('[aria-label="Account menu for Maya Santos"]') as HTMLElement).click());
    const hrefs = [...document.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(hrefs.includes("/admin")).toBe(expected);
    for (const href of ["/app", "/app/profiles", "/app/cards", "/app/account"]) expect(hrefs).toContain(href);
    expect(document.body.textContent?.includes("Admin dashboard")).toBe(expected);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
