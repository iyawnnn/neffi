"use client";

import { useState } from "react";
import { CreditCard, Package, Plus, StickyNote, Tag, Trash2, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { checkLabel, fieldLabel, FormPanel, FormSection, Input, Select, Textarea } from "../../ui";
import { formatPeso, parsePesos } from "@/lib/money";
import { ActionForm } from "../../inventory/forms";
import { createOrderAction } from "./actions";

type Line = { kind: "dbc" | "grc"; quantity: number; agreedTotal: string; label: string; reviewUrl: string; adjust: boolean };
const newLine = (): Line => ({ kind: "grc", quantity: 1, agreedTotal: "", label: "", reviewUrl: "", adjust: false });
const KIND_NAME = { dbc: "Digital Business Card", grc: "Google Review Card" } as const;

// Display-only estimate for the summary. The server recomputes every total; an unparsable entry just falls back to
// the catalog price here.
function pesos(input: string): number | null {
  try { return parsePesos(input); } catch { return null; }
}

export function OrderForm({ products, purchaser, supportCaseId }: { products: { kind: "dbc" | "grc"; name: string; price: number }[]; purchaser?: { id: string; name: string; contactNumber: string | null }; supportCaseId?: string }) {
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [delivery, setDelivery] = useState("pickup");
  const [shipping, setShipping] = useState("");
  const [paidNow, setPaidNow] = useState(false);
  const [method, setMethod] = useState("cash");
  const update = (index: number, change: Partial<Line>) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...change } : line));

  const priced = lines.map((line) => {
    const catalog = (products.find((p) => p.kind === line.kind)?.price ?? 0) * line.quantity;
    const custom = line.adjust ? pesos(line.agreedTotal) : null;
    return { line, catalog, total: custom ?? catalog, custom: custom !== null && custom !== catalog };
  });
  const shippingFee = delivery === "courier" ? pesos(shipping) ?? 0 : 0;
  const total = priced.reduce((sum, row) => sum + row.total, 0) + shippingFee;

  return <ActionForm action={createOrderAction} submit="Create order" variant="primary">
    {supportCaseId ? <input type="hidden" name="supportCaseId" value={supportCaseId} /> : null}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <FormPanel>
        <FormSection icon={UserRound} title="Purchaser">
          {purchaser ? <><input type="hidden" name="purchaserId" value={purchaser.id} /><p className="text-body font-medium">{purchaser.name}{purchaser.contactNumber ? <span className="font-normal text-fg-secondary">{` · ${purchaser.contactNumber}`}</span> : null}</p></> : <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldLabel}>Name<Input name="name" required maxLength={100} autoComplete="name" /></label>
            <label className={fieldLabel}>Contact number (optional)<Input name="contactNumber" maxLength={100} autoComplete="tel" /></label>
          </div>}
        </FormSection>

        <FormSection icon={Package} title="Order items" description="Add a line for each product in this order.">
          <input type="hidden" name="items" value={JSON.stringify(lines.map((line) => ({ kind: line.kind, quantity: line.quantity, agreedTotal: line.adjust ? line.agreedTotal : "", label: line.kind === "grc" ? line.label : "", reviewUrl: line.kind === "grc" ? line.reviewUrl : "" })))} />
          <ul className="flex flex-col gap-3">
            {priced.map(({ line, catalog, custom }, index) => {
              const product = products.find((p) => p.kind === line.kind);
              return <li key={index} className="flex flex-col gap-4 rounded-lg border bg-canvas/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-meta font-medium text-fg-secondary">Line {index + 1}</p>
                  {lines.length > 1 ? <Button type="button" variant="ghost" size="icon" aria-label={`Remove line ${index + 1}`} className="-my-1 -mr-2 size-11 text-fg-secondary hover:bg-destructive/10 hover:text-destructive md:size-8" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><Trash2 aria-hidden /></Button> : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                  <label className={fieldLabel}>Product<Select value={line.kind} onChange={(e) => update(index, { kind: e.target.value as Line["kind"] })}><option value="grc">{KIND_NAME.grc}</option></Select></label>
                  <label className={fieldLabel}>Quantity<Input type="number" inputMode="numeric" min={1} max={500} required value={line.quantity} onChange={(e) => update(index, { quantity: Number(e.target.value) })} /></label>
                </div>
                <p className="text-meta text-fg-secondary">{product ? `${product.name} · ${formatPeso(product.price)} per card` : "Set up this product in Settings first."}</p>
                <p className="text-body font-medium tabular-nums">Catalog total: {formatPeso(catalog)}</p>
                <label className={`${checkLabel} items-center`}><input type="checkbox" checked={line.adjust} onChange={(e) => update(index, { adjust: e.target.checked })} />Adjust price</label>
                {line.adjust ? <div className="flex flex-col gap-2">
                  <label className={fieldLabel}>Agreed line total (pesos)<Input inputMode="decimal" required maxLength={30} value={line.agreedTotal} onChange={(e) => update(index, { agreedTotal: e.target.value })} /></label>
                  <p className={cn("flex items-center gap-1.5 text-label", custom ? "text-action-text" : "text-fg-secondary")}><Tag aria-hidden className="size-3" />{custom ? "Custom price replaces the catalog total for this line." : "Enter the total you agreed for this line."}</p>
                </div> : null}
                {line.kind === "grc" ? <div className="grid gap-4 sm:grid-cols-2">
                  <label className={fieldLabel}>Branch label (optional)<Input maxLength={100} value={line.label} onChange={(e) => update(index, { label: e.target.value })} /></label>
                  <label className={fieldLabel}>Review URL (https, optional)<Input type="url" maxLength={2048} value={line.reviewUrl} onChange={(e) => update(index, { reviewUrl: e.target.value })} /></label>
                </div> : null}
              </li>;
            })}
          </ul>
          <Button type="button" variant="outline" size="touch" className="self-start md:h-9" disabled={lines.length >= 50} onClick={() => setLines((current) => [...current, newLine()])}><Plus aria-hidden />Add line</Button>
        </FormSection>

        <FormSection icon={Truck} title="Fulfillment">
          <label className={fieldLabel}>Delivery method<Select name="deliveryMethod" value={delivery} onChange={(e) => setDelivery(e.target.value)}><option value="pickup">Pickup</option><option value="local_handoff">Local handoff</option><option value="courier">Courier</option></Select></label>
          {delivery === "courier" ? <label className={fieldLabel}>Shipping fee (pesos, optional)<Input name="shippingFee" inputMode="decimal" maxLength={30} value={shipping} onChange={(e) => setShipping(e.target.value)} /><span className="text-label font-normal text-fg-secondary">Recipient and tracking details are recorded when shipping.</span></label> : null}
        </FormSection>

        <FormSection icon={CreditCard} title="Payment">
          <label className={`${checkLabel} items-center`}><input type="checkbox" name="paidNow" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />Paid now</label>
          {paidNow ? <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldLabel}>Payment method<Select name="method" value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Cash</option><option value="gcash">GCash</option><option value="bank_transfer">Bank transfer</option></Select></label>
            <label className={fieldLabel}>Amount (pesos)<Input name="paymentAmount" inputMode="decimal" maxLength={30} placeholder="Full balance if left blank" /></label>
            {method !== "cash" ? <label className={cn(fieldLabel, "sm:col-span-2")}>Reference (optional)<Input name="reference" maxLength={100} /></label> : null}
          </div> : <p className="text-meta text-fg-secondary">Not yet paid. Record payment from the order later.</p>}
        </FormSection>

        <FormSection icon={StickyNote} title="Notes">
          <label className={fieldLabel}>Notes (optional)<Textarea name="notes" maxLength={500} /></label>
        </FormSection>
      </FormPanel>

      <aside aria-label="Order summary" className="flex flex-col gap-4 rounded-panel border bg-background p-4 sm:p-5 lg:sticky lg:top-6">
        <h2 className="text-section">Summary</h2>
        <p className="text-meta text-fg-secondary">{purchaser ? purchaser.name : "New purchaser"}</p>
        <ul className="flex flex-col gap-2 border-t pt-4 text-body">
          {priced.map(({ line, total: lineTotal, custom }, index) => (
            <li key={index} className="flex items-baseline justify-between gap-4">
              <span className="min-w-0">{line.quantity || 0} × {KIND_NAME[line.kind]}{custom ? <span className="block text-label text-action-text">Custom price</span> : null}</span>
              <span className="shrink-0 tabular-nums">{formatPeso(lineTotal)}</span>
            </li>
          ))}
          {shippingFee ? <li className="flex items-baseline justify-between gap-4 text-fg-secondary"><span>Shipping</span><span className="tabular-nums">{formatPeso(shippingFee)}</span></li> : null}
        </ul>
        <p className="flex items-baseline justify-between gap-4 border-t pt-4"><span className="text-body font-medium">Estimated total</span><span className="text-[1.25rem] leading-7 font-semibold tabular-nums">{formatPeso(total)}</span></p>
        <p className="text-label text-fg-secondary">{paidNow ? "Payment is recorded with the order." : "Unpaid until a payment is recorded."} The final total is calculated when the order is created.</p>
      </aside>
    </div>
  </ActionForm>;
}
