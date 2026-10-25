// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import HelpPage from "./page";
import { HelpBrowser } from "./help-browser";
import { helpCategories } from "./help-data";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));

async function mount(hash = "") {
  window.history.replaceState(null, "", `/help${hash}`);
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<HelpBrowser />));
}

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/help");
  vi.unstubAllGlobals();
});

function question(id: string) {
  return host.querySelector<HTMLButtonElement>(`#help-question-${id}`)!;
}

test("Help shows the centered hero, support CTA and every FAQ category without search or selectors", async () => {
  const page = document.createElement("div");
  page.innerHTML = renderToStaticMarkup(<HelpPage />);
  expect(page.querySelector("h1")?.textContent).toBe("Find the answer. Keep moving.");
  expect(page.textContent).toContain("Help with ordering, delivery, activation, sharing, and your Neffi account.");
  const support = page.querySelector('section[aria-labelledby="final-cta-heading"]')!;
  expect(support.previousElementSibling?.getAttribute("aria-label")).toBe("Browse help");
  expect(support.querySelector("h2")?.textContent).toBe("Still need a hand?");
  expect(support.querySelector("p")?.textContent).toBe("Tell us what happened and we’ll help you figure out the next step.");
  expect(support.querySelector('a[href="/support"]')?.textContent).toBe("Contact support");
  expect(support.querySelector("img")?.getAttribute("src")).toBe("/neffi-card-front-preview.svg");
  await mount();
  expect(host.querySelector("input")).toBeNull();
  expect(host.textContent).not.toMatch(/quick help/i);
  expect(host.querySelector('[aria-current], [role="tab"], nav[aria-label="Help categories"]')).toBeNull();
  const categories = [...host.querySelectorAll('section[aria-labelledby^="help-category-"]')];
  expect(categories).toHaveLength(6);
  expect(categories.map(category => category.querySelector("h2")?.textContent)).toEqual(helpCategories.map(category => category.title));
  for (const category of categories) expect(category.hasAttribute("hidden")).toBe(false);
  expect(host.querySelectorAll('button[aria-expanded="false"]')).toHaveLength(29);
  expect(question("price")).not.toBeNull();
  expect(question("tapping")).not.toBeNull();
});

test("four shortcuts link directly to visible category anchors with directional arrows", async () => {
  await mount();
  const links = [...host.querySelectorAll('nav[aria-label="Help shortcuts"] a')];
  expect(links.map(link => link.querySelector("strong")?.textContent)).toEqual([
    "How to order", "Payment & delivery", "Activate my Neffi", "Card isn’t tapping",
  ]);
  expect(links.map(link => link.getAttribute("href"))).toEqual(["#buying-payment", "#shipping-delivery", "#activation", "#troubleshooting"]);
  for (const link of links) {
    const target = host.querySelector(link.getAttribute("href")!)!;
    expect(target.closest("section")?.hasAttribute("hidden")).toBe(false);
    expect(link.lastElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(link.lastElementChild?.getAttribute("aria-hidden")).toBe("true");
  }
});

test("FAQ answers operate independently across categories", async () => {
  await mount();
  const price = question("price");
  const tapping = question("tapping");
  await act(async () => price.click());
  await act(async () => tapping.click());
  for (const button of [price, tapping]) {
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector(`#${button.getAttribute("aria-controls")}`)?.getAttribute("aria-hidden")).toBe("false");
    expect(host.querySelector(`#${button.getAttribute("aria-controls")}`)?.hasAttribute("inert")).toBe(false);
  }
  await act(async () => price.click());
  expect(price.getAttribute("aria-expanded")).toBe("false");
  const closed = host.querySelector(`#${price.getAttribute("aria-controls")}`)!;
  expect(closed.getAttribute("aria-hidden")).toBe("true");
  expect(closed.hasAttribute("inert")).toBe(true);
  expect(tapping.getAttribute("aria-expanded")).toBe("true");
  const facebook = host.querySelector('a[href="https://www.facebook.com/p/Neffi-61595507571192/"]')!;
  expect(facebook.getAttribute("target")).toBe("_blank");
  expect(facebook.getAttribute("rel")).toBe("noopener noreferrer");
});

test("sharing and legacy deep links point into their visible categories without duplicate IDs", async () => {
  await mount("#sharing");
  for (const [anchor, title] of [["sharing", "Using & sharing"], ["getting-started", "Activation"], ["profile", "Using & sharing"], ["buying", "Buying & payment"], ["buying-ordering", "Buying & payment"], ["shipping", "Shipping & delivery"], ["account", "Account & card issues"]]) {
    const section = host.querySelector(`#${anchor}`)?.closest("section");
    expect(section?.querySelector("h2")?.textContent).toBe(title);
    expect(section?.hasAttribute("hidden")).toBe(false);
  }
  const ids = [...host.querySelectorAll("[id]")].map(element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("Help keeps the approved policies and accurate physical QR/NFC guidance in 29 useful answers", () => {
  const articles = helpCategories.flatMap(category => category.articles);
  expect(articles).toHaveLength(29);
  const byId = (id: string) => articles.find(article => article.id === id)!;
  expect(byId("price").answer).toContain("₱799");
  expect(byId("shipping-fee").answer).toContain("Shipping is charged separately");
  expect(byId("shipping-fee").answer).toContain("J&T");
  for (const method of ["GCash", "Maya", "MariBank", "GoTyme", "bank transfer"]) expect(byId("payment").answer).toContain(method);
  expect(byId("cod").answer).toMatch(/Not at the moment.*prepaid/);
  expect(byId("cancel").answer).toContain("has not yet been shipped");
  expect(byId("custom").answer).toContain("Not yet.");
  expect(byId("damaged").answer).toContain("Damage caused by misuse after delivery is not covered.");
  expect(byId("damaged").link?.href).toBe("/support");
  expect(byId("tapping").answer).toMatch(/Android.*enable NFC.*Settings/);
  expect(byId("tapping").answer).toContain("metallic cases");
  expect(byId("no-nfc").answer).toContain("They don’t need a Neffi account or app.");
  expect(byId("two-qrs").answer).toContain("packaging is for activating");
  expect(byId("sharing-qr").answer).toContain("printed on the back");
  expect(byId("no-nfc").answer).toContain("Sharing QR on the back");
  expect(byId("two-qrs").answer).toContain("Sharing QR on the back");
  expect(byId("android-nfc").answer).toContain("NFC is enabled");
  expect(byId("lost-card").answer).toContain("replacement costs may apply");
  expect(byId("lost-card").answer).toContain("may still be able to open");
  expect(byId("lost-card").answer).not.toMatch(/disable|revoke|unlink|block|lost mode/i);
  const copy = articles.map(article => `${article.question} ${article.answer}`).join(" ");
  expect(copy).not.toMatch(/password|invoice|receipt|BIR|7.day|lifetime|unlimited/i);
});
