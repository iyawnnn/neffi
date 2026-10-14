"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, inputClass } from "@/components/ui/input";
import { formatPeso } from "@/lib/money";
import { ActionForm } from "../../inventory/forms";
import { createOrderAction } from "./actions";

type Line = { kind: "dbc" | "grc"; quantity: number; agreedTotal: string; label: string; reviewUrl: string; adjust: boolean };
const newLine = (): Line => ({ kind: "dbc", quantity: 1, agreedTotal: "", label: "", reviewUrl: "", adjust: false });

export function OrderForm({ products, purchaser, supportCaseId }: { products: { kind: "dbc" | "grc"; name: string; price: number }[]; purchaser?: { id: string; name: string; contactNumber: string | null }; supportCaseId?: string }) {
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [delivery, setDelivery] = useState("pickup");
  const [paidNow, setPaidNow] = useState(false);
  const [method, setMethod] = useState("cash");
  const update = (index: number, change: Partial<Line>) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...change } : line));
  return <ActionForm action={createOrderAction} submit="Create order">
    {supportCaseId ? <input type="hidden" name="supportCaseId" value={supportCaseId} /> : null}
    <fieldset className="space-y-3"><legend className="mb-3 text-lg font-semibold">Purchaser</legend>
      {purchaser ? <><input type="hidden" name="purchaserId" value={purchaser.id} /><p>{purchaser.name}{purchaser.contactNumber ? ` · ${purchaser.contactNumber}` : ""}</p></> : <>
        <label className="flex flex-col gap-1 text-sm">Name<Input name="name" required maxLength={100} autoComplete="name" /></label>
        <label className="flex flex-col gap-1 text-sm">Contact number (optional)<Input name="contactNumber" maxLength={100} autoComplete="tel" /></label>
      </>}
    </fieldset>
    <fieldset className="space-y-4"><legend className="mb-3 text-lg font-semibold">Order items</legend>
      <input type="hidden" name="items" value={JSON.stringify(lines.map((line) => ({ kind: line.kind, quantity: line.quantity, agreedTotal: line.adjust ? line.agreedTotal : "", label: line.kind === "grc" ? line.label : "", reviewUrl: line.kind === "grc" ? line.reviewUrl : "" })))} />
      {lines.map((line, index) => {
        const product = products.find((p) => p.kind === line.kind);
        return <div key={index} className="space-y-3 border-b pb-5">
          <label className="flex flex-col gap-1 text-sm">Product<select className={inputClass} value={line.kind} onChange={(e) => update(index, { kind: e.target.value as Line["kind"] })}><option value="dbc">Digital Business Card</option><option value="grc">Google Review Card</option></select></label>
          <p className="text-sm text-muted-foreground">{product ? `${product.name} · ${formatPeso(product.price)} per card` : "Set up this product in Settings first."}</p>
          <label className="flex flex-col gap-1 text-sm">Quantity<Input type="number" inputMode="numeric" min={1} max={500} required value={line.quantity} onChange={(e) => update(index, { quantity: Number(e.target.value) })} /></label>
          <p className="font-medium tabular-nums">Catalog total: {formatPeso((product?.price ?? 0) * line.quantity)}</p>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={line.adjust} onChange={(e) => update(index, { adjust: e.target.checked })} />Adjust price</label>
          {line.adjust ? <label className="flex flex-col gap-1 text-sm">Agreed line total (pesos)<Input inputMode="decimal" required maxLength={30} value={line.agreedTotal} onChange={(e) => update(index, { agreedTotal: e.target.value })} /></label> : null}
          {line.kind === "grc" ? <>
            <label className="flex flex-col gap-1 text-sm">Branch label (optional)<Input maxLength={100} value={line.label} onChange={(e) => update(index, { label: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-sm">Review URL (https, optional)<Input type="url" maxLength={2048} value={line.reviewUrl} onChange={(e) => update(index, { reviewUrl: e.target.value })} /></label>
          </> : null}
          {lines.length > 1 ? <Button type="button" variant="outline" className="min-h-11" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>Remove line</Button> : null}
        </div>;
      })}
      <Button type="button" variant="outline" className="min-h-11" disabled={lines.length >= 50} onClick={() => setLines((current) => [...current, newLine()])}>Add line</Button>
    </fieldset>
    <label className="flex flex-col gap-1 text-sm">Delivery method<select name="deliveryMethod" className={inputClass} value={delivery} onChange={(e) => setDelivery(e.target.value)}><option value="pickup">Pickup</option><option value="local_handoff">Local handoff</option><option value="courier">Courier</option></select></label>
    {delivery === "courier" ? <label className="flex flex-col gap-1 text-sm">Shipping fee (pesos, optional)<Input name="shippingFee" inputMode="decimal" maxLength={30} /><span className="text-muted-foreground">Recipient and tracking details are recorded when shipping.</span></label> : null}
    <label className="flex flex-col gap-1 text-sm">Notes (optional)<Textarea name="notes" maxLength={500} /></label>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="paidNow" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />Paid now</label>
    {paidNow ? <>
      <label className="flex flex-col gap-1 text-sm">Payment method<select name="method" className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Cash</option><option value="gcash">GCash</option><option value="bank_transfer">Bank transfer</option></select></label>
      <label className="flex flex-col gap-1 text-sm">Amount (pesos)<Input name="paymentAmount" inputMode="decimal" maxLength={30} placeholder="Full balance if left blank" /></label>
      {method !== "cash" ? <label className="flex flex-col gap-1 text-sm">Reference (optional)<Input name="reference" maxLength={100} /></label> : null}
    </> : <p className="text-sm text-muted-foreground">Not yet paid. Record payment from the order later.</p>}
  </ActionForm>;
}
