"use client";

import { Check, Moon, Sun } from "lucide-react";
import { ACCENTS, LAYOUTS, COLOR_MODES, type Layout, type ColorMode } from "@/modules/profiles/appearance-options";
import type { SceneView } from "@/modules/profiles/scene-view";
import { ProfileRenderer } from "./profile-renderer";

const choice = "cursor-pointer rounded-[10px] border transition-colors duration-[220ms] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand motion-reduce:transition-none";
const selected = "border-brand/60 bg-brand/5";
const idle = "border-transparent hover:border-border hover:bg-canvas";
const layoutNames = { classic: "Classic", editorial: "Editorial", showcase: "Showcase" };
const descriptions = { classic: "A familiar profile, centred on you.", editorial: "A clean, type-led reading flow.", showcase: "Your work and content up front." };

export function LayoutPicker({ view, value, disabled = false, onChange, recommended }: { view: SceneView; value: Layout; disabled?: boolean; onChange: (value: Layout) => void; recommended?: Layout }) {
  return <section aria-labelledby="layout-title" className="p-4 sm:p-6">
    <h2 id="layout-title" className="text-section">Layout</h2>
    <p id="layout-help" className="mt-1 text-meta text-fg-secondary">Same profile. Three ways to present it.</p>
    <fieldset disabled={disabled} aria-describedby="layout-help" className="mt-4 min-w-0">
      <legend className="sr-only">Choose a layout</legend>
      <div className="grid grid-cols-3 gap-2">
        {LAYOUTS.map(layout => <div key={layout} className={`relative min-w-0 overflow-hidden rounded-[10px] border ${value === layout ? selected : "border-border"} ${disabled ? "opacity-60" : ""}`}>
          <div data-layout-mini inert aria-hidden="true" className="pointer-events-none h-28 overflow-hidden border-b">
            <div className="w-[400%] origin-top-left scale-25"><ProfileRenderer view={{ ...view, appearance: { ...view.appearance, layout } }} /></div>
          </div>
          <div className="h-12" />
          <label className={`${choice} absolute inset-0 flex min-h-11 flex-col justify-end border-0 hover:bg-foreground/5 ${disabled ? "cursor-default" : ""}`}>
            <input type="radio" name="layout" aria-label={layoutNames[layout]} value={layout} checked={value === layout} onChange={() => onChange(layout)} className="sr-only" />
            <span className="flex min-h-12 items-center justify-center px-1 text-meta font-medium">{layoutNames[layout]}</span>
            {value === layout ? <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded border bg-background text-action-text"><Check aria-hidden className="size-3.5" /></span> : null}
            {recommended === layout ? <span className="px-2 pb-2 text-label text-fg-secondary">Recommended</span> : null}
          </label>
        </div>)}
      </div>
      <p className="mt-3 text-meta text-fg-secondary">{descriptions[value]}</p>
    </fieldset>
  </section>;
}

export function ModeToggle({ value, disabled = false, onChange }: { value: ColorMode; disabled?: boolean; onChange: (value: ColorMode) => void }) {
  return <section aria-labelledby="mode-title" className="border-t p-4 sm:p-6">
    <h2 id="mode-title" className="text-section">Colours</h2>
    <p id="mode-help" className="mt-1 text-meta text-fg-secondary">Choose a light or dark background for your profile.</p>
    <fieldset disabled={disabled} aria-describedby="mode-help" className="mt-4 min-w-0">
      <legend className="sr-only">Colour mode</legend>
      <div className="grid grid-cols-2 gap-2">
        {COLOR_MODES.map(mode => { const Icon = mode === "light" ? Sun : Moon; return <label key={mode} className={`${choice} flex min-h-11 items-center gap-2.5 px-3 py-3 ${value === mode ? selected : "border-border hover:bg-canvas"} ${disabled ? "cursor-default opacity-60" : ""}`}>
          <input type="radio" name="colorMode" aria-label={mode === "light" ? "Light" : "Dark"} value={mode} checked={value === mode} onChange={() => onChange(mode)} className="sr-only" />
          <Icon aria-hidden className="size-4 shrink-0" /><span className="flex-1 text-body font-medium">{mode === "light" ? "Light" : "Dark"}</span>{value === mode ? <Check aria-hidden className="size-4 text-action-text" /> : null}
        </label>; })}
      </div>
    </fieldset>
  </section>;
}

export function AccentPicker({ value, disabled, onChange }: { value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return <section aria-labelledby="accent-title" className="border-t p-4 sm:p-6">
    <h2 id="accent-title" className="text-section">Accent color</h2>
    <p id="accent-help" className="mt-1 text-meta text-fg-secondary">Choose the highlight color used for buttons and links.</p>
    <fieldset disabled={disabled} aria-describedby="accent-help" className="mt-4 min-w-0">
      <legend className="sr-only">Choose an accent color</legend>
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:grid-cols-8">
        {ACCENTS.map(option => <label key={option.hex} className={`${choice} flex min-h-11 min-w-0 flex-col items-center gap-2 px-0.5 py-3 ${value === option.hex ? "" : idle} ${disabled ? "cursor-default opacity-60" : ""}`} style={{ outlineColor: option.hex, borderColor: value === option.hex ? option.hex : undefined, backgroundColor: value === option.hex ? `${option.hex}0A` : undefined }}>
          <input type="radio" name="accentColor" aria-label={option.name} value={option.hex} checked={value === option.hex} onChange={() => onChange(option.hex)} className="sr-only" />
          <span aria-hidden className="relative flex size-8 items-center justify-center rounded-full" style={{ backgroundColor: option.hex }}>
            {value === option.hex ? <span className="absolute -right-1 -bottom-0.5 flex size-4 items-center justify-center rounded-full border bg-background" style={{ color: option.hex, borderColor: option.hex }}><Check className="size-3" /></span> : null}
          </span>
          <span className="text-label">{option.name}</span>
        </label>)}
      </div>
    </fieldset>
  </section>;
}
