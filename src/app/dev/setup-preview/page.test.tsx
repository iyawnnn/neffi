// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/db", () => { throw new Error("Preview must not import the database"); });
vi.mock("@/auth/access", () => { throw new Error("Preview must not import authentication"); });
vi.mock("@/app/(customer)/app/setup/[cardId]/actions", () => { throw new Error("Preview must not import setup actions"); });
vi.mock("@/app/(customer)/app/profiles/[profileId]/scenes/[sceneId]/actions", () => ({ loadItemAction: vi.fn(), mutateItemAction: vi.fn() }));
vi.mock("@/app/(customer)/app/profiles/[profileId]/image-upload", () => ({ ImageUpload: () => <div>Development image uploader</div> }));
import PreviewPage from "./page";
const page = (query: Record<string, string | string[]> = {}) => PreviewPage({ searchParams: Promise.resolve(query) });
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", ""); });
afterEach(() => vi.unstubAllEnvs());
test.each(["production", "test", ""])("unavailable in NODE_ENV=%s", async environment => {
  vi.stubEnv("NODE_ENV", environment);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});
test.each(["production", "preview"])("unavailable in %s deployment", async environment => {
  vi.stubEnv("VERCEL_ENV", environment);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});
test.each([["new", "goal"], ["name", "you"], ["draft", "contact"], ["ready", "review"]])("synthetic %s resumes to %s", async (state, step) => {
  await expect(page({ state })).rejects.toThrow(`REDIRECT:?state=${state}&step=${step}`);
});
test("same resolver guards missing Profile, and permits optional-step shell", async () => {
  await expect(page({ state: "new", step: "style" })).rejects.toThrow("REDIRECT:?state=new&step=goal");
  expect(renderToStaticMarkup(await page({ step: "photo" }))).toContain("Skip for now");
});
test("real Goal shell has five choices, quiet progress, accessible Continue and no writes", async () => {
  const html = renderToStaticMarkup(await page({ state: "new", step: "goal" }));
  const host = document.createElement("div"); host.innerHTML = html;
  expect(host.querySelectorAll('[name="goal"]')).toHaveLength(5);
  expect(host.querySelector('[aria-label="Setup progress"]')?.textContent).toBe("1 of 7");
  expect(host.querySelector('[role="progressbar"]')).toBeNull();
  expect(host.querySelector('form')?.getAttribute("method")).toBe("get");
  expect(html).not.toContain("$ACTION");
  expect(html).toContain("synthetic data");
  expect(host.querySelector('nav[aria-label="Setup navigation"] a')?.getAttribute("href")).toBe("?state=new");
});
test("You preview uses the real setup editor with editable synthetic fields", async () => {
  const html = renderToStaticMarkup(await page({ state: "new", step: "you", goal: "business" }));
  expect(html).toContain("Full name");
  expect(html).toContain("Only your full name is required.");
  expect(html).toContain("Continue");
  expect(html).not.toContain("$ACTION");
});
test("Photo and Contact fixtures cover empty, existing photo/logo, filled and validation flows", async () => {
  const emptyPhoto = renderToStaticMarkup(await page({ state: "draft", step: "photo" }));
  const photo = renderToStaticMarkup(await page({ state: "draft", step: "photo", image: "photo" }));
  const logo = renderToStaticMarkup(await page({ state: "draft", step: "photo", image: "logo" }));
  const emptyContact = renderToStaticMarkup(await page({ state: "draft", step: "contact" }));
  const filledContact = renderToStaticMarkup(await page({ state: "draft", step: "contact", contact: "filled" }));
  const errorContact = renderToStaticMarkup(await page({ state: "draft", step: "contact", contact: "error" }));
  expect(emptyPhoto).toContain("Development image uploader");
  expect(photo).toContain("Development image uploader");
  expect(logo).toContain("This is a logo");
  expect(emptyContact).toContain("customer@example.invalid");
  expect(filledContact).toContain("ana@example.test");
  expect(errorContact).toContain("Public email");
});
test("Links preview uses the real setup Links surface for empty and existing synthetic items", async () => {
  expect(renderToStaticMarkup(await page({ state: "draft", step: "links", goal: "freelance", items: "empty" }))).toContain("Add something else");
  expect(renderToStaticMarkup(await page({ state: "draft", step: "links", goal: "business", items: "existing" }))).toContain("Added to your profile");
});
