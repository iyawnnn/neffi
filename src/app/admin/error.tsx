"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminPage } from "./ui";

// Never shows the error message: it can carry record details. The digest is an opaque reference for the logs.
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className={adminPage}>
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <span className="flex size-10 items-center justify-center rounded-full border border-destructive/30 bg-destructive/5 text-destructive"><TriangleAlert aria-hidden className="size-5" /></span>
        <div className="flex flex-col gap-1">
          <h1 className="text-section">Something went wrong</h1>
          <p className="text-meta text-fg-secondary">This page could not be loaded. Nothing was changed. Try again, and if it keeps happening, note the reference below.</p>
        </div>
        <Button type="button" variant="outline" size="touch" className="md:h-9" onClick={() => retry()}>Try again</Button>
        {error.digest ? <p className="font-mono text-label text-fg-secondary">Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
