"use client";

import { useActionState, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Ban, CircleAlert, CircleCheck, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmDialog, type Confirmation } from "../confirm-dialog";
import { checkLabel, controlClass, fieldLabel, Input, NextStep, Select, TextLink, Textarea } from "../ui";
import { CardUrl } from "./card-url";
import {
  matchPackageAction,
  provisionDbcAction,
  receiveStockAction,
  recordNfcCheckAction,
  reserveGrcAction,
  replaceCredentialAction,
  retireCardAction,
  updateStockPurchaseAction,
  type ActionState,
} from "./actions";

const field = controlClass;
const label = fieldLabel;
const check = checkLabel;

type Action = (previous: ActionState | undefined, data: FormData) => Promise<ActionState>;

// The revealed code lives only in this response's React state: it is never written to storage, the URL or the
// console, and it is gone on the next submission or reload.
function Reveal({ reveal }: { reveal: NonNullable<ActionState["reveal"]> }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(reveal.code);
      setMessage(reveal.instructions ? "Activation code copied." : "Activation code copied. Save it to the card's package now.");
    } catch {
      setMessage("Could not copy. Select the code and copy it manually.");
    }
  }

  return (
    <div role="status" className="flex flex-col gap-4 rounded-panel border border-action/50 bg-background p-4 sm:p-5 text-body">
      <h2 className="text-section">Activation code — shown once</h2>
      <p className="rounded-lg border bg-canvas px-4 py-3 font-mono text-[1.5rem] leading-8 font-semibold tracking-wider break-all select-all">{reveal.code}</p>
      <Button type="button" variant="action" size="touch" className="self-start md:h-9" onClick={copy}>Copy activation code</Button>
      <p role="status" className="text-meta text-fg-secondary">{message}</p>
      {reveal.url ? <p className="font-mono text-label text-fg-secondary break-all select-all">{reveal.url}</p> : null}
      <p className="text-meta text-fg-secondary">
        {reveal.instructions ?? "Save this code to the card's package now. It cannot be shown again. If it is lost before release, use Credential recovery."}
      </p>
    </div>
  );
}

// `primary` is the Vermilion main action of a screen; `default` is the quiet secondary; `destructive` is red.
type ActionFormProps = { action: Action; submit: string; variant?: "default" | "primary" | "destructive" | "outline"; children?: ReactNode; available?: boolean; provisioning?: boolean; confirm?: Confirmation; className?: string };
const buttonVariant = { default: "outline", outline: "outline", primary: "action", destructive: "destructive" } as const;

export function ActionForm(props: ActionFormProps) {
  const [visit, setVisit] = useState(0);
  // Next's Activity preserves hidden pages. Reset the response holder on navigation so codes cannot return with Back.
  useLayoutEffect(() => () => setVisit((value) => value + 1), []);
  return <ActionFormContent key={visit} {...props} />;
}

function ActionFormContent({ action, submit, variant = "default", children, available = true, provisioning = false, confirm, className }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // Holds the form while its confirmation is open, so confirming submits exactly the form that asked.
  const [asking, setAsking] = useState<HTMLFormElement | null>(null);
  const confirmedSubmit = useRef<HTMLButtonElement>(null);
  const accepted = useRef(false);
  if (!available && !state?.reveal) return null;

  const form = (
    <form action={formAction} onSubmit={confirm ? (event) => {
      if (accepted.current && (event.nativeEvent as SubmitEvent).submitter === confirmedSubmit.current) return;
      event.preventDefault();
      if (!pending && event.currentTarget.reportValidity()) setAsking(event.currentTarget);
    } : undefined} className={cn("flex flex-col gap-4", className)}>
      {available && !(provisioning && state?.reveal) ? (
        <>
          {children}
          {confirm ? <button ref={confirmedSubmit} type="submit" hidden name={confirm.field} value="on" disabled={pending} /> : null}
          <Button
            type={confirm ? "button" : "submit"}
            onClick={confirm ? (event) => { const form = event.currentTarget.form; if (form?.reportValidity()) setAsking(form); } : undefined}
            variant={buttonVariant[variant]}
            size="touch"
            className={cn("w-full text-body sm:w-auto sm:self-start md:h-9", variant === "primary" && "font-semibold")}
            disabled={pending}
          >
            {pending ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : null}
            {pending ? "Working…" : submit}
          </Button>
          {confirm ? <ConfirmDialog open={asking !== null} onOpenChange={(open) => { if (!open) setAsking(null); }} confirmation={{ confirmLabel: submit, ...confirm }} destructive={variant === "destructive"} pending={pending} onConfirm={() => {
            accepted.current = true;
            try { if (confirmedSubmit.current) asking?.requestSubmit(confirmedSubmit.current); }
            finally { accepted.current = false; setAsking(null); }
          }} /> : null}
        </>
      ) : null}
      {state?.error ? (
        <p role="alert" className="flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-meta text-destructive">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="flex w-full items-start gap-2 rounded-lg border border-emerald-600/25 bg-emerald-600/5 px-3 py-2.5 text-meta text-foreground">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          {state.ok}
        </p>
      ) : null}
      {state?.href ? <TextLink href={state.href}>View stock purchase</TextLink> : null}
      {state?.reveal ? <Reveal reveal={state.reveal} /> : null}
    </form>
  );
  if (!provisioning || state?.reveal) return form;
  return (
    <NextStep title="Next step">
      <h3 className="text-body font-medium">Provision this card</h3>
      {form}
    </NextStep>
  );
}

// A receiving date is the OWNER's local calendar date, not the server's UTC date.
function defaultReceivedDate(input: HTMLInputElement | null) {
  if (!input) return;
  const today = new Date();
  input.defaultValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function StockForm() {
  return (
    <ActionForm action={receiveStockAction} submit="Receive stock" variant="primary">
      <label className={label}>
        Received on
        <input name="receivedOn" type="date" ref={defaultReceivedDate} required className={field} />
      </label>
      <label className={label}>
        Quantity
        <Input name="quantity" type="number" inputMode="numeric" min={1} max={500} required />
      </label>
      <label className={label}>
        Intended product (optional)
        <Select name="intendedKind" defaultValue="">
          <option value="">Decide later</option>
          <option value="dbc">Digital Business Card</option>
          <option value="grc">Google Review Card</option>
        </Select>
      </label>
      <label className={label}>
        Supplier (optional)
        <Input name="supplier" maxLength={100} />
      </label>
      <label className={label}>
        Reference (optional)
        <Input name="reference" maxLength={100} />
      </label>
      <label className={label}>
        Notes (optional)
        <Textarea name="notes" maxLength={500} rows={3} />
      </label>
      <StockCosts />
    </ActionForm>
  );
}

function StockCosts({ purchaseCost, inboundShippingCost }: { purchaseCost?: number | null; inboundShippingCost?: number | null }) {
  return <>{[["purchaseCost", "Purchase cost", purchaseCost], ["inboundShippingCost", "Inbound shipping cost", inboundShippingCost]].map(([name, title, value]) => <label key={String(name)} className={label}>{title} (optional, pesos)<Input name={String(name)} inputMode="decimal" defaultValue={typeof value === "number" ? (value / 100).toFixed(2) : ""} /></label>)}</>;
}

export function StockPurchaseForm({ purchase }: { purchase: { id: string; receivedOn: string; supplier: string | null; reference: string | null; notes: string | null; purchaseCost: number | null; inboundShippingCost: number | null } }) {
  return <ActionForm action={updateStockPurchaseAction} submit="Save stock purchase">
    <input type="hidden" name="stockPurchaseId" value={purchase.id} />
    <label className={label}>Received on<Input name="receivedOn" type="date" defaultValue={purchase.receivedOn} required /></label>
    <label className={label}>Supplier<Input name="supplier" maxLength={100} defaultValue={purchase.supplier ?? ""} /></label>
    <label className={label}>Reference<Input name="reference" maxLength={100} defaultValue={purchase.reference ?? ""} /></label>
    <label className={label}>Notes<Textarea name="notes" maxLength={500} defaultValue={purchase.notes ?? ""} /></label>
    <StockCosts {...purchase} />
  </ActionForm>;
}

export function ProvisionForm({ cardId, available }: { cardId: string; available: boolean }) {
  return (
    <ActionForm action={provisionDbcAction} submit="Provision Digital Business Card" variant="primary" available={available} provisioning confirm={{ title: "Provision this card?", description: "This generates the permanent card URL and its activation code. The code is shown once, so have the package ready to record it.", confirmLabel: "Provision card" }}>
      <input type="hidden" name="cardId" value={cardId} />
      <p className="text-meta text-fg-secondary">Generates the permanent card URL and its activation code. The code is shown once.</p>
    </ActionForm>
  );
}

export function NfcCheckForm({ cardId, expectedUri }: { cardId: string; expectedUri: string }) {
  return (
    <ActionForm action={recordNfcCheckAction} submit="Confirm NFC check" variant="primary">
      <input type="hidden" name="cardId" value={cardId} />
      <p className="text-body">Complete this only when you have the physical card.</p>
      <CardUrl url={expectedUri} />
      <ol className="list-decimal space-y-1 pl-5 text-body">
        <li>Write this URL to the card using NFC Tools.</li>
        <li>Scan the card again using NFC Tools → Read.</li>
        <li>Paste the URL you read from the card below.</li>
      </ol>
      <label className={label}>
        URL read from the card
        <Input name="readBackUri" required autoComplete="off" spellCheck={false} autoCapitalize="off" />
      </label>
      <label className={check}>
        <input type="checkbox" name="readBackMatched" required />The URL on the card matches the Card URL above.
      </label>
      <label className={check}>
        <input type="checkbox" name="phoneOpenedUri" required />Tapping the card on a phone opens the correct URL.
      </label>
      <label className={check}>
        <input type="checkbox" name="tagLeftWritable" required />The card is still writable.
      </label>
    </ActionForm>
  );
}

export function MatchPackageForm({ cardId }: { cardId: string }) {
  return (
    <ActionForm action={matchPackageAction} submit="Match package" variant="primary">
      <input type="hidden" name="cardId" value={cardId} />
      <label className={label}>
        Code from the package
        <Input name="activationCode" required autoComplete="off" spellCheck={false} autoCapitalize="off" className="font-mono" />
      </label>
      <p className="text-meta text-fg-secondary">Type the private code printed in the package that goes with this card.</p>
    </ActionForm>
  );
}

export function ReplaceForm({ cardId, credentialId }: { cardId: string; credentialId: string }) {
  return (
    <ActionForm action={replaceCredentialAction} submit="Replace credential" variant="outline" confirm={{ field: "confirm", icon: <KeyRound className="size-5" />, title: "Replace this card's credential?", description: "The current activation code is revoked straight away and a new one is issued. The package has to be matched again before the card can be released." }}>
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="credentialId" value={credentialId} />
      <p className="text-meta text-fg-secondary">
        Only for a lost or mismatched unused code before the card is released. This is a recovery action,
        not the next provisioning step. The old code stops working and the package must be matched again.
      </p>
      <label className={label}>
        Reason
        <Input name="reason" required maxLength={200} />
      </label>
    </ActionForm>
  );
}

export function ReserveForm({ cardId, items }: { cardId: string; items: { orderItemId: string; orderNumber: number; label: string | null; reviewUrl: string | null; remaining: number }[] }) {
  return (
    <ActionForm action={reserveGrcAction} submit="Reserve Google Review Card" variant="primary">
      <input type="hidden" name="cardId" value={cardId} />
      <label className={label}>
        Order item
        <Select name="orderItemId" required defaultValue="">
          <option value="" disabled>
            Choose an order item
          </option>
          {items.map((item) => (
            <option key={item.orderItemId} value={item.orderItemId}>
              Order {item.orderNumber}
              {item.label ? ` · ${item.label}` : ""} · {item.remaining} to go
            </option>
          ))}
        </Select>
      </label>
    </ActionForm>
  );
}

export function RetireForm({ cardId }: { cardId: string }) {
  return (
    <ActionForm action={retireCardAction} submit="Retire card" variant="destructive" confirm={{ field: "confirm", icon: <Ban className="size-5" />, title: "Retire this card permanently?", description: "A retired card can no longer be sold, reserved or released, and it cannot be brought back. Use this only for a card that failed or must not be sold." }}>
      <input type="hidden" name="cardId" value={cardId} />
      <p className="text-meta text-fg-secondary">For a card that failed or must not be sold. This can&apos;t be undone.</p>
      <label className={label}>
        Reason
        <Input name="reason" required maxLength={200} />
      </label>
    </ActionForm>
  );
}
