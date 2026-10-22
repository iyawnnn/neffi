// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PRESETS, visibleFields } from "@/modules/forms/config";
import { LINK_KINDS, LINK_KIND_LABELS } from "@/modules/profiles/block-options";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { profileTheme } from "@/modules/profiles/profile-theme";
import { buildSceneView, type SceneView } from "@/modules/profiles/scene-view";
import { ProfileRenderer } from "./profile-renderer";

const base: SceneView = {
  appearance: { layout: "classic", mode: "light", accent: "#0C0C0D" },
  identity: { fullName: "Ana Cruz", initials: "AC", headline: "Designer", company: "Studio", location: "Cebu", bio: "Independent designer.", phone: "+63 917 123 4567", email: "ana@example.test", website: "https://ana.example.test", accent: "#0C0C0D", onAccent: "#FFFFFF", image: null },
  scene: { id: "main", name: "Main" }, blocks: [],
};
const full: SceneView = { ...base, blocks: [
  { id: "project", type: "project", title: "A considered website", description: "Design and development.", url: "https://example.test/project" },
  { id: "link", type: "link", kind: "portfolio", label: "Explore my portfolio", url: "https://example.test/work" },
  { id: "social", type: "link", kind: "linkedin", label: "LinkedIn", url: "https://linkedin.com/in/ana" },
  { id: "about", type: "about", text: "I work with independent teams." },
  { id: "contact", type: "contact", saveContact: true, phone: base.identity.phone, email: base.identity.email, website: base.identity.website, location: "Cebu" },
  { id: "booking", type: "booking", label: "Book a conversation", url: "https://cal.com/ana" },
  { id: "form", type: "form", formId: "form", title: "Start a conversation", fields: visibleFields(PRESETS.contact.config) },
] };
const visitorActions = { saveContactHref: "/c/TOKEN/contact" };
function render(view = full, visitor = true) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ProfileRenderer view={view} visitorActions={visitor ? visitorActions : undefined} />);
  return host;
}

test.each(["classic", "showcase", "unknown"])("%s renders Classic without dropping featured content", layout => {
  const host = render({ ...full, appearance: { ...full.appearance, layout: layout as SceneView["appearance"]["layout"] } });
  expect(host.querySelector('[data-layout="classic"]')).toBeTruthy();
  expect(host.querySelectorAll("h3")).toHaveLength(1);
  expect(host.querySelectorAll('a[href="https://example.test/project"]')).toHaveLength(1);
  expect(host.querySelectorAll('a[href="https://example.test/work"]')).toHaveLength(1);
});

test.each(["light", "dark"] as const)("%s applies all T4 tokens using the selected accent", mode => {
  for (const accent of [...ACCENTS.map(a => a.hex), "#not-a-colour", null]) {
    const view = { ...base, appearance: { ...base.appearance, mode, accent: accent as string } };
    const host = render(view);
    const root = host.querySelector<HTMLElement>("[data-layout]")!;
    for (const [key, value] of Object.entries(profileTheme(accent, mode))) expect(root.style.getPropertyValue(key), key).toBe(value);
    expect(root.style.colorScheme).toBe(mode);
  }
});

test("renders the approved hierarchy, once, from semantic groups", () => {
  const host = render();
  const text = host.textContent!;
  const order = ["Ana Cruz", "Independent designer.", "Save contact", "Explore my portfolio", "A considered website", "I work with independent teams.", "Mobile", "Start a conversation"];
  for (let i = 1; i < order.length; i++) expect(text.indexOf(order[i]), order[i]).toBeGreaterThan(text.indexOf(order[i - 1]));
  expect(host.querySelectorAll('a[href="/c/TOKEN/contact"]')).toHaveLength(1);
  expect(text.split("Cebu")).toHaveLength(2);
  expect(host.querySelectorAll('[data-filled="true"]')).toHaveLength(1);
  expect(host.querySelector('a[href="https://cal.com/ana"]')).toBeTruthy();
  expect(host.querySelector('a[href="tel:+639171234567"]')).toBeTruthy();
  expect(host.querySelector('a[href="mailto:ana@example.test"]')).toBeTruthy();
  expect(host.querySelector("form")).toBeTruthy();
});

test("minimal profiles have no empty sections or invented actions", () => {
  const host = render({ ...base, identity: { ...base.identity, bio: null, company: null, headline: null, location: null } });
  expect(host.querySelector("h1")?.textContent).toBe("Ana Cruz");
  expect(host.textContent).toContain("AC");
  expect(host.querySelectorAll("section, nav, a, button, h2")).toHaveLength(0);
});

test("rendered contact details have restrained decorative icons", () => {
  const host = render();
  for (const [href, icon] of [["tel:+639171234567", "phone"], ["mailto:ana@example.test", "mail"], ["https://ana.example.test", "globe"]]) {
    const glyph = host.querySelector(`.pf-contact a[href="${href}"]`)?.closest("dd")?.previousElementSibling?.querySelector("svg");
    expect(glyph?.classList.contains(`lucide-${icon}`)).toBe(true);
    expect(glyph?.getAttribute("width")).toBe("16");
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
  }
});

test("contact icons never introduce missing contact methods", () => {
  const host = render({ ...full, identity: { ...full.identity, phone: null, website: null } });
  expect(host.querySelectorAll(".pf-contact a")).toHaveLength(1);
  expect(host.querySelectorAll(".pf-contact svg")).toHaveLength(1);
  expect(host.querySelector(".pf-contact a")?.getAttribute("href")).toBe("mailto:ana@example.test");
});

test("uses T4 intro dedupe and renders About once", () => {
  const host = render({ ...base, blocks: [{ id: "about", type: "about", text: `  ${base.identity.bio}  ` }] });
  expect(host.textContent?.split(base.identity.bio!)).toHaveLength(2);
  expect(host.querySelector("header")?.textContent).not.toContain(base.identity.bio);
});

test("Showcase's featured link is restored once in the temporary Classic fallback", () => {
  const host = render({ ...base, appearance: { ...base.appearance, layout: "showcase" }, blocks: [full.blocks[1]] });
  expect(host.querySelectorAll('a[href="https://example.test/work"]')).toHaveLength(1);
  expect(host.querySelector('[aria-label="Work"]')).toBeNull();
});

test("without Save contact, the first booking alone is filled and unsafe links leave no empty group", () => {
  const host = render({ ...base, blocks: [
    { id: "first", type: "booking", label: "First booking", url: "https://example.test/first" },
    { id: "second", type: "booking", label: "Second booking", url: "https://example.test/second" },
    { id: "unsafe", type: "link", kind: "custom", label: "Unsafe", url: "javascript:alert(1)" },
  ] });
  expect(host.querySelectorAll('[data-filled="true"]')).toHaveLength(1);
  expect(host.querySelector('[data-filled="true"]')?.textContent).toBe("First booking");
  expect(host.textContent).toContain("Second booking");
  expect(host.querySelector('[aria-label="Links"]')).toBeNull();
});

test.each(LINK_KINDS.flatMap(kind => (["classic", "editorial", "showcase"] as const).map(layout => ({ kind, layout }))))("$kind in $layout has a named, safe link and monochrome icon", ({ kind, layout }) => {
  const label = LINK_KIND_LABELS[kind];
  const host = render({ ...base, appearance: { ...base.appearance, layout }, blocks: [{ id: kind, type: "link", kind, label, url: "https://example.test/destination" }] });
  const link = host.querySelector<HTMLAnchorElement>('a[href="https://example.test/destination"]')!;
  expect(link).toBeTruthy();
  expect(link.getAttribute("aria-label") ?? link.textContent).toContain(label);
  expect(link.querySelector("svg")).toBeTruthy();
  expect(link.target).toBe("_blank");
  expect(link.rel).toBe("noopener noreferrer");
  expect(link.innerHTML).not.toContain("fill-white");
  expect(link.innerHTML).not.toContain("background:");
});

test("stored order and hidden-block filtering survive the renderer boundary", () => {
  const view = buildSceneView({ profile: { ...base.identity, fullName: "Ana", accentColor: null, imageIsLogo: false, layout: "classic", colorMode: "light" }, imageUrl: null, scene: base.scene, forms: [], blocks: [
    { id: "hidden", type: "about", position: 0, visible: false, content: { text: "Hidden biography" }, formId: null },
    ...[2, 1].map(position => ({ id: String(position), type: "link", position, visible: true, content: { kind: "custom", label: `Link ${position}`, url: `https://example.test/${position}` }, formId: null })),
  ] });
  const host = render(view);
  expect(host.textContent).not.toContain("Hidden biography");
  expect([...host.querySelectorAll("a")].map(a => a.textContent)).toEqual(["Link 1", "Link 2"]);
});

test("owner previews keep Save contact and forms disabled while sharing the same content", () => {
  const host = render(full, false);
  expect(host.querySelector('a[href="/c/TOKEN/contact"]')).toBeNull();
  expect(host.querySelector("button")?.disabled).toBe(true);
  expect(host.querySelector("form")).toBeNull();
  expect(host.textContent).toContain("Visitors can send you a message here.");
  for (const control of host.querySelectorAll<HTMLInputElement>("input, textarea, button")) expect(control.disabled).toBe(true);
});

test("controls meet touch minimums and social links have accessible names", () => {
  const host = render();
  for (const control of host.querySelectorAll<HTMLElement>('a, button, input:not([name="website"]), textarea')) expect(control.className).toMatch(/\b(min-h-11|h-11|min-h-12|min-h-24)\b/);
  expect(host.querySelector('a[aria-label="LinkedIn"]')).toBeTruthy();
});

test("a custom social label keeps the platform in its accessible name", () => {
  const host = render({ ...base, blocks: [{ id: "social", type: "link", kind: "linkedin", label: "Connect with me", url: "https://linkedin.com/in/ana" }] });
  expect(host.querySelector("a")?.getAttribute("aria-label")).toBe("Connect with me (LinkedIn)");
});

test("long content and image presentation retain their content and intrinsic dimensions", () => {
  for (const isLogo of [false, true]) {
    const name = "Ana".repeat(100);
    const host = render({ ...base, identity: { ...base.identity, fullName: name, image: { url: "https://example.test/image.webp", isLogo } } });
    expect(host.querySelector("h1")?.textContent).toBe(name);
    expect(host.querySelector("img")?.getAttribute("width")).toBe("96");
    expect(host.querySelector("img")?.className).toContain(isLogo ? "object-contain" : "object-cover");
  }
});
