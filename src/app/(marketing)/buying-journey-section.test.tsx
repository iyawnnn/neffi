// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import GuidePage from "./guide/page";
import PricingPage from "./pricing/page";
import { BuyingJourneySection } from "./buying-journey-section";

test.each([
  ["Guide", GuidePage, "buying"], ["Pricing", PricingPage, undefined],
] as const)("%s renders the canonical shared buying section", (_name, Page, id) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<Page />);
  const section = host.querySelector("#buying-heading")!.closest("section")!;
  const shared = document.createElement("div");
  shared.innerHTML = renderToStaticMarkup(<BuyingJourneySection id={id} />);
  expect(section.isEqualNode(shared.firstElementChild)).toBe(true);
  expect(section.querySelector("h2")?.textContent).toBe("Getting your Neffi is simple.");
  expect(section.querySelector("p")?.textContent).toBe("Order through a conversation. We’ll take it from there.");
  const steps = [...section.querySelectorAll("ol > li")];
  expect(steps.map(step => step.querySelector("span")?.textContent)).toEqual(["01", "02", "03", "04"]);
  expect(steps.map(step => step.querySelector("h3")?.textContent)).toEqual(["Message us", "Confirm and pay", "We pack and ship", "Track your order"]);
  expect(steps.map(step => step.querySelector("p")?.textContent)).toEqual([
    "Message us on Facebook to start your Neffi order.",
    "We’ll confirm your order and send the payment details.",
    "Once confirmed, we’ll prepare your Neffi and ship it through J&T.",
    "We’ll send your J&T tracking number for delivery updates.",
  ]);
  expect(section.querySelector("a, button")).toBeNull();
  expect(section.textContent).not.toContain("Order on Facebook");
  const ids = [...host.querySelectorAll("[id]")].map(element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  if (id) expect(host.querySelector(`#${id}`)).toBe(section);
  else {
    expect(section.hasAttribute("id")).toBe(false);
    expect(section.nextElementSibling?.getAttribute("aria-labelledby")).toBe("final-cta-heading");
    expect(host.querySelector('section[aria-labelledby="pricing-title"] a[target="_blank"]')?.textContent).toBe("Order on Facebook");
  }
});
