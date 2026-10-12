import { renderToStaticMarkup } from "react-dom/server";
import { PRESETS } from "@/modules/forms/config";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), block: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/editor", () => ({ blockForEditing: m.block }));
vi.mock("../../actions", () => ({ addBlockAction: vi.fn(), updateBlockAction: vi.fn(), renameSceneAction: vi.fn(), deleteSceneAction: vi.fn(), moveBlockAction: vi.fn(), toggleBlockAction: vi.fn(), removeBlockAction: vi.fn(), updateFormAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import EditBlockPage from "./page";
const render = async () => renderToStaticMarkup(await EditBlockPage({ params: Promise.resolve({ profileId: "p1", sceneId: "s1", blockId: "b1" }), searchParams: Promise.resolve({}) }));
beforeEach(() => { vi.resetAllMocks(); m.requireAccount.mockResolvedValue({ accountId: "a1" }); m.block.mockResolvedValue({ id: "b1", sceneId: "s1", type: "project", content: { title: "My site", description: "Hello", url: "https://ana.example/" } }); });
test("editing fields are prefilled", async () => {
  const html = await render();
  for (const text of ["My site", "Hello", "https://ana.example/", "Project name", "Short description"]) expect(html).toContain(text);
  expect(html).toMatch(/<button[^>]*>Save<\/button>/);
});
test("form Block shows editable form settings with fixed required name", async () => {
  m.block.mockResolvedValue({ id: "b1", sceneId: "s1", type: "form", content: {}, form: { id: "f1", title: "Contact", config: PRESETS.contact.config } });
  const html = await render();
  expect(html).toContain("Form settings");
  expect(html).toContain("Form title");
  expect(html).toContain('name="field.name" value="required"');
  expect(html).not.toContain('<select name="field.name"');
  for (const mode of ["Hidden", "Optional", "Required"]) expect(html).toContain(mode);
  for (const field of ["email", "phone", "company", "message"]) expect(html).toContain(`name="field.${field}"`);
});
test("unowned or wrong-scene Block is not found", async () => {
  m.block.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
  m.block.mockResolvedValue({ id: "b1", sceneId: "different", type: "about", content: { text: "Other" } });
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
