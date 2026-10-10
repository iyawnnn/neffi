"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Only the permanent public URL is copied; activation codes never reach this component.
export function CardUrl({ url }: { url: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Card URL copied.");
    } catch {
      setMessage("Could not copy. Select the address and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted p-3">
      <p className="break-all font-mono text-sm select-all">{url}</p>
      <Button type="button" variant="outline" className="h-10 self-start" onClick={copy}>
        Copy URL
      </Button>
      <p role="status" className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
