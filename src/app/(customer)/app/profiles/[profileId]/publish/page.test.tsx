import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), profile: vi.fn(), view: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/profiles", () => ({ getOwnedProfile: m.profile }));
vi.mock("@/modules/profiles/view", () => ({ loadOwnerSceneView: m.view }));
vi.mock("@/components/scene-view", () => ({ SceneViewPreview: () => <article data-preview="" /> }));
vi.mock("../actions", () => ({ publishAction: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import PublishPage from "./page";
const render = async () => renderToStaticMarkup(await PublishPage({ params: Promise.resolve({ profileId: "p1" }), searchParams: Promise.resolve({}) }));
beforeEach(() => {
  vi.resetAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1" });
  m.profile.mockResolvedValue({ id: "p1", status: "draft", defaultSceneId: "s1", gaps: [] });
  m.view.mockResolvedValue({});
});
test("Draft shows preview and Publish", async () => {
  const html = await render();
  expect(html).toContain("Your Neffi is ready");
  expect(html).toContain("data-preview");
  expect(html).toContain("Publish");
  expect(m.view).toHaveBeenCalledWith({}, { accountId: "a1", profileId: "p1", sceneId: "s1" });
});
test("gaps show explanations and Edit details", async () => {
  m.profile.mockResolvedValue({ id: "p1", status: "draft", defaultSceneId: "s1", gaps: ["contact", "content"] });
  const html = await render();
  expect(html).toContain(PUBLISH_GAP_COPY.contact);
  expect(html).toContain(PUBLISH_GAP_COPY.content);
  expect(html).toContain('href="/app/profiles/p1/identity"');
  expect(html).toContain("Edit details");
});
test("Published redirects to overview", async () => {
  m.profile.mockResolvedValue({ status: "published" });
  await expect(render()).rejects.toThrow("REDIRECT:/app/profiles/p1");
});
test("unknown is not found", async () => {
  m.profile.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
