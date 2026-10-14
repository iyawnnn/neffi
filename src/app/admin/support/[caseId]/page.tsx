import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { Input, Textarea } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format-date";
import { formatPeso } from "@/lib/money";
import { getCaseDetail, caseLinkOptions } from "@/modules/support/queries";
import { ActionForm } from "../../inventory/forms";
import { ActionSheet } from "../../orders/[orderId]/action-sheet";
import { LinkSelect, linkChoices } from "../link-fields";
import { assignCaseAction, setCaseStatusAction, reopenCaseAction, addCaseNoteAction, fillCaseLinkAction, linkCaseCardAction } from "./actions";
import { CaseCorrections } from "./corrections";

export const instant = false;

export default async function CasePage({ params, searchParams }: PageProps<"/admin/support/[caseId]">) {
  await requireOwner();
  await connection();
  const { caseId } = await params;
  if (!z.uuid().safeParse(caseId).success) notFound();
  const support = await getCaseDetail(db, caseId);
  if (!support) notFound();
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 100) : "";
  const choices = linkChoices(await caseLinkOptions(db, q));
  const hidden = <input name="caseId" type="hidden" value={caseId} />;
  const active = support.status !== "resolved";
  return <main data-admin-section="support" className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 sm:p-8">
    <header className="space-y-2"><Link className="flex min-h-11 items-center underline" href="/admin/support">Support</Link><h1 className="break-words text-2xl font-semibold">{support.summary}</h1><p>{support.type.replaceAll("_", " ")} · {support.status.replaceAll("_", " ")}</p><p className="text-sm text-muted-foreground">Opened {formatDateTime(support.createdAt)} · Updated {formatDateTime(support.updatedAt)}</p></header>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Case status</h2><div className="flex flex-wrap gap-3">
      {active ? <><ActionForm action={setCaseStatusAction} submit={support.status === "open" ? "Wait on customer" : "Mark open"}>{hidden}<input type="hidden" name="status" value={support.status === "open" ? "waiting_on_customer" : "open"} /></ActionForm><ActionSheet title="Resolve case"><ActionForm action={setCaseStatusAction} submit="Resolve case">{hidden}<input type="hidden" name="status" value="resolved" /><label className="flex flex-col gap-1 text-sm">Resolution note (optional)<Textarea name="note" maxLength={500} /></label><p>Corrections are blocked while the case is resolved. You can reopen it later.</p></ActionForm></ActionSheet></> : <ActionForm action={reopenCaseAction} submit="Reopen case">{hidden}</ActionForm>}
    </div>{support.resolvedAt ? <p>Resolved {formatDateTime(support.resolvedAt)}</p> : null}
      {active ? <ActionForm action={assignCaseAction} submit="Assign case">{hidden}<LinkSelect name="assignedToAccountId" label="Assigned owner" choices={support.assignees.map((owner) => ({ id: owner.id, label: owner.email }))} value={support.assignedToAccountId ?? undefined} required /></ActionForm> : <p>Assigned to {support.assignees.find((owner) => owner.id === support.assignedToAccountId)?.email ?? "Unassigned"}</p>}
    </section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Related records</h2>
      {support.order ? <><Link className="flex min-h-11 items-center underline" href={`/admin/orders/${support.order.id}`}>Order {support.order.number} · {support.order.status.replaceAll("_", " ")}</Link><dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Order total", support.order.totals.orderTotal], ["Net paid", support.order.totals.netPaid], ["Balance", support.order.totals.balance], ["After-sale refunds", support.order.totals.afterSaleRefunded]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{formatPeso(value as number)}</dd></div>)}</dl>{support.order.status === "completed" && support.order.totals.balance > 0 ? <p role="status" className="rounded-lg border p-4">Balance due after correction: {formatPeso(support.order.totals.balance)}</p> : null}</> : <p>No original order linked.</p>}
      {support.purchaser ? <Link className="flex min-h-11 items-center underline" href={`/admin/customers/purchasers/${support.purchaser.id}`}>Purchaser: {support.purchaser.name}</Link> : null}
      {support.account ? <p className="break-words">Account: <Link className="underline" href={`/admin/customers/accounts/${support.accountId}`}>{support.account.email}</Link> · {support.account.role} · {support.account.methods.join(", ")}</p> : null}
      {support.linkedOrders.map((order) => <Link key={order.id} className="flex min-h-11 items-center underline" href={`/admin/orders/${order.id}`}>Paid replacement order {order.number} · {order.status.replaceAll("_", " ")}</Link>)}
      {active ? <Link className="flex min-h-11 items-center underline" href={`/admin/orders/new?${new URLSearchParams({ supportCaseId: caseId, ...(support.purchaserId || support.order?.purchaserId ? { purchaserId: (support.purchaserId ?? support.order!.purchaserId) } : {}) })}`}>New replacement order</Link> : null}
    </section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Cards</h2>{support.cards.map((card) => <p key={card.id}><Link className="inline-flex min-h-11 items-center underline" href={`/admin/inventory/cards/${card.id}`}>{card.kind?.toUpperCase() ?? "Unassigned"} …{card.suffix ?? card.id.slice(-4)}</Link> · {card.role} · {card.state}</p>)}{!support.cards.length ? <p>No cards linked.</p> : null}<p className="text-sm text-muted-foreground">GRC corrections use case notes and shipments; there is no GRC Card workflow.</p></section>
    {active ? <section className="space-y-3"><h2 className="text-xl font-semibold">Link related records</h2><p className="text-sm text-muted-foreground">Links can only be added. Search by order number, purchaser name, Account email or the last four characters on a card.</p><form className="flex flex-wrap items-end gap-3"><label className="flex flex-1 flex-col gap-1 text-sm">Find related records<Input name="q" maxLength={100} defaultValue={q} /></label><button className="min-h-11 rounded-lg border px-4">Find records</button></form>
      <div className="grid gap-5 sm:grid-cols-2">{(["orderId", "purchaserId", "accountId"] as const).filter((field) => !support[field]).map((field) => <ActionForm key={field} action={fillCaseLinkAction} submit={`Link ${field === "orderId" ? "order" : field === "purchaserId" ? "purchaser" : "Account"}`}>{hidden}<input name="field" type="hidden" value={field} /><LinkSelect name="value" label={field === "orderId" ? "Order" : field === "purchaserId" ? "Purchaser" : "Account"} choices={choices[field]} required /></ActionForm>)}<ActionForm action={linkCaseCardAction} submit="Link affected card">{hidden}<LinkSelect name="cardId" label="Affected card" choices={choices.cardId.filter((choice) => !support.cards.some((card) => card.id === choice.id))} required /></ActionForm></div>
    </section> : null}
    <section className="space-y-3"><h2 className="text-xl font-semibold">After-sale refunds</h2>{support.refunds.map((refund) => <div key={refund.id} className="border-b py-3"><p className={refund.voidedAt ? "line-through" : ""}>{formatPeso(refund.amount)} · {refund.method} · {refund.refundedOn}</p><p>{refund.reason}</p>{refund.voidedAt ? <p>Voided: {refund.voidReason}</p> : null}</div>)}{!support.refunds.length ? <p>No after-sale refunds from this case.</p> : null}</section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Support shipments</h2>{support.shipments.map((shipment) => <div key={shipment.id} className="border-b py-3"><p>{shipment.status.replaceAll("_", " ")} · {shipment.courier} · {shipment.trackingNumber}</p><p>{shipment.shippedOn}{shipment.courierCost !== null ? ` · Cost ${formatPeso(shipment.courierCost)}` : ""}</p><p>{shipment.recipientName} {shipment.recipientContact}</p><p className="whitespace-pre-wrap break-words">{shipment.address}</p></div>)}{!support.shipments.length ? <p>No support shipments.</p> : null}</section>
    <CaseCorrections support={support} />
    <section className="space-y-3"><h2 className="text-xl font-semibold">Internal note</h2><ActionForm action={addCaseNoteAction} submit="Add note">{hidden}<label className="flex flex-col gap-1 text-sm">Note<Textarea name="note" required maxLength={500} /></label><p className="text-sm text-muted-foreground">Do not paste activation codes, identity documents or secrets.</p></ActionForm></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Activity</h2>{support.timeline.map((event) => <div key={event.id} className="border-b py-3"><p>{event.type.replaceAll("_", " ")}{event.actorAccountId === null ? " · System" : ""}</p>{event.note ? <p className="whitespace-pre-wrap break-words text-sm">{event.note}</p> : null}<p className="text-sm text-muted-foreground">{formatDateTime(event.createdAt)}</p></div>)}{!support.timeline.length ? <p>No activity yet.</p> : null}</section>
  </main>;
}
