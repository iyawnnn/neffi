"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// One right-hand sheet for every contextual task: a visible trigger, a title, a line on what it does, and a close
// control that is always in reach. The icon is an element, not a component: server pages pass it across the client boundary. Focus is trapped while open and Escape closes it.
export function ActionSheet({ title, description, icon, variant = "outline", destructive = false, trigger, defaultOpen = false, children }: { title: string; description?: string; icon?: ReactNode; variant?: "outline" | "action"; destructive?: boolean; trigger?: string; defaultOpen?: boolean; children: ReactNode }) {
  return <Dialog.Root defaultOpen={defaultOpen}>
    <Dialog.Trigger render={<Button type="button" variant={variant} size="touch" className={cn("text-body md:h-9", variant === "action" && "font-semibold", destructive && "border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive")} />}>
      {icon}{trigger ?? title}
    </Dialog.Trigger>
    <Dialog.Portal keepMounted>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 transition-opacity duration-[220ms] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
      <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-y-auto border-l bg-background shadow-xl transition-transform duration-[220ms] ease-out outline-none data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full motion-reduce:transition-none sm:max-w-md">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-background px-5 py-3.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Dialog.Title className="text-section">{title}</Dialog.Title>
            {description ? <Dialog.Description className="text-meta text-fg-secondary">{description}</Dialog.Description> : null}
          </div>
          <Dialog.Close render={<Button type="button" variant="ghost" size="icon" aria-label="Close" className="-mr-2 size-11 shrink-0 md:size-9" />}><X aria-hidden /></Dialog.Close>
        </div>
        <div className="flex flex-col gap-5 p-5 text-body">{children}</div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
