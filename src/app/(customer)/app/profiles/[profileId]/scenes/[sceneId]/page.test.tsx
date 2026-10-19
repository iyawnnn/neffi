import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), scene: vi.fn(), view: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/editor", () => ({ sceneForEditing: m.scene }));
vi.mock("@/modules/profiles/view", () => ({ loadOwnerSceneView: m.view }));
vi.mock("./actions", () => ({ renameSceneAction: vi.fn(), deleteSceneAction: vi.fn(), moveBlockAction: vi.fn(), toggleBlockAction: vi.fn(), removeBlockAction: vi.fn(), addBlockAction: vi.fn(), updateBlockAction: vi.fn() }));
vi.mock("../../actions", () => ({ createSceneAction: vi.fn(), deleteProfileAction: vi.fn(), showSceneAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: () => { throw new Error("NOT_FOUND"); } }));
import ScenePage from "./page";
const scene = () => ({ scene: { id: "s1", name: "Networking", isDefault: true, isShown: true }, blocks: [
  { id: "b1", type: "about", visible: true, summary: "Hello", content: { text: "Hello there" } },
  { id: "b2", type: "link", visible: false, summary: "GitHub", content: { kind: "github", label: "", url: "https://github.com/ana" } },
  { id: "b3", type: "link", visible: true, summary: "LinkedIn", content: { kind: "linkedin", label: "", url: "https://www.linkedin.com/in/ana" } },
  { id: "b4", type: "form", visible: true, summary: "Let's connect", content: {} },
] });
const view = { identity: { fullName: "Ana Reyes", initials: "AR", headline: "Designer", company: null, bio: null, phone: null, email: null, website: null, location: null, accent: "#0C0C0D", onAccent: "#FFFFFF", image: null }, scene: { id: "s1", name: "Networking" }, blocks: [] };
const render = async () => renderToStaticMarkup(await ScenePage({ params: Promise.resolve({ profileId: "p1", sceneId: "s1" }), searchParams: Promise.resolve({}) }));
beforeEach(() => { vi.resetAllMocks(); m.requireAccount.mockResolvedValue({ accountId: "a1" }); m.scene.mockResolvedValue(scene()); m.view.mockResolvedValue(view); });

test("items are grouped into sections with platform names, readable details and edit controls", async () => {
  const html = await render();
  const order = ["Socials &amp; links", "github.com/ana", "linkedin.com/in/ana", "Content", "Hello there", "Actions", "Let&#x27;s connect"].map(text => html.indexOf(text));
  expect(order.every(i => i >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  for (const label of ["GitHub", "LinkedIn", "About", "Let&#x27;s connect"]) expect(html).toContain(`aria-label="Edit ${label}"`);
  expect(html).toContain("Currently showing");
  expect(html).toContain('href="/app/profiles/p1/preview?scene=s1"');
});

test("visibility is a labelled switch; hidden items say so", async () => {
  const html = await render();
  expect(html).toMatch(/role="switch" aria-checked="false" aria-label="Show GitHub to visitors"/);
  expect(html).toMatch(/role="switch" aria-checked="true" aria-label="Show LinkedIn to visitors"/);
  expect(html).toMatch(/>GitHub<\/span><span[^>]*>Hidden<\/span>/);
});

test("reordering is explicit and no inline picker is rendered in normal sections", async () => {
  const html = await render();
  expect(html).toContain('aria-label="Reorder Socials &amp; links"');
  expect(html).not.toContain('aria-label="Move GitHub up"');
  expect(html).not.toContain("Popular");
  expect(html).not.toContain("Close");
});

test("empty sections explain what to add and the editor has no embedded live preview", async () => {
  m.scene.mockResolvedValue({ scene: { id: "s1", name: "Events", isDefault: false, isShown: false }, blocks: [] });
  const html = await render();
  expect(html).toContain("Add Facebook, LinkedIn, Instagram or another link.");
  expect(html).not.toContain("Currently showing");
  expect(html).not.toContain("Live preview");
  expect(html).not.toContain("<aside");
  expect(m.view).not.toHaveBeenCalled();
  expect(html).toContain('href="/app/profiles/p1/preview?scene=s1"');
  expect(html).toContain('aria-label="Add to Socials &amp; links"');
});

test("unowned scene is not found", async () => {
  m.scene.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
