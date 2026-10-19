"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import { Ellipsis, MailOpen, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { updateInboxAction } from "../actions";

export function MessageActions(props: { submissionId: string; sender: string; unread: number }) {
  return <Toast.Provider limit={1}><Actions {...props} /><Notifications /></Toast.Provider>;
}

function Notifications() {
  const { toasts } = Toast.useToastManager();
  return <Toast.Portal><Toast.Viewport className="app-type fixed top-[calc(env(safe-area-inset-top)_+_5.5rem)] right-4 z-[60] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-2">
    {toasts.map(toast => <Toast.Root key={toast.id} toast={toast} className="flex items-center justify-between gap-3 rounded-panel border bg-background p-4 text-foreground shadow-sm"><Toast.Title className="text-body font-medium" /><Toast.Close aria-label="Dismiss notification" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"><X aria-hidden className="size-4" /></Toast.Close></Toast.Root>)}
  </Toast.Viewport></Toast.Portal>;
}

function Actions({ submissionId, sender, unread }: { submissionId: string; sender: string; unread: number }) {
  const router = useRouter();
  const toast = Toast.useToastManager();
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const leaving = useRef(false);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { window.dispatchEvent(new CustomEvent("neffi:inbox-unread", { detail: unread })); }, [unread]);

  async function update(operation: "unread" | "delete") {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    const data = new FormData(); data.set("submissionId", submissionId); data.set("operation", operation);
    try {
      const result = await updateInboxAction(data);
      if (!result) return;
      if ("error" in result) {
        if (operation === "delete") setError(result.error);
        else toast.add({ title: result.error, priority: "high" });
      } else {
        window.dispatchEvent(new CustomEvent("neffi:inbox-unread", { detail: result.unread }));
        if (operation === "delete") { leaving.current = true; router.replace("/app/inbox"); }
        else toast.add({ title: "Marked as unread" });
      }
    } catch {
      const message = "Couldn’t update message. Try again.";
      if (operation === "delete") setError(message);
      else toast.add({ title: message, priority: "high" });
    } finally { if (!leaving.current) { busy.current = false; setPending(false); } }
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button ref={trigger} type="button" size="touch" variant="outline" disabled={pending} aria-label={`Message actions for ${sender}`} className="size-11 rounded-[10px] px-0" />}><Ellipsis aria-hidden className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem disabled={pending} className="min-h-11 cursor-pointer gap-2 px-3" onClick={() => void update("unread")}><MailOpen aria-hidden className="size-4" strokeWidth={1.75} />Mark as unread</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} variant="destructive" className="min-h-11 cursor-pointer gap-2 px-3" onClick={() => { setError(""); setConfirm(true); }}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />Delete message</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog.Root open={confirm} onOpenChange={open => { if (!busy.current) setConfirm(open); }}>
      <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup initialFocus={cancel} finalFocus={trigger} className="app-type fixed top-1/2 left-1/2 z-50 w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-panel border bg-background p-5 text-foreground shadow-sm">
          <Dialog.Title className="text-section">Delete message?</Dialog.Title>
          <Dialog.Description className="mt-2 text-body text-fg-secondary">This message will be permanently deleted.</Dialog.Description>
          {error ? <p role="alert" className="mt-3 text-meta text-destructive">{error}</p> : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Dialog.Close render={<Button ref={cancel} type="button" size="touch" variant="outline" disabled={pending} />}>Cancel</Dialog.Close>
            <Button type="button" size="touch" variant="destructive" disabled={pending} onClick={() => void update("delete")}>{pending ? "Deleting…" : "Delete message"}</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
