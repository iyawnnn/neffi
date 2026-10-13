"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";

export function ActionSheet({ title, children }: { title: string; children: ReactNode }) {
  return <Dialog.Root>
    <Dialog.Trigger render={<Button type="button" variant="outline" className="min-h-11" />}>{title}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-full flex-col gap-5 overflow-y-auto bg-background p-5 shadow-xl sm:max-w-md">
        <div className="flex items-center justify-between gap-3"><Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title><Dialog.Close render={<Button type="button" variant="outline" className="min-h-11" />}>Close</Dialog.Close></div>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
