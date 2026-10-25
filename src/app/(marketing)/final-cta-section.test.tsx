// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { FinalCtaSection } from "./final-cta-section";

test("support variant reuses the approved CTA card artwork", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<FinalCtaSection variant="support" title="Still need a hand?" description="Support description" label="Contact support" href="/support" />);
  expect(host.querySelector("h2")?.textContent).toBe("Still need a hand?");
  expect(host.querySelector("a")?.textContent).toBe("Contact support");
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/support");
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/neffi-card-front-preview.svg");
});

test("canonical final CTA keeps Home and Product defaults", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<FinalCtaSection />);
  expect(host.querySelector("h2")?.textContent).toBe("Turn one tap into a connection.");
  expect(host.querySelector("p")?.textContent).toBe("Share your profile, work, and ways to reach you with one Neffi card.");
  const action = host.querySelector("a")!;
  expect(action.textContent).toBe("Get Neffi");
  expect(action.getAttribute("href")).toBe("/pricing");
  expect(action.getAttribute("target")).toBeNull();
  expect(action.getAttribute("rel")).toBeNull();
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/neffi-card-front-preview.svg");
});

test("canonical final CTA keeps approved copy with Pricing's external destination", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<FinalCtaSection href="https://www.facebook.com/p/Neffi-61595507571192/" external />);
  expect(host.querySelector("h2")?.textContent).toBe("Turn one tap into a connection.");
  expect(host.querySelector("p")?.textContent).toBe("Share your profile, work, and ways to reach you with one Neffi card.");
  const action = host.querySelector("a")!;
  expect(action.textContent).toBe("Get Neffi");
  expect(action.getAttribute("href")).toBe("https://www.facebook.com/p/Neffi-61595507571192/");
  expect(action.getAttribute("target")).toBe("_blank");
  expect(action.getAttribute("rel")).toBe("noopener noreferrer");
});
