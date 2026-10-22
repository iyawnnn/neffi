// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { profileFixture } from "@/dev/profile-fixture";
import { profileTheme } from "@/modules/profiles/profile-theme";
import type { SceneView } from "@/modules/profiles/scene-view";
import { ProfileRenderer } from "./profile-renderer";

const cover = { src: "/synthetic-cover.svg", srcSet: "/synthetic-cover.svg?w=640 640w, /synthetic-cover.svg?w=1080 1080w, /synthetic-cover.svg?w=1600 1600w" };
const view: SceneView = { ...profileFixture, appearance: { ...profileFixture.appearance, layout: "showcase", cover } };
function render(input = view) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ProfileRenderer view={input} />);
  return host;
}

test("Showcase replaces only its band with one decorative responsive cover", () => {
  const host = render();
  const frame = host.querySelector(".pf-showcase-cover")!;
  expect(frame).toBeTruthy();
  const image = frame.querySelector("img")!;
  expect(frame.getAttribute("aria-hidden")).toBe("true");
  expect(host.querySelector(".pf-showcase-band")).toBeNull();
  expect(host.querySelectorAll(`img[src="${cover.src}"]`)).toHaveLength(1);
  expect(image.getAttribute("srcset")).toBe(cover.srcSet);
  expect(image.getAttribute("sizes")).toBe("(min-width: 560px) 560px, 100vw");
  expect(Number(image.getAttribute("width")) / Number(image.getAttribute("height"))).toBe(3);
  expect(image.getAttribute("loading")).toBe("eager");
  expect(image.getAttribute("fetchpriority")).toBe("high");
  expect(image.getAttribute("alt")).toBe("");
  expect(image.hasAttribute("tabindex")).toBe(false);
  expect(image.hasAttribute("aria-label")).toBe(false);
  expect(frame.querySelector("a, button, figcaption")).toBeNull();
});

test.each([false, true])("cover leaves the separate 88px identity photo/logo unchanged: %s", isLogo => {
  const host = render({ ...view, identity: { ...view.identity, image: { url: "/avatar-example.jpg", isLogo } } });
  expect(host.querySelectorAll("img")).toHaveLength(2);
  const photo = host.querySelector<HTMLImageElement>(".pf-showcase-image")!;
  expect(photo.getAttribute("src")).toBe("/avatar-example.jpg");
  expect(photo.width).toBe(88);
  expect(photo.height).toBe(88);
  expect(photo.className).toContain(isLogo ? "object-contain" : "object-cover");
});

test("null cover retains the exact fallback and cover changes no later markup or source data", () => {
  const original = structuredClone(view);
  const withCover = render();
  const withoutCover = render({ ...view, appearance: { ...view.appearance, cover: null } });
  expect(withoutCover.querySelector(".pf-showcase-band")?.outerHTML).toBe('<div class="pf-showcase-band" aria-hidden="true"></div>');
  expect(withoutCover.querySelector(".pf-showcase-cover")).toBeNull();
  withCover.querySelector(".pf-showcase-cover")!.replaceWith(withoutCover.querySelector(".pf-showcase-band")!.cloneNode(true));
  expect(withCover.querySelector("article")!.outerHTML).toBe(withoutCover.querySelector("article")!.outerHTML);
  expect(view).toEqual(original);
});

test.each(["classic", "editorial"] as const)("%s ignores the same cover data", layout => {
  const input = { ...view, appearance: { ...view.appearance, layout } };
  expect(render(input).innerHTML).toBe(render({ ...input, appearance: { ...input.appearance, cover: null } }).innerHTML);
  expect(render(input).querySelector(`img[src="${cover.src}"]`)).toBeNull();
});

test.each(["light", "dark"] as const)("cover keeps %s theme and accent authoritative", mode => {
  const host = render({ ...view, appearance: { ...view.appearance, mode, accent: "#E64A35" } });
  expect(host.querySelector(".pf-showcase-cover img")?.getAttribute("src")).toBe(cover.src);
  const root = host.querySelector<HTMLElement>(".pf-profile")!;
  expect(root.style.colorScheme).toBe(mode);
  for (const [key, value] of Object.entries(profileTheme("#E64A35", mode))) expect(root.style.getPropertyValue(key)).toBe(value);
});
