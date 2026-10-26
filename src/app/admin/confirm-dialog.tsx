"use client";

import type { ReactNode } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// `field` names a hidden input the form submits as "on" once the owner confirms: the server contract for consequential
// actions still expects that flag, and the dialog is where the owner gives it.
export type Confirmation = { title: string; description: ReactNode; confirmLabel?: string; dismissLabel?: string; pendingText?: string; icon?: ReactNode; field?: string };

// Icon, title, one sentence on the consequence, then Cancel and the confirming action. Destructive confirmations are
// red; ordinary state changes stay Vermilion, so only truly irreversible actions look dangerous.
export function ConfirmDialog({ open, onOpenChange, confirmation, destructive = false, pending = false, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; confirmation: Confirmation; destructive?: boolean; pending?: boolean; onConfirm: () => void }) {
  const icon = confirmation.icon ?? (destructive ? <TriangleAlert className="size-5" /> : <ShieldCheck className="size-5" />);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-5 p-4 sm:p-5 text-body sm:max-w-md">
        <DialogHeader className="gap-3">
          <span aria-hidden className={cn("flex size-10 items-center justify-center rounded-full", destructive ? "bg-destructive/10 text-destructive" : "bg-subtle text-foreground")}>{icon}</span>
          <DialogTitle className="font-sans text-section leading-6 font-semibold">{confirmation.title}</DialogTitle>
          <DialogDescription className="text-body text-fg-secondary">{confirmation.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0">
          <DialogClose render={<Button type="button" variant="outline" size="touch" className="text-body md:h-9" />}>{confirmation.dismissLabel ?? "Cancel"}</DialogClose>
          <Button
            type="button"
            variant={destructive ? "danger" : "action"}
            size="touch"
            loading={pending}
            loadingText={confirmation.pendingText}
            onClick={onConfirm}
            className="text-body font-semibold md:h-9"
          >
            {confirmation.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
