import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NeffiLogo } from "@/components/neffi-logo";

export function SetupHeader({ preview = false }: { preview?: boolean }) {
  return (
    <header className="mx-auto w-full max-w-[440px] px-4 pt-4 sm:px-6 sm:pt-6 md:max-w-[1080px] md:pt-8">
      <div className="flex h-14 sm:h-15 w-full items-center justify-between rounded-[16px] border border-border/80 bg-background px-4 sm:px-6 shadow-xs transition-[border-color,box-shadow] duration-200">
        <Link
          href={preview ? "?step=purpose" : "/app"}
          aria-label="Neffi home"
          className="inline-flex min-h-11 items-center rounded-md transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <NeffiLogo aria-hidden className="h-5.5 sm:h-6 w-auto text-foreground" />
        </Link>
        {preview ? (
          <span className="text-meta text-fg-secondary">Setup preview</span>
        ) : (
          <Link
            href="/app"
            className="group inline-flex min-h-11 items-center gap-1.5 text-meta font-medium text-foreground transition-colors duration-[220ms] hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="nav-interact transition-colors group-hover:text-brand">Finish later</span>
            <ArrowRight aria-hidden className="size-3.5 shrink-0 nav-interact nav-arrow" />
          </Link>
        )}
      </div>
    </header>
  );
}
