"use client";

import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const motion = "rounded-[10px] interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none";

export function EditorFooter({ dirty, saving, onCancel }: { dirty: boolean; saving: boolean; onCancel: () => void }) {
  return (
    <footer className={`${dirty || saving ? "sticky bottom-[calc(90px_+_env(safe-area-inset-bottom))] z-20" : ""} flex flex-col gap-3 rounded-b-panel border-t bg-background p-4 sm:static sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5`}>
      <p role="status" className="flex items-center gap-2 text-meta text-fg-secondary">
        {saving ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : dirty ? <span aria-hidden className="size-1.5 rounded-full bg-brand" /> : <Check aria-hidden className="size-4" />}
        {saving ? "Saving changes…" : dirty ? "Unsaved changes" : "All changes saved"}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <Button type="button" variant="outline" size="touch" disabled={saving} onClick={onCancel} className={motion}>Cancel</Button>
        <Button type="submit" variant={dirty && !saving ? "action" : "outline"} size="touch" disabled={!dirty || saving} className={`gap-2 disabled:border-border disabled:bg-subtle disabled:text-fg-faint disabled:opacity-100 ${motion}`}>
          {saving ? <><LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />Saving…</> : "Save changes"}
        </Button>
      </div>
    </footer>
  );
}
