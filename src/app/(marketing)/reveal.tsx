"use client";

import { useEffect, useRef, type ReactNode } from "react";

// A figure that plays its illustration's entrance once, the first time it scrolls into view. It only sets `data-state`; the motion
// lives in CSS. Server-rendered artwork stays visible; figures already on screen skip the entrance unless requested.
export function Reveal({ className, children, animateOnMount = false }: { className: string; children: ReactNode; animateOnMount?: boolean }) {
  const figure = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = figure.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let first = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (first) {
          first = false;
          if (entry.isIntersecting) {
            if (animateOnMount) node.dataset.state = "in";
            return observer.disconnect();
          }
          node.dataset.state = "idle";
          return;
        }
        if (entry.isIntersecting) {
          node.dataset.state = "in";
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [animateOnMount]);

  return (
    <figure ref={figure} className={className}>
      {children}
    </figure>
  );
}
