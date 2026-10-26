import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Check, Circle, Clock, CreditCard, Package, ReceiptText } from "lucide-react";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { formatDate } from "@/lib/format-date";
import { formatPeso } from "@/lib/money";
import { inventoryReference } from "@/modules/inventory/operations-view";
import { getStockPurchase, listStockPurchaseCards } from "@/modules/inventory/stock-purchases";
import { adminPage, Disclosure, EmptyPanel, LinkButton, quietText } from "../../../ui";
import { Card, DetailHeader, KeyValueList, MetaRow, recordLink, StateText, SummaryStrip } from "../../../detail-ui";
import { StockPurchaseForm } from "../../forms";

export const instant = false;

const CARD_STATE: Record<string, string> = { blank: "Available blank", preparing: "Needs preparation", ready: "Ready", reserved: "Assigned", released: "Given out", retired: "Retired" };
const VISIBLE_CARDS = 24;
const money = (value: number | null) => (value === null ? "Not recorded" : formatPeso(value));

export default async function StockPurchasePage({ params }: Pick<PageProps<"/admin/inventory/stock/[stockPurchaseId]">, "params">) {
  await requireOwner();
  await connection();
  const { stockPurchaseId } = await params;
  if (!z.uuid().safeParse(stockPurchaseId).success) notFound();
  const purchase = await getStockPurchase(db, stockPurchaseId);
  if (!purchase) notFound();
  const cards = await listStockPurchaseCards(db, stockPurchaseId);

  // Allocation follows the order link, so a card being prepared for an order counts as allocated.
  const retired = cards.filter((card) => card.state === "retired").length;
  const allocated = cards.filter((card) => card.orderId && card.state !== "retired").length;
  const unassigned = cards.length - retired - allocated;
  const received = formatDate(new Date(`${purchase.receivedOn}T00:00:00+08:00`));
  const outcome = !purchase.quantity ? "No cards recorded" : allocated === 0 ? "No cards allocated yet" : unassigned === 0 && !retired ? "Every card is allocated" : `${allocated} of ${purchase.quantity} cards allocated`;
  const cardIcon = (state: string) => (state === "retired" ? Circle : state === "released" || state === "reserved" ? Check : Clock);
  const cardItem = (card: (typeof cards)[number]) => (
    <li key={card.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 sm:px-6">
      <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5">
        <Link href={`/admin/inventory/cards/${card.id}`} className={`${recordLink} font-mono font-medium`}>{inventoryReference(card.inventoryNumber)}</Link>
        <StateText icon={cardIcon(card.state)}>{CARD_STATE[card.state] ?? card.state}</StateText>
      </span>
      {card.orderId ? <Link href={`/admin/orders/${card.orderId}`} className={`${recordLink} shrink-0 text-meta`}>Order {card.orderNumber}</Link> : <span className={quietText}>No order</span>}
    </li>
  );

  return (
    <main data-admin-section="inventory" className={adminPage}>
      <DetailHeader
        back={{ href: "/admin/inventory?view=stock", label: "Stock purchases" }}
        title={<>Stock receipt{purchase.reference ? <span className="font-normal text-fg-secondary"> · {purchase.reference}</span> : null}</>}
        subtitle={`Received ${received}${purchase.supplier ? ` from ${purchase.supplier}` : ""}`}
        meta={<MetaRow items={[{ icon: Package, text: `${purchase.quantity} ${purchase.quantity === 1 ? "card" : "cards"} received` }, { icon: ReceiptText, text: outcome }]} />}
        actions={unassigned ? <LinkButton variant="action" icon={CreditCard} href="/admin/orders/new">Create order</LinkButton> : undefined}
      />

      <SummaryStrip label="Receipt summary" items={[
        { label: "Received", value: purchase.quantity },
        { label: "Remaining blank", value: unassigned, hint: unassigned ? "Not yet on an order" : undefined },
        { label: "Allocated", value: allocated, hint: allocated ? "On orders" : undefined },
        { label: "Retired", value: retired },
      ]} />

      <Card title="Receipt" icon={ReceiptText} description="What was bought and what it cost. Costs stay on this receipt.">
        <KeyValueList rows={[
          ["Supplier", purchase.supplier ?? "Not recorded"],
          ["Purchase cost", money(purchase.purchaseCost)],
          ["Reference", purchase.reference ?? "None"],
          ["Inbound shipping", money(purchase.inboundShippingCost)],
          purchase.notes ? ["Notes", <span key="notes" className="whitespace-pre-wrap">{purchase.notes}</span>] : null,
        ]} />
      </Card>

      {cards.length ? (
        <Card title="Cards from this receipt" icon={Package} description="Open a card to prepare it, or follow it to its order." flush>
          <ul className="divide-y">{cards.slice(0, VISIBLE_CARDS).map(cardItem)}</ul>
          {cards.length > VISIBLE_CARDS ? (
            <details className="group/more border-t">
              <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-meta font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="group-open/more:hidden">Show all {cards.length} cards</span>
                <span className="hidden group-open/more:inline">Show fewer</span>
              </summary>
              <ul className="divide-y border-t">{cards.slice(VISIBLE_CARDS).map(cardItem)}</ul>
            </details>
          ) : null}
        </Card>
      ) : (
        <EmptyPanel icon={Package} title="No cards on this receipt">Cards received here would be listed with the order each one serves.</EmptyPanel>
      )}

      <Disclosure summary="Edit receipt details">
        <StockPurchaseForm purchase={purchase} />
      </Disclosure>
    </main>
  );
}
