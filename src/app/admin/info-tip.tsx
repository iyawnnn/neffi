"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** A small "what does this mean?" help icon: a focusable button, so keyboard and touch users get the definition too. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipProvider delay={120}>
      <Tooltip>
        <TooltipTrigger render={<button type="button" aria-label={label} className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-fg-faint nav-interact transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-brand" />}>
          <CircleHelp aria-hidden className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-60 px-3 py-2 text-meta leading-snug">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
