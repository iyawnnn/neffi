// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import GuidePage from "./page";
import { SectionDivider } from "../section-divider";
import { FinalCtaSection } from "../final-cta-section";

function render() {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<GuidePage />);
  return host;
}

test("the hero uses the vector package and card composition without extra views or captions", () => {
  const hero = render().querySelector(".guide-hero")!;
  expect(hero.textContent).not.toMatch(/799|pricing|starting at/i);
  expect(hero.querySelectorAll("img")).toHaveLength(1);
  expect(hero.querySelector("img")?.getAttribute("alt")).toBe("Neffi package with NFC card");
  expect(hero.textContent).not.toContain("Facebook ordering link coming soon.");
  expect(hero.querySelector("img")?.getAttribute("src")).toBe("/marketing/guide/neffi-guide-hero-product.svg");
  expect(hero.querySelector("figcaption")).toBeNull();
  expect(hero.textContent).not.toMatch(/Back|Opened|activation code|QR code/);
});

test("explains the manual purchase and tracked delivery journey", () => {
  const host = render();
  const buying = host.querySelector("#buying")!;
  const steps = [...buying.querySelectorAll("ol > li")];
  expect(steps).toHaveLength(4);
  expect(steps.map(step => step.querySelector("p")?.textContent)).toEqual([
    "Message us on Facebook to start your Neffi order.",
    "We’ll confirm your order and send the payment details.",
    "Once confirmed, we’ll prepare your Neffi and ship it through J&T.",
    "We’ll send your J&T tracking number for delivery updates.",
  ]);
  expect(buying.textContent).not.toMatch(/GCash|Maya|MariBank|GoTyme|bank transfer/i);
  const dividerHost = document.createElement("div");
  dividerHost.innerHTML = renderToStaticMarkup(<SectionDivider />);
  const divider = buying.nextElementSibling;
  expect(divider?.isEqualNode(dividerHost.firstElementChild)).toBe(true);
  expect(divider?.nextElementSibling?.id).toBe("in-the-package");
  const order = [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Order on Facebook"));
  expect(order?.disabled).toBe(true);
  expect(host.querySelector('a[href*="facebook.com"], a[href*="m.me"], form')).toBeNull();
});

test("explains the three package essentials beneath the authentic card", () => {
  const section = render().querySelector("#in-the-package")!;
  expect(section.querySelector("h2")?.textContent).toBe("Your Neffi has everythingyou need to get started.");
  expect(section.querySelector("figure img")?.getAttribute("src")).toBe("/neffi-card-front-preview.svg");
  expect(section.querySelector("figcaption")).toBeNull();
  expect([...section.querySelector("dl")!.querySelectorAll("dt")].map(term => term.textContent)).toEqual([
    "01Neffi card", "02Activation QR", "03Private activation code",
  ]);
  expect([...section.querySelector("dl")!.querySelectorAll("dd")].map(description => description.textContent)).toEqual([
    "Tap the NFC card to share your digital profile.",
    "Scan the package QR to open Neffi activation.",
    "Enter the private code to connect your Neffi.",
  ]);
});

test("removes the QR comparison and keeps shared dividers at the section boundaries", () => {
  const host = render();
  const section = host.querySelector("#in-the-package")!;
  expect(section.textContent).toContain("Everything you need to activate and start sharing.");
  expect(section.querySelectorAll("dl")).toHaveLength(1);
  for (const copy of ["Two QR codes. Different jobs.", "Opens Neffi activation.", "Printed on the package.", "Opens your digital profile.", "Available after setup."]) {
    expect(section.textContent).not.toContain(copy);
  }
  const dividerHost = document.createElement("div");
  dividerHost.innerHTML = renderToStaticMarkup(<SectionDivider />);
  for (const [previous, next] of [[host.querySelector("h1")!.closest("section")!, "buying"], [host.querySelector("#buying")!, "in-the-package"], [section, "activation"], [host.querySelector("#activation")!, "your-profile"], [host.querySelector("#your-profile")!, "keep-your-card"]] as const) {
    const divider = previous.nextElementSibling;
    expect(divider?.isEqualNode(dividerHost.firstElementChild)).toBe(true);
    expect(divider?.nextElementSibling?.id).toBe(next);
  }
});

test("explains three activation steps with an illustrative code and the activation link", () => {
  const host = render();
  const activation = host.querySelector("#activation")!;
  expect(activation.querySelector("h2")?.textContent).toBe("Activate your Neffiin 3 steps.");
  expect(activation.textContent).not.toContain("Scan the package, enter your code, then make it yours.");
  const steps = [...activation.querySelectorAll("ol > li")];
  expect(steps).toHaveLength(3);
  expect(steps.map(step => step.querySelector("h3")?.textContent)).toEqual([
    "Scan your package", "Enter your code", "Add your Neffi",
  ]);
  expect(steps.map(step => step.querySelector("p")?.textContent)).toEqual([
    "Scan the QR on the back of your Neffi package to open activation.",
    "Your private activation code is printed inside the package.",
    "Sign in, add the card to your account, then continue to profile setup.",
  ]);
  expect(steps[1].querySelector("figure figcaption")?.textContent).toBe("Your activation code");
  expect(steps[1].querySelector("code")?.textContent).toBe("N8KF-42PQ");
  expect(steps[1].querySelector("figure")?.getAttribute("aria-label")).toBe("Illustrative activation-code sticker");
  expect(steps[0].querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  expect(steps[2].querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  expect(activation.querySelector("input, textarea")).toBeNull();
  expect(activation.textContent).not.toContain("XXXX-XXXX");
  expect(activation.textContent).not.toContain("Google or an email sign-in code");
  expect(activation.querySelector('a[href="/activate"]')?.textContent).toBe("Start activation");
  expect(host.querySelector('.guide-profile-frame [inert] .pf-profile')).toBeTruthy();
});

test("connects profile setup with two compact sharing methods", () => {
  const section = render().querySelector("#your-profile")!;
  expect(section.querySelector("h2")?.textContent).toBe("Make it yours.");
  expect(section.textContent).toContain("After activation, Neffi guides you through your name, photo or logo, contact details, and links.");
  expect(section.textContent).toContain("Choose a layout and colours, preview your profile, then publish when you’re ready.");
  expect(section.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Sample Neffi Classic profile for Mika Santos");
  expect(section.querySelector('[role="img"] [inert]')).toBeTruthy();
  expect(section.querySelector('a[href="/sign-in"]')?.textContent).toBe("Sign in to set up");
  const sharing = section.querySelector("#start-sharing")!;
  expect(sharing.querySelector("h2")?.textContent).toBe("Ready to share.");
  expect([...sharing.querySelectorAll("dt")].map(item => item.textContent)).toEqual(["Tap", "Scan"]);
  expect([...sharing.querySelectorAll("dd")].map(item => item.textContent)).toEqual([
    "Hold your Neffi near a phone’s NFC reader. Open the notification to view your profile.",
    "Show your Sharing QR from your Neffi account. Let the other person scan it to view your profile.",
  ]);
  expect(section.textContent).not.toContain("They don’t need a Neffi account or a separate app.");
  expect(sharing.querySelector('a[href="/help#sharing"]')?.textContent).toBe("Get help with sharing");
});

test("distinguishes the reusable physical card from the updatable profile", () => {
  const section = render().querySelector("#keep-your-card")!;
  expect(section.querySelector("h2")?.textContent).toBe("Change your details.Keep your card.");
  expect([...section.querySelectorAll("dt")].map(item => item.textContent)).toEqual(["Physical card", "Digital profile"]);
  expect([...section.querySelectorAll("dd")].map(item => item.textContent)).toEqual([
    "Your physical Neffi card stays the same as your profile changes.",
    "Update your role, links, contact details, or work from your account.",
  ]);
  expect(section.querySelector('a[href="/product"]')?.textContent).toBe("See what your profile can do");
});

test("removes the Guide FAQ and ends with the shared marketing CTA", () => {
  const host = render();
  expect(host.querySelector("#questions, #guide-questions, details, summary")).toBeNull();
  expect(host.textContent).not.toContain("Questions before or after your order?");
  const closing = host.querySelector('section[aria-labelledby="final-cta-heading"]')!;
  const shared = document.createElement("div");
  shared.innerHTML = renderToStaticMarkup(<FinalCtaSection />);
  expect(closing.isEqualNode(shared.firstElementChild)).toBe(true);
  expect(closing.querySelector('a[href="/pricing"]')?.textContent).toBe("Get Neffi");
  expect(host.querySelector("main")?.lastElementChild).toBe(closing);
});
