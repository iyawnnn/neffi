import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format-date";
import { formatPeso } from "@/lib/money";
import { getCaseDetail, caseLinkOptions } from "@/modules/support/queries";
import { adminPageWide, caseTone, inlineLink, quietText, DetailList, fieldLabel, FilterField, Input, label, Meta, Notice, PageHeader, Panel, Section, shipmentTone, Status, Textarea } from "../../ui";
import { ActionForm } from "../../inventory/forms";
import { ActionSheet } from "../../orders/[orderId]/action-sheet";
import { LinkSelect, linkChoices } from "../link-fields";
import { assignCaseAction, setCaseStatusAction, reopenCaseAction, addCaseNoteAction, fillCaseLinkAction, linkCaseCardAction } from "./actions";
import { CaseCorrections } from "./corrections";
import { CaseEmails } from "./emails";
import { CaseRecovery } from "./recovery";
import type { CaseEmailKind } from "@/modules/support/email";

export const instant = false;

const link = inlineLink;
const quiet = quietText;

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
  const recipient = support.requesterEmail ?? support.account?.email ?? null;
  const failedKinds = [...new Set(support.timeline.filter(event => event.type === "support_email_failed").map(event => event.note?.split(" ")[0]).filter((kind): kind is CaseEmailKind => kind === "acknowledgement" || kind === "reply" || kind === "resolution"))];
  return <main data-admin-section="support" className={adminPageWide}>
    <PageHeader
      back={{ href: "/admin/support", label: "Support" }}
      title={support.summary}
      description={<span className="flex flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><Status tone={caseTone(support.status)}>{label(support.status)}</Status><span>{label(support.type)}</span></span>
        <span className={quiet}>Opened {formatDateTime(support.createdAt)} · Updated {formatDateTime(support.updatedAt)}</span>
      </span>}
    />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      <div className="flex flex-col gap-6 lg:col-start-2 lg:gap-8 lg:row-start-1">
        <Section title="Case status">
          <Panel padded className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {active ? <><ActionForm action={setCaseStatusAction} submit={support.status === "open" ? "Wait on customer" : "Mark open"}>{hidden}<input type="hidden" name="status" value={support.status === "open" ? "waiting_on_customer" : "open"} /></ActionForm><ActionSheet title="Resolve case" description="Close this case. You can reopen it later." icon={<CircleCheck aria-hidden />}><ActionForm action={setCaseStatusAction} submit="Resolve case" variant="primary">{hidden}<input type="hidden" name="status" value="resolved" /><label className={fieldLabel}>Resolution note (optional)<Textarea name="note" maxLength={500} /></label><p className={quiet}>Corrections are blocked while the case is resolved. You can reopen it later.</p></ActionForm></ActionSheet></> : <ActionForm action={reopenCaseAction} submit="Reopen case">{hidden}</ActionForm>}
            </div>
            {support.resolvedAt ? <p className={quiet}>Resolved {formatDateTime(support.resolvedAt)}</p> : null}
            {active ? <ActionForm action={assignCaseAction} submit="Assign case">{hidden}<LinkSelect name="assignedToAccountId" label="Assigned owner" choices={support.assignees.map((owner) => ({ id: owner.id, label: owner.email }))} value={support.assignedToAccountId ?? undefined} required /></ActionForm> : <p className="text-body">Assigned to {support.assignees.find((owner) => owner.id === support.assignedToAccountId)?.email ?? "Unassigned"}</p>}
          </Panel>
        </Section>

        <Section title="Related records">
          <Panel padded className="flex flex-col gap-4">
            {support.order ? <>
              <Link className={`${link} break-words`} href={`/admin/orders/${support.order.id}`}>Order {support.order.number} · {label(support.order.status)}</Link>
              <DetailList rows={[["Order total", support.order.totals.orderTotal === null ? "Pending shipping" : formatPeso(support.order.totals.orderTotal)], ["Net paid", formatPeso(support.order.totals.netPaid)], ["Balance", support.order.totals.balance === null ? "Pending shipping" : formatPeso(support.order.totals.balance)], ["After-sale refunds", formatPeso(support.order.totals.afterSaleRefunded)]]} />
              {support.order.status === "completed" && support.order.totals.balance !== null && support.order.totals.balance > 0 ? <div role="status"><Notice tone="warning" title={`Balance due after correction: ${formatPeso(support.order.totals.balance)}`} /></div> : null}
            </> : <p className={quiet}>No original order linked.</p>}
            <DetailList rows={[
              support.purchaser ? ["Purchaser", <Link key="p" className={link} href={`/admin/customers/purchasers/${support.purchaser.id}`}>{support.purchaser.name}</Link>] : null,
              support.account ? ["Account", <span key="a" className="break-words"><Link className={link} href={`/admin/customers/accounts/${support.accountId}`}>{support.account.email}</Link><span className={`${quiet} block`}>{label(support.account.role)} · {support.account.methods.join(", ")}</span></span>] : null,
            ]} />
            {support.linkedOrders.length ? <ul className="flex flex-col gap-1">{support.linkedOrders.map((order) => <li key={order.id}><Link className={`${link} inline-flex min-h-8 items-center`} href={`/admin/orders/${order.id}`}>Paid replacement order {order.number} · {label(order.status)}</Link></li>)}</ul> : null}
            {active ? <Link className={`${link} inline-flex min-h-8 items-center`} href={`/admin/orders/new?${new URLSearchParams({ supportCaseId: caseId, ...(support.purchaserId || support.order?.purchaserId ? { purchaserId: (support.purchaserId ?? support.order!.purchaserId) } : {}) })}`}>New replacement order</Link> : null}
          </Panel>
        </Section>

        <Section title="Cards" description="GRC corrections use case notes and shipments; there is no GRC Card workflow.">
          {support.cards.length ? <Panel><ul className="divide-y">{support.cards.map((card) => <li key={card.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 sm:px-5 py-3"><Link className={`${link} font-mono`} href={`/admin/inventory/cards/${card.id}`}>{card.kind?.toUpperCase() ?? "Unassigned"} …{card.suffix ?? card.id.slice(-4)}</Link><span className={quiet}>{card.role} · {card.state}</span></li>)}</ul></Panel> : <p className={quiet}>No cards linked.</p>}
        </Section>

        {active ? <Section title="Link related records" description="Links can only be added. Search by order number, purchaser name, Account email or the last four characters on a card.">
          <form className="flex flex-col gap-3"><FilterField label="Find related records" grow><Input name="q" maxLength={100} defaultValue={q} /></FilterField><button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border bg-background px-4 text-body font-medium nav-interact transition-colors hover:border-border-strong hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand md:min-h-9">Find records</button></form>
          <div className="flex flex-col gap-4">{(["orderId", "purchaserId", "accountId"] as const).filter((field) => !support[field]).map((field) => <Panel key={field} padded><ActionForm action={fillCaseLinkAction} submit={`Link ${field === "orderId" ? "order" : field === "purchaserId" ? "purchaser" : "Account"}`}>{hidden}<input name="field" type="hidden" value={field} /><LinkSelect name="value" label={field === "orderId" ? "Order" : field === "purchaserId" ? "Purchaser" : "Account"} choices={choices[field]} required /></ActionForm></Panel>)}<Panel padded><ActionForm action={linkCaseCardAction} submit="Link affected card">{hidden}<LinkSelect name="cardId" label="Affected card" choices={choices.cardId.filter((choice) => !support.cards.some((card) => card.id === choice.id))} required /></ActionForm></Panel></div>
        </Section> : null}
      </div>

      <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:gap-8 lg:row-start-1">
        <Section title="Requester">
          <Panel padded className="flex flex-col gap-4">
            <DetailList rows={[["Source", label(support.source ?? "owner")], support.requesterEmail ? ["Unverified contact", <span key="e" className="break-all">{support.requesterEmail}</span>] : null, support.requesterName ? ["Name", support.requesterName] : null]} />
            {support.requesterMessage ? <p className="rounded-lg border bg-canvas/60 p-4 text-body break-words whitespace-pre-wrap">{support.requesterMessage}</p> : null}
          </Panel>
        </Section>
        <CaseEmails caseId={caseId} recipient={recipient} active={active} failedKinds={failedKinds} />
        <CaseRecovery support={support} />
        <Section title="After-sale refunds">
          {support.refunds.length ? <Panel><ul className="divide-y">{support.refunds.map((refund) => <li key={refund.id} className="flex flex-col gap-0.5 px-4 sm:px-5 py-3"><p className={`text-body ${refund.voidedAt ? "line-through text-fg-secondary" : ""}`}>{formatPeso(refund.amount)} · {refund.method} · {refund.refundedOn}</p><p className={quiet}>{refund.reason}</p>{refund.voidedAt ? <p className={quiet}>Voided: {refund.voidReason}</p> : null}</li>)}</ul></Panel> : <p className={quiet}>No after-sale refunds from this case.</p>}
        </Section>
        <Section title="Support shipments">
          {support.shipments.length ? <Panel><ul className="divide-y">{support.shipments.map((shipment) => <li key={shipment.id} className="flex flex-col gap-1 px-4 sm:px-5 py-3.5 text-body"><div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1"><p className="font-medium">{shipment.courier} · {shipment.trackingNumber}</p><Status tone={shipmentTone(shipment.status)}>{label(shipment.status)}</Status></div><p className={quiet}>{shipment.shippedOn}{shipment.courierCost !== null ? ` · Cost ${formatPeso(shipment.courierCost)}` : ""}</p><p className={quiet}>{shipment.recipientName} {shipment.recipientContact}</p><p className={`${quiet} break-words whitespace-pre-wrap`}>{shipment.address}</p></li>)}</ul></Panel> : <p className={quiet}>No support shipments.</p>}
        </Section>
        <CaseCorrections support={support} />
        <Section title="Internal note">
          <Panel padded><ActionForm action={addCaseNoteAction} submit="Add note">{hidden}<label className={fieldLabel}>Note<Textarea name="note" required maxLength={500} /></label><p className={quiet}>Do not paste activation codes, identity documents or secrets.</p></ActionForm></Panel>
        </Section>
        <Section title="Activity">
          <Panel>{support.timeline.length ? <ul className="divide-y">{support.timeline.map((event) => <li key={event.id} className="flex flex-col gap-0.5 px-4 sm:px-5 py-3"><p className="text-body font-medium">{event.type.replaceAll("_", " ")}{event.actorAccountId === null ? " · System" : ""}</p>{event.note ? <Meta className="whitespace-pre-wrap">{event.note}</Meta> : null}<p className={`${quiet} tabular-nums`}>{formatDateTime(event.createdAt)}</p></li>)}</ul> : <p className="px-4 sm:px-5 py-4 text-meta text-fg-secondary">No activity yet.</p>}</Panel>
        </Section>
      </div>
    </div>
  </main>;
}
