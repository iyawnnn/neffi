"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { LayoutPicker, ModeToggle, AccentPicker } from "@/components/profile/appearance-pickers";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { Button } from "@/components/ui/button";
import { GOALS, NO_GOAL, type Goal } from "@/modules/profiles/goals";
import type { SceneView } from "@/modules/profiles/scene-view";
import type { SetupState } from "./actions";
import { SetupForm } from "./setup-form";
import { SetupView } from "./setup-view";

type Props = { step: "look" | "style"; cardId: string; suffix: string; goal: Goal | null; view: SceneView; action: (previous: SetupState | undefined, data: FormData) => Promise<SetupState> };
export function SetupAppearance({ step, cardId, suffix, goal, view, action }: Props) {
  const [values, setValues] = useState(view.appearance);
  const [state, submit, pending] = useActionState(action, undefined);
  const error = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state?.error) error.current?.focus(); }, [state]);
  const preview = { ...view, appearance: { ...view.appearance, ...values } };
  const dirty = step === "look" ? values.layout !== view.appearance.layout : values.mode !== view.appearance.mode || values.accent !== view.appearance.accent;
  const next = step === "look" ? "style" : "review";
  const render = <div inert aria-hidden="true"><ProfileRenderer view={preview} /></div>;
  return <SetupView suffix={suffix} step={step} backHref={step === "look" ? "?step=links" : "?step=look"} desktopPreview={render}>
    <div data-setup-appearance-preview tabIndex={0} aria-label="Scrollable profile preview" className="neffi-appearance-preview-scroll mx-auto max-h-[22rem] w-full max-w-[390px] overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden">{render}</div>
    <SetupForm action={submit} changed={dirty} className="flex min-w-0 flex-col gap-5">
      <input type="hidden" name="cardId" value={cardId} />
      <div className="-mx-4 sm:-mx-6">
        {step === "look" ? <LayoutPicker view={preview} value={values.layout} recommended={(goal ? GOALS[goal] : NO_GOAL).layout} disabled={pending} onChange={layout => setValues({ ...values, layout })} /> : <><ModeToggle value={values.mode} disabled={pending} onChange={mode => setValues({ ...values, mode })} /><AccentPicker value={values.accent} disabled={pending} onChange={accent => setValues({ ...values, accent })} /></>}
      </div>
      {state?.error && <p ref={error} tabIndex={-1} role="alert" className="text-body text-destructive outline-none">{state.error}</p>}
      <Button type="submit" variant="action" size="touch" className="h-12 w-full" loading={pending} loadingText="Saving…">Continue</Button>
      <Link href={`?step=${next}`} className="inline-flex min-h-11 items-center justify-center rounded-lg text-body text-fg-secondary focus-visible:outline-2 focus-visible:outline-brand">Skip for now</Link>
    </SetupForm>
  </SetupView>;
}
