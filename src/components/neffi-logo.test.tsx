// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { NeffiLogo } from "./neffi-logo";

const approved = new DOMParser().parseFromString(
  readFileSync("public/neffi-mark-vermillion-dot.svg", "utf8"), "image/svg+xml",
);

test("uses the approved wordmark geometry with adaptive Ink and the fixed Vermilion dot", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<NeffiLogo />);
  const svg = host.querySelector("svg")!;
  const paths = [...svg.querySelectorAll("path")];
  const sourcePaths = [...approved.querySelectorAll("path")];
  expect(paths.map(path => path.getAttribute("d"))).toEqual(sourcePaths.map(path => path.getAttribute("d")));
  expect(svg.getAttribute("viewBox")).toBe("166 310 469 180");
  expect(svg.getAttribute("fill")).toBe("currentColor");
  expect(paths.slice(0, 4).every(path => !path.hasAttribute("fill"))).toBe(true);
  expect(paths[4].getAttribute("fill")).toBe("#E64A35");
  expect(svg.querySelector("rect, image")).toBeNull();
});

test("preserves caller sizing and accessibility attributes", () => {
  const html = renderToStaticMarkup(<NeffiLogo aria-hidden className="h-6 w-auto" />);
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('class="h-6 w-auto"');
  const labelled = renderToStaticMarkup(<NeffiLogo role="img" aria-label="Neffi" />);
  expect(labelled).toContain('role="img"');
  expect(labelled).toContain('aria-label="Neffi"');
});
