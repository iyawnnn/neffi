"use client";

import { useEffect, useRef } from "react";

// The email lives in an iframe so its styles stay isolated like in a real client. Size it to the rendered email
// so the preview shows the natural height instead of a fixed box with empty space below.
export function PreviewFrame({ html, title, width }: { html: string; title: string; width: number }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const fit = () => {
    const element = frame.current;
    const body = element?.contentDocument?.body;
    // The frame is border-box, so add its border back or the content scrolls by a pixel.
    if (element && body) element.style.height = `${body.offsetHeight + element.offsetHeight - element.clientHeight}px`;
  };
  // The first load can finish before hydration attaches onLoad, so size once on mount as well.
  useEffect(fit, [html, width]);
  return <iframe ref={frame} title={title} srcDoc={html} onLoad={fit} style={{ width, height: 480, maxWidth: "100%" }} className="rounded-md border border-border bg-white" />;
}
