import type { caseLinkOptions } from "@/modules/support/queries";
import { fieldLabel, Select } from "../ui";

export type LinkOptions = Awaited<ReturnType<typeof caseLinkOptions>>;

export function LinkSelect({ name, label, choices, value, required = false }: { name: string; label: string; choices: { id: string; label: string }[]; value?: string; required?: boolean }) {
  return <label className={fieldLabel}>{label}<Select name={name} defaultValue={value ?? ""} required={required}><option value="">{required ? "Choose a record" : "None"}</option>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</Select></label>;
}

export function linkChoices(options: LinkOptions) {
  return {
    orderId: options.orders.map((row) => ({ id: row.id, label: `Order ${row.number} · ${row.purchaserName}` })),
    purchaserId: options.purchasers.map((row) => ({ id: row.id, label: row.name })),
    accountId: options.accounts.map((row) => ({ id: row.id, label: row.email })),
    cardId: options.cards.map((row) => ({ id: row.id, label: `${row.kind?.toUpperCase() ?? "Unassigned"} …${row.suffix} · ${row.state}` })),
  };
}
