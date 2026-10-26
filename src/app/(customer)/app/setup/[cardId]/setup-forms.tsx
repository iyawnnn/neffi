"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { SceneView } from "@/modules/profiles/scene-view";
import type { Goal } from "@/modules/profiles/goals";
import { ImageUpload, type ImageUploadActions } from "../../profiles/[profileId]/image-upload";
import { LocationCombobox } from "../../profiles/[profileId]/identity/location-combobox";
import { basicFields, detailValues, fieldMessages, mobileNumber, phoneInput, type DetailsProfile, type DetailKey } from "../../profiles/[profileId]/identity/identity-values";
import type { SetupState } from "./actions";
import { SetupForm } from "./setup-form";
import { SetupPreviewDialog } from "./setup-preview";
import { SetupView } from "./setup-view";
import { setupDraft, type SetupImageUrls } from "./setup-draft";

type SetupProfile = DetailsProfile & { imageIsLogo: boolean; imageAssetId: string | null };
export type SetupEditorProps = {
  step: "you" | "photo" | "contact"; cardId: string; suffix: string; goal: Goal | null;
  profile: SetupProfile | null; view: SceneView | null; imageUrls: SetupImageUrls; signInEmail: string;
  contact?: { saveContact: boolean } | null; imageActions?: ImageUploadActions;
  action: (previous: SetupState | undefined, data: FormData) => Promise<SetupState>;
};

export function SetupEditor({ step, cardId, suffix, goal, profile, view, imageUrls, signInEmail, contact = null, imageActions, action }: SetupEditorProps) {
  const initial = detailValues(profile ?? { fullName: null, headline: null, company: null, location: null, bio: null, phone: null, email: null, website: null });
  if (step === "contact" && !contact && !initial.email) initial.email = signInEmail;
  const [values, setValues] = useState(initial);
  const [logo, setLogo] = useState(profile?.imageIsLogo ?? false);
  const [saveContact, setSaveContact] = useState(contact?.saveContact ?? true);
  const [state, submit, pending] = useActionState(action, undefined);
  const [cleared, setCleared] = useState<Partial<Record<DetailKey, SetupState>>>({});
  const errors = Object.fromEntries((state?.fields ?? []).map(key => [key, cleared[key as DetailKey] === state ? undefined : state?.messages?.[key as DetailKey] ?? fieldMessages[key as DetailKey]])) as Partial<Record<DetailKey, string>>;
  const [mediaBusy, setMediaBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fields = useRef<HTMLFieldSetElement>(null);
  const [baseline] = useState({ values: initial, logo: profile?.imageIsLogo ?? false, saveContact: contact?.saveContact ?? true });
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline.values) || logo !== baseline.logo || saveContact !== baseline.saveContact;
  useEffect(() => {
    if (!state?.error) return;
    const field = fields.current?.querySelector<HTMLElement>(`[name="${state.fields?.[0]}"]:not([type="hidden"])`);
    field?.focus(); field?.scrollIntoView?.({ block: "nearest" });
  }, [state]);
  const preview = setupDraft(view, step === "you" ? { fullName: values.fullName, headline: values.headline, company: values.company, location: values.location, bio: values.bio } : step === "contact" ? { phone: values.phone, email: values.email, website: values.website, ...(contact && !view?.blocks.some(block => block.type === "contact") ? {} : { saveContact }) } : { imageIsLogo: logo }, goal, imageUrls);
  const busy = pending || mediaBusy;
  const legacyPhone = !!values.phone && mobileNumber(values.phone) === null && values.phone === phoneInput(profile?.phone ?? null);
  function change(key: DetailKey, value: string) { setValues(previous => ({ ...previous, [key]: value })); }
  function blur(key: DetailKey) {
    if (!errors[key]) return;
    const value = values[key].trim();
    const valid = key === "fullName" ? !!value && value.length <= 80 : key === "bio" ? value.length <= 300 : key === "phone" ? mobileNumber(value) !== null : key === "email" ? !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : key === "website" ? !value || !!setupDraft(null, { website: value }).identity.website : value.length <= 80;
    if (valid) setCleared(previous => ({ ...previous, [key]: state }));
  }
  function error(key: DetailKey) { return errors[key] ? <p id={`setup-error-${key}`} role="alert" className="text-meta text-destructive">{errors[key]}</p> : null; }
  const formField = (key: "fullName" | "headline" | "company" | "bio") => {
    const field = basicFields.find(field => field.key === key)!;
    const shared = { id: `setup-${key}`, name: key, value: values[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(key, event.target.value), onBlur: () => blur(key), maxLength: field.max, placeholder: field.placeholder, "aria-invalid": !!errors[key] || undefined, "aria-describedby": errors[key] ? `setup-error-${key}` : undefined };
    return <div key={key} className="flex flex-col gap-1.5">
      <label htmlFor={`setup-${key}`} className="text-body font-medium">{field.label}{key !== "fullName" && <span className="font-normal text-fg-secondary"> (optional)</span>}</label>
      {key === "bio" ? <Textarea {...shared} className="min-h-28" /> : <Input {...shared} required={key === "fullName"} autoComplete={field.autoComplete} />}
      {error(key)}{key === "bio" && <span className="self-end text-label tabular-nums text-fg-secondary">{values.bio.length} / 300</span>}
    </div>;
  };
  const showPreview = <Button type="button" size="touch" variant="outline" className="h-11 gap-2" onClick={() => setPreviewOpen(true)}><Eye aria-hidden className="size-4" />Preview</Button>;
  return <>
    <SetupView suffix={suffix} step={step} backHref={`?step=${step === "you" ? `goal&goal=${goal ?? ""}` : step === "photo" ? "you" : "photo"}`} preview={showPreview} desktopPreview={<div inert aria-hidden="true"><ProfileRenderer view={preview} /></div>}>
      <SetupForm action={submit} changed={dirty} noValidate className="flex flex-col gap-6">
        <input type="hidden" name="cardId" value={cardId} /><input type="hidden" name="goal" value={goal ?? ""} />
        <fieldset ref={fields} disabled={busy} className="flex min-w-0 flex-col gap-5 [&_input]:scroll-mb-20 [&_textarea]:scroll-mb-20">
          {step === "you" && <>
            <p className="text-body text-fg-secondary">Tell people who you are. Only your full name is required.</p>
            {formField("fullName")}{formField("headline")}{formField("company")}
            <input type="hidden" name="location" value={values.location} />
            <LocationCombobox label="City / municipality (optional)" value={values.location} onChange={value => change("location", value)} error={errors.location} disabled={busy} />
            {formField("bio")}
          </>}
          {step === "photo" && profile && <>
            <p className="text-body text-fg-secondary">Optional. A clear photo of your face, or your logo. JPG, PNG, WebP or HEIC, up to 5 MB.</p>
            <ImageUpload actions={imageActions} profileId={profile.id} fullName={profile.fullName} hasImage={!!profile.imageAssetId} image={logo ? imageUrls?.logo ?? null : imageUrls?.photo ?? null} logo={logo} disabled={pending} onBusyChange={setMediaBusy} />
            <input type="hidden" name="imageIsLogo" value={String(logo)} />
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-body font-medium">This is a logo<input type="checkbox" checked={logo} onChange={event => setLogo(event.target.checked)} className="size-5 accent-brand" /></label>
            <p className="text-meta text-fg-secondary">Photos are cropped to fit. Logos stay whole. Uploads save immediately; Continue saves your display choice.</p>
          </>}
          {step === "contact" && <>
            <p className="text-body text-fg-secondary">Add at least one way for people to reach you.</p>
            <div className="flex flex-col gap-1.5"><label htmlFor="setup-phone" className="text-body font-medium">Mobile number (optional)</label>
              <div className="flex items-center overflow-hidden rounded-[10px] border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">{!legacyPhone && <span aria-hidden className="border-r px-3 text-body text-fg-secondary">+63</span>}<Input id="setup-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" aria-label={legacyPhone ? "Mobile number (optional)" : "Mobile number (optional), +63"} value={values.phone} onChange={event => change("phone", event.target.value)} onBlur={() => blur("phone")} maxLength={30} placeholder="912 345 6789" aria-invalid={!!errors.phone || undefined} aria-describedby={errors.phone ? "setup-error-phone" : undefined} className="min-w-0 rounded-none border-0 focus-visible:ring-0" /></div>{error("phone")}
            </div>
            <div className="flex flex-col gap-1.5"><label htmlFor="setup-email" className="text-body font-medium">Public email (optional)</label><Input id="setup-email" name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={event => change("email", event.target.value)} onBlur={() => blur("email")} maxLength={254} placeholder="you@example.com" aria-invalid={!!errors.email || undefined} aria-describedby={`setup-email-help${errors.email ? " setup-error-email" : ""}`} /><p id="setup-email-help" className="text-meta text-fg-secondary">Shown on your profile. Clear it to keep your sign-in email private.</p>{error("email")}</div>
            <div className="flex flex-col gap-1.5"><label htmlFor="setup-website" className="text-body font-medium">Website (optional)</label><Input id="setup-website" name="website" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} value={values.website} onChange={event => change("website", event.target.value)} onBlur={() => blur("website")} maxLength={2048} placeholder="yourwebsite.com" aria-invalid={!!errors.website || undefined} aria-describedby={errors.website ? "setup-error-website" : undefined} />{error("website")}</div>
            <input type="hidden" name="saveContact" value={String(saveContact)} />
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-body font-medium">Save Contact<input type="checkbox" role="switch" aria-checked={saveContact} checked={saveContact} onChange={event => setSaveContact(event.target.checked)} className="size-5 accent-brand" /></label><p className="-mt-3 text-meta text-fg-secondary">Visitors can save your details to their phone.</p>
          </>}
        </fieldset>
        {state?.error && <p role="alert" className="text-body text-destructive">{state.error}</p>}
        <div className="flex flex-col gap-3"><Button type="submit" variant="action" size="touch" className="h-12 w-full" disabled={busy} loading={pending} loadingText="Saving…">Continue</Button>{step === "photo" && <Link href="?step=contact" className="inline-flex min-h-11 items-center justify-center rounded-lg text-body text-fg-secondary focus-visible:outline-2 focus-visible:outline-brand">Skip for now</Link>}</div>
      </SetupForm>
    </SetupView>
    <SetupPreviewDialog view={preview} open={previewOpen} onOpenChange={setPreviewOpen} />
  </>;
}
