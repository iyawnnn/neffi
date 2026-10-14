import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { supportCaseType } from "@/db/schema";
import { Input, Textarea, inputClass } from "@/components/ui/input";
import { accountDirectoryDetail } from "@/modules/accounts/directory";
import { getPurchaser } from "@/modules/orders/purchasers";
import { getOrderDetail, orderAssignees } from "@/modules/orders/queries";
import { getCardDetail } from "@/modules/inventory/queries";
import { caseLinkOptions } from "@/modules/support/queries";
import { ActionForm } from "../../inventory/forms";
import { openCaseAction } from "../[caseId]/actions";
import { LinkSelect, linkChoices } from "../link-fields";

export const instant = false;

export default async function NewCasePage({ searchParams }: Pick<PageProps<"/admin/support/new">, "searchParams">) {
  const owner = await requireOwner();
  await connection();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const [options, assignees] = await Promise.all([caseLinkOptions(db, q), orderAssignees(db)]);
  const choices = linkChoices(options);
  const prefill: Partial<Record<keyof typeof choices, string>> = {};
  for (const field of ["orderId", "purchaserId", "accountId", "cardId"] as const) {
    const value = params[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || !z.uuid().safeParse(value).success) notFound();
    const record = field === "orderId" ? await getOrderDetail(db, value) : field === "purchaserId" ? await getPurchaser(db, value) : field === "accountId" ? await accountDirectoryDetail(db, value) : await getCardDetail(db, value);
    if (!record) notFound();
    prefill[field] = value;
    if (!choices[field].some((choice) => choice.id === value)) choices[field].push({ id: value, label: field === "orderId" && "number" in record ? `Order ${record.number}` : field === "accountId" && "email" in record ? String(record.email) : field === "purchaserId" && "name" in record ? String(record.name) : "Selected card" });
  }
  return <main data-admin-section="support" className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8"><Link className="flex min-h-11 items-center underline" href="/admin/support">Support</Link><h1 className="text-2xl font-semibold">Open support case</h1>
    <form className="flex flex-wrap items-end gap-3">{Object.entries(prefill).map(([key, value]) => <input key={key} name={key} value={value} type="hidden" />)}<label className="flex flex-1 flex-col gap-1 text-sm">Find related records<Input name="q" defaultValue={q} maxLength={100} placeholder="Order number, name, email or card suffix" /></label><button className="min-h-11 rounded-lg border px-4">Find records</button></form>
    <ActionForm action={openCaseAction} submit="Open support case"><label className="flex flex-col gap-1 text-sm">Type<select name="type" className={inputClass}>{supportCaseType.enumValues.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label><label className="flex flex-col gap-1 text-sm">Summary<Textarea name="summary" required maxLength={500} /></label>
      <p className="text-sm text-muted-foreground">Internal only. Do not paste activation codes, identity documents or secrets. Related links can be filled once and cannot be changed.</p>
      {(["orderId", "purchaserId", "accountId", "cardId"] as const).map((field) => <LinkSelect key={field} name={field} label={`${field === "orderId" ? "Order" : field === "purchaserId" ? "Purchaser" : field === "accountId" ? "Account" : "Affected card"} (optional)`} choices={choices[field]} value={prefill[field]} />)}
      <LinkSelect name="assignedToAccountId" label="Assigned owner" choices={assignees.map((row) => ({ id: row.id, label: row.email }))} value={owner.accountId} required />
    </ActionForm>
  </main>;
}
