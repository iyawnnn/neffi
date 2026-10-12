import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), scene: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/editor", () => ({ sceneForEditing: m.scene }));
vi.mock("./actions", () => ({ renameSceneAction: vi.fn(), deleteSceneAction: vi.fn(), moveBlockAction: vi.fn(), toggleBlockAction: vi.fn(), removeBlockAction: vi.fn(), addBlockAction: vi.fn(), updateBlockAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import ScenePage from "./page";
const scene = () => ({ scene: { id: "s1", name: "Main", isDefault: true }, blocks: [{ id: "b1", type: "about", visible: true, summary: "Hello", content: { text: "Hello" } }, { id: "b2", type: "link", visible: false, summary: "GitHub", content: { kind: "github", url: "https://github.com/ana" } }] });
const render = async () => renderToStaticMarkup(await ScenePage({ params: Promise.resolve({ profileId: "p1", sceneId: "s1" }), searchParams: Promise.resolve({}) }));
beforeEach(() => { vi.resetAllMocks(); m.requireAccount.mockResolvedValue({ accountId: "a1" }); m.scene.mockResolvedValue(scene()); });
test("Scene renders rename, ordered summaries, edit and confirmed removal", async () => {
  const html = await render();
  for (const text of ["Rename", "About", "Hello", "Link", "GitHub", "Hide", "Show", "Remove"]) expect(html).toContain(text);
  for (const id of ["b1", "b2"]) expect(html).toContain(`href="/app/profiles/p1/scenes/s1/blocks/${id}"`);
  expect(html).toContain('name="confirm"');
  const up = [...html.matchAll(/<button\b([^>]*)>Move up<\/button>/g)];
  const down = [...html.matchAll(/<button\b([^>]*)>Move down<\/button>/g)];
  expect(up[0][1]).toContain("disabled");
  expect(up[1][1]).not.toContain("disabled=");
  expect(down[0][1]).not.toContain("disabled=");
  expect(down[1][1]).toContain("disabled");
});
test("absent Block types are offered before present ones; Default cannot be deleted", async () => {
  const html = await render();
  for (const type of ["about", "project", "link", "contact", "booking", "form"]) expect(html).toContain(`/blocks/new?type=${type}`);
  expect(html.indexOf("Add Project")).toBeLessThan(html.indexOf("Add About"));
  expect(html).not.toContain("Delete scene");
  m.scene.mockResolvedValue({ ...scene(), scene: { id: "s1", name: "Events", isDefault: false } });
  expect(await render()).toContain("Delete scene");
});
test("unowned scene is not found", async () => {
  m.scene.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
