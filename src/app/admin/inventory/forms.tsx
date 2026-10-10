"use client";

import { useActionState, useLayoutEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CardUrl } from "./card-url";
import {
  matchPackageAction,
  provisionDbcAction,
  receiveStockAction,
  recordNfcCheckAction,
  reserveGrcAction,
  replaceCredentialAction,
  retireCardAction,
  type ActionState,
} from "./actions";

const field = "h-10 w-full rounded-lg border border-input bg-background px-3 text-base";
const label = "flex flex-col gap-1 text-sm font-medium";
const check = "flex items-start gap-2 text-sm";

type Action = (previous: ActionState | undefined, data: FormData) => Promise<ActionState>;

// The revealed code lives only in this response's React state: it is never written to storage, the URL or the
// console, and it is gone on the next submission or reload.
function Reveal({ reveal }: { reveal: NonNullable<ActionState["reveal"]> }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(reveal.code);
      setMessage("Activation code copied. Save it to the card's package now.");
    } catch {
      setMessage("Could not copy. Select the code and copy it manually.");
    }
  }

  return (
    <div role="status" className="flex flex-col gap-4 rounded-lg border-2 border-primary bg-secondary p-5 text-sm">
      <h2 className="text-xl font-semibold">Activation code — shown once</h2>
      <p className="break-all font-mono text-2xl font-semibold tracking-wider select-all">{reveal.code}</p>
      <Button type="button" className="h-10 self-start" onClick={copy}>Copy activation code</Button>
      <p role="status">{message}</p>
      {reveal.url ? <p className="break-all font-mono text-xs select-all">{reveal.url}</p> : null}
      <p>
        Save this code to the card&apos;s package now. It cannot be shown again. If it is lost before release,
        use Credential recovery.
      </p>
    </div>
  );
}

type ActionFormProps = { action: Action; submit: string; variant?: "default" | "destructive" | "outline"; children?: ReactNode; available?: boolean; provisioning?: boolean };

function ActionForm(props: ActionFormProps) {
  const [visit, setVisit] = useState(0);
  // Next's Activity preserves hidden pages. Reset the response holder on navigation so codes cannot return with Back.
  useLayoutEffect(() => () => setVisit((value) => value + 1), []);
  return <ActionFormContent key={visit} {...props} />;
}

function ActionFormContent({ action, submit, variant = "default", children, available = true, provisioning = false }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  if (!available && !state?.reveal) return null;

  const form = (
    <form action={formAction} className="flex flex-col gap-3">
      {available && !(provisioning && state?.reveal) ? (
        <>
          {children}
          <Button type="submit" variant={variant} size="lg" className="h-10 w-full" disabled={pending}>
            {pending ? "Working…" : submit}
          </Button>
        </>
      ) : null}
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p role="status" className="text-sm text-muted-foreground">{state.ok}</p> : null}
      {state?.reveal ? <Reveal reveal={state.reveal} /> : null}
    </form>
  );
  if (!provisioning || state?.reveal) return form;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-primary p-5">
      <h2 className="text-base font-semibold">Next step</h2>
      <h3 className="font-medium">Provision this card</h3>
      {form}
    </section>
  );
}

export function StockForm({ today }: { today: string }) {
  return (
    <ActionForm action={receiveStockAction} submit="Receive stock">
      <label className={label}>
        Received on
        <input name="receivedOn" type="date" defaultValue={today} required className={field} />
      </label>
      <label className={label}>
        Quantity
        <input name="quantity" type="number" inputMode="numeric" min={1} max={500} required className={field} />
      </label>
      <label className={label}>
        Intended product (optional)
        <select name="intendedKind" defaultValue="" className={field}>
          <option value="">Decide later</option>
          <option value="dbc">Digital Business Card</option>
          <option value="grc">Google Review Card</option>
        </select>
      </label>
      <label className={label}>
        Supplier (optional)
        <input name="supplier" maxLength={100} className={field} />
      </label>
      <label className={label}>
        Reference (optional)
        <input name="reference" maxLength={100} className={field} />
      </label>
    </ActionForm>
  );
}

export function ProvisionForm({ cardId, available }: { cardId: string; available: boolean }) {
  return (
    <ActionForm action={provisionDbcAction} submit="Provision Digital Business Card" available={available} provisioning>
      <input type="hidden" name="cardId" value={cardId} />
      <p className="text-sm text-muted-foreground">Generates the permanent card URL and its activation code. The code is shown once.</p>
    </ActionForm>
  );
}

export function NfcCheckForm({ cardId, expectedUri }: { cardId: string; expectedUri: string }) {
  return (
    <ActionForm action={recordNfcCheckAction} submit="Record NFC check">
      <input type="hidden" name="cardId" value={cardId} />
      <p className="text-sm">Use NFC Tools to write this exact address to the physical tag, then read it back:</p>
      <CardUrl url={expectedUri} />
      <p className="text-sm text-muted-foreground">
        Confirm each check only after testing a real physical tag: the address reads back exactly,
        a real phone recognises and opens it, and the tag remains unlocked and writable.
        Software testing cannot replace these checks.
      </p>
      <label className={label}>
        Address read back from the tag
        <input name="readBackUri" required autoComplete="off" spellCheck={false} autoCapitalize="off" className={field} />
      </label>
      <label className={check}>
        <input type="checkbox" name="readBackMatched" required className="mt-1" />I read the tag back and the address is exactly the one above.
      </label>
      <label className={check}>
        <input type="checkbox" name="phoneOpenedUri" required className="mt-1" />A real phone recognised the tag and tried to open that exact address.
      </label>
      <label className={check}>
        <input type="checkbox" name="tagLeftWritable" required className="mt-1" />The tag was left unlocked and writable.
      </label>
      <label className={label}>
        Phone / device (optional)
        <input name="device" maxLength={100} className={field} />
      </label>
    </ActionForm>
  );
}

export function MatchPackageForm({ cardId }: { cardId: string }) {
  return (
    <ActionForm action={matchPackageAction} submit="Match package">
      <input type="hidden" name="cardId" value={cardId} />
      <label className={label}>
        Code from the package
        <input name="activationCode" required autoComplete="off" spellCheck={false} autoCapitalize="off" className={`${field} font-mono`} />
      </label>
      <p className="text-sm text-muted-foreground">Type the private code printed in the package that goes with this card.</p>
    </ActionForm>
  );
}

export function ReplaceForm({ cardId, credentialId }: { cardId: string; credentialId: string }) {
  return (
    <ActionForm action={replaceCredentialAction} submit="Replace credential" variant="outline">
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="credentialId" value={credentialId} />
      <p className="text-sm text-muted-foreground">
        Only for a lost or mismatched unused code before the card is released. This is a recovery action,
        not the next provisioning step. The old code stops working and the package must be matched again.
      </p>
      <label className={label}>
        Reason
        <input name="reason" required maxLength={200} className={field} />
      </label>
      <label className={check}>
        <input type="checkbox" name="confirm" required className="mt-1" />Revoke the current code and issue a new one.
      </label>
    </ActionForm>
  );
}

export function ReserveForm({ cardId, items }: { cardId: string; items: { orderItemId: string; orderNumber: number; label: string | null; reviewUrl: string | null; remaining: number }[] }) {
  return (
    <ActionForm action={reserveGrcAction} submit="Reserve Google Review Card">
      <input type="hidden" name="cardId" value={cardId} />
      <label className={label}>
        Order item
        <select name="orderItemId" required defaultValue="" className={field}>
          <option value="" disabled>
            Choose an order item
          </option>
          {items.map((item) => (
            <option key={item.orderItemId} value={item.orderItemId}>
              Order {item.orderNumber}
              {item.label ? ` · ${item.label}` : ""} · {item.remaining} to go
            </option>
          ))}
        </select>
      </label>
    </ActionForm>
  );
}

export function RetireForm({ cardId }: { cardId: string }) {
  return (
    <ActionForm action={retireCardAction} submit="Retire card" variant="destructive">
      <input type="hidden" name="cardId" value={cardId} />
      <p className="text-sm text-muted-foreground">For a card that failed or must not be sold. This can&apos;t be undone.</p>
      <label className={label}>
        Reason
        <input name="reason" required maxLength={200} className={field} />
      </label>
      <label className={check}>
        <input type="checkbox" name="confirm" required className="mt-1" />Retire this card permanently.
      </label>
    </ActionForm>
  );
}
