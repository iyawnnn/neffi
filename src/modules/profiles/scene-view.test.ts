import { expect, test } from "vitest";
import { PRESETS, visibleFields } from "../forms/config";
import { buildSceneView, type SceneViewInput } from "./scene-view";

const base = () => ({
  profile: { fullName: "Ana Maria Cruz", headline: "Designer", company: null, bio: null, phone: null, email: null, website: null, location: null, accentColor: null, imageIsLogo: false, layout: "classic", colorMode: "light" },
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

import { ACCENTS } from "./rules";
import { contrast, onAccent } from "./scene-view";

test("any stored link that is not https is dropped or blanked", () => {
  const view = buildSceneView({
    ...base(),
    profile: { ...base().profile, website: "http://ana.example/" },
    blocks: [
      block("l", "link", 0, { kind: "custom", label: null, url: "javascript:alert(1)" }),
      block("b", "booking", 1, { label: null, url: "data:text/html,hi" }),
      block("p", "project", 2, { title: "Site", description: null, url: "http://ana.example/" }),
      block("ok", "link", 3, { kind: "github", label: null, url: "https://github.com/ana" }),
    ],
  });
  expect(view.identity.website).toBeNull();
  expect(view.blocks).toEqual([
    { id: "p", type: "project", title: "Site", description: null, url: null },
    { id: "ok", type: "link", kind: "github", label: "GitHub", url: "https://github.com/ana" },
  ]);
});
test.each(ACCENTS.map(a => a.hex))("text on accent %s meets WCAG AA (4.5:1)", hex => {
  expect(contrast(hex, onAccent(hex))).toBeGreaterThanOrEqual(4.5);
});
test("view identity carries the accent text colour, Ink on Vermilion", () => {
  const view = buildSceneView({ ...base(), profile: { ...base().profile, accentColor: "#E64A35" } });
  expect(view.identity.onAccent).toBe("#0C0C0D");
  expect(buildSceneView(base()).identity.onAccent).toBe("#FFFFFF");
});

test.each([null, "#123456", "#0E7C86"])("appearance carries layout, mode and a curated accent for %s", accentColor => {
  const view = buildSceneView({ ...base(), profile: { ...base().profile, layout: "showcase", colorMode: "dark", accentColor } });
  expect(view).toHaveProperty("appearance", { layout: "showcase", mode: "dark", accent: accentColor === "#0E7C86" ? accentColor : "#0C0C0D", cover: null });
  expect(view.identity.accent).toBe(accentColor ?? "#0C0C0D");
});

test.each(["classic", "editorial", "showcase"] as const)("%s carries cover URLs only on appearance, with no identity/content changes", layout => {
  const input = { ...base(), profile: { ...base().profile, layout } };
  const cover = { src: "https://example.invalid/cover", srcSet: "https://example.invalid/cover 640w" };
  const before = buildSceneView(input);
  expect(buildSceneView({ ...input, cover })).toEqual({ ...before, appearance: { ...before.appearance, cover } });
});
