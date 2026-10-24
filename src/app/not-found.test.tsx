// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import NotFound from "./not-found";

function renderNotFound() {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<NotFound />);
  return host;
}

test("root App Router not-found presents the missing page with one Home recovery action", () => {
  const host = renderNotFound();
  expect(host.querySelectorAll("main")).toHaveLength(1);
  expect(host.querySelectorAll("h1")).toHaveLength(1);
  expect(host.querySelector("h1")?.textContent).toBe("This page missed the tap.");
  expect(host.textContent).toContain("ERROR 404");
  expect(host.textContent).toContain("The page you’re looking for couldn’t be found.");
  const actions = host.querySelectorAll("a, button, input, [role='button']");
  expect(actions).toHaveLength(1);
  expect(actions[0].textContent).toBe("Go back home");
  expect(actions[0].getAttribute("href")).toBe("/");
  expect(host.querySelector("nav, footer")).toBeNull();
  expect(host.textContent).not.toMatch(/Guide|Support|Pricing/);
});

test("uses the shared brand and a decorative, transparent vector illustration", () => {
  const host = renderNotFound();
  expect(host.querySelector("svg[aria-label='Neffi']")).not.toBeNull();
  const illustration = host.querySelector("img");
  expect(illustration?.getAttribute("src")).toBe("/neffi-not-found.svg");
  expect(illustration?.getAttribute("alt")).toBe("");
  expect(illustration?.getAttribute("aria-hidden")).toBe("true");

  const source = readFileSync(join(process.cwd(), "public/neffi-not-found.svg"), "utf8");
  const svg = new DOMParser().parseFromString(source, "image/svg+xml");
  expect(svg.querySelector("parsererror")).toBeNull();
  expect(svg.documentElement.getAttribute("viewBox")).toBe("0 0 360 240");
  expect(svg.querySelector("image, text, script, foreignObject, linearGradient, radialGradient")).toBeNull();
  expect(svg.documentElement.getAttribute("fill")).toBe("none");
});
