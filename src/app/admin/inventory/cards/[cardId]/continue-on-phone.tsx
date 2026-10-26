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
    <div className="flex flex-col gap-3">
      <h3 className="text-body font-medium">Continue on phone</h3>
      <p className="text-meta text-fg-secondary">Scan to open this card workspace on your phone. You will sign in on your phone; nothing secret is in the QR.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrSrc} alt="QR code that opens this card workspace on your phone" width={144} height={144} className="size-36 self-start rounded-lg border bg-white p-2" />
      <a href={url} className="break-all font-mono text-label text-fg-secondary underline-offset-4 hover:underline">{url}</a>
      <Button type="button" variant="outline" size="touch" className="self-start md:h-9" onClick={copy}>Copy link</Button>
      <p role="status" className="text-meta text-fg-secondary">{message}</p>
    </div>
  );
}
