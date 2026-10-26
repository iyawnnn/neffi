"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Only the permanent public URL is copied; activation codes never reach this component.
export function CardUrl({ url, copyLabel = "Copy URL", copied = "Card URL copied." }: { url: string; copyLabel?: string; copied?: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(copied);
    } catch {
      setMessage("Could not copy. Select the address and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-canvas p-3">
      <p className="font-mono text-meta break-all select-all">{url}</p>
      <Button type="button" variant="outline" size="touch" className="self-start md:h-9" onClick={copy}>
        {copyLabel}
      </Button>
      <p role="status" className="text-meta text-fg-secondary empty:hidden">{message}</p>
    </div>
  );
}
