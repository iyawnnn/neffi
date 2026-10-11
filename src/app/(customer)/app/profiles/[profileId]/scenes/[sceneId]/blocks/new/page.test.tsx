import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), scene: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/editor", () => ({ sceneForEditing: m.scene }));
vi.mock("../../actions", () => ({ addBlockAction: vi.fn(), updateBlockAction: vi.fn(), renameSceneAction: vi.fn(), deleteSceneAction: vi.fn(), moveBlockAction: vi.fn(), toggleBlockAction: vi.fn(), removeBlockAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import NewBlockPage from "./page";
const render = async (type: string) => renderToStaticMarkup(await NewBlockPage({ params: Promise.resolve({ profileId: "p1", sceneId: "s1" }), searchParams: Promise.resolve({ type }) }));
beforeEach(() => { vi.resetAllMocks(); m.requireAccount.mockResolvedValue({ accountId: "a1" }); m.scene.mockResolvedValue({ scene: { id: "s1", name: "Main" } }); });
test.each([["about", ["About you"]], ["project", ["Project name", "Short description", "Link"]], ["link", ["Type", "Label", "Link", "Other"]], ["contact", ["Show a Save Contact button"]], ["booking", ["Button text", "Booking link"]], ["form", ["Connect", "Project inquiry", "Contact"]]])("new %s uses friendly labels", async (type, labels) => {
  const html = await render(type as string);
  for (const label of labels as string[]) expect(html).toContain(label);
  expect(html).toMatch(/<button[^>]*>Add<\/button>/);
});
test("unknown type or unowned Scene is not found", async () => {
  await expect(render("unknown")).rejects.toThrow("NOT_FOUND");
  m.scene.mockResolvedValue(null);
  await expect(render("about")).rejects.toThrow("NOT_FOUND");
});
