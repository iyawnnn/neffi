// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/db", () => { throw new Error("Preview must not import the database"); });
vi.mock("@/auth/access", () => { throw new Error("Preview must not import authentication"); });
vi.mock("@/app/(customer)/app/setup/[cardId]/actions", () => { throw new Error("Preview must not import setup actions"); });
import PreviewPage from "./page";
import { EssentialsFields } from "@/app/(customer)/app/setup/[cardId]/setup-view";

const page = (query: Record<string, string | string[]> = {}) => PreviewPage({ searchParams: Promise.resolve(query) });
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", ""); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test.each(["production", "test", ""])("preview is unavailable in NODE_ENV=%s", async environment => {
  vi.stubEnv("NODE_ENV", environment);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});

test.each(["production", "preview"])("preview is unavailable in a %s deployment", async environment => {
  vi.stubEnv("VERCEL_ENV", environment);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});

test("purpose selection uses the real setup presentation and fake data", async () => {
  const html = renderToStaticMarkup(await page({ step: "purpose" }));
  expect(html).toContain("Development preview");
  expect(html).toContain("Choose your starting point");
  expect(html).toContain("Choose what you want your Neffi to focus on first. You can change this later.");
  const host = document.createElement("div");
  host.innerHTML = html;
  expect(host.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("1");
  expect(host.querySelector('[role="progressbar"] > div')?.className).toContain("w-1/2");
  expect(host.querySelectorAll("main a")).toHaveLength(3);
  expect(host.querySelectorAll('a[aria-label="Neffi home"]')).toHaveLength(1);
  expect(host.querySelector("main aside, main svg[viewBox='398 198 843 212']")).toBeNull();
  for (const purpose of ["network", "get_clients", "show_my_work"]) expect(html).toContain(`href="?purpose=${purpose}"`);
  expect(html).not.toContain("<form");
});

test.each([
  ["network", "LinkedIn or main profile link", "linkedin.com/in/yourname"],
  ["get_clients", "Booking link", "cal.com/yourname"],
  ["show_my_work", "Portfolio link", "yourportfolio.com"],
])("renders the real %s essentials fields without a server action", async (purpose, label, placeholder) => {
  const html = renderToStaticMarkup(await page({ purpose }));
  expect(html).toContain("Make it yours");
  for (const copy of ["Full name", "Role or headline", "Short intro", "Email", "Phone", label, "Create my Neffi"]) expect(html).toContain(copy);
  expect(html).toContain('value="customer@example.invalid"');
  expect(html).toContain('href="?step=purpose"');
  expect(html).toContain("Back");
  expect(html).not.toContain("Change</a>");
  expect(html).toContain("Add the details people should see first. You can edit everything later.");
  const host = document.createElement("div");
  host.innerHTML = html;
  expect(host.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("2");
  expect(host.querySelector('[role="progressbar"] > div')?.className).toContain("w-full");
  expect(host.querySelector('main a[href="?step=purpose"]')?.textContent?.trim()).toBe("Back");
  expect(host.querySelector("header div")?.className).toContain("rounded-[16px]");
  expect(host.querySelector("header div")?.className).toContain("shadow-xs");
  for (const [name, hint] of Object.entries({ fullName: "Juan Dela Cruz", headline: "Web Developer", bio: "I build simple digital experiences for businesses and teams.", email: "you@example.com", phone: "09XX XXX XXXX", link: placeholder })) {
    const input = host.querySelector(`[name="${name}"]`);
    expect(input?.getAttribute("placeholder")).toBe(hint);
    const shell = input?.closest("div");
    expect(shell?.className).toContain("focus-within:border-brand");
    expect(shell?.querySelector("svg")?.className).toContain("group-focus-within:text-brand");
  }
  expect(html).toContain("Step 2 of 2");
  expect(html).toContain("bg-action");
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*Create my Neffi[\s\S]*<\/button>/);
  expect(html).not.toMatch(/\baction=|\$ACTION/);
});

test("an invalid purpose falls back to selection", async () => {
  expect(renderToStaticMarkup(await page({ purpose: "unknown" }))).toContain("Choose your starting point");
});

test("real essentials retain an enabled brand CTA and accessible validation state", () => {
  const html = renderToStaticMarkup(<EssentialsFields purpose="get_clients" linkLabel="Booking link" defaultEmail="customer@example.invalid" state={{ error: "Check the highlighted fields and try again.", fields: ["fullName"] }} />);
  expect(html).toContain("bg-action");
  expect(html).not.toMatch(/<button[^>]*disabled=""/);
  const host = document.createElement("div");
  host.innerHTML = html;
  expect(host.querySelector('[name="fullName"]')?.getAttribute("aria-invalid")).toBe("true");
  expect(html).toContain('role="alert"');
});

test("preview prevents submission even if a submit event is dispatched directly", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    const content = await page({ purpose: "network" });
    await act(async () => root.render(content));
    for (const label of ["Full name", "Role or headline", "Short intro", "Email", "Phone (optional)", "LinkedIn or main profile link"]) {
      const fieldLabel = [...host.querySelectorAll("label")].find(element => element.textContent?.trim() === label);
      expect(fieldLabel?.querySelector("input, textarea")).toBeTruthy();
    }
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    const event = new Event("submit", { bubbles: true, cancelable: true });
    await act(async () => host.querySelector("form")!.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
