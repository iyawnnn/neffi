import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PRESETS, visibleFields } from "@/modules/forms/config";
import type { SceneView } from "@/modules/profiles/scene-view";
import { SceneViewPreview } from "./scene-view";

const base: SceneView = {
  appearance: { layout: "classic", mode: "light", accent: "#0C0C0D" },
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
  expect(tag).toMatch(/min-h-1[12]/);
});
test("form preview has only disabled controls and explanatory text", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={{ ...base, blocks: [{ id: "f1", type: "form", formId: "form", title: "Send me a message", fields: visibleFields(PRESETS.contact.config) }] }} />);
  expect(html).toContain("Visitors can send you a message here.");
  for (const [tag] of html.matchAll(/<(?:input|textarea|button)\b[^>]*>/g)) expect(tag).toContain("disabled");
  expect(html).toContain("(required)");
});
test("contact links work; Save contact stays inert in the owner preview", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={{ ...base, blocks: [{ id: "c1", type: "contact", saveContact: true, phone: "+639171234567", email: "ana@e.test", website: null, location: null }] }} />);
  expect(html).toContain('href="tel:+639171234567"');
  expect(html).toContain('href="mailto:ana@e.test"');
  expect(html).toContain("Save contact");
  expect(html.match(/<button\b[^>]*>/)?.[0]).toContain("disabled");
});

const visitor = { saveContactHref: "/c/TOKEN/contact" };
const full: SceneView = { ...base, identity: { ...base.identity, phone: "+63 917 123 4567", email: "ana@e.test" }, blocks: [
  { id: "a", type: "about", text: "Hi" },
  { id: "p", type: "project", title: "Site", description: null, url: "https://ana.example/" },
  { id: "l", type: "link", kind: "github", label: "GitHub", url: "https://github.com/ana" },
  { id: "c", type: "contact", saveContact: true, phone: "+63 917 123 4567", email: "ana@e.test", website: null, location: null },
  { id: "b", type: "booking", label: "Book a time", url: "https://cal.com/ana" },
  { id: "f", type: "form", formId: "form", title: "Send me a message", fields: visibleFields(PRESETS.contact.config) },
] };

test("visitor mode: Save contact is a link and the form is live", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={full} visitorActions={visitor} />);
  expect(html).toMatch(/<a\b[^>]*href="\/c\/TOKEN\/contact"[^>]*>Save contact<\/a>/);
  expect(html).toContain('name="website"');
  for (const [tag] of html.matchAll(/<(?:input|textarea|button)\b[^>]*>/g)) expect(tag).not.toMatch(/\sdisabled(?:[=\s>])/i);
  expect(html).not.toContain("Visitors can send you a message here.");
});
test("visitor mode: every control is at least 44px tall", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={full} visitorActions={visitor} />);
  const tags = [...html.matchAll(/<(?:a|button|input|textarea)\b[^>]*>/g)].map(([t]) => t).filter(t => !t.includes('name="website"'));
  expect(tags.length).toBeGreaterThan(5);
  for (const tag of tags) expect(tag).toMatch(/\b(min-h-11|h-11|min-h-12|min-h-24)\b/);
});
test("tel links dial digits only", () => {
  expect(renderToStaticMarkup(<SceneViewPreview view={full} />)).toContain('href="tel:+639171234567"');
});
test("accent fills use the readable accent text colour", () => {
  const html = renderToStaticMarkup(<SceneViewPreview view={{ ...full, identity: { ...full.identity, accent: "#E64A35", onAccent: "#0C0C0D" } }} visitorActions={visitor} />);
  expect(html).toContain("--on-accent:#0C0C0D");
  expect(html).toContain("color:var(--on-accent)");
  expect(html).not.toContain("#fff");
});
