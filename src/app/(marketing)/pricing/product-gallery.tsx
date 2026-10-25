"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const views = [
  { label: "Product", src: "/marketing/pricing/neffi-pricing-gallery-01-product.webp", alt: "Neffi NFC card with its packaging", width: 1254, height: 1254 },
  { label: "Card front", src: "/marketing/pricing/neffi-pricing-gallery-02-card-front.webp", alt: "Front of the Neffi NFC card", width: 1254, height: 1254 },
  { label: "Card back / Sharing QR", src: "/marketing/pricing/neffi-pricing-gallery-03-card-back-qr.webp", alt: "Back of the Neffi card with Sharing QR", width: 1254, height: 1255 },
  { label: "Packaging", src: "/marketing/pricing/neffi-pricing-gallery-04-packaging.webp", alt: "Closed Neffi packaging", width: 1254, height: 1254 },
  { label: "Package open", src: "/marketing/pricing/neffi-pricing-gallery-05-package-open.webp", alt: "Opened Neffi package with activation details", width: 1254, height: 1254 },
];

export function ProductGallery() {
  const stage = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);

  function select(index: number) {
    const next = Math.max(0, Math.min(views.length - 1, index));
    setSelected(next);
    stage.current?.scrollTo({ left: next * stage.current.clientWidth });
  }

  return (
    <div className="pricing-gallery" role="group" aria-label="Neffi product gallery">
      <div
        ref={stage}
        className="pricing-gallery-stage"
        role="region"
        aria-roledescription="carousel"
        aria-label="Product views"
        tabIndex={0}
        onScroll={event => {
          const { scrollLeft, clientWidth } = event.currentTarget;
          if (clientWidth) setSelected(Math.max(0, Math.min(views.length - 1, Math.round(scrollLeft / clientWidth))));
        }}
        onKeyDown={event => {
          const destinations: Record<string, number> = { ArrowLeft: selected - 1, ArrowRight: selected + 1, Home: 0, End: views.length - 1 };
          if (event.key in destinations) {
            event.preventDefault();
            select(destinations[event.key]);
          }
        }}
      >
        {views.map(({ label, src, alt, width, height }, index) => (
          <figure key={src} className="pricing-gallery-view" aria-label={`${index + 1} of ${views.length}: ${label}`}>
            <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 1200px) 550px, (min-width: 900px) 50vw, calc(100vw - 48px)" priority={index === 0} unoptimized />
          </figure>
        ))}
      </div>
      <div className="pricing-gallery-thumbnails" role="group" aria-label="Choose a product view">
        {views.map(({ label, src, width, height }, index) => (
          <button key={src} type="button" aria-label={`Show ${label.toLowerCase()}`} aria-pressed={selected === index} onClick={() => select(index)}>
            <Image src={src} alt="" width={width} height={height} sizes="80px" loading="lazy" unoptimized />
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">View {selected + 1} of {views.length}: {views[selected].label}</p>
    </div>
  );
}
