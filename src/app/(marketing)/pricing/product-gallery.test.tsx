// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { ProductGallery } from "./product-gallery";

test("Pricing gallery supports thumbnail selection, keyboard boundaries and swipe updates", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<ProductGallery />));
    const stage = host.querySelector<HTMLElement>('[aria-roledescription="carousel"]')!;
    const thumbnails = [...host.querySelectorAll("button")];
    Object.defineProperty(stage, "clientWidth", { value: 400 });
    stage.scrollTo = vi.fn((options?: ScrollToOptions | number) => {
      stage.scrollLeft = typeof options === "number" ? options : options?.left ?? 0;
    });
    expect(thumbnails.map(button => button.getAttribute("aria-pressed"))).toEqual(["true", "false", "false", "false", "false"]);
    expect([...host.querySelectorAll("figure img")].map(image => image.getAttribute("src"))).toEqual(["/marketing/pricing/neffi-pricing-gallery-01-product.webp","/marketing/pricing/neffi-pricing-gallery-02-card-front.webp","/marketing/pricing/neffi-pricing-gallery-03-card-back-qr.webp","/marketing/pricing/neffi-pricing-gallery-04-packaging.webp","/marketing/pricing/neffi-pricing-gallery-05-package-open.webp"]);
    expect(host.querySelector('img[alt="Back of the Neffi card with Sharing QR"]')).not.toBeNull();
    expect(host.querySelector('img[alt="Opened Neffi package with activation details"]')).not.toBeNull();
    expect(host.querySelector('img[src$=".svg"]')).toBeNull();
    await act(async () => thumbnails[1].click());
    expect(stage.scrollLeft).toBe(400);
    expect(thumbnails[1].getAttribute("aria-pressed")).toBe("true");
    const key = async (value: string) => act(async () => {
      stage.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true }));
    });
    await key("ArrowRight");
    expect(stage.scrollLeft).toBe(800);
    await key("Home");
    expect(stage.scrollLeft).toBe(0);
    await key("ArrowLeft");
    expect(stage.scrollLeft).toBe(0);
    await key("End");
    expect(stage.scrollLeft).toBe(1600);
    await key("ArrowRight");
    expect(stage.scrollLeft).toBe(1600);
    await key("ArrowLeft");
    expect(stage.scrollLeft).toBe(1200);
    await key("ArrowRight");
    expect(stage.scrollLeft).toBe(1600);
    await act(async () => {
      stage.scrollLeft = 0;
      stage.dispatchEvent(new Event("scroll"));
    });
    expect(thumbnails[0].getAttribute("aria-pressed")).toBe("true");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
