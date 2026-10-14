"use client";

import { useState } from "react";
import { Input, Textarea, inputClass } from "@/components/ui/input";

function defaultManilaDate(input: HTMLInputElement | null) {
  if (input) input.defaultValue = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

export function MoneyFields({ kind, amount, reasonRequired = false }: { kind: "payment" | "refund"; amount: number; reasonRequired?: boolean }) {
  const [method, setMethod] = useState("cash");
  return <>
    <label className="flex flex-col gap-1 text-sm">Amount (pesos)<Input name="amount" inputMode="decimal" maxLength={30} required defaultValue={(amount / 100).toFixed(2)} /></label>
    <label className="flex flex-col gap-1 text-sm">Method<select className={inputClass} name="method" value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Cash</option><option value="gcash">GCash</option><option value="bank_transfer">Bank transfer</option></select></label>
    <label className="flex flex-col gap-1 text-sm">Date (today if blank)<Input name={kind === "payment" ? "paidOn" : "refundedOn"} type="date" ref={defaultManilaDate} /></label>
    {kind === "payment" && method !== "cash" ? <label className="flex flex-col gap-1 text-sm">Reference (optional)<Input name="reference" maxLength={100} /></label> : null}
    {kind === "refund" ? <label className="flex flex-col gap-1 text-sm">Reason{reasonRequired ? "" : " (optional)"}<Textarea name="reason" required={reasonRequired} maxLength={reasonRequired ? 200 : 500} /></label> : null}
  </>;
}
