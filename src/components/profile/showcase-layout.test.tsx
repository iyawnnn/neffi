// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { profileFixture, allLinkFixtures } from "@/dev/profile-fixture";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { profileTheme } from "@/modules/profiles/profile-theme";
import { buildSceneView, type SceneView } from "@/modules/profiles/scene-view";
import { ProfileRenderer } from "./profile-renderer";

const full: SceneView = { ...profileFixture, appearance: { ...profileFixture.appearance, layout: "showcase" } };
const secondProject = { id: "second", type: "project" as const, title: "Second project", description: "Another collaboration.", url: "https://example.invalid/second" };
function render(view = full, visitor = true) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ProfileRenderer view={view} visitorActions={visitor ? { saveContactHref: "/c/TOKEN/contact" } : undefined} />);
  return host;
}

test("Showcase dispatches to its own composition and preserves every group in reading order", () => {
  const host = render({ ...full, blocks: [...full.blocks, secondProject] });
  expect(host.querySelector('[data-layout="showcase"] .pf-showcase')).toBeTruthy();
  expect(host.querySelector(".pf-classic, .pf-editorial")).toBeNull();
  const order = ["h1", ".pf-intro", ".pf-primary", '[aria-label="Featured"]', '[aria-label="Work"]', '[aria-label="Links"]', '[aria-label="Social profiles"]', '[aria-label="About"]', '[aria-label="Contact"]', ".pf-form"];
  const nodes = [...host.querySelectorAll("*")];
  for (let i = 1; i < order.length; i++) {
    expect(host.querySelector(order[i]), order[i]).toBeTruthy();
    expect(nodes.indexOf(host.querySelector(order[i])!), order[i]).toBeGreaterThan(nodes.indexOf(host.querySelector(order[i - 1])!));
  }
  expect(host.querySelectorAll("h1")).toHaveLength(1);
  expect(host.querySelectorAll('a[href="/c/TOKEN/contact"]')).toHaveLength(1);
  expect(host.querySelectorAll('[data-filled="true"]')).toHaveLength(1);
  expect(host.querySelector('a[href="https://example.invalid/booking"]')).toBeTruthy();
  expect(host.querySelector("form")).toBeTruthy();
});

test("first Project is featured once; remaining Work retains order", () => {
  const host = render({ ...full, blocks: [...full.blocks, secondProject, { ...secondProject, id: "third", title: "Third project", url: null }] });
  expect(host.querySelector('[aria-label="Featured"] h3')?.textContent).toBe("A home for independent ideas");
  expect(host.querySelectorAll('a[href="https://example.invalid/project"]')).toHaveLength(1);
  expect([...host.querySelectorAll('[aria-label="Work"] h3')].map(node => node.textContent)).toEqual(["Second project", "Third project"]);
});

test("ordinary Link fallback includes its host and is absent from normal Links", () => {
  const host = render({ ...full, blocks: full.blocks.filter(block => block.type !== "project") });
  const featured = host.querySelector('[aria-label="Featured"]')!;
  expect(featured).toBeTruthy();
  expect(featured.textContent).toContain("Selected work");
  expect(featured.textContent).toContain("example.invalid");
  expect(featured.querySelector("svg")).toBeTruthy();
  expect(host.querySelectorAll('a[href="https://example.invalid/work"]')).toHaveLength(1);
  expect(host.querySelector('[aria-label="Links"]')?.textContent).not.toContain("Selected work");
  expect(host.querySelector('[aria-label="Work"]')).toBeNull();
});

test("minimal Showcase keeps identity, initials and band without empty groups", () => {
  const host = render({ ...full, identity: { ...full.identity, bio: null, headline: null, company: null, location: null }, blocks: [] });
  expect(host.querySelector("h1")?.textContent).toBe("Ana Reyes");
  expect(host.querySelector(".pf-initials")?.textContent).toBe("AR");
  expect(host.querySelector(".pf-showcase-band")?.getAttribute("aria-hidden")).toBe("true");
  expect(host.querySelectorAll("section, nav, a, button, h2")).toHaveLength(0);
});

test.each([false, true])("88px image preserves photo/logo treatment: %s", isLogo => {
  const host = render({ ...full, identity: { ...full.identity, image: { url: "/avatar-example.jpg", isLogo } } });
  const image = host.querySelector("img")!;
  expect(image.getAttribute("width")).toBe("88");
  expect(image.getAttribute("height")).toBe("88");
  expect(image.className).toContain(isLogo ? "object-contain" : "object-cover");
  expect(host.querySelector(".pf-initials")).toBeNull();
});

test.each(["light", "dark"] as const)("Showcase %s uses curated accents and legacy fallbacks", mode => {
  for (const accent of [...ACCENTS.map(a => a.hex), "#bad", null]) {
    const host = render({ ...full, appearance: { layout: "showcase", mode, accent: accent as string, cover: null } });
    const root = host.querySelector<HTMLElement>('[data-layout="showcase"]')!;
    expect(root).toBeTruthy();
    for (const [key, value] of Object.entries(profileTheme(accent, mode))) expect(root.style.getPropertyValue(key), key).toBe(value);
    expect(root.style.colorScheme).toBe(mode);
  }
});

test("all 22 kinds render once with safe named anchors and icons", () => {
  const host = render({ ...full, blocks: allLinkFixtures });
  for (const item of allLinkFixtures) {
    const anchors = host.querySelectorAll<HTMLAnchorElement>(`a[href="${item.url}"]`);
    expect(anchors, item.kind).toHaveLength(1);
    expect(anchors[0].getAttribute("aria-label") ?? anchors[0].textContent).toContain(item.label);
    expect(anchors[0].querySelector("svg")).toBeTruthy();
    expect(anchors[0].rel).toBe("noopener noreferrer");
  }
});

test("stored order and hidden filtering survive the Showcase boundary", () => {
  const view = buildSceneView({ profile: { ...full.identity, accentColor: null, imageIsLogo: false, layout: "showcase", colorMode: "light" }, imageUrl: null, scene: full.scene, forms: [], blocks: [
    { id: "hidden", type: "project", position: 0, visible: false, content: { title: "Hidden project", description: "Invisible", url: null }, formId: null },
    ...[3, 1, 2].map(position => ({ id: String(position), type: "project", position, visible: true, content: { title: `Project ${position}`, description: "Selected work", url: null }, formId: null })),
  ] });
  const host = render(view);
  expect(host.textContent).not.toContain("Hidden project");
  expect([...host.querySelectorAll("h3")].map(node => node.textContent)).toEqual(["Project 1", "Project 2", "Project 3"]);
});

test("dedupe, long content, inert owner controls, placeholders and touch minimums remain shared", () => {
  const name = "Ana".repeat(100);
  const host = render({ ...full, identity: { ...full.identity, fullName: name }, blocks: [...full.blocks, { id: "duplicate", type: "about", text: full.identity.bio! }] }, false);
  expect(host.querySelector("h1")?.textContent).toBe(name);
  expect(host.querySelector(".pf-intro")).toBeNull();
  expect(host.textContent?.split(full.identity.bio!)).toHaveLength(2);
  expect(host.querySelector("form")).toBeNull();
  for (const control of host.querySelectorAll<HTMLInputElement>("input, textarea, button")) expect(control.disabled).toBe(true);
  expect([...host.querySelectorAll<HTMLInputElement>("input, textarea")].map(control => control.placeholder)).toEqual(["Full name", "you@example.com", "Tell me what you'd like to discuss..."]);
  for (const control of render().querySelectorAll<HTMLElement>('a, button, input:not([name="website"]), textarea')) expect(control.className).toMatch(/\b(min-h-11|h-11|min-h-12|min-h-24)\b/);
});
