// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProductFacts } from "./product-facts";
import { ProductAnatomy } from "./product-anatomy";

test("anatomy has four consistent callouts and identifies the card-back Sharing QR", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ProductAnatomy />);
  expect([...host.querySelectorAll("h3")].map(heading => heading.textContent)).toEqual([
    "Set up once", "Yours from the box", "Tap to open", "Scan to open",
  ]);
  expect(host.textContent).toContain("The Sharing QR on the back opens your profile when tapping isn’t available.");
  expect(host.textContent).not.toContain("No card with you?");
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/neffi-card-front-preview.svg");
});

test("product facts explain NFC and the printed card-back Sharing QR", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ProductFacts />);
  expect(host.textContent).toContain("Tap or scan");
  expect(host.textContent).toContain("Sharing QR printed on the back of your Neffi card");
});
