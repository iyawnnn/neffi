"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import { Check, ChevronDown, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { inputClass } from "@/components/ui/input";
import { loadPhilippineLocalities, localityLabel, locationOptions, type PhilippineLocality } from "@/lib/philippine-localities";

const subscribeViewport = (listener: () => void) => {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", listener);
  viewport?.addEventListener("scroll", listener);
  return () => { viewport?.removeEventListener("resize", listener); viewport?.removeEventListener("scroll", listener); };
};
const getViewport = () => window.visualViewport ? `${window.visualViewport.offsetTop}:${window.visualViewport.height}` : "";
const serverViewport = () => "";

export function LocationFeedback({ status, empty }: { status: "idle" | "loading" | "ready" | "error"; empty: boolean }) {
  if (status === "loading") return <p role="status" className="flex items-center justify-center gap-2 px-3 py-4 text-body text-fg-secondary"><LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />Loading locations…</p>;
  if (status === "error") return <p role="status" className="px-3 py-4 text-center text-body text-fg-secondary">Locations are unavailable right now.</p>;
  if (status === "ready" && empty) return <div role="status" className="flex min-h-40 flex-col items-center justify-center px-4 py-6 text-center"><Search aria-hidden className="mb-3 size-5 text-fg-secondary" /><p className="text-body font-medium">No locations found</p><p className="mt-1 text-meta text-fg-secondary">Try a different city or municipality.</p></div>;
  return null;
}

export function LocationResult({ location, selected }: { location: PhilippineLocality; selected: boolean }) {
  return <><span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-body font-medium">{location.name}</span><span className="truncate text-meta text-fg-secondary">{location.province}</span></span>{selected ? <Check aria-hidden className="size-4 shrink-0" /> : <span aria-hidden className="size-4 shrink-0" />}</>;
}

const clearClass = "absolute top-0 right-0 flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-fg-secondary transition-colors interact duration-[220ms] hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:outline-brand motion-reduce:transition-none";

export function LocationCombobox({ value, onChange, error, disabled }: { value: string; onChange: (value: string) => void; error?: string; disabled: boolean }) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const labelId = `${inputId}-label`;
  const viewport = useSyncExternalStore(subscribeViewport, getViewport, serverViewport);
  const [locations, setLocations] = useState<PhilippineLocality[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const loading = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  async function load() {
    if (loading.current || status === "ready") return;
    loading.current = true;
    setStatus("loading");
    try { setLocations(await loadPhilippineLocalities()); setStatus("ready"); }
    catch (cause) {
      if (process.env.NODE_ENV !== "production") console.error("Neffi locality snapshot is missing or invalid. Run the PSGC import described in docs/architecture/philippine-localities.md.", cause);
      setStatus("error");
    }
    finally { loading.current = false; }
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      if (status === "idle") void load();
    }
  }

  const options = locationOptions(locations, query);
  if (!query.trim() && value && locations.some(location => localityLabel(location) === value) && !options.includes(value)) options.unshift(value);
  const byLabel = new Map(locations.map(location => [localityLabel(location), location]));
  const label = <label id={labelId} htmlFor={inputId} className="flex items-baseline justify-between gap-3 text-body font-medium">City / municipality<span className="text-meta font-normal text-fg-secondary">Optional</span></label>;
  const fieldError = error ? <p id={errorId} role="alert" className="text-meta text-destructive">{error}</p> : null;
  const [viewportTop, viewportHeight] = viewport.split(":");
  return <div className="flex flex-col gap-1.5">
      <Dialog.Root open={open} onOpenChange={changeOpen}>
        {label}
        <div className="relative">
          <Dialog.Trigger id={inputId} ref={triggerRef} disabled={disabled} aria-labelledby={`${labelId} ${inputId}-value`} aria-invalid={!!error || undefined} aria-describedby={error ? errorId : undefined}
            className={`${inputClass} flex cursor-pointer items-center gap-2 rounded-[10px] pr-11 text-left transition-colors interact duration-[220ms] hover:border-border-strong active:bg-canvas disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none`}>
            {value ? <MapPin aria-hidden className="size-4 shrink-0 text-fg-secondary" /> : <Search aria-hidden className="size-4 shrink-0 text-fg-secondary" />}
            <span id={`${inputId}-value`} className={`min-w-0 flex-1 truncate ${value ? "" : "text-fg-secondary"}`}>{value || "Search city or municipality..."}</span>
            {!value ? <ChevronDown aria-hidden className="absolute right-3 size-4 text-fg-secondary" /> : null}
          </Dialog.Trigger>
          {value ? <button type="button" disabled={disabled} aria-label="Clear location" className={clearClass} onClick={() => { onChange(""); triggerRef.current?.focus(); }}><X aria-hidden className="size-4" /></button> : null}
        </div>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 transition-opacity interact duration-[220ms] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none" />
          <Dialog.Viewport className="fixed inset-x-0 top-0 z-50 flex h-dvh items-center justify-center p-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]" style={viewport ? { top: `${viewportTop}px`, height: `${viewportHeight}px` } : undefined}>
            <Dialog.Popup initialFocus={inputRef} finalFocus={triggerRef} aria-modal="true" className="app-type flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-panel border bg-background text-foreground shadow-sm transition-opacity interact duration-[220ms] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none">
              <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3">
                <Dialog.Title className="text-section">Select city / municipality</Dialog.Title>
                <Dialog.Close aria-label="Close location selector" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:outline-brand"><X aria-hidden className="size-4" /></Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">Search and select a Philippine city or municipality.</Dialog.Description>
              <Combobox.Root inline open={open} onOpenChange={changeOpen} items={options} filteredItems={options} value={value || null} inputValue={query} disabled={disabled} autoHighlight onInputValueChange={setQuery} onValueChange={next => { if (next !== null) { onChange(next); setOpen(false); } }}>
                <div className="relative mx-4 mt-2 mb-3 shrink-0">
                  <Search aria-hidden className="pointer-events-none absolute top-3.5 left-3 size-4 text-fg-secondary" />
                  <Combobox.Input ref={inputRef} aria-label="Search city or municipality" className={`${inputClass} rounded-[10px] pr-11 pl-9`} maxLength={80} placeholder="Search city or municipality..." autoCapitalize="none" autoCorrect="off" />
                  {query ? <button type="button" aria-label="Clear search" className={clearClass} onClick={() => { setQuery(""); inputRef.current?.focus(); }}><X aria-hidden className="size-4" /></button> : null}
                </div>
                <div className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-2 [scrollbar-width:thin] sm:max-h-[364px] max-sm:max-h-[min(28rem,calc(100dvh_-_10rem))]">
                  <LocationFeedback status={status} empty={!options.length} />
                  <Combobox.List>
                    {(item: string) => {
                      const location = byLabel.get(item);
                      return location ? <Combobox.Item key={item} value={item} className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-foreground outline-none transition-colors interact duration-[220ms] data-[highlighted]:bg-canvas data-[selected]:bg-subtle active:bg-subtle motion-reduce:transition-none"><LocationResult location={location} selected={item === value} /></Combobox.Item> : null;
                    }}
                  </Combobox.List>
                </div>
              </Combobox.Root>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
      {fieldError}
    </div>;
}
