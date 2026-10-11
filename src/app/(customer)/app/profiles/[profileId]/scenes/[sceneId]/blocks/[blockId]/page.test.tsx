import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), block: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/editor", () => ({ blockForEditing: m.block }));
vi.mock("../../actions", () => ({ addBlockAction: vi.fn(), updateBlockAction: vi.fn(), renameSceneAction: vi.fn(), deleteSceneAction: vi.fn(), moveBlockAction: vi.fn(), toggleBlockAction: vi.fn(), removeBlockAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import EditBlockPage from "./page";
const render = async () => renderToStaticMarkup(await EditBlockPage({ params: Promise.resolve({ profileId: "p1", sceneId: "s1", blockId: "b1" }), searchParams: Promise.resolve({}) }));
beforeEach(() => { vi.resetAllMocks(); m.requireAccount.mockResolvedValue({ accountId: "a1" }); m.block.mockResolvedValue({ id: "b1", sceneId: "s1", type: "project", content: { title: "My site", description: "Hello", url: "https://ana.example/" } }); });
test("editing fields are prefilled", async () => {
  const html = await render();
  for (const text of ["My site", "Hello", "https://ana.example/", "Project name", "Short description"]) expect(html).toContain(text);
  expect(html).toMatch(/<button[^>]*>Save<\/button>/);
});
test("form Block is a settings placeholder until Task 17", async () => {
  m.block.mockResolvedValue({ id: "b1", sceneId: "s1", type: "form", content: {} });
  const html = await render();
  expect(html).toContain("Form settings");
  expect(html).toContain('href="/app/profiles/p1/scenes/s1"');
});
test("unowned or wrong-scene Block is not found", async () => {
  m.block.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
  m.block.mockResolvedValue({ id: "b1", sceneId: "different", type: "about", content: { text: "Other" } });
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
