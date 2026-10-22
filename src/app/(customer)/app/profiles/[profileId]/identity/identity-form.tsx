"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { updateIdentityAction } from "../actions";
import { ImageUpload } from "../image-upload";
import { ImagePresentationPicker } from "../appearance/appearance-controls";
import { basicFields, detailKeys, detailsDirty, fieldMessages, identityPhone, mobileNumber, phoneInput, type DetailKey, type DetailsProfile } from "./identity-values";
import { LocationCombobox } from "./location-combobox";
import { guardHistoryNavigation, type BrowserNavigation, type HistoryNavigation } from "./unsaved-navigation";
import { DETAILS_TOASTS, detailsReducer, initialDetailsState } from "./details-state";
import { EditorFooter } from "./editor-footer";

const motion = "rounded-[10px] interact duration-[220ms] motion-reduce:transform-none motion-reduce:transition-none";


function DetailsToasts() {
  const { toasts } = Toast.useToastManager();
  return <Toast.Portal><Toast.Viewport className="app-type fixed top-[calc(env(safe-area-inset-top)_+_5.5rem)] right-4 z-[60] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-2">
    {toasts.map(toast => <Toast.Root key={toast.id} toast={toast} className="flex items-center justify-between gap-3 rounded-panel border bg-background p-4 text-foreground shadow-md transition-opacity interact duration-[220ms] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none"><div><Toast.Title className="text-body font-medium" /><Toast.Description className="mt-1 text-meta text-fg-secondary" /></div><Toast.Close aria-label="Dismiss notification" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"><X aria-hidden className="size-4" /></Toast.Close></Toast.Root>)}
  </Toast.Viewport></Toast.Portal>;
}

type IdentityImage = { hasImage: boolean; photoUrl: string | null; logoUrl: string | null; imageIsLogo: boolean };

export function IdentityForm({ profile, image }: { profile: DetailsProfile; image?: IdentityImage }) {
  return <Toast.Provider limit={1}><IdentityEditor profile={profile} image={image} /><DetailsToasts /></Toast.Provider>;
}

function IdentityEditor({ profile, image }: { profile: DetailsProfile; image?: IdentityImage }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const [{ values, saved, savedPhone, errors, saving }, dispatch] = useReducer(detailsReducer, profile, initialDetailsState);
  const formRef = useRef<HTMLFormElement>(null);
  const focusErrors = useRef(false);
  const submitting = useRef(false);
  const discarding = useRef(false);
  const leaveHistoryKey = useRef<string | null>(null);
  const [leaveFor, setLeaveFor] = useState<string | null>(null);
  const [imageIsLogo, setImageIsLogo] = useState(image?.imageIsLogo ?? false);
  const [savedImageIsLogo, setSavedImageIsLogo] = useState(image?.imageIsLogo ?? false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const dirty = detailsDirty(values, saved) || imageIsLogo !== savedImageIsLogo;
  const base = `/app/profiles/${profile.id}`;
  const legacyPhone = !!values.phone && mobileNumber(values.phone) === null && values.phone === phoneInput(savedPhone);

  useEffect(() => {
    if (saving || !focusErrors.current) return;
    focusErrors.current = false;
    const first = detailKeys.find(key => errors[key]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [errors, saving]);

  function change(key: DetailKey, value: string) {
    discarding.current = false;
    dispatch({ type: "edit", key, value });
  }

  // Guard ordinary app links as well as the form's Cancel/back controls. Browser exits use the native prompt.
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!discarding.current) { event.preventDefault(); event.returnValue = ""; } };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.download || (anchor.target && anchor.target !== "_self")) return;
      const target = new URL(anchor.href, window.location.href);
      if (!["http:", "https:"].includes(target.protocol)) return;
      if (target.origin === window.location.origin && target.pathname === window.location.pathname && target.search === window.location.search) return;
      event.preventDefault(); event.stopPropagation();
      if (!submitting.current) { leaveHistoryKey.current = null; setLeaveFor(target.href); }
    };
    const navigation = (window as Window & { navigation?: BrowserNavigation }).navigation;
    const traverse = (event: Event) => guardHistoryNavigation(event as HistoryNavigation, discarding.current, submitting.current, (url, key) => { leaveHistoryKey.current = key; setLeaveFor(url); });
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    navigation?.addEventListener("navigate", traverse);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); navigation?.removeEventListener("navigate", traverse); };
  }, [dirty]);

  function navigate(href: string) {
    const target = new URL(href, window.location.href);
    if (target.origin === window.location.origin) router.push(`${target.pathname}${target.search}${target.hash}`);
    else window.location.assign(target.href);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || mediaBusy || !dirty) return;
    focusErrors.current = true;
    const phone = identityPhone(values.phone, savedPhone);
    dispatch({ type: "errors", errors: {} });
    if (phone === null) {
      dispatch({ type: "errors", errors: { phone: fieldMessages.phone } });
      return;
    }
    submitting.current = true; dispatch({ type: "saving" });
    const data = new FormData();
    data.set("profileId", profile.id);
    for (const key of detailKeys) data.set(key, key === "phone" ? phone : values[key]);
    if (image) data.set("imageIsLogo", String(imageIsLogo));
    try {
      const result = await updateIdentityAction(undefined, data);
      if (result.ok && result.identity) {
        dispatch({ type: "saved", identity: result.identity });
        setSavedImageIsLogo(imageIsLogo);
        toast.add(DETAILS_TOASTS.success);
        router.refresh();
      } else if (result.fields?.length) {
        dispatch({ type: "errors", errors: Object.fromEntries(result.fields.filter((key): key is DetailKey => detailKeys.includes(key as DetailKey)).map(key => [key, fieldMessages[key]])) });
      } else toast.add(DETAILS_TOASTS.failure);
    } catch { toast.add(DETAILS_TOASTS.failure); }
    finally { submitting.current = false; dispatch({ type: "settled" }); }
  }

  function fieldLabel(key: DetailKey, label: string) {
    return <label htmlFor={`details-${key}`} className="flex items-baseline justify-between gap-3 text-body font-medium">{label}{key !== "fullName" ? <span className="text-meta font-normal text-fg-secondary">Optional</span> : null}</label>;
  }
  function fieldError(key: DetailKey) {
    return errors[key] ? <p id={`error-${key}`} role="alert" className="text-meta text-destructive">{errors[key]}</p> : null;
  }

  return <>
    <form ref={formRef} onSubmit={submit} noValidate className="rounded-panel border bg-background">
      <fieldset disabled={saving || mediaBusy} className="min-w-0 [&_input]:scroll-mb-56 [&_textarea]:scroll-mb-56 sm:[&_input]:scroll-mb-6 sm:[&_textarea]:scroll-mb-6">
        {image ? <section aria-labelledby="profile-image" className="p-5 sm:p-6">
          <h2 id="profile-image" className="text-lg leading-6 font-semibold">Profile image</h2>
          <p className="mt-1 text-body text-fg-secondary">Use a photo or logo visitors will recognize.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
            <ImageUpload profileId={profile.id} fullName={profile.fullName} hasImage={image.hasImage} image={imageIsLogo ? image.logoUrl : image.photoUrl} logo={imageIsLogo} disabled={saving || mediaBusy} onBusyChange={setMediaBusy} />
            <ImagePresentationPicker logo={imageIsLogo} hasImage={image.hasImage} disabled={saving || mediaBusy} onChange={setImageIsLogo} />
          </div>
        </section> : null}
        <section aria-labelledby="basic-information" className={image ? "border-t p-5 sm:p-6" : "p-5 sm:p-6"}>
          <h2 id="basic-information" className="text-lg leading-6 font-semibold">Basic information</h2>
          <p className="mt-1 text-body text-fg-secondary">Tell visitors who you are and what you do. Full name is required.</p>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {basicFields.map(field => <div key={field.key} className={`flex min-w-0 flex-col gap-1.5 ${field.key === "headline" || field.key === "bio" ? "sm:col-span-2" : ""}`}>
              {fieldLabel(field.key, field.label)}
              {field.key === "bio" ? <Textarea id={`details-${field.key}`} name={field.key} value={values[field.key]} onChange={event => change(field.key, event.target.value)} maxLength={field.max} placeholder={field.placeholder} aria-invalid={!!errors[field.key] || undefined} aria-describedby={errors[field.key] ? `error-${field.key}` : undefined} className="min-h-28 rounded-[10px]" />
                : <Input id={`details-${field.key}`} name={field.key} value={values[field.key]} onChange={event => change(field.key, event.target.value)} maxLength={field.max} required={field.key === "fullName"} autoComplete={field.autoComplete} placeholder={field.placeholder} aria-invalid={!!errors[field.key] || undefined} aria-describedby={errors[field.key] ? `error-${field.key}` : undefined} className="rounded-[10px]" />}
              {fieldError(field.key)}
              {field.key === "bio" ? <span className="self-end text-label tabular-nums text-fg-faint">{values.bio.length} / {field.max}</span> : null}
            </div>)}
          </div>
        </section>
        <section aria-labelledby="contact-location" className="border-t p-5 sm:p-6">
          <h2 id="contact-location" className="text-lg leading-6 font-semibold">Contact &amp; location</h2>
          <p className="mt-1 text-body text-fg-secondary">Add only the contact information you want visitors to see.</p>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              {fieldLabel("phone", "Mobile number")}
              <div className="flex items-center overflow-hidden rounded-[10px] border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                {!legacyPhone ? <span aria-hidden className="border-r px-3 text-body text-fg-secondary">+63</span> : null}
                <Input id="details-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={values.phone} onChange={event => change("phone", event.target.value)} onBlur={() => {
                  const number = mobileNumber(values.phone);
                  if (number) change("phone", number.slice(3));
                  dispatch({ type: "errors", errors: { ...errors, phone: identityPhone(values.phone, savedPhone) === null ? fieldMessages.phone : undefined } });
                }} maxLength={30} placeholder="912 345 6789" aria-label={legacyPhone ? "Mobile number" : "Mobile number, +63"} aria-invalid={!!errors.phone || undefined} aria-describedby={errors.phone ? "error-phone" : undefined} className="min-w-0 rounded-none border-0 focus-visible:ring-0" />
              </div>
              {legacyPhone ? <p className="text-meta text-fg-secondary">Existing number preserved. Enter a Philippine mobile number to replace it.</p> : null}
              {fieldError("phone")}
            </div>
            <div className="flex flex-col gap-1.5">{fieldLabel("email", "Public email")}<Input id="details-email" name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={event => change("email", event.target.value)} maxLength={254} placeholder="name@example.com" aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? "error-email" : undefined} className="rounded-[10px]" />{fieldError("email")}</div>
            <div className="flex flex-col gap-1.5">{fieldLabel("website", "Website")}<Input id="details-website" name="website" type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} value={values.website} onChange={event => change("website", event.target.value)} maxLength={2048} placeholder="example.com" aria-invalid={!!errors.website || undefined} aria-describedby={errors.website ? "error-website" : undefined} className="rounded-[10px]" />{fieldError("website")}</div>
            <LocationCombobox key={saved.location} value={values.location} onChange={value => change("location", value)} error={errors.location} disabled={saving} />
          </div>
        </section>
      </fieldset>
      <EditorFooter dirty={dirty} saving={saving} onCancel={() => dirty ? setLeaveFor(base) : router.push(base)} />
    </form>
    <Dialog.Root open={leaveFor !== null} onOpenChange={open => { if (!open) { leaveHistoryKey.current = null; setLeaveFor(null); } }}>
      <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" /><Dialog.Popup className="app-type fixed top-1/2 left-1/2 z-50 w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-panel border bg-background p-6 text-foreground shadow-lg">
        <Dialog.Title className="text-lg font-semibold">Discard changes?</Dialog.Title>
        <Dialog.Description className="mt-2 text-body text-fg-secondary">Your changes haven’t been saved.</Dialog.Description>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end"><Dialog.Close render={<Button type="button" variant="outline" size="touch" className={motion} />}>Keep editing</Dialog.Close><Button type="button" variant="destructive" size="touch" className={motion} onClick={() => {
          if (!leaveFor) return;
          discarding.current = true;
          dispatch({ type: "discard" });
          setImageIsLogo(savedImageIsLogo);
          const navigation = (window as Window & { navigation?: BrowserNavigation }).navigation;
          if (leaveHistoryKey.current && navigation) navigation.traverseTo(leaveHistoryKey.current);
          else navigate(leaveFor);
          setLeaveFor(null);
        }}>Discard changes</Button></div>
      </Dialog.Popup></Dialog.Portal>
    </Dialog.Root>
  </>;
}
