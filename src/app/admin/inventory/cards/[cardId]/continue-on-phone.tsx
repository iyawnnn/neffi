"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// The QR carries only the trusted Admin route. The phone signs in itself; no code, credential or session is encoded.
export function ContinueOnPhone({ url, qrSrc }: { url: string; qrSrc: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied.");
    } catch {
      setMessage("Could not copy. Select the link and copy it manually.");
    }
  }
  return (
    <div className="flex items-start gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrSrc} alt="QR code that opens this card workspace on your phone" width={96} height={96} className="size-24 shrink-0 rounded-lg border bg-white p-1.5" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-meta text-fg-secondary">Scan to open this card workspace on your phone. You will sign in on your phone; nothing secret is in the QR.</p>
        <a href={url} className="break-all font-mono text-label text-fg-secondary underline-offset-4 hover:underline">{url}</a>
        <Button type="button" variant="outline" size="touch" className="self-start md:h-9" onClick={copy}>Copy link</Button>
        <p role="status" className="text-meta text-fg-secondary empty:hidden">{message}</p>
      </div>
    </div>
  );
}
