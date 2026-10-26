"use client";

import { useState } from "react";
import { CreditCard, Package, StickyNote, Truck, UserRound } from "lucide-react";
import { formatPeso } from "@/lib/money";
import { NORMAL_DBC_UNIT_PRICE } from "@/modules/orders/policy";
import { ActionForm } from "../../inventory/forms";
import { fieldLabel, FormPanel, FormSection, Input, Select, Textarea } from "../../ui";
import { createPaidOrderAction } from "./actions";

const METHODS = [["gcash", "GCash"], ["maya", "Maya"], ["maribank", "MariBank"], ["gotyme", "GoTyme"], ["bank_transfer", "Bank transfer"]] as const;
const PRODUCT = `Neffi Digital Business Card — ${formatPeso(NORMAL_DBC_UNIT_PRICE).replace(/\.00$/, "")}`;

// Controlled fields keep what the owner typed when the server refuses the submit. The server owns the price, the
// courier and every amount; nothing here can change them.
export function NormalOrderForm({ clientKey, purchaser, supportCaseId }: { clientKey: string; purchaser?: { id: string; name: string; contactNumber: string | null }; supportCaseId?: string }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<string>(METHODS[0][0]);
  const [delivery, setDelivery] = useState("in_person");
  const [recipient, setRecipient] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const customerName = purchaser?.name ?? name;
  const customerPhone = purchaser?.contactNumber ?? contact;
  const units = Number.isInteger(quantity) && quantity > 0 ? quantity : 0;

  return <ActionForm action={createPaidOrderAction} submit="Create paid order" variant="primary">
    <input type="hidden" name="clientKey" value={clientKey} />
    {supportCaseId ? <input type="hidden" name="supportCaseId" value={supportCaseId} /> : null}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <FormPanel>
        <FormSection icon={UserRound} title="Customer">
          {purchaser ? <><input type="hidden" name="purchaserId" value={purchaser.id} /><p className="break-words text-body font-medium [overflow-wrap:anywhere]">{purchaser.name}{purchaser.contactNumber ? <span className="font-normal text-fg-secondary">{` · ${purchaser.contactNumber}`}</span> : null}</p></> : <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldLabel}>Customer name<Input name="name" required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className={fieldLabel}>Contact number<Input name="contactNumber" maxLength={100} autoComplete="tel" inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} /></label>
          </div>}
        </FormSection>

        <FormSection icon={Package} title="Product">
          <p className="text-body font-medium">{PRODUCT}</p>
          <label className={`${fieldLabel} max-w-32`}>Quantity<Input name="quantity" type="number" inputMode="numeric" min={1} max={500} required value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></label>
        </FormSection>

        <FormSection icon={CreditCard} title="Payment method" description="Choose how the customer paid. Creating this order records the full product price as received.">
          <label className={`${fieldLabel} max-w-xs`}>Payment method<Select name="paymentMethod" value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</Select></label>
          <p className="text-meta text-fg-secondary">{formatPeso(NORMAL_DBC_UNIT_PRICE).replace(/\.00$/, "")} has already been received. No amount to enter.</p>
        </FormSection>

        <FormSection icon={Truck} title="Delivery">
          <label className={`${fieldLabel} max-w-xs`}>Delivery<Select name="delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)}><option value="in_person">In person</option><option value="jnt">J&amp;T</option></Select></label>
          {delivery === "jnt" ? <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldLabel}>Recipient name<Input name="recipientName" maxLength={100} autoComplete="name" value={recipient ?? customerName} onChange={(e) => setRecipient(e.target.value)} /></label>
            <label className={fieldLabel}>Recipient phone<Input name="recipientPhone" maxLength={100} autoComplete="tel" inputMode="tel" value={phone ?? customerPhone} onChange={(e) => setPhone(e.target.value)} /></label>
            <label className={`${fieldLabel} sm:col-span-2`}>Full address<Textarea name="address" maxLength={500} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
            <p className="text-meta text-fg-secondary sm:col-span-2">J&amp;T Shipping — To be confirmed. You confirm the fee when you mark the order as shipped.</p>
          </div> : null}
        </FormSection>

        <FormSection icon={StickyNote} title="Notes">
          <label className={fieldLabel}>Internal note (optional)<Textarea name="notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </FormSection>
      </FormPanel>

      <aside aria-label="Order summary" className="flex flex-col gap-4 rounded-panel border bg-background p-4 sm:p-5 lg:sticky lg:top-6">
        <h2 className="text-section">Summary</h2>
        <p className="break-words text-meta text-fg-secondary [overflow-wrap:anywhere]">{customerName || "New customer"}</p>
        <ul className="flex flex-col gap-2 border-t pt-4 text-body">
          <li className="flex items-baseline justify-between gap-4"><span className="min-w-0">{units} × Neffi Digital Business Card</span><span className="shrink-0 tabular-nums">{formatPeso(units * NORMAL_DBC_UNIT_PRICE)}</span></li>
          {delivery === "jnt" ? <li className="flex items-baseline justify-between gap-4 text-fg-secondary"><span>J&amp;T Shipping</span><span>To be confirmed</span></li> : null}
        </ul>
        <p className="flex items-baseline justify-between gap-4 border-t pt-4"><span className="text-body font-medium">Product received</span><span className="text-[1.25rem] leading-7 font-semibold tabular-nums">{formatPeso(units * NORMAL_DBC_UNIT_PRICE)}</span></p>
        <p className="text-label text-fg-secondary">Cards are allocated automatically after the order is created.</p>
      </aside>
    </div>
  </ActionForm>;
}
