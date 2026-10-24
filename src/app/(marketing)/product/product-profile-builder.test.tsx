// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { SceneView } from "@/modules/profiles/scene-view";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { ProductMakeItYours } from "./product-profile-builder";
import { ProductProfileEvolution } from "./product-profile-evolution";
import { baseMarketingProfile } from "./product-profile-fixture";

vi.mock("@/components/profile/profile-renderer", () => ({
  ProfileRenderer: vi.fn(() => <div data-real-profile-renderer />),
}));

function render() {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ProductMakeItYours />);
  return host;
}

test("hands a compact Classic, light, Vermilion SceneView to the production renderer", () => {
  vi.mocked(ProfileRenderer).mockClear();
  render();
  const props = vi.mocked(ProfileRenderer).mock.calls[0][0];
  const view: SceneView = props.view;
  expect(view.appearance).toEqual({ layout: "classic", mode: "light", accent: "#E64A35", cover: null });
  expect(view.identity).toMatchObject({ fullName: "Mika Santos", headline: "Brand Designer", location: "Manila, Philippines" });
  expect(view.blocks).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "contact", saveContact: true }),
    expect.objectContaining({ type: "link", label: "Portfolio" }),
    expect.objectContaining({ type: "link", label: "Book a call" }),
    expect.objectContaining({ type: "link", kind: "linkedin" }),
  ]));
  expect(props.visitorActions).toBeUndefined();
});

test("keeps the renderer inert behind a single accessible description and retains editor tabs", () => {
  const host = render();
  const preview = host.querySelector('[role="img"]')!;
  expect(preview.getAttribute("aria-label")).toBe("Sample Neffi Classic profile preview for Mika Santos");
  expect(preview.querySelector('[inert] [data-real-profile-renderer]')).toBeTruthy();
  const tabs = host.querySelector('[aria-label="Profile sections"]')!;
  expect([...tabs.querySelectorAll("button")].map(button => button.textContent)).toEqual(["Identity", "Links", "Contact"]);
  expect(tabs.querySelector('[aria-pressed="true"]')?.textContent).toBe("Identity");
});

test("does not fork the profile or retain the marketing approximation and highlight hooks", () => {
  const source = readFileSync(join(process.cwd(), "src/app/(marketing)/product/product-profile-builder.tsx"), "utf8");
  expect(source).not.toMatch(/DigitalProfilePreview|data-focus|className="(?:pf-|pe-)/);
  expect(render().querySelectorAll("[data-real-profile-renderer]")).toHaveLength(1);
});


test("removes the builder's extra marketing annotations", () => {
  const text = render().textContent;
  for (const label of ["Live preview", "What people see", "A little more you. Ready to share."]) {
    expect(text).not.toContain(label);
  }
});

test("evolution derives the updated Classic profile from the same Mika fixture", () => {
  vi.mocked(ProfileRenderer).mockClear();
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ProductProfileEvolution />);
  expect(host.querySelector('img[src="/neffi-card-front-preview.svg"]')).toBeTruthy();
  expect(host.textContent).toContain("Same physical card");
  expect(host.querySelectorAll(".pp-change-summary > div")).toHaveLength(3);
  expect(host.querySelector(".pp-studio, .pp-change-list")).toBeNull();
  const props = vi.mocked(ProfileRenderer).mock.calls[0][0];
  expect(props.view.appearance).toEqual(baseMarketingProfile.appearance);
  expect(props.view.identity).toEqual({ ...baseMarketingProfile.identity, headline: "Senior Brand Designer" });
  expect(props.view.blocks).toEqual(baseMarketingProfile.blocks.map(block =>
    block.type === "link" && block.id === "portfolio" ? { ...block, label: "Latest case study" } : block
  ));
  expect(props.view.blocks).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "link", label: "Latest case study" }),
    expect.objectContaining({ type: "link", label: "Book a call" }),
    expect.objectContaining({ type: "contact", saveContact: true }),
  ]));
  expect(props.visitorActions).toBeUndefined();
  expect(host.querySelector('[role="img"] [inert] [data-real-profile-renderer]')).toBeTruthy();
  const source = readFileSync(join(process.cwd(), "src/app/(marketing)/product/product-profile-evolution.tsx"), "utf8");
  expect(source).not.toMatch(/DigitalProfilePreview|className="(?:pf-|pe-)/);
});
