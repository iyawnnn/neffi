"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

function scrollStops(track: HTMLUListElement) {
  const step = window.matchMedia("(min-width: 1024px)").matches ? 2 : 1;
  const maximum = track.scrollWidth - track.clientWidth;
  const items = Array.from(track.children) as HTMLElement[];
  return items.filter((_, index) => index % step === 0).map((item) => Math.min(item.offsetLeft, maximum));
}

function closestStop(stops: number[], left: number) {
  return stops.reduce((closest, stop, index) => Math.abs(stop - left) < Math.abs(stops[closest] - left) ? index : closest, 0);
}

export function UseCasesCarousel({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const animation = useRef<number>(0);
  const [position, setPosition] = useState({ index: 0, count: 3 });

  function cancelAnimation() {
    cancelAnimationFrame(animation.current);
    if (track.current) track.current.style.scrollSnapType = "";
  }

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const sync = () => {
      const stops = scrollStops(node);
      const index = closestStop(stops, node.scrollLeft);
      setPosition((previous) => previous.index === index && previous.count === stops.length ? previous : { index, count: stops.length });
    };
    const resize = new ResizeObserver(() => {
      cancelAnimation();
      const stops = scrollStops(node);
      node.scrollTo({ left: stops[closestStop(stops, node.scrollLeft)], behavior: "instant" });
      sync();
    });
    node.addEventListener("scroll", sync, { passive: true });
    resize.observe(node);
    return () => {
      cancelAnimation();
      resize.disconnect();
      node.removeEventListener("scroll", sync);
    };
  }, []);

  function move(direction: number, edge?: "first" | "last") {
    const node = track.current;
    if (!node) return;
    cancelAnimation();
    const stops = scrollStops(node);
    const index = edge === "first" ? 0 : edge === "last" ? stops.length - 1 : Math.max(0, Math.min(stops.length - 1, closestStop(stops, node.scrollLeft) + direction));
    const destination = stops[index];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.scrollTo({ left: destination, behavior: "instant" });
      return;
    }
    const start = node.scrollLeft;
    const started = performance.now();
    // Disable snapping only during the controlled glide; native touch scrolling keeps CSS snap.
    node.style.scrollSnapType = "none";
    const frame = (now: number) => {
      const progress = Math.min((now - started) / 500, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      node.scrollTo({ left: start + (destination - start) * eased, behavior: "instant" });
      if (progress < 1) animation.current = requestAnimationFrame(frame);
      else node.style.scrollSnapType = "";
    };
    animation.current = requestAnimationFrame(frame);
  }

  return (
    <div role="region" aria-roledescription="carousel" aria-labelledby="use-cases-heading">
      <div className="uc-header">
        {heading}
      </div>
      <ul
        id="use-cases-track"
        ref={track}
        className="uc-track"
        aria-label="Introduction use cases"
        tabIndex={0}
        onTouchStart={cancelAnimation}
        onPointerDown={cancelAnimation}
        onWheel={cancelAnimation}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1, event.key === "Home" ? "first" : event.key === "End" ? "last" : undefined);
        }}
      >
        {children}
      </ul>
      <div className="uc-controls">
        <button type="button" className="uc-arrow" aria-label="Previous use cases" aria-controls="use-cases-track" disabled={position.index === 0} onClick={() => move(-1)}>
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" className="uc-arrow" aria-label="Next use cases" aria-controls="use-cases-track" disabled={position.index === position.count - 1} onClick={() => move(1)}>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
