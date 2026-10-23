"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { SceneView } from "@/modules/profiles/scene-view";

export function SetupPreviewDialog({ view, open, onOpenChange }: { view: SceneView; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" /><Dialog.Popup className="app-type fixed inset-0 z-50 flex flex-col bg-canvas text-foreground sm:inset-4 sm:mx-auto sm:max-w-[438px] sm:rounded-3xl sm:border">
      <div className="flex items-center justify-between border-b bg-background px-4 py-3"><Dialog.Title className="text-section">Profile preview</Dialog.Title><Dialog.Close render={<Button type="button" size="touch" variant="ghost" className="size-11" aria-label="Close preview" />}><X aria-hidden className="size-5" /></Dialog.Close></div><Dialog.Description className="sr-only">Preview your current setup details. Close to continue editing.</Dialog.Description><div tabIndex={0} aria-label="Scrollable profile preview" className="neffi-appearance-preview-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand"><div inert><ProfileRenderer view={view} /></div></div>
    </Dialog.Popup></Dialog.Portal></Dialog.Root>
  );
}
