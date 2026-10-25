// @vitest-environment happy-dom
import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import GuidePage from "./guide/page";
import PricingPage from "./pricing/page";
import HelpPage from "./help/page";
import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page";
import TermsPage, { metadata as termsMetadata } from "./terms/page";
import { MarketingFooter } from "./marketing-footer";
import { FinalCtaSection } from "./final-cta-section";
import { SectionDivider } from "./section-divider";

const appRoot = join(process.cwd(), "src/app");
const publicRoot = join(process.cwd(), "public");
const routes = new Set(readdirSync(appRoot, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name === "page.tsx")
  .map(entry => "/" + relative(appRoot, entry.parentPath).split(sep).filter(part => part && !part.startsWith("(")).join("/")));
const pages = { "/guide": GuidePage, "/pricing": PricingPage, "/help": HelpPage, "/privacy": PrivacyPage, "/terms": TermsPage };
const rendered = Object.fromEntries(Object.entries(pages).map(([path, Page]) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<><Page /><MarketingFooter /></>);
  return [path, host];
}));

test.each(Object.keys(pages))("%s has a clear landmark, valid destinations and existing artwork", path => {
  const host = rendered[path];
  expect(host.querySelectorAll("main")).toHaveLength(1);
  expect([...host.querySelectorAll("h1")].filter(heading => !heading.closest("[inert]"))).toHaveLength(1);
  expect(host.querySelectorAll("footer")).toHaveLength(1);
  const ids = [...host.querySelectorAll("[id]")].map(element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const link of host.querySelectorAll("a")) {
    const href = link.getAttribute("href")!;
    expect(href).not.toBe("");
    expect(href).not.toBe("#");
    expect(href).not.toMatch(/^javascript:/i);
    const target = new URL(href, `https://neffi.example${path}`);
    if (target.origin !== "https://neffi.example") continue;
    expect(routes.has(target.pathname), href).toBe(true);
    if (target.hash && rendered[target.pathname]) {
      const targetIds = [...rendered[target.pathname].querySelectorAll("[id]")].map(element => element.id);
      expect(targetIds, href).toContain(decodeURIComponent(target.hash.slice(1)));
    }
  }
  for (const asset of host.querySelectorAll("img[src], image[href]")) {
    const source = asset.getAttribute("src") ?? asset.getAttribute("href")!;
    if (source.startsWith("/")) expect(existsSync(join(publicRoot, source.slice(1))), source).toBe(true);
  }
});

const sectionText = (path: string, id: string) => rendered[path].querySelector(`section#${id}`)?.textContent ?? "";
const mailto = (path: string, id: string) => [...rendered[path].querySelectorAll(`section#${id} a[href^="mailto:"]`)].map(link => link.getAttribute("href"));
const guardian = "If you are under 18, you may use Neffi with the permission and involvement of a parent or legal guardian.";

test.each([
  ["/privacy", privacyMetadata, "Privacy Policy"], ["/terms", termsMetadata, "Terms & Conditions"],
] as const)("%s is a single-column dated legal document that stays out of search until approved", (path, metadata, title) => {
  const main = rendered[path].querySelector("main")!;
  expect(main.querySelector("h1")?.textContent).toBe(title);
  expect(main.querySelector(".legal-eyebrow")?.textContent).toBe("Legal");
  expect(main.querySelector(".legal-updated time")?.getAttribute("dateTime")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // One document column: no contents rail, mobile contents disclosure or per-heading anchor icons.
  expect(main.querySelector("nav, details, .legal-anchor")).toBeNull();
  const sections = main.querySelectorAll(".legal-document > section[id]");
  expect(sections.length).toBeGreaterThanOrEqual(8);
  expect(sections.length).toBeLessThanOrEqual(13);
  expect(main.textContent).not.toMatch(/Not yet published|Approved copy required|NEEDS OWNER CONFIRMATION|\bTBD\b|\bpending\b/i);
  // No business registration, operator or address exists yet; none may be implied.
  expect(main.textContent).not.toMatch(/\b(DTI|BIR|VAT|TIN|SEC)\b|Neffi Inc|incorporated|corporation|registered (office|address)|registration (no|number)|data protection officer/i);
  expect(main.textContent).not.toMatch(/guarantee[sd]? (full )?(legal )?compliance|fully compliant|completely secure/i);
  expect(main.textContent).not.toMatch(/must be at least 18/i);
  expect(rendered[path].innerHTML).not.toContain("neffi.team@gmail.com");
  expect(metadata.robots).toEqual({ index: false, follow: true });
});

test("privacy explains collection, public profiles, sharing by category, rights and young users", () => {
  const text = rendered["/privacy"].querySelector("main")!.textContent!;
  for (const category of ["Account information", "Profile information", "Card information", "Orders and support", "Technical information"]) {
    expect(sectionText("/privacy", "information-we-collect")).toContain(category);
  }
  const publicProfile = sectionText("/privacy", "public-profile");
  for (const way of ["NFC", "Sharing QR", "permanent profile link"]) expect(publicProfile).toContain(way);
  expect(publicProfile).toContain("Your sign-in email is separate from the contact email you choose to show publicly.");
  const sharing = sectionText("/privacy", "sharing");
  expect(sharing).toContain("hosting, data and image storage, email delivery, sign-in, and technical monitoring");
  expect(sharing).toContain("delivery courier and the payment method you choose");
  expect(sharing).toContain("outside the Philippines");
  // The provider inventory lives in the internal audit, not the public page.
  expect(text).not.toMatch(/Vercel|Neon|Resend|Cloudinary|Sentry/);
  expect(rendered["/privacy"].querySelector("table")).toBeNull();
  const rights = sectionText("/privacy", "your-rights");
  for (const right of ["informed", "access", "correct", "object", "erased or blocked", "copy", "National Privacy Commission"]) expect(rights).toContain(right);
  expect(rights).toContain("You may request deletion of your Neffi account or personal information");
  expect(rights).toContain("Some information may need to be retained");
  expect(mailto("/privacy", "your-rights")).toEqual(["mailto:privacy@getneffi.com"]);
  expect(sectionText("/privacy", "retention")).toContain("as long as reasonably necessary");
  const cookies = sectionText("/privacy", "cookies-and-security");
  expect(cookies).toContain("only essential cookies");
  expect(cookies).toContain("No online service can guarantee absolute security");
  expect(cookies).not.toMatch(/hash|HMAC|attempt/i);
  expect(sectionText("/privacy", "young-users")).toContain("with the permission and involvement of a parent or legal guardian");
  expect(mailto("/privacy", "contact")).toEqual(["mailto:privacy@getneffi.com", "mailto:support@getneffi.com"]);
  expect(text).toContain("Neffi does not sell personal information to advertisers or data brokers.");
  expect(text).not.toMatch(/we (may )?sell|Google Analytics|Meta Pixel|TikTok Pixel|self-service (account )?deletion/i);
});

test("terms keep the locked commercial, card, lost-card and consumer terms", () => {
  const text = rendered["/terms"].querySelector("main")!.textContent!;
  const using = sectionText("/terms", "using-neffi");
  expect(using).toContain(guardian);
  expect(using).toContain("A parent or guardian must approve purchases made by a minor.");
  const card = sectionText("/terms", "your-card");
  expect(card).toContain("Package QR ≠ Sharing QR");
  expect(card).toMatch(/Package QR.*activate your Neffi/);
  expect(card).toMatch(/Sharing QR.*back of the card and opens your public profile/);
  expect(card).toContain("custom or personalized physical designs are not offered");
  const ordering = sectionText("/terms", "ordering-and-payment");
  expect(ordering).toContain("₱799");
  expect(ordering).toContain("Shipping is charged separately.");
  expect(ordering).toContain("We accept GCash, Maya, MariBank, GoTyme and bank transfer.");
  expect(ordering).toContain("Cash on delivery (COD) is not currently available.");
  expect(ordering).not.toMatch(/\bcash\b(?! on delivery)/i);
  expect(ordering).toContain("Your order is accepted once Neffi confirms your payment.");
  expect([...rendered["/terms"].querySelectorAll("#ordering-and-payment a")].map(link => link.getAttribute("href"))).toEqual(["https://www.facebook.com/p/Neffi-61595507571192/"]);
  expect(text).not.toContain("Wise");
  const issues = sectionText("/terms", "shipping-and-issues");
  expect(issues).toContain("J&T");
  expect(issues).toContain("confirmed before you pay");
  expect(issues).toContain("as long as it has not been shipped");
  expect(issues).toContain("Neffi will coordinate the refund with you using an appropriate payment method.");
  expect(issues).not.toMatch(/business days|fee for cancel|restocking/i);
  expect(issues).toMatch(/damaged or defective.*photos or a short video/i);
  expect(mailto("/terms", "shipping-and-issues")).toEqual(["mailto:support@getneffi.com"]);
  const lost = sectionText("/terms", "lost-cards");
  expect(lost).toContain("not a damaged or defective product");
  expect(lost).toContain("Replacement costs may apply and will be confirmed before a replacement is arranged.");
  expect(lost).not.toMatch(/lost mode|free replacement|insurance/i);
  expect(sectionText("/terms", "responsibility")).toContain("Nothing in these Terms removes rights you have under Philippine consumer law");
  expect(sectionText("/terms", "changes")).toContain("we will update the effective date and provide additional notice where appropriate");
  expect(sectionText("/terms", "privacy").includes("Privacy Policy")).toBe(true);
  const law = sectionText("/terms", "law-and-contact");
  expect(law).toContain("governed by the applicable laws of the Philippines");
  expect(mailto("/terms", "law-and-contact")).toEqual(["mailto:support@getneffi.com", "mailto:hello@getneffi.com", "mailto:privacy@getneffi.com"]);
  expect(text).not.toMatch(/No Return, No Exchange|All sales are final|waive all rights|arbitration|class action/i);
});

test("pricing presents the product price and sends purchases to Facebook", () => {
  const main = rendered["/pricing"].querySelector("main")!;
  const hero = main.querySelector('section[aria-labelledby="pricing-title"]')!;
  expect(hero.querySelector("h1")?.textContent).toBe("Neffi Digital Business Card");
  expect(hero.textContent).toContain("₱799");
  expect(hero.textContent).toContain("One tap. Instant connection.");
  expect(hero.textContent).not.toMatch(/NEFFI GUIDE|From order to first tap\.|I already have Neffi/i);
  expect([...hero.querySelectorAll("li")].map(item => item.textContent)).toEqual(["Neffi NFC card", "Editable digital profile"]);
  const gallery = hero.querySelector('[aria-label="Neffi product gallery"]')!;
  const views = [...gallery.querySelectorAll("figure img")].map(image => image.getAttribute("src"));
  expect(views).toEqual(["/marketing/pricing/neffi-pricing-gallery-01-product.webp","/marketing/pricing/neffi-pricing-gallery-02-card-front.webp","/marketing/pricing/neffi-pricing-gallery-03-card-back-qr.webp","/marketing/pricing/neffi-pricing-gallery-04-packaging.webp","/marketing/pricing/neffi-pricing-gallery-05-package-open.webp"]);
  expect(gallery.querySelectorAll('button[aria-pressed]')).toHaveLength(5);
  const heroOrder = hero.querySelector('a[target="_blank"]')!;
  expect(heroOrder.textContent).toBe("Order on Facebook");
  expect(heroOrder.getAttribute("href")).toBe("https://www.facebook.com/p/Neffi-61595507571192/");
  expect(heroOrder.getAttribute("rel")).toBe("noopener noreferrer");
  const productDetails = [...hero.querySelectorAll("a")].find(link => link.textContent === "See product details");
  expect(productDetails?.getAttribute("href")).toBe("/product");
  expect(productDetails?.parentElement).toBe(heroOrder.parentElement);
  expect([...main.querySelectorAll("dt")].map(item => item.textContent)).toEqual([
    "Physical Neffi NFC card", "Your digital profile", "Update it anytime", "Tap or share your QR",
  ]);
  expect([...main.querySelectorAll("ol h3")].map(item => item.textContent)).toEqual([
    "Message us", "Confirm and pay", "We pack and ship", "Track your order",
  ]);
  expect(main.textContent).toContain("Sharing QR printed on the back of the card");
  expect(main.textContent).toContain("Delivery details and any applicable shipping fee are confirmed before payment.");
  expect(main.querySelector("img")?.getAttribute("src")).toBe("/marketing/pricing/neffi-pricing-gallery-01-product.webp");
  expect(main.querySelector('a[href="/product"]')).not.toBeNull();
  expect(main.querySelector('a[href^="/support"], details, .mp-questions, form')).toBeNull();
  expect(main.textContent).not.toMatch(/Before you decide|Ask about current pricing|When your card arrives/);
  expect(main.textContent).not.toMatch(/The card stays\.|Your profile keeps moving\./);
  expect(main.textContent).toContain("Getting your Neffi is simple.");
  const orders = [...main.querySelectorAll("a")].filter(link => link.textContent?.includes("Order on Facebook"));
  expect(orders).toHaveLength(1);
  for (const order of orders) {
    expect(order.getAttribute("href")).toBe("https://www.facebook.com/p/Neffi-61595507571192/");
    expect(order.getAttribute("target")).toBe("_blank");
    expect(order.getAttribute("rel")).toBe("noopener noreferrer");
  }
  const closing = main.lastElementChild!;
  expect(closing.querySelector("h2")?.textContent).toBe("Turn one tap into a connection.");
  expect(closing.querySelector("p")?.textContent).toBe("Share your profile, work, and ways to reach you with one Neffi card.");
  const finalAction = closing.querySelector("a")!;
  expect(finalAction.textContent).toBe("Get Neffi");
  expect(finalAction.getAttribute("href")).toBe("https://www.facebook.com/p/Neffi-61595507571192/");
  expect(finalAction.getAttribute("target")).toBe("_blank");
  expect(finalAction.getAttribute("rel")).toBe("noopener noreferrer");
  const canonical = document.createElement("div");
  canonical.innerHTML = renderToStaticMarkup(<FinalCtaSection href="https://www.facebook.com/p/Neffi-61595507571192/" external />);
  expect(closing.isEqualNode(canonical.firstElementChild)).toBe(true);
  const dividerHost = document.createElement("div");
  dividerHost.innerHTML = renderToStaticMarkup(<SectionDivider />);
  const sections = [...main.children].filter(element => element.tagName === "SECTION");
  expect(sections.map(section => section.getAttribute("aria-labelledby"))).toEqual([
    "pricing-title", "included-heading", "buying-heading", "final-cta-heading",
  ]);
  for (let index = 0; index < 2; index++) {
    const divider = sections[index].nextElementSibling;
    expect(divider?.isEqualNode(dividerHost.firstElementChild)).toBe(true);
    expect(divider?.nextElementSibling).toBe(sections[index + 1]);
  }
  const ordering = sections[2];
  expect(ordering.textContent).not.toContain("Order on Facebook");
  expect(ordering.querySelector("a, button")).toBeNull();
  expect(ordering.nextElementSibling).toBe(closing);
  expect(rendered["/pricing"].querySelector("footer")?.firstElementChild?.isEqualNode(dividerHost.firstElementChild)).toBe(true);
});

test("Help opens its buying category with approved price, payment and ordering information", () => {
  const topic = rendered["/help"].querySelector("#buying-ordering");
  expect(topic).not.toBeNull();
  expect(topic?.querySelector("h2")?.textContent).toBe("Buying & payment");
  expect(topic?.querySelectorAll("button[aria-expanded]")).toHaveLength(7);
  expect(topic?.textContent).toContain("A Neffi Digital Business Card is ₱799.");
  expect(topic?.textContent).toContain("Shipping is charged separately based on your delivery location.");
  for (const method of ["GCash", "Maya", "MariBank", "GoTyme", "bank transfer"]) expect(topic?.textContent).toContain(method);
  expect(topic?.querySelector('a[href="https://www.facebook.com/p/Neffi-61595507571192/"]')).not.toBeNull();
  expect(topic?.textContent).not.toContain("Wise");
});

test("footer has official social anchors and no newsletter controls", () => {
  const footer = rendered["/guide"].querySelector("footer")!;
  for (const path of ["/product", "/guide", "/pricing", "/help", "/privacy", "/terms"]) {
    expect(footer.querySelector(`a[href="${path}"]`), path).not.toBeNull();
  }
  expect(footer.querySelector('a[href="/terms"]')?.textContent).toBe("Terms & Conditions");
  expect(footer.querySelector('a[href="/privacy"]')?.textContent).toBe("Privacy Policy");
  expect(footer.querySelectorAll(".marketing-footer-socials a")).toHaveLength(3);
  for (const [label, href] of [
    ["Facebook", "https://www.facebook.com/p/Neffi-61595507571192/"],
    ["Instagram", "https://www.instagram.com/neffi.ph"],
    ["TikTok", "https://www.tiktok.com/@neffi.ph"],
  ]) {
    const link = footer.querySelector(`a[aria-label="${label}"]`);
    expect(link?.getAttribute("href")).toBe(href);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.querySelector("svg path")).not.toBeNull();
  }
  expect(footer.textContent).toContain("Follow Neffi");
  expect(footer.querySelector('form, input, button, [aria-label="Email"]')).toBeNull();
});
