"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminNav } from "./admin-nav";

const iconButton = "inline-flex size-11 items-center justify-center rounded-lg text-fg-secondary nav-interact transition-colors hover:bg-subtle hover:text-foreground active:bg-subtle focus-visible:outline-2 focus-visible:outline-brand";

/** Phone navigation: a drawer with the same grouped menu as the sidebar. Closes on navigation, Escape or the backdrop. */
export function MobileMenu({ account, basePath = "/admin" }: { account: ReactNode; basePath?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label="Open menu" className={iconButton}>
        <Menu aria-hidden className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false} className="w-[min(20rem,88vw)] gap-0 bg-background p-0 data-[side=right]:sm:max-w-80">
        <SheetHeader className="min-h-14 flex-row items-center justify-between gap-3 border-b py-0 pr-2 pl-4">
          <SheetTitle className="font-sans text-section">Menu</SheetTitle>
          <SheetDescription className="sr-only">Jump to any part of the owner admin.</SheetDescription>
          <SheetClose aria-label="Close menu" className={iconButton}><X aria-hidden className="size-5" /></SheetClose>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
          <AdminNav basePath={basePath} comfortable onNavigate={() => setOpen(false)} />
          <div className="mt-auto">{account}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
