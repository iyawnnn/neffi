import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PRESETS, visibleFields } from "@/modules/forms/config";
import type { SceneView } from "@/modules/profiles/scene-view";
import { SceneViewPreview } from "./scene-view";

const base: SceneView = {
  identity: { fullName: "Ana Cruz", initials: "AC", headline: "Designer", company: null, bio: null, phone: null, email: null, website: null, location: null, accent: "#0C0C0D", onAccent: "#FFFFFF", image: null },
  scene: { id: "s1", name: "Main" }, blocks: [],
};
test("renders name, headline and initials", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={base} />);
  for (const text of ["Ana Cruz", "Designer", "AC"]) expect(html).toContain(text);
});
test("external link is touch-safe and safely opens a new tab", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={{ ...base, blocks: [{ id: "b1", type: "link", kind: "github", label: "GitHub", url: "https://github.com/ana" }] }} />);
  const tag = html.match(/<a\b[^>]*>/)?.[0];
  expect(tag).toContain('href="https://github.com/ana"');
  expect(tag).toContain('target="_blank"');
  expect(tag).toContain('rel="noopener noreferrer"');
  expect(tag).toContain("min-h-11");
});
test("form preview has only disabled controls and explanatory text", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={{ ...base, blocks: [{ id: "f1", type: "form", formId: "form", title: "Send me a message", fields: visibleFields(PRESETS.contact.config) }] }} />);
  expect(html).toContain("Visitors can send you a message here.");
  for (const [tag] of html.matchAll(/<(?:input|textarea|button)\b[^>]*>/g)) expect(tag).toContain("disabled");
  expect(html).toContain("(required)");
});
test("contact links work; Save contact remains disabled until M7", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={{ ...base, blocks: [{ id: "c1", type: "contact", saveContact: true, phone: "+639171234567", email: "ana@e.test", website: null, location: null }] }} />);
  expect(html).toContain('href="tel:+639171234567"');
  expect(html).toContain('href="mailto:ana@e.test"');
  expect(html).toContain("Save contact");
  expect(html.match(/<button\b[^>]*>/)?.[0]).toContain("disabled");
});
