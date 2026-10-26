"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldLabel, Input } from "../../../ui";
import { revealActivationCodeAction, saveExistingActivationCodeAction } from "../../actions";

// The code exists only in this component's memory: it is fetched on an explicit click through the authorized reveal
// action, never written to storage or the URL, and cleared on Hide, when the tab is hidden and when the page unmounts.
export function ActivationCode({ cardId, credentialId, retrievable }: { cardId: string; credentialId: string; retrievable: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  // Bumped whenever the code is cleared, so a reveal that finishes afterwards is discarded.
  const epoch = useRef(0);

  useEffect(() => {
    const clear = () => { if (document.visibilityState === "hidden") { epoch.current += 1; setCode(null); setMessage(""); } };
    document.addEventListener("visibilitychange", clear);
    return () => document.removeEventListener("visibilitychange", clear);
  }, []);

  if (!retrievable) return <ExistingCode cardId={cardId} credentialId={credentialId} />;

  function show() {
    setError("");
    const requested = epoch.current;
    start(async () => {
      const data = new FormData();
      data.set("cardId", cardId);
      data.set("credentialId", credentialId);
      const result = await revealActivationCodeAction(undefined, data);
      if (requested !== epoch.current || document.visibilityState === "hidden") return;
      if (result.reveal) setCode(result.reveal.code);
      else setError(result.error ?? "The activation code could not be shown. Reload the card and try again.");
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code ?? "");
      setMessage("Activation code copied.");
    } catch {
      setMessage("Could not copy. Select the code and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-body font-medium">Activation code</h3>
      <p className="text-meta text-fg-secondary">Needed to print the package label. Shown only when you ask, and only while this page is open.</p>
      {code ? (
        <>
          <p className="break-all rounded-lg border bg-canvas px-4 py-3 font-mono text-[1.375rem] leading-8 font-semibold tracking-wider select-all">{code}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="action" size="touch" className="md:h-9" onClick={copy}>Copy activation code</Button>
            <Button type="button" variant="outline" size="touch" className="gap-2 md:h-9" onClick={() => { epoch.current += 1; setCode(null); setMessage(""); }}><EyeOff aria-hidden className="size-4" />Hide</Button>
          </div>
        </>
      ) : (
        <Button type="button" variant="outline" size="touch" className="gap-2 self-start md:h-9" onClick={show} disabled={pending}><Eye aria-hidden className="size-4" />{pending ? "Working…" : "Show activation code"}</Button>
      )}
      <p role="status" className="text-meta text-fg-secondary">{message}</p>
      {error ? <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-meta text-destructive"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{error}</p> : null}
    </div>
  );
}

// An older credential has only its HMAC, so the code cannot be shown. The owner may save the code from the real
// package, which is checked against the stored HMAC; nothing is replaced silently.
function ExistingCode({ cardId, credentialId }: { cardId: string; credentialId: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    start(async () => {
      const data = new FormData();
      data.set("cardId", cardId);
      data.set("credentialId", credentialId);
      data.set("code", value);
      const result = await saveExistingActivationCodeAction(undefined, data);
      if (result.error) setError(result.error);
      else { setDone(true); setValue(""); }
    });
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <h3 className="text-body font-medium">Activation code</h3>
      <p className="text-meta text-fg-secondary">This is an older credential, so its code cannot be shown. If you have the code from the package, save it here to enable Show activation code. It is checked against this card.</p>
      {done ? <p role="status" className="text-meta">Saved. Reload the card to show the code.</p> : (
        <>
          <label className={fieldLabel}>Code from the package<Input name="code" required autoComplete="off" spellCheck={false} autoCapitalize="off" className="font-mono" value={value} onChange={(e) => setValue(e.target.value)} /></label>
          <Button type="submit" variant="outline" size="touch" className="self-start md:h-9" disabled={pending}>{pending ? "Working…" : "Save existing code"}</Button>
        </>
      )}
      {error ? <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-meta text-destructive"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{error}</p> : null}
    </form>
  );
}
