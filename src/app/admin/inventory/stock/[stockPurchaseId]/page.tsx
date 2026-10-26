import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { CreditCard, Package } from "lucide-react";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { formatDate } from "@/lib/format-date";
import { formatPeso } from "@/lib/money";
import { inventoryReference } from "@/modules/inventory/operations-view";
import { getStockPurchase, listStockPurchaseCards } from "@/modules/inventory/stock-purchases";
import { adminPage, cardTone, DetailList, Disclosure, EmptyPanel, inlineLink, LinkButton, PageHeader, Panel, quietText, Section, StatStrip, Status } from "../../../ui";
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
  const cardItem = (card: (typeof cards)[number]) => (
    <li key={card.id} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 sm:px-5 md:min-h-10">
      <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5">
        <Link href={`/admin/inventory/cards/${card.id}`} className="font-mono text-body font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand">{inventoryReference(card.inventoryNumber)}</Link>
        <Status tone={cardTone(card.state)}>{CARD_STATE[card.state] ?? card.state}</Status>
      </span>
      {card.orderId ? <Link href={`/admin/orders/${card.orderId}`} className={`${inlineLink} shrink-0 text-meta`}>Order {card.orderNumber}</Link> : <span className={quietText}>No order</span>}
    </li>
  );

  return (
    <main data-admin-section="inventory" className={adminPage}>
      <PageHeader
        back={{ href: "/admin/inventory?view=stock", label: "Stock purchases" }}
        title={<>Stock receipt{purchase.reference ? <span className="font-normal text-fg-secondary"> · {purchase.reference}</span> : null}</>}
        description={<span className="flex flex-col gap-1.5">
          <span>Received {received}{purchase.supplier ? ` from ${purchase.supplier}` : ""}</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1"><Status tone={allocated === 0 ? "neutral" : unassigned === 0 ? "success" : "warning"}>{outcome}</Status><span className="inline-flex items-center gap-1.5 text-meta font-medium text-foreground"><Package aria-hidden className="size-3.5 text-fg-secondary" />{purchase.quantity} {purchase.quantity === 1 ? "card" : "cards"} received</span></span>
        </span>}
        actions={unassigned ? <LinkButton variant="action" icon={CreditCard} href="/admin/orders/new">Create order</LinkButton> : undefined}
      />

      <StatStrip items={[
        { label: "Received", value: purchase.quantity },
        { label: "Remaining blank", value: unassigned, hint: unassigned ? "Not yet on an order" : undefined },
        { label: "Allocated", value: allocated, hint: allocated ? "On orders" : undefined },
        { label: "Retired", value: retired },
      ]} />

      <Section title="Receipt" description="What was bought and what it cost. Costs stay on this receipt.">
        <Panel padded>
          <DetailList rows={[
            ["Received on", received],
            ["Supplier", purchase.supplier ?? "Not recorded"],
            ["Reference", purchase.reference ?? "None"],
            ["Purchase cost", money(purchase.purchaseCost)],
            ["Inbound shipping", money(purchase.inboundShippingCost)],
            purchase.notes ? ["Notes", <span key="notes" className="whitespace-pre-wrap">{purchase.notes}</span>] : null,
          ]} />
        </Panel>
      </Section>

      <Section title="Cards from this receipt" description="Open a card to prepare it, or follow it to its order.">
        {cards.length ? (
          <Panel>
            <ul className="divide-y">{cards.slice(0, VISIBLE_CARDS).map(cardItem)}</ul>
            {cards.length > VISIBLE_CARDS ? (
              <details className="group/more border-t">
                <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-meta font-medium text-action-text hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className="group-open/more:hidden">Show all {cards.length} cards</span>
                  <span className="hidden group-open/more:inline">Show fewer</span>
                </summary>
                <ul className="divide-y border-t">{cards.slice(VISIBLE_CARDS).map(cardItem)}</ul>
              </details>
            ) : null}
          </Panel>
        ) : (
          <EmptyPanel icon={Package} title="No cards on this receipt">Cards received here would be listed with the order each one serves.</EmptyPanel>
        )}
      </Section>

      <Disclosure summary="Edit receipt details">
        <StockPurchaseForm purchase={purchase} />
      </Disclosure>
    </main>
  );
}
