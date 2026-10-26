"use client";

import { useState } from "react";
import { ActionForm } from "../../inventory/forms";
import { fieldLabel, Input, quietText, Textarea } from "../../ui";
import { markJntShippedAction, saveJntDeliveryAction } from "./actions";

type Destination = { recipientName: string; recipientPhone: string; address: string };

// Controlled so a refused submit keeps what was typed. The payment method and courier are never fields here.
export function JntDetailsForm({ orderId, initial, fee, withFee }: { orderId: string; initial: Destination; fee: string; withFee: boolean }) {
  const [values, setValues] = useState(initial);
  const [shippingFee, setShippingFee] = useState(fee);
  const set = (key: keyof Destination) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));
  return <ActionForm action={saveJntDeliveryAction} submit="Save J&T details" variant="primary">
    <input type="hidden" name="orderId" value={orderId} />
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={fieldLabel}>Recipient name<Input name="recipientName" required maxLength={100} autoComplete="name" value={values.recipientName} onChange={set("recipientName")} /></label>
      <label className={fieldLabel}>Recipient phone<Input name="recipientPhone" required maxLength={100} autoComplete="tel" inputMode="tel" value={values.recipientPhone} onChange={set("recipientPhone")} /></label>
      <label className={`${fieldLabel} sm:col-span-2`}>Full address<Textarea name="address" required maxLength={500} autoComplete="street-address" value={values.address} onChange={set("address")} /></label>
      {withFee ? <label className={fieldLabel}>J&amp;T shipping fee (pesos, optional now)<Input name="shippingFee" inputMode="decimal" maxLength={30} value={shippingFee} onChange={(event) => setShippingFee(event.target.value)} /></label> : null}
    </div>
    <p className={quietText}>Saved details survive reloads. Saving a fee does not record any payment.</p>
  </ActionForm>;
}

export function MarkShippedForm({ orderId, fee, feeKnown, today, earliest }: { orderId: string; fee: string; feeKnown: boolean; today: string; earliest: string }) {
  const [tracking, setTracking] = useState("");
  const [shippedOn, setShippedOn] = useState(today);
  const [shippingFee, setShippingFee] = useState(fee);
  return <ActionForm action={markJntShippedAction} submit="Mark as shipped" variant="primary">
    <input type="hidden" name="orderId" value={orderId} />
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={fieldLabel}>J&amp;T tracking number<Input name="trackingNumber" required maxLength={100} autoComplete="off" value={tracking} onChange={(event) => setTracking(event.target.value)} /></label>
      <label className={fieldLabel}>Shipped on<Input name="shippedOn" type="date" required min={earliest} max={today} value={shippedOn} onChange={(event) => setShippedOn(event.target.value)} /></label>
      <label className={fieldLabel}>J&amp;T shipping fee (pesos){feeKnown ? "" : " — required"}<Input name="shippingFee" inputMode="decimal" required maxLength={30} value={shippingFee} onChange={(event) => setShippingFee(event.target.value)} /><span className="text-label font-normal text-fg-secondary">{feeKnown ? "Confirmed fee. Enter 0 if there is no shipping charge." : "Enter 0 if there is no shipping charge."}</span></label>
    </div>
    <p className={quietText}>Marking as shipped confirms the J&amp;T shipping fee has been collected and makes the cards available for activation.</p>
  </ActionForm>;
}
