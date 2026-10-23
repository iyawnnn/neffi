import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import { GOALS, NO_GOAL } from "@/modules/profiles/goals";
import { SetupProgress } from "@/components/setup-header";
import { STEP_TITLES, type SetupStep } from "./setup-steps";
import "../../profiles/[profileId]/appearance/appearance-form.css";

export function SetupView({ suffix, step, children, backHref, preview, desktopPreview, showCardSuffix = true }: {
  suffix: string; step?: SetupStep; children?: ReactNode; backHref?: string; preview?: ReactNode; desktopPreview?: ReactNode; showCardSuffix?: boolean;
}) {
  return (
    <main data-setup className="w-full flex-1">
      <div className={`mx-auto w-full px-4 pt-5 pb-12 sm:px-6 sm:pt-8 md:pb-16 ${desktopPreview ? "max-w-[1080px] lg:grid lg:grid-cols-[minmax(0,480px)_390px] lg:items-start lg:justify-between lg:gap-12" : "max-w-[528px]"}`}><div className="mx-auto w-full max-w-[480px] lg:mx-0">
        <SetupProgress step={step} backHref={backHref} preview={preview} />
        {showCardSuffix && <p className="mt-5 text-meta text-fg-secondary">Card ending in {suffix}</p>}
        {step && <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">{STEP_TITLES[step]}</h1>}
        <div className="mt-5 flex flex-col gap-4 sm:mt-6">{children}</div>
        </div>{desktopPreview && <aside aria-label="Profile preview" className="sticky top-28 hidden min-w-0 lg:block"><div tabIndex={0} aria-label="Scrollable profile preview" className="neffi-appearance-preview-scroll max-h-[calc(100dvh-10rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{desktopPreview}</div></aside>}
      </div>
    </main>
  );
}

export function GoalFields({ goal, disabled = false }: { goal?: string | null; disabled?: boolean }) {
  return (
    <>
      <p className="text-body text-fg-secondary">A few simple steps, then you&apos;re ready to share.</p>
      <fieldset className="flex min-w-0 flex-col gap-2.5">
        <legend className="mb-3 text-body font-medium">What will you use Neffi for?</legend>
        {[...Object.entries(GOALS), ["", NO_GOAL] as const].map(([value, option]) => (
          <label key={value} className="flex min-h-[76px] cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand/[0.03] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
            <input type="radio" name="goal" value={value} required defaultChecked={goal !== undefined && (goal ?? "") === value} className="size-4 shrink-0 accent-brand" />
            <span className="min-w-0"><span className="block text-body font-semibold">{option.label}</span><span className="mt-1 block text-meta text-fg-secondary">{option.helper}</span></span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" variant="action" size="touch" className="h-12 w-full" disabled={disabled}>Continue <ArrowRight aria-hidden className="size-4" /></Button>
    </>
  );
}
