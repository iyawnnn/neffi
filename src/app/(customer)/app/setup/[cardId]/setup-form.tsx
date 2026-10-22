"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ComponentProps, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { guardHistoryNavigation, type BrowserNavigation, type HistoryNavigation } from "../../profiles/[profileId]/identity/unsaved-navigation";

function SubmissionStatus({ submittingRef }: { submittingRef: RefObject<boolean> }) {
  const { pending } = useFormStatus();
  useEffect(() => { submittingRef.current = pending; }, [pending, submittingRef]);
  return null;
}

export function SetupForm({ children, changed, ...props }: ComponentProps<"form"> & { changed?: boolean }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const baseline = useRef<string | null>(null);
  const submitting = useRef(false);
  const discarding = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [leave, setLeave] = useState<{ url: string; key?: string } | null>(null);
  useEffect(() => { baseline.current = JSON.stringify([...new FormData(form.current!).entries()]); }, []);
  useEffect(() => {
    if (!(changed ?? dirty)) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!submitting.current && !discarding.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.download || (anchor.target && anchor.target !== "_self")) return;
      const target = new URL(anchor.href, window.location.href);
      if (!["http:", "https:"].includes(target.protocol) || target.href === window.location.href) return;
      event.preventDefault(); event.stopPropagation();
      if (!submitting.current) setLeave({ url: target.href });
    };
    const navigation = (window as Window & { navigation?: BrowserNavigation }).navigation;
    const traverse = (event: Event) => guardHistoryNavigation(event as HistoryNavigation, discarding.current, submitting.current, (url, key) => setLeave({ url, key }));
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    navigation?.addEventListener("navigate", traverse);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); navigation?.removeEventListener("navigate", traverse); };
  }, [changed, dirty]);
  return (
    <>
      <form {...props} ref={form} onInput={() => { submitting.current = false; discarding.current = false; setDirty(JSON.stringify([...new FormData(form.current!).entries()]) !== baseline.current); }} onSubmit={() => { submitting.current = true; }}>{children}<SubmissionStatus submittingRef={submitting} /></form>
      <Dialog.Root open={!!leave} onOpenChange={open => { if (!open) setLeave(null); }}>
        <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30" /><Dialog.Popup className="app-type fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-panel border bg-background p-6 text-foreground">
          <Dialog.Title className="text-xl font-semibold">Discard changes?</Dialog.Title>
          <Dialog.Description className="mt-2 text-body text-fg-secondary">Your changes on this step have not been saved.</Dialog.Description>
          <div className="mt-6 flex flex-col gap-2">
            <Button type="button" variant="outline" size="touch" className="h-11" onClick={() => setLeave(null)}>Keep editing</Button>
            <Button type="button" variant="danger" size="touch" className="h-11" onClick={() => {
              if (!leave) return;
              discarding.current = true;
              const navigation = (window as Window & { navigation?: BrowserNavigation }).navigation;
              if (leave.key && navigation) navigation.traverseTo(leave.key);
              else router.push(leave.url);
              setLeave(null);
            }}>Discard changes</Button>
          </div>
        </Dialog.Popup></Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
