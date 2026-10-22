import { profileFixture } from "@/dev/profile-fixture";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), profile: vi.fn(), view: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/profiles", () => ({ getOwnedProfile: m.profile }));
vi.mock("@/modules/profiles/view", () => ({ loadOwnerSceneView: m.view }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import PreviewPage from "./page";
const render = async (query: Record<string, string> = {}) => renderToStaticMarkup(await PreviewPage({ params: Promise.resolve({ profileId: "p1" }), searchParams: Promise.resolve(query) }));
beforeEach(() => {
  vi.resetAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1" });
  m.profile.mockResolvedValue({ id: "p1", scenes: [{ id: "s1", name: "Main" }, { id: "s2", name: "Events" }] });
  m.view.mockResolvedValue({ ...profileFixture, scene: { id: "s2", name: "Events" } });
});
test.each(["classic", "editorial", "showcase"] as const)("%s preview explains its purpose and offers scene switching", async layout => {
  m.view.mockResolvedValue({ ...profileFixture, appearance: { ...profileFixture.appearance, layout } });
  const html = await render({ scene: "s2" });
  expect(html).toContain(`data-layout="${layout}"`);
  expect(html).toContain("This is a preview. Visitors see this when your Neffi is published.");
  for (const id of ["s1", "s2"]) expect(html).toContain(`href="?scene=${id}"`);
  expect(m.view).toHaveBeenCalledWith({}, { accountId: "a1", profileId: "p1", sceneId: "s2" });
});
test("unowned profiles are not found", async () => {
  m.profile.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
