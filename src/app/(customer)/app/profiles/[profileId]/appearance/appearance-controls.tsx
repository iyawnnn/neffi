import { Check } from "lucide-react";
import { ProfileGlyph } from "@/components/app-ui";
import { ACCENTS } from "@/modules/profiles/appearance-options";

const choice = "relative cursor-pointer rounded-[10px] border transition-colors duration-[220ms] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand motion-reduce:transition-none";
const selected = "border-brand/60 bg-brand/5";
const idle = "border-transparent hover:border-border hover:bg-canvas";

export function AppearanceImage({ image, logo }: { image: string | null; logo: boolean }) {
  return image ? <img src={image} alt="Profile image" width={88} height={88} className={`size-20 shrink-0 bg-canvas sm:size-[88px] ${logo ? "rounded-lg object-contain p-1" : "rounded-full object-cover"}`} /> : <ProfileGlyph className="size-20 sm:size-[88px] [&_svg]:size-7" />;
}

export function ImagePresentationPicker({ logo, hasImage, disabled, onChange }: { logo: boolean; hasImage: boolean; disabled: boolean; onChange: (logo: boolean) => void }) {
  return <section aria-labelledby="presentation-title" className="border-t p-4 sm:p-6">
    <h2 id="presentation-title" className="text-section">Display as</h2>
    <p id="presentation-help" className="mt-1 text-meta text-fg-secondary">{hasImage ? "Choose how the same uploaded image is displayed." : "Available after you upload an image."}</p>
    <fieldset disabled={disabled || !hasImage} aria-describedby="presentation-help" className={`mt-4 min-w-0 ${!hasImage ? "opacity-60" : ""}`}>
      <legend className="sr-only">Image display</legend>
      <div className="grid grid-cols-2 gap-2.5">
        {[{ logo: false, label: "Photo", detail: "Circular crop" }, { logo: true, label: "Logo", detail: "Keep the full image, no crop" }].map(option => <label key={option.label} className={`${choice} flex min-h-11 items-start gap-2 p-3 ${logo === option.logo ? selected : "border-border hover:bg-canvas"} ${disabled || !hasImage ? "cursor-default" : ""}`}>
          <input type="radio" name="imagePresentation" aria-label={option.label} value={String(option.logo)} checked={logo === option.logo} onChange={() => onChange(option.logo)} className="sr-only" />
          <span className="min-w-0 flex-1"><span className="block text-body font-medium">{option.label}</span><span className="mt-1 block text-label text-fg-secondary">{option.detail}</span></span>
          {logo === option.logo ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-action-text" /> : null}
        </label>)}
      </div>
    </fieldset>
  </section>;
}

export function AccentPicker({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
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
