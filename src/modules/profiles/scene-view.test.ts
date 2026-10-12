import { expect, test } from "vitest";
import { PRESETS, visibleFields } from "../forms/config";
import { buildSceneView, type SceneViewInput } from "./scene-view";

const base = () => ({
  profile: { fullName: "Ana Maria Cruz", headline: "Designer", company: null, bio: null, phone: null, email: null, website: null, location: null, accentColor: null, imageIsLogo: false },
  imageUrl: null,
  scene: { id: "s1", name: "Main" },
  blocks: [], forms: [],
} satisfies SceneViewInput);
const block = (id: string, type: string, position: number, content: unknown, visible = true, formId: string | null = null) => ({ id, type, position, content, visible, formId });

test("hidden blocks are dropped and display order follows position", () => {
  const view = buildSceneView({ ...base(), blocks: [block("b2", "about", 2, { text: "Last" }), block("b1", "about", 0, { text: "First" }), block("hidden", "about", 1, { text: "Hidden" }, false)] });
  expect(view.blocks).toEqual([{ id: "b1", type: "about", text: "First" }, { id: "b2", type: "about", text: "Last" }]);
});
test("link and booking labels fall back to customer labels", () => {
  const view = buildSceneView({ ...base(), blocks: [block("link", "link", 0, { kind: "github", label: null, url: "https://github.com/ana" }), block("booking", "booking", 1, { label: null, url: "https://cal.com/ana" })] });
  expect(view.blocks).toEqual([
    { id: "link", type: "link", kind: "github", label: "GitHub", url: "https://github.com/ana" },
    { id: "booking", type: "booking", label: "Book a time", url: "https://cal.com/ana" },
  ]);
});
test("contact uses shared identity and drops an empty contact without Save contact", () => {
  const input = { ...base(), blocks: [block("contact", "contact", 0, { saveContact: false })] };
  expect(buildSceneView(input).blocks).toEqual([]);
  const contacts = { phone: "+63 917 123 4567", email: "ana@e.test", website: "https://ana.example/", location: "Manila" };
  expect(buildSceneView({ ...input, profile: { ...input.profile, ...contacts } }).blocks).toEqual([{ id: "contact", type: "contact", saveContact: false, ...contacts }]);
  expect(buildSceneView({ ...input, blocks: [block("contact", "contact", 0, { saveContact: true })] }).blocks).toHaveLength(1);
});
test("forms carry title and visible fields; missing or invalid forms are dropped", () => {
  const input = { ...base(), blocks: [block("form", "form", 0, {}, true, "f1")] };
  expect(buildSceneView(input).blocks).toEqual([]);
  expect(buildSceneView({ ...input, forms: [{ id: "f1", title: "Hello", config: {} }] }).blocks).toEqual([]);
  expect(buildSceneView({ ...input, forms: [{ id: "f1", title: "Hello", config: PRESETS.contact.config }] }).blocks).toEqual([{ id: "form", type: "form", formId: "f1", title: "Hello", fields: visibleFields(PRESETS.contact.config) }]);
});
test.each([["Ana Maria Cruz", "AC"], ["ana", "A"], [" ", "N"]])("initials for %j", (fullName, initials) => {
  const input = base();
  expect(buildSceneView({ ...input, profile: { ...input.profile, fullName } }).identity).toMatchObject({ initials, accent: "#0C0C0D", image: null });
});
