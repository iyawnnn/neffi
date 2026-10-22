// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { profileFixture, allLinkFixtures } from "@/dev/profile-fixture";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { profileTheme } from "@/modules/profiles/profile-theme";
import { PLATFORMS } from "@/modules/profiles/platform-registry";
import { buildSceneView, type SceneView } from "@/modules/profiles/scene-view";
import { ProfileRenderer } from "./profile-renderer";

const full: SceneView = { ...profileFixture, appearance: { ...profileFixture.appearance, layout: "editorial" } };
function render(view = full, visitor = true) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ProfileRenderer view={view} visitorActions={visitor ? { saveContactHref: "/c/TOKEN/contact" } : undefined} />);
  return host;
}

test.each([
  { company: "Studio", location: "Cebu", icons: ["building-2", "map-pin"] },
  { company: "Studio", location: null, icons: ["building-2"] },
  { company: null, location: "Cebu", icons: ["map-pin"] },
  { company: null, location: null, icons: [] },
])("identity meta groups company=$company and location=$location without a separator", ({ company, location, icons }) => {
  const host = render({ ...full, identity: { ...full.identity, company, location } });
  const rows = host.querySelectorAll(".pf-editorial-meta");
  expect(rows).toHaveLength(icons.length ? 1 : 0);
  if (!icons.length) return;
  const items = rows[0].querySelectorAll(".pf-editorial-meta-item");
  expect([...items].map(item => item.textContent)).toEqual([company, location].filter(Boolean));
  for (let index = 0; index < icons.length; index++) {
    const icon = items[index].querySelector(`svg.lucide-${icons[index]}`);
    expect(icon?.getAttribute("width")).toBe("14");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  }
  expect(rows[0].textContent).not.toContain("·");
});

test("Editorial dispatches to its own composition and renders every group in reading order", () => {
  const host = render();
  expect(host.querySelector('[data-layout="editorial"] .pf-editorial')).toBeTruthy();
  expect(host.querySelector(".pf-classic")).toBeNull();
  const ordered = ["h1", ".pf-intro", ".pf-primary", '[aria-label="Contact"]', '[aria-label="Links"]', '[aria-label="Work"]', '[aria-label="About"]', '[aria-label="Social profiles"]', ".pf-form"];
  const nodes = [...host.querySelectorAll("*")];
  for (let i = 1; i < ordered.length; i++) {
    expect(host.querySelector(ordered[i]), ordered[i]).toBeTruthy();
    expect(nodes.indexOf(host.querySelector(ordered[i])!), ordered[i]).toBeGreaterThan(nodes.indexOf(host.querySelector(ordered[i - 1])!));
  }
  expect(host.querySelectorAll("h1")).toHaveLength(1);
  expect(host.querySelectorAll('a[href="/c/TOKEN/contact"]')).toHaveLength(1);
  expect(host.querySelectorAll('[data-filled="true"]')).toHaveLength(1);
  expect(host.querySelector('a[href="https://example.invalid/booking"]')).toBeTruthy();
  expect(host.querySelector("form")).toBeTruthy();
});

test("section labels precede their content in the single-column reading order", () => {
  const host = render();
  for (const name of ["Contact", "Links", "Work", "About", "Social profiles"]) {
    const section = host.querySelector(`[aria-label="${name}"]`)!;
    expect(section.firstElementChild?.tagName, name).toBe("H2");
    expect(section.children.length, name).toBeGreaterThan(1);
  }
  expect(host.querySelector(".pf-form")?.firstElementChild?.tagName).toBe("H2");
});

test("minimal Editorial has no image placeholder, empty groups or invented content", () => {
  const host = render({ ...full, identity: { ...full.identity, bio: null, headline: null, company: null, location: null }, blocks: [] });
  expect(host.querySelector("h1")?.textContent).toBe("Ana Reyes");
  expect(host.querySelectorAll("img, .pf-initials, section, nav, a, button, h2")).toHaveLength(0);
  expect(host.textContent).toBe("Ana Reyes");
});

test.each([false, true])("Editorial image is inline, intrinsic 64px, logo=%s", isLogo => {
  const host = render({ ...full, identity: { ...full.identity, image: { url: "/avatar-example.jpg", isLogo } } });
  expect(host.querySelector("img")?.getAttribute("width")).toBe("64");
  expect(host.querySelector("img")?.getAttribute("height")).toBe("64");
  expect(host.querySelector("img")?.className).toContain(isLogo ? "object-contain" : "object-cover");
  expect(host.querySelector("h1")?.textContent).toBe("Ana Reyes");
});

test.each(["light", "dark"] as const)("Editorial %s uses every curated T4 accent and safe legacy fallbacks", mode => {
  for (const accent of [...ACCENTS.map(a => a.hex), "#bad", null]) {
    const host = render({ ...full, appearance: { layout: "editorial", mode, accent: accent as string, cover: null } });
    const root = host.querySelector<HTMLElement>('[data-layout="editorial"]')!;
    expect(root).toBeTruthy();
    for (const [key, value] of Object.entries(profileTheme(accent, mode))) expect(root.style.getPropertyValue(key), key).toBe(value);
    expect(root.style.colorScheme).toBe(mode);
  }
});

test("all 22 kinds retain a named safe link, icon, and stored order", () => {
  const host = render({ ...full, blocks: allLinkFixtures });
  for (const item of allLinkFixtures) {
    const anchors = host.querySelectorAll<HTMLAnchorElement>(`a[href="${item.url}"]`);
    expect(anchors, item.kind).toHaveLength(1);
    expect(anchors[0].getAttribute("aria-label") ?? anchors[0].textContent).toContain(item.label);
    expect(anchors[0].querySelector("svg")).toBeTruthy();
    expect(anchors[0].rel).toBe("noopener noreferrer");
  }
  const links = [...host.querySelectorAll('.pf-links a')].map(a => a.getAttribute("href"));
  expect(links).toEqual(allLinkFixtures.filter(item => links.includes(item.url)).map(item => item.url));
});

test("Editorial socials keep icon and full label in one named anchor, in source order", () => {
  const host = render({ ...full, blocks: allLinkFixtures });
  const items = allLinkFixtures.filter(item => PLATFORMS[item.kind].category === "social");
  const anchors = [...host.querySelectorAll<HTMLAnchorElement>(".pf-socials > a")];
  expect(anchors).toHaveLength(items.length);
  expect(anchors.map(anchor => anchor.getAttribute("href"))).toEqual(items.map(item => item.url));
  anchors.forEach((anchor, index) => {
    expect(anchor.getAttribute("aria-label")).toBe(items[index].label);
    expect(anchor.querySelector(".pf-social-label")?.textContent).toBe(items[index].label);
    expect(anchor.querySelector('[aria-hidden="true"] svg')).toBeTruthy();
    expect(anchor.querySelectorAll("a, button, [tabindex]")).toHaveLength(0);
    expect(anchor.className).toContain("min-h-11");
    expect(host.querySelectorAll(`a[href="${items[index].url}"]`)).toHaveLength(1);
  });
});

test("Editorial preserves stored ordering and hidden filtering from SceneView", () => {
  const view = buildSceneView({ profile: { ...full.identity, accentColor: null, imageIsLogo: false, layout: "editorial", colorMode: "light" }, imageUrl: null, scene: full.scene, forms: [], blocks: [
    { id: "hidden", type: "about", position: 0, visible: false, content: { text: "Hidden biography" }, formId: null },
    ...[2, 1].map(position => ({ id: String(position), type: "project", position, visible: true, content: { title: `Project ${position}`, description: "Selected work", url: `https://example.invalid/${position}` }, formId: null })),
  ] });
  const host = render(view);
  expect(host.textContent).not.toContain("Hidden biography");
  expect([...host.querySelectorAll("h3")].map(h => h.textContent)).toEqual(["Project 1", "Project 2"]);
});

test("long content is preserved; intro dedupe remains the shared contract's responsibility", () => {
  const name = "Ana".repeat(100);
  const host = render({ ...full, identity: { ...full.identity, fullName: name }, blocks: [...full.blocks, { id: "duplicate", type: "about", text: full.identity.bio! }] });
  expect(host.querySelector("h1")?.textContent).toBe(name);
  expect(host.querySelector(".pf-intro")).toBeNull();
  expect(host.textContent?.split(full.identity.bio!)).toHaveLength(2);
});

test("owner preview remains inert and every visitor control keeps touch minimums", () => {
  const preview = render(full, false);
  expect(preview.querySelector("form")).toBeNull();
  for (const control of preview.querySelectorAll<HTMLInputElement>("input, textarea, button")) expect(control.disabled).toBe(true);
  expect([...preview.querySelectorAll<HTMLInputElement>("input, textarea")].map(control => control.placeholder)).toEqual(["Full name", "you@example.com", "Tell me what you'd like to discuss..."]);
  for (const control of render().querySelectorAll<HTMLElement>('a, button, input:not([name="website"]), textarea')) expect(control.className).toMatch(/\b(min-h-11|h-11|min-h-12|min-h-24)\b/);
});
