"use client";

import Image from "next/image";
import { useEffect, useRef, type PointerEvent } from "react";

// The card's corner radius as a fraction of the 324x205 artwork, so the plates match the SVG's own 12px corners at any size.
const CARD_RADIUS = "rounded-[3.7%/5.85%]";

// The tilt transition length; the callout anchors are re-measured for this long after the pointer moves.
const TILT_MS = 700;

// Pointer position drives custom properties on the stage: tilt for the card, an opposite drift for the tap field, and the light
// position for the card's shading. CSS transitions smooth them, so there is no animation loop.
export function HeroCard() {
  const stage = useRef<HTMLDivElement>(null);
  const leftEdge = useRef<HTMLSpanElement>(null);
  const rightEdge = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);
  const anchorFrame = useRef(0);

  // The callout lines end on two markers fixed to the middle of the card's left and right edges. The markers move with the card's
  // 3D transform, so their projected positions are the true edge points at any size or tilt.
  const anchor = () => {
    const node = stage.current;
    const left = leftEdge.current?.getBoundingClientRect();
    const right = rightEdge.current?.getBoundingClientRect();
    if (!node || !left || !right) return;
    const box = node.getBoundingClientRect();
    node.style.setProperty("--edge-left", `${(left.left - box.left).toFixed(1)}px`);
    node.style.setProperty("--edge-right", `${(right.left - box.left).toFixed(1)}px`);
    node.dataset.anchored = "true";
  };

  const followTilt = () => {
    cancelAnimationFrame(anchorFrame.current);
    const until = performance.now() + TILT_MS + 50;
    const step = () => {
      anchor();
      if (performance.now() < until) anchorFrame.current = requestAnimationFrame(step);
    };
    anchorFrame.current = requestAnimationFrame(step);
  };

  // The card is as wide as the stage's height allows (1.58 being the artwork's aspect), capped by its width and 32rem. This is
  // measured rather than done with container units, because cqh resolves to 0 for a flex-sized container in current Chrome.
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const fit = () => {
      const width = Math.min(512, node.clientWidth * 0.88, (node.clientHeight - 40) * 1.58);
      node.style.setProperty("--card-w", `${Math.max(width, 160).toFixed(0)}px`);
      requestAnimationFrame(anchor);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(anchorFrame.current);
    };
  }, []);

  const set = (x: number, y: number) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const style = stage.current?.style;
      if (!style) return;
      style.setProperty("--tilt-x", `${(-y * 7).toFixed(2)}deg`);
      style.setProperty("--tilt-y", `${(x * 9).toFixed(2)}deg`);
      style.setProperty("--drift-x", `${(-x * 14).toFixed(1)}px`);
      style.setProperty("--drift-y", `${(-y * 10).toFixed(1)}px`);
      style.setProperty("--light-x", `${(30 + x * 40).toFixed(1)}%`);
      style.setProperty("--light-y", `${(18 + y * 30).toFixed(1)}%`);
      followTilt();
    });
  };

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    set((event.clientX - box.left) / box.width - 0.5, (event.clientY - box.top) / box.height - 0.5);
  };

  return (
    <div
      ref={stage}
      onPointerMove={follow}
      onPointerLeave={() => set(0, 0)}
      className="group/stage relative mt-[clamp(0.5rem,2svh,1.5rem)] min-h-0 w-full max-w-5xl flex-1 [--card-w:min(32rem,86vw)] [perspective:1600px]"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <TapField />
        <div className="relative animate-card-float motion-reduce:animate-none">
          <div
            style={{ transform: "rotateX(calc(14deg + var(--tilt-x, 0deg))) rotateY(var(--tilt-y, 0deg)) rotateZ(-2deg)", width: "var(--card-w)" }}
            className="relative aspect-[324/205] transition-transform duration-700 ease-out [transform-style:preserve-3d] motion-reduce:transition-none"
          >
            {/* Card stock: a plate set back from the face reads as the card's edge as it tilts. */}
            <div aria-hidden className={`absolute inset-0 ${CARD_RADIUS} bg-[#D6D7DC] [transform:translateZ(-5px)]`} />
            <div
              className={`absolute inset-0 overflow-hidden ${CARD_RADIUS} bg-white shadow-[inset_0_1px_0_rgb(255_255_255),0_32px_64px_-28px_rgb(17_17_19/0.36),0_12px_24px_-12px_rgb(17_17_19/0.14)] ring-1 ring-black/[0.06]`}
            >
              <Image src="/neffi-card-front-preview.svg" alt="The Neffi card" fill priority unoptimized className="object-cover" />
              {/* Soft shading away from the light; it follows the pointer so the face reads as a lit surface. */}
              <div
                aria-hidden
                style={{ background: "radial-gradient(130% 110% at var(--light-x, 30%) var(--light-y, 18%), rgb(255 255 255 / 0.5), transparent 45%, rgb(17 17 19 / 0.07))" }}
                className="pointer-events-none absolute inset-0 transition-[background] duration-700"
              />
            </div>
            <span ref={leftEdge} aria-hidden className="absolute top-1/2 left-0 size-0" />
            <span ref={rightEdge} aria-hidden className="absolute top-1/2 right-0 size-0" />
          </div>
        </div>
        {/* After the card in the DOM, so the endpoint dots sit on top of its edge. */}
        <Callout side="left">Tap to share</Callout>
        <Callout side="right">Edit anytime</Callout>
      </div>
    </div>
  );
}

// A quiet callout set right against the card: a short hairline and a tiny Vermilion anchor on the card's edge (see the markers above). Desktop only: on a
// phone there is no room beside the card, so the stage shows the card and field alone. Hidden until the edges have been measured.
function Callout({ side, children }: { side: "left" | "right"; children: string }) {
  const left = side === "left";
  return (
    <p
      aria-hidden
      style={left ? { right: "calc(100% - var(--edge-left) - 2px)" } : { left: "calc(var(--edge-right) - 2px)" }}
      className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 items-center font-mono text-xs font-medium tracking-[0.12em] whitespace-nowrap text-fg-secondary uppercase opacity-0 transition-opacity duration-300 group-data-[anchored=true]/stage:opacity-100 min-[900px]:flex ${
        left ? "flex-row" : "flex-row-reverse"
      }`}
    >
      {children}
      <span className={`h-px w-7 bg-border-strong ${left ? "ml-3" : "mr-3"}`} />
      <span className="size-1 shrink-0 rounded-full bg-brand" />
    </p>
  );
}

// The "tap field" behind the card: concentric guide rings and axes that fade out well before the edge of their box, so nothing ends on
// a hard line. It drifts against the card's tilt for a little parallax, and two Vermilion rings ripple out on a slow loop. It carries
// no text. Small screens keep only the rings, quieter.
function TapField() {
  return (
    // Centring and drift both use the translate property, so they live on separate elements.
    <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -z-10 aspect-[3/2] w-[75rem] max-w-[220vw] -translate-1/2 max-[768px]:opacity-60">
      <div
        style={{ translate: "var(--drift-x, 0) var(--drift-y, 0)" }}
        className="absolute inset-0 transition-[translate] duration-1000 ease-out [mask-image:radial-gradient(closest-side,#000_30%,transparent_85%)]"
      >
        <svg viewBox="0 0 1200 800" className="absolute inset-0 size-full" fill="none">
          <g stroke="rgb(17 17 19)" strokeOpacity="0.07" vectorEffect="non-scaling-stroke">
            {[150, 225, 310, 405, 510].map((r, i) => (
              <circle key={r} cx="600" cy="400" r={r} strokeDasharray={i % 2 ? "2 6" : undefined} />
            ))}
            <g className="max-[768px]:hidden">
              <line x1="0" y1="400" x2="1200" y2="400" />
              <line x1="600" y1="0" x2="600" y2="800" />
            </g>
          </g>
        </svg>
        <span className="absolute top-1/2 left-1/2 size-[24rem] -translate-1/2">
          <span className="absolute inset-0 animate-tap-pulse rounded-full border border-brand/30 motion-reduce:hidden" />
          <span className="absolute inset-0 animate-tap-pulse rounded-full border border-brand/20 [animation-delay:-3.5s] motion-reduce:hidden" />
        </span>
      </div>
    </div>
  );
}
